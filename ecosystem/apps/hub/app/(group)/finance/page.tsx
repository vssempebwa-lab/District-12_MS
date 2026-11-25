import Link from "next/link";
import { ArrowRight, Info, Percent, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import { TENANTS } from "@d12/contracts";
import {
  Alert,
  Badge,
  BrandMark,
  Card,
  EmptyState,
  MiniBars,
  PageHeader,
  Panel,
  StatCard,
  TableShell,
  Td,
  Th,
  rowClass,
} from "@d12/ui";
import { formatNumber, formatUgx, relativeTime, shortDay } from "@/lib/format";
import { requirePermissionPage } from "@/lib/session-server";
import { getWarehouseOverview } from "@/lib/warehouse";

export const metadata = { title: "Group finance — District 12" };
export const dynamic = "force-dynamic";

export default async function FinancePage() {
  await requirePermissionPage("finance.read");
  const warehouse = await getWarehouseOverview(30);
  const revenue = warehouse.tenants.reduce((sum, tenant) => sum + tenant.revenue30d, 0);
  const expenses = warehouse.tenants.reduce((sum, tenant) => sum + tenant.expenses30d, 0);
  const paidSales = warehouse.tenants.reduce((sum, tenant) => sum + tenant.transactions30d, 0);
  const net = revenue - expenses;
  const margin = warehouse.expensesAvailable && revenue > 0 ? `${((net / revenue) * 100).toFixed(1)}%` : "—";
  const hasActivity = warehouse.daily.some((point) => point.revenue > 0 || point.expenses > 0);
  const leader = warehouse.tenants.slice().sort((left, right) => right.revenue30d - left.revenue30d)[0];
  const leaderShare = leader && revenue > 0 ? Math.round((leader.revenue30d / revenue) * 100) : 0;
  const summary: string[] = [
    `${formatUgx(revenue)} in paid revenue came from ${formatNumber(paidSales)} paid sales across ${warehouse.tenants.length} subsidiaries.`,
  ];
  if (warehouse.expensesAvailable) {
    summary.push(
      `Recorded expenses were ${formatUgx(expenses)}, leaving an operating net of ${formatUgx(net)}${margin !== "—" ? ` (${margin} margin)` : ""}.`,
    );
  } else {
    summary.push("Recorded expenses are not connected, so operating net and margin cannot be calculated.");
  }
  if (leader && leaderShare > 0) {
    summary.push(
      `${TENANTS[leader.tenantId].shortName} contributed ${leaderShare}% of group paid revenue at ${formatUgx(leader.revenue30d)}.`,
    );
  }
  summary.push("Figures cover the last 30 days. Receivables, bank balances, taxes and payroll are not included.");

  return (
    <div className="space-y-4">
      <PageHeader
        className="[&_h1]:font-bold [&_h1]:text-navy [&_p:first-child]:text-royal"
        eyebrow="Finance monitoring"
        title="District 12 finance"
        description="Monitor paid revenue, recorded expenses and operating performance across the group."
        actions={
          <>
            <Badge tone={warehouse.mode === "supabase" ? "success" : "warning"}>
              {warehouse.mode === "supabase" ? "Finance live" : "Finance demo"}
            </Badge>
            <Badge tone="info">Read-only · last 30 days</Badge>
            <form action="/finance" method="get">
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-navy hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal">
                <RefreshCw className="h-3.5 w-3.5" />Refresh figures
              </button>
            </form>
          </>
        }
      />

      {warehouse.mode === "demo" ? (
        <Alert tone="info" className="flex items-start gap-2 border-blue-200 bg-royal-50 text-blue-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Demo warehouse: figures come from subsidiary sales and expense telemetry, not the separate legacy ERP. They remain zero until financial activity is received.</span>
        </Alert>
      ) : null}

      {!warehouse.expensesAvailable ? (
        <Alert tone="warning">Expense reporting is not connected. Apply the finance database migration before using expenses, operating net or margin; those figures are unavailable rather than zero.</Alert>
      ) : null}

      <Card className="px-4 py-3">
        <p className="text-xs font-semibold text-ink">What this report says</p>
        <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
          {summary.map((note) => (
            <li key={note} className="flex gap-2 text-[11px] leading-snug text-ink-soft">
              <span aria-hidden className="mt-1 h-1 w-1 shrink-0 rounded-full bg-royal" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Paid revenue · 30 days" value={formatUgx(revenue)} hint={`${formatNumber(paidSales)} paid sales`} icon={<TrendingUp className="h-4 w-4" />} accent="blue" />
        <StatCard label="Operating expenses · 30 days" value={warehouse.expensesAvailable ? formatUgx(expenses) : "—"} hint="Recorded expense transactions" icon={<Wallet className="h-4 w-4" />} accent="violet" />
        <StatCard label="Operating net · 30 days" value={warehouse.expensesAvailable ? formatUgx(net) : "—"} hint="Paid revenue less expenses" icon={<Wallet className="h-4 w-4" />} accent="green" />
        <StatCard label="Operating margin" value={margin} hint={revenue > 0 ? "Operating net / paid revenue" : "No paid revenue to calculate a margin"} icon={<Percent className="h-4 w-4" />} />
      </div>

      <Panel
        title="Subsidiary financial performance"
        subtitle="A consolidated 30-day view of all subsidiary workspaces."
        className="border-0 [&>header]:bg-navy [&>header_h2]:text-white [&>header_p]:text-slate-300"
        bodyClassName="p-0"
      >
        <TableShell className="relative rounded-none border-0 [&>table]:min-w-[820px]">
          <thead>
            <tr>
              <Th>Subsidiary</Th>
              <Th className="text-right">Paid revenue</Th>
              <Th className="text-right">Expenses</Th>
              <Th className="text-right">Operating net</Th>
              <Th className="text-right">Margin</Th>
              <Th className="text-right">Paid sales</Th>
            </tr>
          </thead>
          <tbody>
            {warehouse.tenants.map((tenant) => {
              const meta = TENANTS[tenant.tenantId];
              const tenantNet = tenant.revenue30d - tenant.expenses30d;
              return (
                <tr key={tenant.tenantId} id={tenant.tenantId} className={`${rowClass} scroll-mt-36`}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <BrandMark mark={meta.mark} color={meta.color} logo={meta.logo} alt={`${meta.shortName} logo`} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-ink">{meta.shortName}</p>
                        <p className="text-[11px] text-ink-mute">{meta.sector}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="text-right tabular-nums">{formatUgx(tenant.revenue30d)}</Td>
                  <Td className="text-right tabular-nums">{warehouse.expensesAvailable ? formatUgx(tenant.expenses30d) : "—"}</Td>
                  <Td className={`text-right font-semibold tabular-nums ${tenantNet < 0 ? "text-red-600" : "text-emerald-700"}`}>{warehouse.expensesAvailable ? formatUgx(tenantNet) : "—"}</Td>
                  <Td className="text-right tabular-nums">{warehouse.expensesAvailable && tenant.revenue30d > 0 ? `${((tenantNet / tenant.revenue30d) * 100).toFixed(1)}%` : "—"}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(tenant.transactions30d)}</Td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-line bg-canvas font-semibold">
              <Td>Group total</Td>
              <Td className="text-right tabular-nums">{formatUgx(revenue)}</Td>
              <Td className="text-right tabular-nums">{warehouse.expensesAvailable ? formatUgx(expenses) : "—"}</Td>
              <Td className={`text-right tabular-nums ${net < 0 ? "text-red-600" : "text-emerald-700"}`}>{warehouse.expensesAvailable ? formatUgx(net) : "—"}</Td>
              <Td className="text-right tabular-nums">{margin}</Td>
              <Td className="text-right tabular-nums">{formatNumber(paidSales)}</Td>
            </tr>
          </tfoot>
        </TableShell>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Revenue and expenses · 30 days" subtitle="Daily financial activity received by the warehouse.">
          {hasActivity ? (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-royal">Paid revenue</p>
                <MiniBars values={warehouse.daily.map((point) => point.revenue)} color="#0066FF" height={60} />
              </div>
              {warehouse.expensesAvailable ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-violet-700">Operating expenses</p>
                  <MiniBars values={warehouse.daily.map((point) => point.expenses)} color="#7C3AED" height={60} />
                </div>
              ) : <p className="text-xs text-amber-700">Expense trend unavailable until finance reporting is connected.</p>}
              <div className="flex justify-between text-[10px] text-ink-mute">
                <span>{warehouse.daily[0] ? shortDay(warehouse.daily[0].day) : ""}</span>
                <span>{warehouse.daily.length ? shortDay(warehouse.daily[warehouse.daily.length - 1].day) : ""}</span>
              </div>
            </div>
          ) : (
            <EmptyState title="No financial activity received" description="Record paid sales and expense transactions in subsidiary workspaces, then sync their telemetry to the hub." className="py-8" />
          )}
        </Panel>
        <Panel
          title="Reporting basis"
          subtitle="Understand what these figures include."
          action={<Link href="/warehouse" className="inline-flex items-center gap-1 text-xs font-semibold text-royal hover:underline">Warehouse<ArrowRight className="h-3.5 w-3.5" /></Link>}
        >
          <dl className="space-y-3 text-xs">
            <div><dt className="font-semibold text-navy">Revenue</dt><dd className="mt-1 text-ink-soft">Paid sales only; pending and refunded sales are excluded.</dd></div>
            <div><dt className="font-semibold text-navy">Expenses and operating net</dt><dd className="mt-1 text-ink-soft">Recorded expense transactions, deducted from paid sales. These are operating figures, not a full statutory profit statement.</dd></div>
            <div><dt className="font-semibold text-navy">Not included</dt><dd className="mt-1 text-ink-soft">Invoice receivables, bank balances, taxes and legacy ERP records.</dd></div>
            <div><dt className="font-semibold text-navy">Last warehouse activity</dt><dd className="mt-1 text-ink-soft">{relativeTime(warehouse.lastReceivedAt)}</dd></div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
