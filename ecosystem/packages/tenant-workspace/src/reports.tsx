import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Panel,
  ProgressBar,
  StatCard,
  TableShell,
  Td,
  Th,
  rowClass,
} from "@d12/ui";
import { AlertTriangle, TrendingUp, Wallet } from "lucide-react";
import type {
  InvoiceRecord,
  LeadRecord,
  SaleRecord,
  TenantMeta,
  TransactionRecord,
} from "@d12/contracts";
import { formatNumber, formatUgx, relativeTime, shortDate, titleCase } from "./format";
import { ReportDownload } from "./report-download";
import { ReportPeriodTabs } from "./report-tabs";

export const REPORT_WINDOWS = [30, 90, 365] as const;
export type ReportWindow = (typeof REPORT_WINDOWS)[number];

export function normalizeReportWindow(value: string | string[] | undefined): ReportWindow {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return (REPORT_WINDOWS as readonly number[]).includes(parsed) ? (parsed as ReportWindow) : 30;
}

export interface ReportInput {
  sales: SaleRecord[];
  transactions: TransactionRecord[];
  invoices: InvoiceRecord[];
  leads: LeadRecord[];
}

export interface CategoryLine {
  category: string;
  amount: number;
}

export interface ReceivableLine {
  id: string;
  number: string;
  customerName: string;
  amount: number;
  dueOn: string;
  overdue: boolean;
}

export interface CustomerLine {
  name: string;
  amount: number;
  sales: number;
}

export interface ChannelLine {
  channel: string;
  amount: number;
  sales: number;
}

export interface AgeingLine {
  label: string;
  amount: number;
  count: number;
}

export interface ReportData {
  windowDays: ReportWindow;
  startOn: string;
  endOn: string;
  priorStartOn: string;
  priorEndOn: string;
  revenue: number;
  expenses: number;
  net: number;
  margin: number;
  priorRevenue: number;
  priorExpenses: number;
  priorNet: number;
  revenueChange: number | null;
  expensesChange: number | null;
  netChange: number | null;
  salesCount: number;
  averageSale: number;
  receivables: number;
  receivablesCount: number;
  overdueAmount: number;
  overdueCount: number;
  severeOverdueAmount: number;
  pipelineValue: number;
  openLeads: number;
  expensesByCategory: CategoryLine[];
  receivablesList: ReceivableLine[];
  topCustomers: CustomerLine[];
  salesByChannel: ChannelLine[];
  ageing: AgeingLine[];
  notes: string[];
  months: string[];
  monthlyRevenue: number[];
  monthlyExpenses: number[];
  csv: string[][];
}

function dayOffset(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

function monthLabel(key: string): string {
  const date = new Date(`${key}-01T12:00:00`);
  return Number.isNaN(date.getTime())
    ? key
    : date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function sumAmount(records: Array<{ amount: number | string | null | undefined }>): number {
  return records.reduce((sum, record) => sum + Number(record.amount ?? 0), 0);
}

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

function changeSentence(change: number | null): string {
  if (change === null) return " There is no earlier period with figures to compare against.";
  if (change === 0) return " That is level with the previous period.";
  return ` That is ${Math.abs(change)}% ${change > 0 ? "higher" : "lower"} than the previous period.`;
}

export function buildReportData(input: ReportInput, windowDays: ReportWindow): ReportData {
  const startOn = dayOffset(windowDays - 1);
  const endOn = dayOffset(0);
  const priorStartOn = dayOffset(windowDays * 2 - 1);
  const priorEndOn = dayOffset(windowDays);
  const today = endOn;

  const withinPeriod = (date: string, start: string, end: string) => date >= start && date <= end;
  const paidSalesIn = (start: string, end: string) =>
    input.sales.filter((sale) => sale.status === "paid" && withinPeriod(sale.occurredOn, start, end));
  const expensesIn = (start: string, end: string) =>
    input.transactions.filter((entry) => entry.kind === "expense" && withinPeriod(entry.occurredOn, start, end));

  const windowedSales = input.sales.filter((sale) => sale.occurredOn >= startOn);
  const windowedExpenses = expensesIn(startOn, endOn);
  const paidSales = paidSalesIn(startOn, endOn);
  const priorPaidSales = paidSalesIn(priorStartOn, priorEndOn);
  const priorExpenses = expensesIn(priorStartOn, priorEndOn);

  const revenue = sumAmount(paidSales);
  const expenses = sumAmount(windowedExpenses);
  const net = revenue - expenses;
  const priorRevenue = sumAmount(priorPaidSales);
  const priorExpenseTotal = sumAmount(priorExpenses);
  const priorNet = priorRevenue - priorExpenseTotal;

  const pendingInvoices = input.invoices.filter((invoice) => invoice.status === "pending");
  const overdueInvoices = pendingInvoices.filter((invoice) => invoice.dueOn && invoice.dueOn < today);

  const categoryTotals = new Map<string, number>();
  for (const entry of windowedExpenses) {
    const key = entry.category || "Uncategorised";
    categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + Number(entry.amount ?? 0));
  }
  const expensesByCategory = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((left, right) => right.amount - left.amount);

  const customerTotals = new Map<string, CustomerLine>();
  for (const sale of paidSales) {
    const name = sale.customerName?.trim() || "Walk-in customer";
    const line = customerTotals.get(name) ?? { name, amount: 0, sales: 0 };
    line.amount += Number(sale.amount ?? 0);
    line.sales += 1;
    customerTotals.set(name, line);
  }
  const topCustomers = Array.from(customerTotals.values())
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5);

  const channelTotals = new Map<string, ChannelLine>();
  for (const sale of paidSales) {
    const channel = sale.channel?.trim() || "Direct";
    const line = channelTotals.get(channel) ?? { channel, amount: 0, sales: 0 };
    line.amount += Number(sale.amount ?? 0);
    line.sales += 1;
    channelTotals.set(channel, line);
  }
  const salesByChannel = Array.from(channelTotals.values()).sort((left, right) => right.amount - left.amount);

  const daysLate = (dueOn: string): number | null => {
    if (!dueOn) return null;
    const due = new Date(`${dueOn}T12:00:00`).getTime();
    const now = new Date(`${today}T12:00:00`).getTime();
    if (!Number.isFinite(due)) return null;
    return Math.floor((now - due) / 86_400_000);
  };
  const ageing: AgeingLine[] = [
    { label: "Not yet due", amount: 0, count: 0 },
    { label: "1–30 days late", amount: 0, count: 0 },
    { label: "31–60 days late", amount: 0, count: 0 },
    { label: "Over 60 days late", amount: 0, count: 0 },
  ];
  let severeOverdueAmount = 0;
  for (const invoice of pendingInvoices) {
    const late = daysLate(invoice.dueOn);
    const amount = Number(invoice.amount ?? 0);
    const bucket =
      late === null || late <= 0 ? ageing[0] : late <= 30 ? ageing[1] : late <= 60 ? ageing[2] : ageing[3];
    bucket.amount += amount;
    bucket.count += 1;
    if (late !== null && late > 60) severeOverdueAmount += amount;
  }

  const openStages = new Set(["new", "contacted", "qualified"]);
  const openLeads = input.leads.filter((lead) => openStages.has(lead.stage));
  const pipelineValue = openLeads.reduce((sum, lead) => sum + Number(lead.value ?? 0), 0);

  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    return date.toISOString().slice(0, 7);
  });
  const monthlyRevenue = months.map((month) =>
    input.sales
      .filter((sale) => sale.status === "paid" && sale.occurredOn.slice(0, 7) === month)
      .reduce((sum, sale) => sum + Number(sale.amount ?? 0), 0),
  );
  const monthlyExpenses = months.map((month) =>
    input.transactions
      .filter((entry) => entry.kind === "expense" && entry.occurredOn.slice(0, 7) === month)
      .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0),
  );

  const salesCount = paidSales.length;
  const averageSale = salesCount ? Math.round(revenue / salesCount) : 0;
  const margin = revenue > 0 ? Math.round((net / revenue) * 100) : 0;
  const receivables = sumAmount(pendingInvoices);
  const overdueAmount = sumAmount(overdueInvoices);

  const notes: string[] = [];
  if (salesCount) {
    notes.push(
      `Revenue was ${formatUgx(revenue)} from ${countLabel(salesCount, "paid sale")}, an average of ${formatUgx(averageSale)} per sale.${changeSentence(percentChange(revenue, priorRevenue))}`,
    );
  } else {
    notes.push(`No sales were paid in this period, so revenue is ${formatUgx(0)}.`);
  }
  if (expensesByCategory.length) {
    const largest = expensesByCategory[0];
    const share = expenses > 0 ? Math.round((largest.amount / expenses) * 100) : 0;
    notes.push(
      `Operating expenses were ${formatUgx(expenses)}. The largest category was ${largest.category} at ${formatUgx(largest.amount)}, ${share}% of spend.${changeSentence(percentChange(expenses, priorExpenseTotal))}`,
    );
  } else {
    notes.push("No operating expenses were recorded in this period.");
  }
  notes.push(
    net >= 0
      ? `Net profit was ${formatUgx(net)}, a margin of ${margin}% of revenue.${changeSentence(percentChange(net, priorNet))}`
      : `Net loss was ${formatUgx(Math.abs(net))} because expenses exceeded revenue.${changeSentence(percentChange(net, priorNet))}`,
  );
  if (pendingInvoices.length) {
    notes.push(
      `Outstanding invoices stand at ${formatUgx(receivables)} across ${countLabel(pendingInvoices.length, "invoice")}. ${
        overdueInvoices.length
          ? `${formatUgx(overdueAmount)} on ${countLabel(overdueInvoices.length, "invoice")} ${overdueInvoices.length === 1 ? "is" : "are"} already past due, including ${formatUgx(severeOverdueAmount)} more than 60 days late.`
          : "None is past its due date."
      }`,
    );
  } else {
    notes.push("There are no pending invoices, so nothing is outstanding.");
  }
  notes.push(
    openLeads.length
      ? `The open pipeline is worth ${formatUgx(pipelineValue)} across ${countLabel(openLeads.length, "active lead")}, averaging ${formatUgx(Math.round(pipelineValue / openLeads.length))} per lead. Pipeline value is potential, not yet earned.`
      : "There are no active leads, so the open pipeline is empty.",
  );

  const csv: string[][] = [
    ["Type", "Date", "Reference", "Description", "Party", "Category", "Amount (UGX)", "Status"],
  ];
  const csvRows: Array<{ date: string; row: string[] }> = [];
  for (const sale of windowedSales) {
    csvRows.push({
      date: sale.occurredOn,
      row: [
        "Sale",
        sale.occurredOn,
        sale.customerId || "",
        sale.description,
        sale.customerName,
        sale.channel,
        String(Math.round(Number(sale.amount ?? 0))),
        sale.status,
      ],
    });
  }
  for (const entry of input.transactions.filter((item) => item.occurredOn >= startOn)) {
    csvRows.push({
      date: entry.occurredOn,
      row: [
        titleCase(entry.kind),
        entry.occurredOn,
        entry.reference,
        entry.description,
        entry.counterparty,
        entry.category,
        String(Math.round(Number(entry.amount ?? 0))),
        entry.kind,
      ],
    });
  }
  for (const invoice of input.invoices.filter((item) => item.issueOn >= startOn)) {
    csvRows.push({
      date: invoice.issueOn,
      row: [
        "Invoice",
        invoice.issueOn,
        invoice.number,
        invoice.notes || invoice.customerName,
        invoice.customerName,
        "Receivables",
        String(Math.round(Number(invoice.amount ?? 0))),
        invoice.status,
      ],
    });
  }
  csvRows.sort((left, right) => left.date.localeCompare(right.date));
  for (const item of csvRows) csv.push(item.row);

  return {
    windowDays,
    startOn,
    endOn,
    priorStartOn,
    priorEndOn,
    revenue,
    expenses,
    net,
    margin,
    priorRevenue,
    priorExpenses: priorExpenseTotal,
    priorNet,
    revenueChange: percentChange(revenue, priorRevenue),
    expensesChange: percentChange(expenses, priorExpenseTotal),
    netChange: percentChange(net, priorNet),
    salesCount,
    averageSale,
    receivables,
    receivablesCount: pendingInvoices.length,
    overdueAmount,
    overdueCount: overdueInvoices.length,
    severeOverdueAmount,
    pipelineValue,
    openLeads: openLeads.length,
    expensesByCategory,
    receivablesList: pendingInvoices
      .slice()
      .sort((left, right) => String(left.dueOn).localeCompare(String(right.dueOn)))
      .slice(0, 6)
      .map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        customerName: invoice.customerName,
        amount: Number(invoice.amount ?? 0),
        dueOn: invoice.dueOn,
        overdue: Boolean(invoice.dueOn) && invoice.dueOn < today,
      })),
    topCustomers,
    salesByChannel,
    ageing,
    notes,
    months,
    monthlyRevenue,
    monthlyExpenses,
    csv,
  };
}

function changeHint(change: number | null, base: string): string {
  if (change === null) return "No prior figures to compare";
  if (change === 0) return `Level with ${base}`;
  return `${change > 0 ? "Up" : "Down"} ${Math.abs(change)}% on ${base}`;
}

export function WorkspaceReports({
  tenant,
  data,
  lastSaleAt,
}: {
  tenant: TenantMeta;
  data: ReportData;
  lastSaleAt?: string | null;
}) {
  const topExpense = Math.max(1, ...data.expensesByCategory.map((line) => line.amount));
  const filename = `${tenant.id}-report-${data.windowDays}d.csv`;
  const windowLabel =
    data.windowDays === 365 ? "the last 12 months" : `the last ${data.windowDays} days`;
  const compareLabel = data.windowDays === 365 ? "the previous year" : `the previous ${data.windowDays} days`;
  const rangeLabel = `${shortDate(data.startOn)} — ${shortDate(data.endOn)}`;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Reporting"
        title="Reports & P&L"
        description={`Profit and loss, receivables and pipeline for ${windowLabel} (${rangeLabel}). Revenue counts paid sales only; receivables and pipeline are as at today.`}
        actions={
          <>
            <ReportPeriodTabs windowDays={data.windowDays} />
            <ReportDownload rows={data.csv} filename={filename} />
          </>
        }
      />

      <Card className="px-4 py-3">
        <p className="text-xs font-semibold text-ink">What this report says</p>
        <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
          {data.notes.map((note) => (
            <li key={note} className="flex gap-2 text-[11px] leading-snug text-ink-soft">
              <span aria-hidden className="mt-1 h-1 w-1 shrink-0 rounded-full bg-royal" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value={formatUgx(data.revenue)}
          hint={`${countLabel(data.salesCount, "paid sale")} · ${changeHint(data.revenueChange, compareLabel)}`}
          icon={<TrendingUp className="h-4 w-4" />}
          accent="green"
        />
        <StatCard
          label="Expenses"
          value={formatUgx(data.expenses)}
          hint={`${data.expensesByCategory.length} categories · ${changeHint(data.expensesChange, compareLabel)}`}
          icon={<Wallet className="h-4 w-4" />}
          accent="red"
        />
        <StatCard
          label="Net profit"
          value={formatUgx(data.net)}
          hint={`${data.margin}% margin · ${changeHint(data.netChange, compareLabel)}`}
          icon={<TrendingUp className="h-4 w-4" />}
          accent={data.net >= 0 ? "navy" : "amber"}
        />
        <StatCard
          label="Receivables"
          value={formatUgx(data.receivables)}
          hint={
            data.overdueCount
              ? `${data.overdueCount} overdue · ${formatUgx(data.overdueAmount)}`
              : "No overdue invoices"
          }
          icon={<AlertTriangle className="h-4 w-4" />}
          accent={data.overdueCount ? "amber" : "violet"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Profit & loss"
          subtitle={`${rangeLabel} · compared with ${shortDate(data.priorStartOn)} — ${shortDate(data.priorEndOn)}`}
        >
          <dl className="divide-y divide-line text-sm">
            <div className="flex items-center justify-between py-2 first:pt-0">
              <dt className="text-ink-soft">Revenue from paid sales</dt>
              <dd className="font-semibold text-ink">{formatUgx(data.revenue)}</dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-ink-soft">Operating expenses</dt>
              <dd className="font-semibold text-ink">−{formatUgx(data.expenses)}</dd>
            </div>
            <div className="flex items-center justify-between py-2 last:pb-0">
              <dt className="font-medium text-ink">Net profit</dt>
              <dd className={data.net >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-red-600"}>
                {formatUgx(data.net)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 border-t border-line pt-2 text-[11px] text-ink-mute">
            Previous period: revenue {formatUgx(data.priorRevenue)}, expenses {formatUgx(data.priorExpenses)}, net{" "}
            {formatUgx(data.priorNet)}. Margin {data.margin}% on {countLabel(data.salesCount, "paid sale")}. Last sale{" "}
            {relativeTime(lastSaleAt ?? null)}.
          </p>
        </Panel>

        <Panel title="Expenses by category" subtitle="Operating spend recorded inside the period">
          {data.expensesByCategory.length ? (
            <>
              <ul className="space-y-2.5">
                {data.expensesByCategory.map((line) => (
                  <li key={line.category}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-ink">{line.category}</span>
                      <span className="text-ink-mute">{formatUgx(line.amount)}</span>
                    </div>
                    <ProgressBar
                      value={(line.amount / topExpense) * 100}
                      color={tenant.accent ?? tenant.color}
                      className="mt-1"
                    />
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-line pt-2 text-[11px] text-ink-mute">
                Total {formatUgx(data.expenses)}. Largest category {data.expensesByCategory[0].category} at{" "}
                {data.expenses > 0 ? Math.round((data.expensesByCategory[0].amount / data.expenses) * 100) : 0}% of
                spend.
              </p>
            </>
          ) : (
            <EmptyState
              title="No expenses in this period"
              description="Record expenses in Finance to see the breakdown here."
            />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Receivables"
          subtitle={`${formatUgx(data.receivables)} outstanding across ${countLabel(data.receivablesCount, "pending invoice")}`}
          bodyClassName="p-0"
        >
          {data.receivablesList.length ? (
            <TableShell className="rounded-none border-0">
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Due</Th>
                  <Th className="text-right">Amount</Th>
                  <Th><span className="sr-only">Status</span></Th>
                </tr>
              </thead>
              <tbody>
                {data.receivablesList.map((invoice) => (
                  <tr key={invoice.id} className={rowClass}>
                    <Td>
                      <p className="text-sm font-medium text-ink">{invoice.number}</p>
                      <p className="truncate text-[11px] text-ink-mute">{invoice.customerName}</p>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-ink-soft">
                      {shortDate(invoice.dueOn)}
                    </Td>
                    <Td className="whitespace-nowrap text-right text-sm font-medium">
                      {formatUgx(invoice.amount)}
                    </Td>
                    <Td className="text-right">
                      <Badge tone={invoice.overdue ? "danger" : "warning"}>
                        {invoice.overdue ? "Overdue" : "Pending"}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          ) : (
            <div className="p-4">
              <EmptyState title="Nothing outstanding" description="Every invoice has been settled." />
            </div>
          )}
          <div className="border-t border-line px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">
              How old the debt is
            </p>
            <dl className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {data.ageing.map((bucket) => (
                <div key={bucket.label} className="rounded-lg border border-line bg-canvas/60 px-2 py-1.5">
                  <dt className="text-[10px] font-medium text-ink-mute">{bucket.label}</dt>
                  <dd className="text-xs font-semibold text-ink">{formatUgx(bucket.amount)}</dd>
                  <dd className="text-[10px] text-ink-mute">
                    {formatNumber(bucket.count)} invoice{bucket.count === 1 ? "" : "s"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Panel>

        <Panel title="Pipeline snapshot" subtitle="Open conversations, valued today">
          <dl className="divide-y divide-line text-sm">
            <div className="flex items-center justify-between py-2 first:pt-0">
              <dt className="text-ink-soft">Open pipeline</dt>
              <dd className="font-semibold text-ink">{formatUgx(data.pipelineValue)}</dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-ink-soft">Active leads</dt>
              <dd className="font-semibold text-ink">{formatNumber(data.openLeads)}</dd>
            </div>
            <div className="flex items-center justify-between py-2 last:pb-0">
              <dt className="text-ink-soft">Average deal size</dt>
              <dd className="font-semibold text-ink">
                {formatUgx(data.openLeads ? Math.round(data.pipelineValue / data.openLeads) : 0)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 border-t border-line pt-2 text-[11px] text-ink-mute">
            Active means new, contacted or qualified. The value is the recorded deal size, not yet earned.
          </p>
        </Panel>
      </div>

      <Panel
        title="Where the money came from"
        subtitle="Paid sales in this period, grouped by customer and by channel"
        bodyClassName="p-0"
      >
        {data.topCustomers.length ? (
          <div className="grid gap-0 sm:grid-cols-2 sm:divide-x sm:divide-line">
            <div className="px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Top customers</p>
              <ul className="mt-2 space-y-1.5">
                {data.topCustomers.map((customer) => (
                  <li key={customer.name} className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate text-ink-soft">{customer.name}</span>
                    <span className="whitespace-nowrap font-medium text-ink">
                      {formatUgx(customer.amount)}
                      <span className="ml-1 font-normal text-ink-mute">
                        · {formatNumber(customer.sales)} sale{customer.sales === 1 ? "" : "s"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">By channel</p>
              <ul className="mt-2 space-y-2">
                {data.salesByChannel.map((channel) => {
                  const share = data.revenue > 0 ? Math.round((channel.amount / data.revenue) * 100) : 0;
                  return (
                    <li key={channel.channel}>
                      <div className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="text-ink-soft">{channel.channel || "Direct"}</span>
                        <span className="whitespace-nowrap font-medium text-ink">
                          {formatUgx(channel.amount)}
                          <span className="ml-1 font-normal text-ink-mute">{share}%</span>
                        </span>
                      </div>
                      <ProgressBar value={share} color={tenant.accent ?? tenant.color} className="mt-1" />
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <EmptyState
              title="No paid sales in this period"
              description="Once sales are marked paid, the customer and channel split appears here."
            />
          </div>
        )}
      </Panel>

      <Panel
        title="Month by month"
        subtitle="The six months ending this month. Revenue is paid sales; expenses are recorded spend."
        bodyClassName="p-0"
      >
        <TableShell className="rounded-none border-0">
          <thead>
            <tr>
              <Th>Month</Th>
              <Th className="text-right">Revenue</Th>
              <Th className="text-right">Expenses</Th>
              <Th className="text-right">Net</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.months.map((month, index) => {
              const monthNet = data.monthlyRevenue[index] - data.monthlyExpenses[index];
              return (
                <tr key={month} className={rowClass}>
                  <Td className="text-xs font-medium text-ink">{monthLabel(month)}</Td>
                  <Td className="whitespace-nowrap text-right text-xs text-ink-soft">
                    {formatUgx(data.monthlyRevenue[index])}
                  </Td>
                  <Td className="whitespace-nowrap text-right text-xs text-ink-soft">
                    {formatUgx(data.monthlyExpenses[index])}
                  </Td>
                  <Td
                    className={
                      monthNet >= 0
                        ? "whitespace-nowrap text-right text-xs font-medium text-emerald-700"
                        : "whitespace-nowrap text-right text-xs font-medium text-red-600"
                    }
                  >
                    {formatUgx(monthNet)}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      </Panel>
    </div>
  );
}
