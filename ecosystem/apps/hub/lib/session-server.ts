import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  claimsToUser,
  createSessionToken,
  hasPermission,
  landingFor,
  readSessionToken,
  tenantCallbackUrl,
  type SessionClaims,
} from "@d12/auth";
import { isGlobalRole, permissionsForRoles, roleMeta } from "@d12/contracts";
import { listAccounts } from "./accounts";

export async function getHubSession(): Promise<SessionClaims | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await readSessionToken(token);
  if (!session || session.scope !== "group") return session;
  const { accounts } = await listAccounts();
  const account = accounts.find((entry) => entry.id === session.sub);
  if (!account || account.status !== "active") return null;
  const group = isGlobalRole(account.role);
  return { ...session, name: account.name, email: account.email, roles: [account.role], permissions: permissionsForRoles([account.role]), tenants: account.tenants, scope: group ? "group" : "tenant", homeTenant: group ? null : account.tenants[0] ?? null };
}

export async function requireGroupPage(): Promise<SessionClaims> {
  const session = await getHubSession();
  if (!session) redirect("/login");

  if (session.scope !== "group") {
    const landing = landingFor(session);
    if (landing.kind === "tenant") {
      const token = await createSessionToken(claimsToUser(session));
      redirect(tenantCallbackUrl(token, landing.tenant, landing.path));
    }
    redirect("/login");
  }
  return session;
}

export async function requirePermissionPage(permission: string): Promise<SessionClaims> {
  const session = await requireGroupPage();
  if (!hasPermission(session, permission)) {
    const landing = landingFor(session);
    redirect(landing.kind === "hub" ? landing.path : "/login");
  }
  return session;
}

export function primaryRoleLabel(session: SessionClaims): string {
  const highest = session.roles
    .slice()
    .sort((left, right) => (roleMeta(right)?.rank ?? 0) - (roleMeta(left)?.rank ?? 0))[0];
  return roleMeta(highest ?? "")?.label ?? "Member";
}
