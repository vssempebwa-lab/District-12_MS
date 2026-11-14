import type { TenantId } from "@d12/contracts";
import {
  SESSION_COOKIE,
  canAccessTenant,
  hasPermission,
  readSessionToken,
  type SessionClaims,
} from "./session";

export function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    const key = pair.slice(0, separator).trim();
    if (!key) continue;
    const raw = pair.slice(separator + 1).trim();
    try {
      cookies[key] = decodeURIComponent(raw);
    } catch {
      cookies[key] = raw;
    }
  }
  return cookies;
}

export async function sessionFromRequest(request: Request): Promise<SessionClaims | null> {
  const cookies = parseCookies(request.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  return readSessionToken(token);
}

export type GuardResult =
  | { ok: true; session: SessionClaims }
  | { ok: false; status: 401 | 403; message: string };

export async function guardTenant(request: Request, tenant: TenantId): Promise<GuardResult> {
  const session = await sessionFromRequest(request);
  if (!session) return { ok: false, status: 401, message: "Sign in to continue" };
  if (!canAccessTenant(session, tenant)) {
    return { ok: false, status: 403, message: "You do not have access to this subsidiary" };
  }
  return { ok: true, session };
}

export async function guardPermission(
  request: Request,
  permission: string,
  tenant?: TenantId,
): Promise<GuardResult> {
  const session = await sessionFromRequest(request);
  if (!session) return { ok: false, status: 401, message: "Sign in to continue" };
  if (tenant && !canAccessTenant(session, tenant)) {
    return { ok: false, status: 403, message: "You do not have access to this subsidiary" };
  }
  if (!hasPermission(session, permission, tenant)) {
    return { ok: false, status: 403, message: `Missing permission: ${permission}` };
  }
  return { ok: true, session };
}

export async function guardGlobalPermission(
  request: Request,
  permission: string,
): Promise<GuardResult> {
  const session = await sessionFromRequest(request);
  if (!session) return { ok: false, status: 401, message: "Sign in to continue" };
  if (session.scope !== "group" || !hasPermission(session, permission)) {
    return { ok: false, status: 403, message: `Missing permission: ${permission}` };
  }
  return { ok: true, session };
}
