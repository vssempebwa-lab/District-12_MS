import type { ReactNode } from "react";
import { TenantShell } from "@d12/tenant-workspace";
import { getUserProfile, primaryRoleLabel, requireTenantPage } from "@d12/tenant-workspace/server";
import { TENANT, TENANT_ID } from "@/lib/tenant";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await requireTenantPage(TENANT_ID);
  const profile = await getUserProfile(session.sub);

  return (
    <TenantShell
      tenant={TENANT}
      userName={profile.displayName || session.name}
      roleLabel={profile.title || primaryRoleLabel(session)}
      permissions={session.permissions}
      shiftStartedAt={new Date(session.iat * 1000).toISOString()}
      accent={profile.accent}
      density={profile.density}
    >
      {children}
    </TenantShell>
  );
}
