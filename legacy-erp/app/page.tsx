"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Building2, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { SubsidiaryDashboard } from "@/components/subsidiary-dashboard";
import { GroupTrendChart } from "@/components/charts";
import { CompanyMark, ProjectStatusBadge } from "@/components/entities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSystem } from "@/components/system-provider";
import { useEntity } from "@/components/entity-provider";
import { groupSeries, type Project } from "@/lib/data";
import { formatDate, formatPercent, formatUGX } from "@/lib/format";

function isAtRisk(project: Project) {
  return (
    project.status === "on-hold" ||
    (project.status === "active" && project.budget > 0 && project.progress < 65)
  );
}

export default function DashboardPage() {
  const { companies, transactions, projects, contacts, deals } = useSystem();
  const { entity } = useEntity();
  const [period, setPeriod] = useState("ytd");

  const scopedCompanies = useMemo(
    () => (entity ? [entity] : companies),
    [entity, companies]
  );
  const scopedIds = useMemo(
    () => new Set(scopedCompanies.map((company) => company.id)),
    [scopedCompanies]
  );

  const totals = useMemo(
    () => ({
      revenue: scopedCompanies.reduce((sum, company) => sum + company.revenue, 0),
      expenses: scopedCompanies.reduce((sum, company) => sum + company.expenses, 0),
      profit: scopedCompanies.reduce((sum, company) => sum + company.profit, 0),
      staff: scopedCompanies.reduce((sum, company) => sum + company.staff, 0),
    }),
    [scopedCompanies]
  );

  const openPipeline = deals
    .filter(
      (deal) =>
        scopedIds.has(deal.companyId) &&
        deal.stage !== "won" &&
        deal.stage !== "lost"
    )
    .reduce((sum, deal) => sum + deal.value, 0);
  const wonValue = deals
    .filter((deal) => scopedIds.has(deal.companyId) && deal.stage === "won")
    .reduce((sum, deal) => sum + deal.value, 0);
  const activeContacts = contacts.filter(
    (contact) => scopedIds.has(contact.companyId) && contact.status === "active"
  ).length;

  const series = useMemo(() => {
    const baseRevenue = groupSeries.reduce((sum, point) => sum + point.revenue, 0);
    const baseExpenses = groupSeries.reduce((sum, point) => sum + point.expenses, 0);
    const revenueFactor = baseRevenue ? totals.revenue / baseRevenue : 0;
    const expenseFactor = baseExpenses ? totals.expenses / baseExpenses : 0;
    return groupSeries.map((point) => ({
      month: point.month,
      revenue: Math.round(point.revenue * revenueFactor),
      expenses: Math.round(point.expenses * expenseFactor),
    }));
  }, [totals.revenue, totals.expenses]);

  const chartData = period === "6m" ? series.slice(-6) : series;
  const last = series[series.length - 1];
  const previous = series[series.length - 2];
  const change = (current: number, prior: number) =>
    prior === 0 ? 0 : ((current - prior) / prior) * 100;
  const revenueDelta = change(last.revenue, previous.revenue);
  const expenseDelta = change(last.expenses, previous.expenses);
  const profitDelta = change(
    last.revenue - last.expenses,
    previous.revenue - previous.expenses
  );
  const margin = totals.revenue ? (totals.profit / totals.revenue) * 100 : 0;

  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .filter((transaction) => scopedIds.has(transaction.companyId))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 6),
    [transactions, scopedIds]
  );

  const attention = useMemo(
    () =>
      projects
        .filter((project) => scopedIds.has(project.companyId) && isAtRisk(project))
        .sort((a, b) => b.progress - a.progress)
        .slice(0, 4),
    [projects, scopedIds]
  );

  const maxRevenue = Math.max(1, ...scopedCompanies.map((company) => company.revenue));

  if (entity) {
    return <SubsidiaryDashboard company={entity} />;
  }

  return (
    <div>
      <PageHeader
        title="Group overview"
        description={`Consolidated performance across ${companies.length} subsidiaries — financial year 2026.`}
      >
        <Select
          aria-label="Reporting period"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
          className="w-40"
        >
          <option value="ytd">Year to date</option>
          <option value="6m">Last 6 months</option>
        </Select>
        <Link href="/reports">
          <Button variant="outline" size="md">
            View reports
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Group revenue"
          value={formatUGX(totals.revenue)}
          delta={revenueDelta}
          hint="vs Sep 2026"
          icon={TrendingUp}
          tone="green"
        />
        <StatCard
          label="Operating expenses"
          value={formatUGX(totals.expenses)}
          delta={expenseDelta}
          positiveIsGood={false}
          hint="vs Sep 2026"
          icon={Wallet}
          tone="brand"
        />
        <StatCard
          label="Net profit"
          value={formatUGX(totals.profit)}
          delta={profitDelta}
          hint={`${formatPercent(margin)} margin`}
          icon={TrendingUp}
          tone="blue"
        />
        <StatCard
          label="Subsidiaries"
          value={String(companies.length)}
          hint={`${totals.staff} employees`}
          icon={Building2}
          tone="violet"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Revenue vs expenses</CardTitle>
              <CardDescription>Consolidated monthly performance, UGX</CardDescription>
            </div>
            <div className="hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" /> Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#1F2937]" /> Expenses
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <GroupTrendChart data={chartData} height={258} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Revenue by company</CardTitle>
              <CardDescription>Share of group year-to-date revenue</CardDescription>
            </div>
            <Link
              href="/crm"
              className="text-xs font-semibold text-primary hover:underline"
            >
              CRM
            </Link>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {scopedCompanies.map((company) => (
              <Link
                key={company.id}
                href={`/companies/${company.id}`}
                className="group block"
              >
                <div className="flex items-center gap-2.5">
                  <CompanyMark company={company} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-foreground group-hover:text-primary">
                        {company.shortName}
                      </p>
                      <p className="shrink-0 text-xs font-semibold text-foreground">
                        {formatUGX(company.revenue)}
                      </p>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Progress
                        value={(company.revenue / maxRevenue) * 100}
                        className="h-1"
                        barColor={company.color}
                      />
                      <span
                        className={
                          company.growth >= 0
                            ? "w-11 shrink-0 text-right text-[10px] font-semibold text-emerald-600"
                            : "w-11 shrink-0 text-right text-[10px] font-semibold text-red-600"
                        }
                      >
                        {company.growth >= 0 ? "+" : ""}
                        {company.growth.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}

            <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
              {[
                ["Open pipeline", formatUGX(openPipeline, { compact: true })],
                ["Won", formatUGX(wonValue, { compact: true })],
                ["Contacts", String(activeContacts)],
              ].map(([label, value]) => (
                <Link key={label} href="/crm" className="group text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-foreground group-hover:text-primary">
                    {value}
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Recent transactions</CardTitle>
              <CardDescription>Latest group-wide entries</CardDescription>
            </div>
            <Link
              href="/finance"
              className="text-xs font-semibold text-primary hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-0">
            {recentTransactions.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                No transactions recorded for the group yet.
              </p>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="hidden md:table-cell">Company</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTransactions.map((transaction) => {
                  const company = companies.find(
                    (item) => item.id === transaction.companyId
                  );
                  return (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <p className="max-w-[220px] truncate text-xs font-medium text-foreground">
                          {transaction.description}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {transaction.category}
                        </p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {company?.shortName}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(transaction.date)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            transaction.type === "income"
                              ? "text-xs font-semibold text-emerald-700"
                              : "text-xs font-semibold text-red-700"
                          }
                        >
                          {transaction.type === "income" ? "+" : "−"}
                          {formatUGX(transaction.amount).replace("UGX ", "")}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Needs attention</CardTitle>
              <CardDescription>Projects behind plan or on hold</CardDescription>
            </div>
            <Link
              href="/projects"
              className="text-xs font-semibold text-primary hover:underline"
            >
              All projects
            </Link>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {attention.map((project) => {
              const company = companies.find((item) => item.id === project.companyId);
              return (
                <div key={project.id} className="rounded-md border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {project.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {company?.shortName} · due {formatDate(project.due)}
                      </p>
                    </div>
                    <ProjectStatusBadge status={project.status} />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Progress value={project.progress} className="h-1.5" />
                    <span className="w-8 shrink-0 text-right text-[10px] font-semibold text-muted-foreground">
                      {project.progress}%
                    </span>
                  </div>
                </div>
              );
            })}
            {attention.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No projects need attention.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle>Subsidiary snapshot</CardTitle>
            <CardDescription>Year-to-date revenue, profit and headcount</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead className="hidden md:table-cell">Sector</TableHead>
                <TableHead className="hidden sm:table-cell">Managing director</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Profit</TableHead>
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
                  <TableCell className="hidden sm:table-cell">
                    <span className="text-xs text-muted-foreground">{company.md}</span>
                  </TableCell>
                  <TableCell className="text-right text-xs font-semibold">
                    {formatUGX(company.revenue)}
                  </TableCell>
                  <TableCell className="hidden text-right text-xs font-semibold lg:table-cell">
                    {formatUGX(company.profit)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">{company.staff}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
