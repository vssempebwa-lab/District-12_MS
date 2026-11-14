import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  canAccessTenant,
  readSessionToken,
  type SessionClaims,
} from "@d12/auth";
import { roleMeta, type TenantId } from "@d12/contracts";

export async function getTenantSession(tenantId: TenantId): Promise<SessionClaims | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await readSessionToken(token);
  if (!session || !canAccessTenant(session, tenantId)) return null;
  return session;
}

export async function requireTenantPage(
  tenantId: TenantId,
  next = "/",
): Promise<SessionClaims> {
  const session = await getTenantSession(tenantId);
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return session;
}

/** Employees work on their own assignments; every other role sees the whole subsidiary. */
export function personalWorkName(session: SessionClaims): string | null {
  const employeeRank = roleMeta("employee")?.rank ?? 0;
  if (!session.roles.includes("employee")) return null;
  const highest = session.roles.reduce((rank, role) => Math.max(rank, roleMeta(role)?.rank ?? 0), 0);
  return highest <= employeeRank ? session.name : null;
}

export function primaryRoleLabel(session: SessionClaims): string {
  const highest = session.roles
    .slice()
    .sort((left, right) => (roleMeta(right)?.rank ?? 0) - (roleMeta(left)?.rank ?? 0))[0];
  return roleMeta(highest ?? "")?.label ?? "Team member";
}
