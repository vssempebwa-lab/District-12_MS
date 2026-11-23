import { requireTenantPage } from "@d12/tenant-workspace/server";
import { listEntity } from "@d12/tenant-workspace/server";
import type { CustomerRecord, ProjectRecord } from "@d12/contracts";
import { TENANT_ID } from "@/lib/tenant";
import CohortDashboard from "./cohort-dashboard";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  await requireTenantPage(TENANT_ID);
  const [projectRows, customerRows] = await Promise.all([
    listEntity(TENANT_ID, "projects"),
    listEntity(TENANT_ID, "customers"),
  ]);
  return (
    <CohortDashboard
      initialCohorts={projectRows as ProjectRecord[]}
      initialParticipants={customerRows as CustomerRecord[]}
      tenantId={TENANT_ID}
    />
  );
}