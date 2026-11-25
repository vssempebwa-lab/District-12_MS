import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  buildClaims,
  createSessionToken,
  getSessionSecret,
  isDemoMode,
  landingFor,
  parseCookies,
  safeLocalPath,
  sessionCookie,
  signJwt,
  tenantCallbackUrl,
  verifyJwt,
  type JwtPayload,
  type SessionUser,
} from "@d12/auth";
import { configuredTenantAppUrl } from "@d12/contracts";
import { createServiceClient, hasServiceRoleEnv } from "@d12/db";
import { jsonError } from "@/lib/http";
import { sendTwoFactorCode } from "@/lib/mail";

// Email two-factor sign-in. After the password checks out, the hub emails a
// one-time 6-digit code. The pending sign-in lives in a short-lived signed
// cookie (d12_2fa); the code itself is only stored as an HMAC, with attempts
// and expiry tracked server side so a replayed cookie cannot reset them.

export const TWO_FACTOR_COOKIE = "d12_2fa";
export const CODE_TTL_MINUTES = 10;
const CODE_TTL_SECONDS = CODE_TTL_MINUTES * 60;
const MAX_ATTEMPTS = 5;
const MAX_RESENDS = 3;
export const RESEND_COOLDOWN_SECONDS = 30;
const USER_WINDOW_MINUTES = 15;
const MAX_CHALLENGES_PER_WINDOW = 5;
const PURPOSE = "d12-2fa";

export class TwoFactorError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly restart = false,
  ) {
    super(message);
  }
}

/** JSON error for the sign-in form; `restart` tells it to go back to the password step. */
export function twoFactorErrorResponse(error: TwoFactorError): NextResponse {
  const code = error.status === 503 ? "UPSTREAM_FAILED" : "UNAUTHORIZED";
  const response = jsonError(code, error.message, error.status, { restart: error.restart });
  if (error.restart) response.headers.append("set-cookie", clearPendingCookie());
  return response;
}

/**
 * Two-factor is on unless D12_TWO_FACTOR=off (break-glass, e.g. while SMTP is
 * broken). Seeded demo accounts skip it unless D12_TWO_FACTOR=demo, which lets
 * the flow be tried locally; in demo mode the code is also logged to the server
 * console when mail is not set up.
 */
export function twoFactorRequired(isDemoUser: boolean): boolean {
  const flag = process.env.D12_TWO_FACTOR?.trim().toLowerCase();
  if (flag === "off" || flag === "false") return false;
  if (isDemoUser) return flag === "demo" && isDemoMode();
  return true;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, Math.max(1, local.length - 1)));
  return `${visible}${"•".repeat(Math.max(1, Math.min(6, local.length - visible.length)))}@${domain}`;
}

// ---------------------------------------------------------------------------
// Challenge store: Supabase table d12_two_factor_challenges, or memory when the
// service role is not configured (local demo).
// ---------------------------------------------------------------------------

interface ChallengeRow {
  id: string;
  userId: string;
  codeHash: string;
  attempts: number;
  expiresAt: number;
  consumedAt: number | null;
  createdAt: number;
}

const memory = globalThis as typeof globalThis & { __d12TwoFactor?: ChallengeRow[] };
function memoryRows(): ChallengeRow[] {
  return (memory.__d12TwoFactor ??= []);
}

const useDb = () => hasServiceRoleEnv() && !isDemoMode();
const TABLE = "d12_two_factor_challenges";

async function insertChallenge(row: ChallengeRow): Promise<void> {
  if (!useDb()) {
    const rows = memoryRows();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    memory.__d12TwoFactor = [...rows.filter((r) => r.createdAt > cutoff), row];
    return;
  }
  const { error } = await createServiceClient().from(TABLE).insert({
    id: row.id,
    user_id: row.userId,
    code_hash: row.codeHash,
    attempts: 0,
    expires_at: new Date(row.expiresAt).toISOString(),
    created_at: new Date(row.createdAt).toISOString(),
  });
  if (error) throw error;
}

async function readChallenge(id: string): Promise<ChallengeRow | null> {
  if (!useDb()) return memoryRows().find((row) => row.id === id) ?? null;
  const { data, error } = await createServiceClient()
    .from(TABLE)
    .select("id, user_id, code_hash, attempts, expires_at, consumed_at, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as {
    id: string;
    user_id: string;
    code_hash: string;
    attempts: number;
    expires_at: string;
    consumed_at: string | null;
    created_at: string;
  };
  return {
    id: row.id,
    userId: row.user_id,
    codeHash: row.code_hash,
    attempts: row.attempts,
    expiresAt: Date.parse(row.expires_at),
    consumedAt: row.consumed_at ? Date.parse(row.consumed_at) : null,
    createdAt: Date.parse(row.created_at),
  };
}

async function updateChallenge(id: string, patch: { attempts?: number; consumed?: boolean }): Promise<void> {
  const consumedAt = patch.consumed ? Date.now() : undefined;
  if (!useDb()) {
    const row = memoryRows().find((candidate) => candidate.id === id);
    if (row) {
      if (patch.attempts !== undefined) row.attempts = patch.attempts;
      if (consumedAt !== undefined) row.consumedAt = consumedAt;
    }
    return;
  }
  const update: Record<string, unknown> = {};
  if (patch.attempts !== undefined) update.attempts = patch.attempts;
  if (consumedAt !== undefined) update.consumed_at = new Date(consumedAt).toISOString();
  let query = createServiceClient().from(TABLE).update(update).eq("id", id);
  // Consuming only succeeds once, so two racing correct guesses cannot both sign in.
  if (patch.consumed) query = query.is("consumed_at", null);
  const { error } = await query;
  if (error) throw error;
}

async function recentChallengeCount(userId: string): Promise<number> {
  const since = Date.now() - USER_WINDOW_MINUTES * 60 * 1000;
  if (!useDb()) return memoryRows().filter((row) => row.userId === userId && row.createdAt > since).length;
  const { count, error } = await createServiceClient()
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gt("created_at", new Date(since).toISOString());
  if (error) throw error;
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Codes and the pending sign-in cookie
// ---------------------------------------------------------------------------

function hashCode(challengeId: string, code: string): string {
  return createHmac("sha256", getSessionSecret()).update(`${PURPOSE}:${challengeId}:${code}`).digest("hex");
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

interface PendingSignIn extends JwtPayload {
  purpose: typeof PURPOSE;
  cid: string;
  user: SessionUser;
  next: string;
  resends: number;
}

function pendingCookie(token: string, maxAgeSeconds = CODE_TTL_SECONDS): string {
  const parts = [
    `${TWO_FACTOR_COOKIE}=${token}`,
    "Path=/api/auth",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearPendingCookie(): string {
  return pendingCookie("", 0);
}

export async function readPendingSignIn(request: Request): Promise<PendingSignIn | null> {
  const token = parseCookies(request.headers.get("cookie"))[TWO_FACTOR_COOKIE];
  if (!token) return null;
  const pending = await verifyJwt<PendingSignIn>(token, getSessionSecret());
  if (!pending || pending.purpose !== PURPOSE || typeof pending.cid !== "string" || !pending.user?.id) return null;
  return pending;
}

async function issueChallenge(user: SessionUser, next: string, resends: number): Promise<string> {
  if ((await recentChallengeCount(user.id)) >= MAX_CHALLENGES_PER_WINDOW) {
    throw new TwoFactorError(
      `Too many sign-in codes were requested. Wait ${USER_WINDOW_MINUTES} minutes and try again.`,
      429,
      true,
    );
  }

  const id = randomUUID();
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const now = Date.now();
  await insertChallenge({
    id,
    userId: user.id,
    codeHash: hashCode(id, code),
    attempts: 0,
    expiresAt: now + CODE_TTL_SECONDS * 1000,
    consumedAt: null,
    createdAt: now,
  });

  const mail = await sendTwoFactorCode({ name: user.name, email: user.email, code, minutes: CODE_TTL_MINUTES });
  if (!mail.sent) {
    if (isDemoMode()) {
      console.info(`[d12] demo two-factor code for ${user.email}: ${code} (${mail.detail})`);
    } else {
      await updateChallenge(id, { consumed: true });
      console.error("[d12] two-factor code could not be sent", mail.detail);
      throw new TwoFactorError(
        "Your sign-in code could not be emailed. Ask the group administrator to check the mail settings.",
        503,
        true,
      );
    }
  }

  const pending: Omit<PendingSignIn, "iat" | "exp"> = { purpose: PURPOSE, cid: id, user, next, resends };
  return signJwt(pending, getSessionSecret(), CODE_TTL_SECONDS);
}

/** Start the second step for a user whose password was accepted. */
export async function startTwoFactor(user: SessionUser, next: string): Promise<NextResponse> {
  const token = await issueChallenge(user, next, 0);
  return NextResponse.json(
    { ok: true, twoFactor: true, email: maskEmail(user.email), resendAfter: RESEND_COOLDOWN_SECONDS },
    { headers: { "set-cookie": pendingCookie(token) } },
  );
}

/** Check a submitted code. Returns the user on success. */
export async function verifyTwoFactor(pending: PendingSignIn, code: string): Promise<SessionUser> {
  const row = await readChallenge(pending.cid);
  if (!row || row.userId !== pending.user.id || row.consumedAt !== null || row.expiresAt <= Date.now()) {
    throw new TwoFactorError("This sign-in code has expired. Sign in again to get a new one.", 401, true);
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await updateChallenge(row.id, { consumed: true });
    throw new TwoFactorError("Too many incorrect codes. Sign in again to get a new one.", 429, true);
  }
  if (!/^\d{6}$/.test(code) || !sameHash(row.codeHash, hashCode(row.id, code))) {
    const attempts = row.attempts + 1;
    const left = MAX_ATTEMPTS - attempts;
    await updateChallenge(row.id, { attempts, consumed: left <= 0 });
    if (left <= 0) throw new TwoFactorError("Too many incorrect codes. Sign in again to get a new one.", 429, true);
    throw new TwoFactorError(`That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.`, 401);
  }
  await updateChallenge(row.id, { consumed: true });
  return pending.user;
}

/** Email a fresh code for the pending sign-in, retiring the old one. */
export async function resendTwoFactor(pending: PendingSignIn): Promise<NextResponse> {
  const row = await readChallenge(pending.cid);
  if (!row || row.consumedAt !== null || row.userId !== pending.user.id) {
    throw new TwoFactorError("This sign-in has expired. Sign in again to get a new code.", 401, true);
  }
  const wait = Math.ceil((row.createdAt + RESEND_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000);
  if (wait > 0) throw new TwoFactorError(`Wait ${wait} seconds before asking for another code.`, 429);
  if (pending.resends >= MAX_RESENDS) {
    throw new TwoFactorError("No more codes can be sent for this sign-in. Sign in again to start over.", 429, true);
  }
  await updateChallenge(row.id, { consumed: true });
  const token = await issueChallenge(pending.user, pending.next, pending.resends + 1);
  return NextResponse.json(
    { ok: true, email: maskEmail(pending.user.email), resendAfter: RESEND_COOLDOWN_SECONDS },
    { headers: { "set-cookie": pendingCookie(token) } },
  );
}

/** Issue the session cookie and pick where the browser goes next. */
export async function completeSignIn(user: SessionUser, next: string): Promise<NextResponse> {
  const claims = buildClaims(user);
  const token = await createSessionToken(user);
  const landing = landingFor(claims);
  const redirectTo = claims.mustChangePassword
    ? "/account/password"
    : landing.kind === "tenant" && configuredTenantAppUrl(landing.tenant)
      ? tenantCallbackUrl(token, landing.tenant, landing.path)
      : safeLocalPath(next, landing.kind === "hub" ? landing.path : "/dashboard");

  const response = NextResponse.json({
    ok: true,
    redirect: redirectTo,
    user: { id: claims.sub, email: claims.email, name: claims.name },
    scope: claims.scope,
    tenants: claims.tenants,
  });
  response.headers.append("set-cookie", sessionCookie(token));
  response.headers.append("set-cookie", clearPendingCookie());
  return response;
}
