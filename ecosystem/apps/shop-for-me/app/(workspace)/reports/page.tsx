import { notFound } from "next/navigation";
import { hasPermission } from "@d12/auth";
import type { InvoiceRecord, LeadRecord, SaleRecord, TransactionRecord } from "@d12/contracts";
import { WorkspaceReports, buildReportData, normalizeReportWindow } from "@d12/tenant-workspace/server";
import { listEntity, requireTenantPage } from "@d12/tenant-workspace/server";
import { TENANT, TENANT_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports — Shop For Me" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { window?: string | string[] };
}) {
  const session = await requireTenantPage(TENANT_ID, "/reports");
  if (!hasPermission(session, "reports.read", TENANT_ID) || !hasPermission(session, "sales.read", TENANT_ID)) {
    notFound();
  }
  const windowDays = normalizeReportWindow(searchParams.window);

  const [sales, transactions, invoices, leads] = await Promise.all([
    listEntity(TENANT_ID, "sales"),
    listEntity(TENANT_ID, "transactions"),
    listEntity(TENANT_ID, "invoices"),
    listEntity(TENANT_ID, "leads"),
  ]);

  const saleRows = sales as SaleRecord[];
  const data = buildReportData(
    {
      sales: saleRows,
      transactions: transactions as TransactionRecord[],
      invoices: invoices as InvoiceRecord[],
      leads: leads as LeadRecord[],
    },
    windowDays,
  );
  const lastSaleAt =
    saleRows
      .slice()
      .sort((left, right) => String(right.occurredOn).localeCompare(String(left.occurredOn)))
      .at(0)?.occurredOn ?? null;

  return <WorkspaceReports tenant={TENANT} data={data} lastSaleAt={lastSaleAt} />;
}
