import Link from "next/link";
import {
  ArrowUpRight,
  ListChecks,
  TrendingUp,
  UsersRound,
  Wallet,
} from "lucide-react";
import type { TenantMeta } from "@d12/contracts";
import {
  Badge,
  MiniBars,
  Panel,
  PageHeader,
  ProgressBar,
  StatCard,
  buttonStyles,
  cn,
  type Tone,
} from "@d12/ui";
import type { WorkspaceOverview } from "./data";
import { formatNumber, formatUgx, relativeTime, shortDate, titleCase } from "./format";
import { allowsAll } from "./permissions";
import { SyncButton } from "./sync-button";

function stageTone(stage: string): Tone {
  switch (stage) {
    case "won":
      return "success";
    case "qualified":
      return "brand";
    case "contacted":
      return "warning";
    case "lost":
      return "danger";
    default:
      return "info";
  }
}

function saleTone(status: string): Tone {
  if (status === "paid") return "success";
  if (status === "pending") return "warning";
  return "danger";
}

export function WorkspaceDashboard({
  tenant,
  userName,
  overview,
  permissions,
  personal = false,
}: {
  tenant: TenantMeta;
  userName: string;
  overview: WorkspaceOverview;
  permissions: string[];
  personal?: boolean;
}) {
  const firstName = userName.split(/\s+/)[0] || "there";
  const revenue14 = overview.revenue14.reduce((sum, value) => sum + value, 0);
  const maxStageCount = Math.max(1, ...overview.pipelineByStage.map((bucket) => bucket.count));
  const taskTotal = overview.tasksOpen + overview.tasksDone;
  const taskDonePercent = taskTotal ? Math.round((overview.tasksDone / taskTotal) * 100) : 0;
  const canLeads = allowsAll(permissions, ["leads.read"]);
  const canCustomers = allowsAll(permissions, ["customers.read"]);
  const canSales = allowsAll(permissions, ["sales.read"]);
  const canTasks = allowsAll(permissions, ["tasks.read"]);
  const canSync = allowsAll(permissions, ["telemetry.write"]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={tenant.sector}
        title={`${tenant.shortName} workspace`}
        description={
          personal
            ? `${tenant.tagline}. Welcome back, ${firstName} — this is your own workload.`
            : `${tenant.tagline}. Welcome back, ${firstName}.`
        }
        actions={canSync ? <SyncButton pending={overview.pendingEvents} /> : undefined}
      />

      {canLeads || canSales || canCustomers || canTasks ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {canLeads ? (
            <StatCard
              label="Open pipeline"
              value={formatUgx(overview.pipelineValue)}
              hint={`${overview.openLeads} active lead${overview.openLeads === 1 ? "" : "s"}`}
              icon={<TrendingUp className="h-4 w-4" />}
              accent="blue"
            />
          ) : null}
          {canSales ? (
            <StatCard
              label="Revenue · 30 days"
              value={formatUgx(overview.revenue30)}
              hint={`${formatUgx(overview.net30)} net after ${formatUgx(overview.expenses30)} expenses`}
              icon={<Wallet className="h-4 w-4" />}
              accent="green"
            />
          ) : null}
          {canCustomers ? (
            <StatCard
              label="Active customers"
              value={formatNumber(overview.customersActive)}
              hint={`${formatUgx(overview.customerValue)} lifetime value`}
              icon={<UsersRound className="h-4 w-4" />}
              accent="violet"
            />
          ) : null}
          {canTasks ? (
            <StatCard
              label="Open tasks"
              value={formatNumber(overview.tasksOpen)}
              hint={`${overview.tasksOverdue} overdue`}
              icon={<ListChecks className="h-4 w-4" />}
              accent={overview.tasksOverdue > 0 ? "amber" : "navy"}
            />
          ) : null}
        </div>
      ) : null}

      {canSales || canLeads ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {canSales ? (
            <Panel
              className={canLeads ? "lg:col-span-2" : "lg:col-span-3"}
              title="Revenue, last 14 days"
              subtitle={`${formatUgx(revenue14)} collected · ${formatUgx(overview.revenue30)} in the last 30 days`}
              action={
                <Link href="/sales" className={buttonStyles("ghost", "sm")}>
                  All sales
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              }
            >
              <MiniBars values={overview.revenue14} color={tenant.accent ?? tenant.color} height={88} />
              <div className="mt-3 flex items-center justify-between text-[11px] text-ink-mute">
                <span>14 days ago</span>
                <span>Today</span>
              </div>
            </Panel>
          ) : null}

          {canLeads ? (
            <Panel
              title="Pipeline by stage"
              subtitle={`${formatUgx(overview.wonValue)} already won`}
              action={
                <Link href="/leads" className={buttonStyles("ghost", "sm")}>
                  Leads
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              }
            >
              <ul className="space-y-2.5">
                {overview.pipelineByStage.map((bucket) => (
                  <li key={bucket.stage}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-ink">{titleCase(bucket.stage)}</span>
                      <span className="text-ink-mute">
                        {bucket.count} · {formatUgx(bucket.value)}
                      </span>
                    </div>
                    <ProgressBar
                      value={(bucket.count / maxStageCount) * 100}
                      color={tenant.accent ?? tenant.color}
                      className="mt-1"
                    />
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      ) : null}

      {canSales || canLeads ? (
        <div className={canSales && canLeads ? "grid gap-4 lg:grid-cols-2" : "grid gap-4"}>
          {canSales ? (
            <Panel
              title="Recent sales"
              subtitle="Every paid invoice already lives in the group warehouse"
              action={
                <Link href="/sales" className={buttonStyles("ghost", "sm")}>
                  View
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              }
            >
              {overview.recentSales.length ? (
                <ul className="divide-y divide-line">
                  {overview.recentSales.map((sale) => (
                    <li key={sale.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{sale.description}</p>
                        <p className="truncate text-[11px] text-ink-mute">
                          {sale.customerName || "Walk-in"} · {shortDate(sale.occurredOn)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-ink">{formatUgx(sale.amount)}</p>
                        <Badge tone={saleTone(sale.status)}>{titleCase(sale.status)}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-ink-soft">
                  {personal ? "Nothing recorded under your name yet." : "No sales recorded yet."}
                </p>
              )}
            </Panel>
          ) : null}

          {canLeads ? (
            <Panel
              title="Needs attention"
              subtitle="Newest conversations still in the pipeline"
              action={
                <Link href="/leads" className={buttonStyles("ghost", "sm")}>
                  Pipeline
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              }
            >
              {overview.activeLeads.length ? (
                <ul className="divide-y divide-line">
                  {overview.activeLeads.map((lead) => (
                    <li key={lead.id} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{lead.name}</p>
                        <p className="truncate text-[11px] text-ink-mute">
                          {lead.nextStep || lead.company || "No next step yet"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-ink">{formatUgx(lead.value)}</p>
                        <Badge tone={stageTone(lead.stage)}>{titleCase(lead.stage)}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-ink-soft">
                  {personal
                    ? "No leads are assigned to you right now."
                    : "Nothing open — the pipeline is clear."}
                </p>
              )}
            </Panel>
          ) : null}
        </div>
      ) : null}

      {canTasks || canSync ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {canTasks ? (
            <Panel title="Task load" subtitle={`${taskTotal} tasks tracked`}>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">Open</span>
                  <span className="font-semibold text-ink">{overview.tasksOpen}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">Overdue</span>
                  <Badge tone={overview.tasksOverdue > 0 ? "danger" : "success"}>
                    {overview.tasksOverdue}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">Completed</span>
                  <span className="font-semibold text-ink">{overview.tasksDone}</span>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[11px] text-ink-mute">
                    <span>Completion</span>
                    <span>{taskDonePercent}%</span>
                  </div>
                  <ProgressBar value={taskDonePercent} color={tenant.accent ?? tenant.color} className="mt-1" />
                </div>
              </div>
            </Panel>
          ) : null}

          {canSync ? (
            <Panel
              className={canTasks ? "lg:col-span-2" : "lg:col-span-3"}
              title="Warehouse sync"
              subtitle="Signed batches stream to the group ingestion API"
              action={
                <Badge tone={overview.pendingEvents > 0 ? "warning" : "success"}>
                  {overview.pendingEvents > 0 ? `${overview.pendingEvents} queued` : "Queue clear"}
                </Badge>
              }
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-line bg-canvas/60 px-3 py-2">
                  <p className="text-[11px] text-ink-mute">Queued events</p>
                  <p className="mt-1 text-lg font-semibold text-ink">{overview.pendingEvents}</p>
                </div>
                <div className="rounded-lg border border-line bg-canvas/60 px-3 py-2">
                  <p className="text-[11px] text-ink-mute">Last change</p>
                  <p className="mt-1 text-sm font-medium text-ink">{relativeTime(overview.lastActivity)}</p>
                </div>
                <div className="rounded-lg border border-line bg-canvas/60 px-3 py-2">
                  <p className="text-[11px] text-ink-mute">Records tracked</p>
                  <p className="mt-1 text-lg font-semibold text-ink">
                    {Object.values(overview.counts).reduce((sum, value) => sum + value, 0)}
                  </p>
                </div>
              </div>
              <p className={cn("mt-3 text-xs text-ink-soft")}>
                Each create, update or delete writes to the tenant outbox. Syncing signs the batch with
                this subsidiary&apos;s HMAC secret and posts it to <code className="text-[11px]">/api/ingest/v1/events</code> on
                the hub.
              </p>
            </Panel>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
