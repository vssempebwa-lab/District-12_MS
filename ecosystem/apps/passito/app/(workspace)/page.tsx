import { WorkspaceDashboard, getWorkspaceOverview } from "@d12/tenant-workspace/server";
import { personalWorkName, requireTenantPage } from "@d12/tenant-workspace/server";
import { TENANT, TENANT_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const session = await requireTenantPage(TENANT_ID);
  const overview = await getWorkspaceOverview(TENANT_ID);

  return (
    <WorkspaceDashboard
      tenant={TENANT}
      userName={session.name}
      overview={overview}
      permissions={session.permissions}
      personal={personalWorkName(session) !== null}
    />
  );
}
