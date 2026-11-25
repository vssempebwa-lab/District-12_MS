import { CheckCircle2, FileText, Inbox, Building2 } from "lucide-react";
import { TENANTS, type TenantId } from "@d12/contracts";
import { Badge, PageHeader, StatCard } from "@d12/ui";
import { ReportInbox } from "@/components/report-inbox";
import { listGroupReports } from "@/lib/reports";
import { requirePermissionPage } from "@/lib/session-server";

export const metadata = { title: "Subsidiary reports — District 12" };
export const dynamic = "force-dynamic";

export default async function GroupReportsPage() {
  const session = await requirePermissionPage("reports.read");
  const { reports, mode } = await listGroupReports(session);

  const awaiting = reports.filter((report) => report.status === "submitted");
  const acknowledged = reports.filter((report) => report.status === "acknowledged");
  const subsidiaries = new Set(reports.map((report) => report.tenantId));
  const role = session.roles[0] ?? "";
  const description =
    role === "hr_admin"
      ? "People reports filed by subsidiary HR officers, routed to the group HR desk."
      : role === "group_accountant"
        ? "Finance and invoice reports filed by subsidiary accountants, routed to group finance."
        : "Reports from subsidiary managers, HR officers and accountants, consolidated for the group administrator.";

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Reporting line"
        title="Subsidiary reports"
        description={description}
        actions={
          <>
            <Badge tone={mode === "supabase" ? "success" : "warning"}>
              {mode === "supabase" ? "Live records" : "Demo records"}
            </Badge>
            <Badge tone="info">
              {Array.from(subsidiaries)
                .map((tenant) => TENANTS[tenant as TenantId]?.shortName ?? tenant)
                .join(", ") || "No subsidiaries yet"}
            </Badge>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Reports" value={reports.length} hint="Visible to your desk" icon={<FileText className="h-4 w-4" />} />
        <StatCard
          label="Awaiting review"
          value={awaiting.length}
          hint="Not yet acknowledged"
          icon={<Inbox className="h-4 w-4" />}
          accent="amber"
        />
        <StatCard
          label="Acknowledged"
          value={acknowledged.length}
          hint="Confirmed by the receiving desk"
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="green"
        />
        <StatCard
          label="Subsidiaries"
          value={subsidiaries.size}
          hint="Reporting into your desk"
          icon={<Building2 className="h-4 w-4" />}
          accent="violet"
        />
      </div>

      <ReportInbox reports={reports} />
    </div>
  );
}
