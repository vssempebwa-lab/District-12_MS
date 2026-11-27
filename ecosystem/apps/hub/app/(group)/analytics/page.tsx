import Link from "next/link";
import { hasPermission } from "@d12/auth";
import { Badge, Card, MiniBars, Panel, StatCard, TableShell, Td, Th } from "@d12/ui";
import { WarehouseWindowTabs } from "@/components/warehouse-window-tabs";
import { formatUgx, shortDay } from "@/lib/format";
import { getWarehouseOverview } from "@/lib/warehouse";
import { listHubRecords } from "@/lib/records";
import { requirePermissionPage } from "@/lib/session-server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Group analytics — District 12" };
export default async function AnalyticsPage({ searchParams }: { searchParams: { window?: string } }) {
  const session = await requirePermissionPage("reports.read");
  let organizationName = "District 12 Group";
  let defaultWindow = 30;
  try {
    const { records } = await listHubRecords(["group_settings"]);
    const settings = records[0]?.data;
    organizationName = String(settings?.organizationName ?? organizationName);
    defaultWindow = Number(settings?.reportingDays ?? defaultWindow);
  } catch { /* Keep warehouse reporting available before workflow storage is configured. */ }
  const requested = Number(searchParams.window ?? defaultWindow);
  const windowDays = [14, 30, 90].includes(requested) ? requested : defaultWindow;
  const overview = await getWarehouseOverview(windowDays);
  const revenue = overview.daily.reduce((sum, point) => sum + point.revenue, 0);
  const expenses = overview.daily.reduce((sum, point) => sum + point.expenses, 0);
  const leads = overview.daily.reduce((sum, point) => sum + point.leads, 0);
  const tasks = overview.daily.reduce((sum, point) => sum + point.tasks, 0);
  let workforce: { employees: number; openTasks: number; overdue: number } | null = null;
  let workflowWarning = false;
  if (hasPermission(session, "hr.reports") && hasPermission(session, "group.tasks")) {
    try {
      const { records } = await listHubRecords(["employees", "tasks"]);
      const pending = records.filter((record) => record.kind === "tasks" && ["open", "in_progress"].includes(String(record.data.status)));
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      workforce = { employees: records.filter((record) => record.kind === "employees" && record.data.status === "active" && String(record.data.startOn) <= today && (!record.data.endOn || String(record.data.endOn) >= today)).length, openTasks: pending.length, overdue: pending.filter((record) => record.data.dueOn && String(record.data.dueOn) < today).length };
    } catch { workflowWarning = true; }
  }
  const activeRevenue = overview.daily.some((point) => point.revenue || point.expenses);
  const rangeLabel = overview.daily.length
    ? `${shortDay(overview.daily[0].day)} — ${shortDay(overview.daily[overview.daily.length - 1].day)}`
    : `${windowDays} days`;
  return <div className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-ink-soft">{organizationName}</p><h1 className="text-2xl font-semibold text-navy">Group analytics</h1><p className="mt-1 text-sm text-ink-soft">Recorded subsidiary performance over {windowDays} days ({rangeLabel}).</p></div><Badge tone={overview.mode === "demo" ? "warning" : "success"}>{overview.mode === "demo" ? "Demo telemetry" : "Warehouse live"}</Badge></div>
    <WarehouseWindowTabs windowDays={windowDays} />
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><StatCard label={`Paid revenue · ${windowDays}d`} value={formatUgx(revenue)} /><StatCard label={`Expenses · ${windowDays}d`} value={overview.expensesAvailable ? formatUgx(expenses) : "—"} /><StatCard label="Operating net" value={overview.expensesAvailable ? formatUgx(revenue - expenses) : "—"} /><StatCard label="Operating margin" value={overview.expensesAvailable && revenue ? `${((revenue - expenses) / revenue * 100).toFixed(1)}%` : "—"} /></div>
    {!overview.expensesAvailable ? <Card className="p-4 text-sm text-amber-700">Expense storage is not available. Net and margin are not calculated.</Card> : null}
    <Panel title="Reading these figures" subtitle="What each column includes, so the numbers are not misread.">
      <dl className="grid gap-3 text-xs sm:grid-cols-2">
        <div><dt className="font-semibold text-navy">Paid revenue</dt><dd className="mt-0.5 text-ink-soft">Value of sales marked paid in the selected window. Pending and refunded sales are excluded.</dd></div>
        <div><dt className="font-semibold text-navy">Expenses and operating net</dt><dd className="mt-0.5 text-ink-soft">Expenses are recorded subsidiary expense transactions. Operating net is paid revenue less those expenses.</dd></div>
        <div><dt className="font-semibold text-navy">Operating margin</dt><dd className="mt-0.5 text-ink-soft">Operating net divided by paid revenue. A dash means there is no paid revenue to divide by.</dd></div>
        <div><dt className="font-semibold text-navy">Leads and tasks</dt><dd className="mt-0.5 text-ink-soft">Counts of subsidiary telemetry in the same window. They are separate from the group task board below.</dd></div>
        <div className="sm:col-span-2"><dt className="font-semibold text-navy">Not included</dt><dd className="mt-0.5 text-ink-soft">Invoice receivables, bank balances, taxes, unposted payroll and legacy ERP records. This is an operating view, not a statutory profit statement.</dd></div>
      </dl>
    </Panel>
    <div className="grid gap-3 sm:grid-cols-2"><StatCard label="Leads created" value={leads} hint="Recorded telemetry in selected window" /><StatCard label="Subsidiary tasks completed" value={tasks} hint="Separate from group task board" /></div>
    <Panel title="Revenue and expense trend" subtitle="Daily recorded UGX totals">{activeRevenue ? <div className="grid gap-5 sm:grid-cols-2"><div><p className="mb-3 text-xs font-semibold text-ink-soft">Paid revenue</p><MiniBars values={overview.daily.map((point) => point.revenue)} color="#0066FF" height={120} /></div><div><p className="mb-3 text-xs font-semibold text-ink-soft">Expenses</p>{overview.expensesAvailable ? <MiniBars values={overview.daily.map((point) => point.expenses)} color="#F79009" height={120} /> : <p className="text-sm text-ink-soft">Unavailable</p>}</div></div> : <p className="py-6 text-center text-sm text-ink-soft">No financial telemetry recorded in this window.</p>}<div className="mt-3 flex justify-between text-xs text-ink-soft"><span>{shortDay(overview.daily[0]?.day ?? "")}</span><span>{shortDay(overview.daily[overview.daily.length - 1]?.day ?? "")}</span></div></Panel>
    <Panel title="Subsidiary comparison" subtitle="Fixed rolling 30-day warehouse summary; trend filters above do not change this baseline."><TableShell className="relative"><thead><tr><Th>Subsidiary</Th><Th>Paid revenue</Th><Th>Expenses</Th><Th>Operating net</Th><Th>Paid sales</Th><Th>Leads</Th></tr></thead><tbody>{overview.tenants.map((tenant) => <tr key={tenant.tenantId}><Td><Link href={hasPermission(session, "finance.read") ? `/finance#${tenant.tenantId}` : "/warehouse"} className="font-medium text-royal hover:underline">{tenant.shortName}</Link></Td><Td>{formatUgx(tenant.revenue30d)}</Td><Td>{overview.expensesAvailable ? formatUgx(tenant.expenses30d) : "—"}</Td><Td>{overview.expensesAvailable ? formatUgx(tenant.revenue30d - tenant.expenses30d) : "—"}</Td><Td>{tenant.transactions30d}</Td><Td>{tenant.leads30d}</Td></tr>)}</tbody></TableShell></Panel>
    {workforce ? <Panel title="Group operations"><div className="grid gap-3 sm:grid-cols-3"><StatCard label="Active employment profiles" value={workforce.employees} /><StatCard label="Open group tasks" value={workforce.openTasks} /><StatCard label="Overdue group tasks" value={workforce.overdue} /></div><div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-royal"><Link href="/hr/reports">Workforce reports</Link><Link href="/tasks">Group task board</Link></div></Panel> : null}
    {workflowWarning ? <p role="alert" className="text-sm text-amber-700">Group workflow aggregates are unavailable until storage is configured.</p> : null}
    <p className="text-xs text-ink-soft">Revenue includes paid sales only. Expenses use subsidiary expense transactions. These totals exclude pending sales, banking balances, taxes and unposted payroll.</p>
  </div>;
}
