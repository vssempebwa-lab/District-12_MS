import Link from "next/link";
import { Activity, ArrowRight, ArrowUpRight, Building2, Clock3, UsersRound, Wallet } from "lucide-react";
import { TENANTS, TENANT_IDS, type TenantId } from "@d12/contracts";
import {
  Badge,
  BrandMark,
  EmptyState,
  PageHeader,
  Panel,
  StatCard,
  TableShell,
  Td,
  Th,
  MiniBars,
  rowClass,
} from "@d12/ui";
import { RowLink } from "@/components/row-link";
import { WarehouseWindowTabs } from "@/components/warehouse-window-tabs";
import { listAccounts, listAudit } from "@/lib/accounts";
import { getShiftDay, shiftDay } from "@/lib/shifts";
import { getWarehouseOverview } from "@/lib/warehouse";
import { requirePermissionPage } from "@/lib/session-server";
import { formatNumber, formatUgx, relativeTime, relativeTimeLower, shortDay } from "@/lib/format";

export const metadata = { title: "Group overview — District 12" };
export const dynamic = "force-dynamic";

const TREND_WINDOWS = [14, 30, 90] as const;

function shiftTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { window?: string | string[] };
}) {
  await requirePermissionPage("iam.read");
  const requested = Number(Array.isArray(searchParams.window) ? searchParams.window[0] : searchParams.window);
  const windowDays = (TREND_WINDOWS as readonly number[]).includes(requested) ? requested : 14;

  const [directory, warehouse, audit, shiftsToday] = await Promise.all([
    listAccounts(),
    getWarehouseOverview(windowDays),
    listAudit(6),
    getShiftDay(shiftDay(), [...TENANT_IDS]),
  ]);

  const activeAccounts = directory.accounts.filter((account) => account.status === "active").length;
  const revenue30d = warehouse.tenants.reduce((sum, tenant) => sum + tenant.revenue30d, 0);
  const expenses30d = warehouse.tenants.reduce((sum, tenant) => sum + tenant.expenses30d, 0);
  const net30d = revenue30d - expenses30d;
  const revenuePoints = warehouse.daily.map((point) => point.revenue);
  const hasRevenue = revenuePoints.some((value) => value > 0);
  const latestBatch = warehouse.batches[0];
  const provisioning = audit.filter((entry) => entry.action !== "shift.ended");

  return (
    <div className="space-y-4">
      <PageHeader
        className="[&_h1]:text-navy [&_h1]:font-bold [&_p:first-child]:text-royal"
        eyebrow="Group overview"
        title="District 12 administration"
        description="Oversee the group, open subsidiary workspaces and manage HR through its dedicated module."
        actions={
          <>
            <Badge tone={warehouse.mode === "supabase" ? "success" : "warning"}>
              {warehouse.mode === "supabase" ? "Supabase warehouse" : "Demo warehouse"}
            </Badge>
            <Badge tone="info">{directory.mode === "supabase" ? "Directory live" : "Directory demo"}</Badge>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Subsidiaries"
          value={warehouse.tenants.length}
          hint="All connected to the hub"
          icon={<Building2 className="h-4 w-4" />}
        />
        <StatCard
          label="Directory accounts"
          value={formatNumber(directory.accounts.length)}
          hint={`${activeAccounts} active · ${directory.accounts.length - activeAccounts} suspended`}
          icon={<UsersRound className="h-4 w-4" />}
          accent="blue"
        />
        <StatCard
          label="Telemetry events"
          value={formatNumber(warehouse.totalEvents)}
          hint={`Last batch ${relativeTimeLower(warehouse.lastReceivedAt)}`}
          icon={<Activity className="h-4 w-4" />}
          accent="green"
        />
        <StatCard
          label="Revenue · 30 days"
          value={formatUgx(revenue30d)}
          hint={`${formatUgx(net30d)} net after ${formatUgx(expenses30d)} costs`}
          icon={<Wallet className="h-4 w-4" />}
          accent="violet"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Subsidiaries"
          subtitle="Jump into any workspace with the shared session."
          className="border-0 xl:col-span-2 [&>header]:bg-navy [&>header]:px-5 [&>header]:py-4 [&>header_h2]:text-white [&>header_p]:text-slate-300"
          action={
            <Link
              href="/warehouse"
              className="inline-flex items-center gap-1 rounded text-xs font-medium text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Warehouse
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
          bodyClassName="p-0"
        >
          <TableShell className="relative rounded-none border-0">
            <thead>
              <tr>
                <Th>Subsidiary</Th>
                <Th className="text-right">Revenue 30d</Th>
                <Th className="text-right">Sales</Th>
                <Th className="text-right">Leads</Th>
                <Th className="text-right">Tasks</Th>
                <Th>Last event</Th>
                <Th><span className="sr-only">Open</span></Th>
              </tr>
            </thead>
            <tbody>
              {warehouse.tenants.map((tenant) => {
                const meta = TENANTS[tenant.tenantId];
                return (
                  <RowLink
                    key={tenant.tenantId}
                    href={`/api/auth/handoff?tenant=${tenant.tenantId}`}
                    className={rowClass}
                  >
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <BrandMark
                          mark={meta.mark}
                          color={meta.color}
                          logo={meta.logo}
                          alt={`${meta.shortName} logo`}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{meta.shortName}</p>
                          <p className="truncate text-[11px] text-ink-mute">{meta.sector}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-right tabular-nums">{formatUgx(tenant.revenue30d)}</Td>
                    <Td className="text-right tabular-nums">{formatNumber(tenant.transactions30d)}</Td>
                    <Td className="text-right tabular-nums">{formatNumber(tenant.leads30d)}</Td>
                    <Td className="text-right tabular-nums">{formatNumber(tenant.tasks30d)}</Td>
                    <Td className="whitespace-nowrap text-xs text-ink-soft">
                      {relativeTime(tenant.lastEventAt)}
                    </Td>
                    <Td className="text-right">
                      <a
                        href={`/api/auth/handoff?tenant=${tenant.tenantId}`}
                        aria-label={`Open ${meta.shortName} workspace`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-navy hover:bg-canvas"
                      >
                        Open
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    </Td>
                  </RowLink>
                );
              })}
            </tbody>
          </TableShell>
        </Panel>

        <Panel
          title="Group P&L · 30 days"
          subtitle="Paid sales against operating expenses."
          className="xl:col-span-2"
          action={<Link href="/finance" className="text-xs font-semibold text-royal hover:underline">Finance dashboard</Link>}
        >
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-canvas px-3.5 py-2.5">
              <dt className="text-[11px] font-medium text-ink-soft">Revenue</dt>
              <dd className="mt-1 text-lg font-semibold tracking-tight text-ink">
                {formatUgx(revenue30d)}
              </dd>
            </div>
            <div className="rounded-lg bg-canvas px-3.5 py-2.5">
              <dt className="text-[11px] font-medium text-ink-soft">Expenses</dt>
              <dd className="mt-1 text-lg font-semibold tracking-tight text-ink">
                −{formatUgx(expenses30d)}
              </dd>
            </div>
            <div className="rounded-lg bg-canvas px-3.5 py-2.5">
              <dt className="text-[11px] font-medium text-ink-soft">Net profit</dt>
              <dd
                className={`mt-1 text-lg font-semibold tracking-tight ${
                  net30d >= 0 ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {formatUgx(net30d)}
              </dd>
            </div>
          </dl>
        </Panel>

        <div className="space-y-4 xl:contents xl:space-y-0">
          <Panel
            title={`Revenue · last ${windowDays} days`}
            subtitle={`${formatUgx(warehouse.daily.reduce((sum, day) => sum + day.revenue, 0))} ingested`}
            action={<WarehouseWindowTabs windowDays={windowDays} />}
          >
            {hasRevenue ? (
              <>
                <MiniBars values={revenuePoints} color="#0066FF" height={72} />
                <div className="mt-2 flex justify-between text-[10px] text-ink-mute">
                  <span>{warehouse.daily[0] ? shortDay(warehouse.daily[0].day) : ""}</span>
                  <span>
                    {warehouse.daily.length
                      ? shortDay(warehouse.daily[warehouse.daily.length - 1].day)
                      : ""}
                  </span>
                </div>
              </>
            ) : (
              <EmptyState
                title="No sales events yet"
                description="Open a subsidiary workspace and record activity — telemetry flows back here automatically."
              />
            )}
          </Panel>

          <Panel title="Recent ingestion" subtitle="Signed batches received by the hub.">
            {warehouse.batches.length ? (
              <ul className="space-y-2">
                {warehouse.batches.slice(0, 4).map((batch) => {
                  const meta = TENANTS[batch.tenantId as TenantId];
                  return (
                    <li key={batch.id}>
                      <Link
                        href="/warehouse"
                        className="-mx-1 flex items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-canvas"
                      >
                        <BrandMark
                          mark={meta?.mark ?? "?"}
                          color={meta?.color ?? "#94A3B8"}
                          logo={meta?.logo}
                          alt={meta ? `${meta.shortName} logo` : "Subsidiary"}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-ink">
                            {meta?.shortName ?? batch.tenantId}
                          </p>
                          <p className="text-[11px] text-ink-mute">
                            {batch.eventCount} {batch.eventCount === 1 ? "event" : "events"} ·{" "}
                            {relativeTime(batch.receivedAt)}
                          </p>
                        </div>
                        <Badge tone={batch.accepted > 0 ? "success" : "neutral"}>
                          +{batch.accepted}
                        </Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                title="Waiting for the first batch"
                description="Batches appear here after a subsidiary flushes its telemetry outbox."
              />
            )}
            {latestBatch ? (
              <p className="mt-3 border-t border-line pt-2 text-[11px] text-ink-mute">
                Last signed flush {relativeTimeLower(latestBatch.receivedAt)}.
              </p>
            ) : null}
          </Panel>
        </div>
      </div>

      <Panel
        title="Shift sign-outs · today"
        subtitle="Closures recorded when staff end a shift or sign out of a workspace."
        action={
          <Link
            href="/shifts"
            className="inline-flex items-center gap-1 text-xs font-medium text-royal hover:underline"
          >
            Shift log
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
        bodyClassName="p-0"
      >
        {shiftsToday.totals.count ? (
          <>
            <TableShell className="relative rounded-none border-0">
              <thead>
                <tr>
                  <Th>Subsidiary</Th>
                  <Th className="text-right">People</Th>
                  <Th className="text-right">Shifts</Th>
                  <Th className="text-right">Time recorded</Th>
                  <Th>Last sign-out</Th>
                  <Th><span className="sr-only">Open</span></Th>
                </tr>
              </thead>
              <tbody>
                {shiftsToday.summary
                  .filter((row) => row.count > 0)
                  .map((row) => {
                    const meta = TENANTS[row.tenantId];
                    return (
                      <RowLink
                        key={row.tenantId}
                        href={`/shifts?tenant=${row.tenantId}`}
                        className={rowClass}
                      >
                        <Td>
                          <div className="flex items-center gap-2.5">
                            <BrandMark
                              mark={meta.mark}
                              color={meta.color}
                              logo={meta.logo}
                              alt={`${meta.shortName} logo`}
                              size="sm"
                            />
                            <p className="truncate text-sm font-medium text-ink">{meta.shortName}</p>
                          </div>
                        </Td>
                        <Td className="text-right tabular-nums">{row.people}</Td>
                        <Td className="text-right tabular-nums">{row.count}</Td>
                        <Td className="text-right tabular-nums">{shiftTime(row.minutes)}</Td>
                        <Td className="whitespace-nowrap text-xs text-ink-soft">
                          {row.lastEndedAt ? relativeTime(row.lastEndedAt) : "—"}
                        </Td>
                        <Td className="text-right">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-navy">
                            Open
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </span>
                        </Td>
                      </RowLink>
                    );
                  })}
              </tbody>
            </TableShell>
            <p className="flex items-center gap-1.5 border-t border-line px-4 py-2 text-[11px] text-ink-mute">
              <Clock3 className="h-3.5 w-3.5" />
              {shiftsToday.totals.people} people · {shiftTime(shiftsToday.totals.minutes)} recorded today
              {shiftsToday.mode === "demo" ? " · demo records" : ""}
            </p>
          </>
        ) : (
          <EmptyState
            title="No shift sign-outs yet today"
            description="Staff end their shift from the sidebar of their workspace; the record appears here for the group."
          />
        )}
      </Panel>

      <Panel
        title="Provisioning activity"
        subtitle="Directory changes from the HR workspace."
        action={
          <Link
            href="/hr/employees"
            className="inline-flex items-center gap-1 text-xs font-medium text-royal hover:underline"
          >
            Manage accounts
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
        bodyClassName="p-0"
      >
        {provisioning.length ? (
          <ul className="divide-y divide-line">
            {provisioning.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-ink">
                    <span className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">
                      {entry.action}
                    </span>{" "}
                    {entry.detail ?? entry.target}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-ink-mute">
                    {entry.actor} → {entry.target || "—"}
                  </p>
                </div>
                <span className="text-[11px] text-ink-mute">{relativeTime(entry.at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No provisioning activity yet" />
        )}
      </Panel>
    </div>
  );
}
