import { hubToday, TENANT_IDS } from "@d12/contracts";
import { Card } from "@d12/ui";
import { buildHrReport } from "@/lib/hr-report";
import { HubRecordError, listHubRecords } from "@/lib/records";
import { requirePermissionPage } from "@/lib/session-server";
import { HrReportView } from "./hr-report-view";

export async function HrReportsPage({ searchParams }: { searchParams: { month?: string; tenant?: string } }) {
  await requirePermissionPage("hr.reports");
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.month ?? "") ? searchParams.month! : hubToday().slice(0, 7);
  const tenant = ["all", "group", ...TENANT_IDS].includes(searchParams.tenant ?? "") ? searchParams.tenant! : "all";
  try {
    const { records, mode } = await listHubRecords(["employees", "attendance", "leave", "payroll", "performance", "vacancies", "applications", "training", "enrolments", "group_settings"]);
    const organizationName = String(records.find((record) => record.kind === "group_settings")?.data.organizationName ?? "District 12 Group");
    return <HrReportView report={buildHrReport(records, month, tenant)} month={month} tenant={tenant} mode={mode} organizationName={organizationName} />;
  } catch (error) {
    return <Card className="space-y-2 p-5"><h1 className="text-xl font-semibold text-navy">HR reports unavailable</h1><p className="text-sm text-ink-soft">{error instanceof HubRecordError ? error.message : "Check workflow storage and the database connection."}</p></Card>;
  }
}
