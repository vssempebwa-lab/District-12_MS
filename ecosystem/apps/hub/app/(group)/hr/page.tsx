import { HrDashboard } from "@/components/hr-dashboard";
import { Card } from "@d12/ui";
import { listAudit } from "@/lib/accounts";
import { HubRecordError, listHubRecords } from "@/lib/records";
import { requirePermissionPage } from "@/lib/session-server";

export const metadata = { title: "HR Dashboard — District 12" };
export const dynamic = "force-dynamic";

export default async function HrPage() {
  await requirePermissionPage("hr.manage");
  try {
    const [workflows, audit] = await Promise.all([listHubRecords(["employees", "attendance", "leave"]), listAudit(12)]);
    return <HrDashboard records={workflows.records} audit={audit} now={Date.now()} mode={workflows.mode} />;
  } catch (error) {
    return <Card className="space-y-2 p-5"><h1 className="text-xl font-semibold text-navy">HR records are unavailable</h1><p className="text-sm text-ink-soft">{error instanceof HubRecordError ? error.message : "Check the database connection and workflow migration."}</p></Card>;
  }
}
