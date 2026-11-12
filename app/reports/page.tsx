"use client";

import Link from "next/link";
import { Download, Receipt, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { CompanyMark } from "@/components/entities";
import { CompanyRevenueChart, ExpenseDonut } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEntity } from "@/components/entity-provider";
import { useSystem } from "@/components/system-provider";
import { expenseBreakdown, groupSeries } from "@/lib/data";
import { formatPercent, formatUGX } from "@/lib/format";

export default function ReportsPage() {
  const { companies, invoices } = useSystem();
  const { entity } = useEntity();
  const scopedCompanies = entity ? [entity] : companies;
  const totals = {
    revenue: scopedCompanies.reduce((sum, company) => sum + company.revenue, 0),
    expenses: scopedCompanies.reduce((sum, company) => sum + company.expenses, 0),
    profit: scopedCompanies.reduce((sum, company) => sum + company.profit, 0),
    staff: scopedCompanies.reduce((sum, company) => sum + company.staff, 0),
  };
  const margin = totals.revenue ? (totals.profit / totals.revenue) * 100 : 0;

  const baseRevenue = groupSeries.reduce((sum, point) => sum + point.revenue, 0);
  const baseExpenses = groupSeries.reduce((sum, point) => sum + point.expenses, 0);
  const series = groupSeries.map((point) => ({
    ...point,
    revenue: baseRevenue ? Math.round((point.revenue * totals.revenue) / baseRevenue) : 0,
    expenses: baseExpenses ? Math.round((point.expenses * totals.expenses) / baseExpenses) : 0,
  }));

  const scopedInvoices = entity
    ? invoices.filter((invoice) => invoice.companyId === entity.id)
    : invoices;
  const overdueInvoices = scopedInvoices.filter((invoice) => invoice.status === "overdue");
  const pendingInvoices = scopedInvoices.filter((invoice) => invoice.status === "pending");
  const outstanding = scopedInvoices
    .filter((invoice) => invoice.status !== "paid")
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  const overdueValue = overdueInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const pendingValue = pendingInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);

  function exportCsv() {
    const rows = [
      [
        entity
          ? `${entity.name} — FY 2026 profit and loss`
          : "District 12 Group — FY 2026 profit and loss",
      ],
      ["Month", "Revenue (UGX)", "Expenses (UGX)", "Net profit (UGX)"],
      ...series.map((point) => [
        point.month,
        point.revenue,
        point.expenses,
        point.revenue - point.expenses,
      ]),
      ["Total", totals.revenue, totals.expenses, totals.profit],
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const filename = entity
      ? `${entity.id}-pl-fy2026.csv`
      : "district-12-pl-fy2026.csv";
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported", { description: filename });
  }

  return (
    <div>
      <PageHeader
        title={entity ? `${entity.shortName} reports` : "Reports"}
        description={
          entity
            ? `Financial reporting for ${entity.name} — financial year 2026.`
            : "Consolidated financial reporting for the group — financial year 2026."
        }
      >
        <Button variant="outline" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={entity ? "Revenue" : "Group revenue"} value={formatUGX(totals.revenue)} icon={TrendingUp} hint="year to date" delta={11.8} tone="green" />
        <StatCard label="Operating expenses" value={formatUGX(totals.expenses)} icon={Wallet} hint="year to date" delta={6.2} positiveIsGood={false} tone="brand" />
        <StatCard label="Net profit" value={formatUGX(totals.profit)} icon={TrendingUp} hint="year to date" delta={18.4} tone="blue" />
        <StatCard label="Profit margin" value={formatPercent(margin)} icon={Wallet} hint={entity ? "subsidiary" : "consolidated"} tone="amber" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Profit and loss</CardTitle>
              <CardDescription>
                {entity ? `Monthly results for ${entity.shortName}, UGX` : "Monthly consolidated results, UGX"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Expenses</TableHead>
                  <TableHead className="text-right">Net profit</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {series.map((point) => {
                  const profit = point.revenue - point.expenses;
                  return (
                    <TableRow key={point.month}>
                      <TableCell>
                        <span className="text-xs font-semibold text-foreground">
                          {point.month} 2026
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs font-medium text-foreground">
                          {formatUGX(point.revenue)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-right sm:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {formatUGX(point.expenses)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs font-semibold text-emerald-700">
                          {formatUGX(profit)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-right md:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {formatPercent((profit / point.revenue) * 100)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-secondary/50">
                  <TableCell>
                    <span className="text-xs font-bold text-foreground">Total</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs font-bold text-foreground">
                      {formatUGX(totals.revenue)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    <span className="text-xs font-bold text-foreground">
                      {formatUGX(totals.expenses)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs font-bold text-emerald-700">
                      {formatUGX(totals.profit)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-right md:table-cell">
                    <span className="text-xs font-bold text-foreground">
                      {formatPercent(margin)}
                    </span>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Cost structure</CardTitle>
                <CardDescription>Share of operating expenses</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ExpenseDonut height={200} />
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {expenseBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5 text-[11px]">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="flex-1 truncate text-muted-foreground">
                      {item.name}
                    </span>
                    <span className="font-semibold text-foreground">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" />
                  Receivables
                </CardTitle>
                <CardDescription>Outstanding client invoices</CardDescription>
              </div>
              <Link
                href="/finance"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Finance
              </Link>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="rounded-md border border-border p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Total outstanding
                </p>
                <p className="mt-0.5 text-lg font-bold text-foreground">
                  {formatUGX(outstanding)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {overdueInvoices.length + pendingInvoices.length} open invoices
                </p>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Overdue</span>
                <span className="font-semibold text-red-700">
                  {formatUGX(overdueValue)} · {overdueInvoices.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pending</span>
                <span className="font-semibold text-foreground">
                  {formatUGX(pendingValue)} · {pendingInvoices.length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle>{entity ? "Revenue snapshot" : "Revenue by company"}</CardTitle>
            <CardDescription>
              {entity
                ? `${entity.shortName} year-to-date revenue`
                : "Year-to-date contribution to group revenue"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <CompanyRevenueChart
            data={scopedCompanies.map((company) => ({
              name: company.shortName,
              revenue: company.revenue,
              color: company.color,
            }))}
            height={240}
          />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle>{entity ? `${entity.shortName} performance` : "Company performance"}</CardTitle>
            <CardDescription>
              {entity
                ? "Year-to-date revenue, profit and headcount"
                : "Year-to-date revenue, profit and headcount by subsidiary"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead className="hidden md:table-cell">Sector</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Expenses</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="hidden text-right md:table-cell">Margin</TableHead>
                <TableHead className="text-right">Staff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scopedCompanies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>
                    <Link
                      href={`/companies/${company.id}`}
                      className="flex items-center gap-2.5 hover:text-primary"
                    >
                      <CompanyMark company={company} size="sm" />
                      <span className="text-xs font-semibold">{company.shortName}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-xs text-muted-foreground">{company.sector}</span>
                  </TableCell>
                  <TableCell className="text-right text-xs font-semibold">
                    {formatUGX(company.revenue)}
                  </TableCell>
                  <TableCell className="hidden text-right text-xs text-muted-foreground sm:table-cell">
                    {formatUGX(company.expenses)}
                  </TableCell>
                  <TableCell className="text-right text-xs font-semibold text-emerald-700">
                    {formatUGX(company.profit)}
                  </TableCell>
                  <TableCell className="hidden text-right text-xs text-muted-foreground md:table-cell">
                    {formatPercent((company.profit / company.revenue) * 100)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {company.staff}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-secondary/50">
                <TableCell>
                  <span className="text-xs font-bold text-foreground">
                    {entity ? `${entity.shortName} total` : "Group total"}
                  </span>
                </TableCell>
                <TableCell className="hidden md:table-cell" />
                <TableCell className="text-right text-xs font-bold text-foreground">
                  {formatUGX(totals.revenue)}
                </TableCell>
                <TableCell className="hidden text-right text-xs font-bold text-foreground sm:table-cell">
                  {formatUGX(totals.expenses)}
                </TableCell>
                <TableCell className="text-right text-xs font-bold text-emerald-700">
                  {formatUGX(totals.profit)}
                </TableCell>
                <TableCell className="hidden text-right text-xs font-bold text-foreground md:table-cell">
                  {formatPercent(margin)}
                </TableCell>
                <TableCell className="text-right text-xs font-bold text-foreground">
                  {totals.staff}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
