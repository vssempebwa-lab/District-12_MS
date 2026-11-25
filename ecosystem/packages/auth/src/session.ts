import {
  TENANT_IDS,
  permissionsForRoles,
  scopeForRoles,
  type RoleId,
  type SessionView,
  type TenantId,
  tenantAppUrl,
} from "@d12/contracts";
import { signJwt, verifyJwt, type JwtPayload } from "./jwt";

export const SESSION_COOKIE = "d12_session";
export const TENANT_COOKIE = "d12_tenant";
export const SESSION_ISSUER = "district12";

const DEV_SECRET = "d12-dev-session-secret-change-me";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  roles: RoleId[];
  tenants: TenantId[];
  homeTenant: TenantId | null;
  mustChangePassword?: boolean;
}

export interface SessionClaims extends JwtPayload {
  sub: string;
  email: string;
  name: string;
  scope: "group" | "tenant";
  roles: RoleId[];
  permissions: string[];
  tenants: TenantId[];
  homeTenant: TenantId | null;
  mustChangePassword: boolean;
  iss: string;
}

export function isDemoMode(): boolean {
  const flag = process.env.D12_DEMO_MODE?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  // Development keeps the seeded demo directory, production never does.
  return process.env.NODE_ENV !== "production";
}

export function getSessionSecret(): string {
  const secret = process.env.D12_SESSION_SECRET?.trim();
  if (secret) {
    if (secret.length < 32) {
      throw new Error("D12_SESSION_SECRET must be at least 32 characters");
    }
    return secret;
  }
  if (isDemoMode()) return DEV_SECRET;
  throw new Error("D12_SESSION_SECRET must be set to at least 32 characters when demo mode is off");
}

export function getSessionTtlSeconds(): number {
  const hours = Number(process.env.D12_SESSION_TTL_HOURS ?? "12");
  return (Number.isFinite(hours) && hours > 0 ? hours : 12) * 60 * 60;
}

export function buildClaims(user: SessionUser, ttlSeconds: number = getSessionTtlSeconds()): SessionClaims {
  const scope = scopeForRoles(user.roles);
  const tenants = scope === "group" ? [...TENANT_IDS] : user.tenants;
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: user.id,
    email: user.email,
    name: user.name,
    scope,
    roles: user.roles,
    permissions: permissionsForRoles(user.roles),
    tenants,
    homeTenant: user.homeTenant,
    mustChangePassword: user.mustChangePassword === true,
    iss: SESSION_ISSUER,
    iat: now,
    exp: now + ttlSeconds,
  };
}

export async function createSessionToken(
  user: SessionUser,
  ttlSeconds: number = getSessionTtlSeconds(),
): Promise<string> {
  return signJwt(buildClaims(user, ttlSeconds), getSessionSecret(), ttlSeconds);
}

export async function readSessionToken(token: string): Promise<SessionClaims | null> {
  const claims = await verifyJwt<SessionClaims>(token, getSessionSecret());
  if (!claims || claims.iss !== SESSION_ISSUER || !Array.isArray(claims.tenants)) return null;
  return { ...claims, mustChangePassword: claims.mustChangePassword === true };
}

export function canAccessTenant(session: SessionClaims | null, tenant: TenantId): boolean {
  if (!session) return false;
  return session.tenants.includes(tenant);
}

export function hasPermission(
  session: SessionClaims | null,
  permission: string,
  tenant?: TenantId,
): boolean {
  if (!session) return false;
  if (tenant && !session.tenants.includes(tenant)) return false;
  return session.permissions.includes("*") || session.permissions.includes(permission);
}

export type Landing =
  | { kind: "hub"; path: string }
  | { kind: "tenant"; tenant: TenantId; path: string };

export function landingFor(session: SessionClaims): Landing {
  if (session.scope === "group") {
    const path = session.roles.includes("group_admin")
      ? "/dashboard"
      : session.roles.includes("hr_admin") ? "/hr" : "/finance";
    return { kind: "hub", path };
  }
  const tenant = session.homeTenant ?? session.tenants[0];
  if (!tenant) return { kind: "hub", path: "/login" };
  const path = session.roles.includes("hr_officer")
    ? "/staff"
    : session.roles.includes("accountant")
      ? "/transactions"
      : session.roles.includes("account_executive")
        ? "/leads"
        : "/";
  return { kind: "tenant", tenant, path };
}

export function safeLocalPath(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export function tenantCallbackUrl(token: string, tenant: TenantId, next = "/"): string {
  const url = new URL("/auth/callback", tenantAppUrl(tenant));
  url.searchParams.set("token", token);
  if (next !== "/") url.searchParams.set("next", next);
  return url.toString();
}

export function claimsToUser(session: SessionClaims): SessionUser {
  return {
    id: session.sub,
    email: session.email,
    name: session.name,
    roles: session.roles,
    tenants: session.tenants,
    homeTenant: session.homeTenant,
    mustChangePassword: session.mustChangePassword === true,
  };
}

export function sessionToView(session: SessionClaims): SessionView {
  return {
    user: { id: session.sub, email: session.email, name: session.name },
    scope: session.scope,
    roles: session.roles,
    permissions: session.permissions,
    tenants: session.tenants,
    homeTenant: session.homeTenant,
    expiresAt: new Date(session.exp * 1000).toISOString(),
  };
}

const COOKIE_DOMAIN_PATTERN = /^\.?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export function normalizeCookieDomain(raw: string | null | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  const host = value
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .split(/[/?#]/, 1)[0]
    .split(":")[0]
    .replace(/\.$/, "")
    .toLowerCase();
  if (!COOKIE_DOMAIN_PATTERN.test(host)) {
    throw new Error(
      `D12_COOKIE_DOMAIN "${value}" is not a valid cookie domain; use a bare domain such as .district12.co.ug`,
    );
  }
  return host;
}

function cookieDomain(): string | undefined {
  return normalizeCookieDomain(process.env.D12_COOKIE_DOMAIN);
}

export function sessionCookie(token: string, maxAgeSeconds: number = getSessionTtlSeconds()): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  const domain = cookieDomain();
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join("; ");
}

export function clearSessionCookie(): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  const domain = cookieDomain();
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join("; ");
}
