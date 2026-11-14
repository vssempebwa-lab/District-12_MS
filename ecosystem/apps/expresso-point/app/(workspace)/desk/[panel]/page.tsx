import { WorkspaceDeskPage } from "@d12/tenant-workspace/server";
import { TENANT_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function DeskPanelPage({ params }: { params: { panel: string } }) {
  return <WorkspaceDeskPage panel={params.panel} tenantId={TENANT_ID} />;
}
