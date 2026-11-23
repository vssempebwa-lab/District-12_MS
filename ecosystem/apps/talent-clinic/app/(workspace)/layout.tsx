import type { ReactNode } from "react";
import type { ProjectRecord } from "@d12/contracts";
import { TenantShell } from "@d12/tenant-workspace";
import { getUserProfile, listEntity, primaryRoleLabel, requireTenantPage } from "@d12/tenant-workspace/server";
import { TENANT, TENANT_ID } from "@/lib/tenant";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await requireTenantPage(TENANT_ID);
  const [profile, projects] = await Promise.all([
    getUserProfile(session.sub),
    listEntity(TENANT_ID, "projects"),
  ]);
  const cohortLinks = (projects as ProjectRecord[]).map((project) => ({
    id: project.id,
    code: project.client || "",
    label: project.client ? `${project.client} — ${project.name}` : project.name,
  }));

  return (
    <TenantShell
      tenant={TENANT}
      userName={profile.displayName || session.name}
      roleLabel={profile.title || primaryRoleLabel(session)}
      permissions={session.permissions}
      shiftStartedAt={new Date(session.iat * 1000).toISOString()}
      accent={profile.accent}
      density={profile.density}
      cohortLinks={cohortLinks}
    >
      {children}
    </TenantShell>
  );
}
