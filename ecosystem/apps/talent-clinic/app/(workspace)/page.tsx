import Link from "next/link";
import { Folder, Plus, Users } from "lucide-react";
import { PageHeader, Card, StatCard, Button, ProgressBar } from "@d12/ui";
import { getWorkspaceOverview } from "@d12/tenant-workspace/server";
import { personalWorkName, requireTenantPage } from "@d12/tenant-workspace/server";
import { listEntity } from "@d12/tenant-workspace/server";
import type { CustomerRecord, ProjectRecord } from "@d12/contracts";
import { TENANT, TENANT_ID } from "@/lib/tenant";
import { formatNumber, formatUgx, shortDate } from "@d12/tenant-workspace";

export const dynamic = "force-dynamic";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function cohortProgress(start: string) {
  const s = new Date(start); const e = new Date(start);
  e.setDate(e.getDate() + 42);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  if (now < s) return { label: "Upcoming", pct: 0, daysLeft: Math.ceil((s.getTime() - now.getTime()) / 86400000) };
  if (now > e) return { label: "Completed", pct: 100, daysLeft: 0 };
  const elapsed = Math.floor((now.getTime() - s.getTime()) / 86400000);
  const week = Math.min(6, Math.floor(elapsed / 7) + 1);
  const daysLeft = Math.ceil((e.getTime() - now.getTime()) / 86400000);
  return { label: `Week ${week} of 6`, pct: Math.min(100, Math.round((elapsed / 42) * 100)), daysLeft };
}

export default async function OverviewPage() {
  const session = await requireTenantPage(TENANT_ID);
  const overview = await getWorkspaceOverview(TENANT_ID);
  const personal = personalWorkName(session) !== null;

  const [projectRows, customerRows] = await Promise.all([
    listEntity(TENANT_ID, "projects"),
    listEntity(TENANT_ID, "customers"),
  ]);
  const cohorts = projectRows as ProjectRecord[];
  const participants = customerRows as CustomerRecord[];

  const activeCohort = cohorts.find((c) => c.status === "active") ?? cohorts[0];
  const progress = activeCohort ? cohortProgress(activeCohort.startDate || activeCohort.dueOn || "") : null;

  const clinicCounts: Record<string, number> = {};
  const sessionCounts: Record<string, number> = {};
  participants.forEach((p) => {
    clinicCounts[p.clinic || "—"] = (clinicCounts[p.clinic || "—"] || 0) + 1;
    sessionCounts[p.programSession || "—"] = (sessionCounts[p.programSession || "—"] || 0) + 1;
  });

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={TENANT.sector}
        title={`${TENANT.shortName} workspace`}
        description={personal ? `Welcome back, ${session.name.split(/\s+/)[0]}.` : `Welcome back, ${session.name.split(/\s+/)[0]}.`}
      />

      {activeCohort && progress ? (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">{activeCohort.name}</p>
              <p className="text-xs text-ink-soft">
                {shortDate(activeCohort.startDate || activeCohort.dueOn)} → {shortDate(addDays(activeCohort.startDate || activeCohort.dueOn || "", 42))} · {activeCohort.durationWeeks ?? 6} weeks · {activeCohort.programSession || "—"}
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-700">
              {progress.label}{progress.daysLeft > 0 ? ` · ${progress.daysLeft} days remaining` : ""}
            </span>
          </div>
          <div className="mt-3">
            <ProgressBar value={progress.pct} />
          </div>
          <div className="mt-3 grid grid-cols-6 gap-1">
            {[1, 2, 3, 4, 5, 6].map((w) => {
              const week = Math.min(6, Math.floor((Date.now() - new Date(activeCohort.startDate || activeCohort.dueOn || "").getTime()) / (7 * 86400000)) + 1);
              const done = w < week;
              const current = w === week;
              return (
                <div
                  key={w}
                  className={`rounded-md px-1 py-1 text-center text-[10px] font-semibold ${done ? "bg-emerald-100 text-emerald-700" : current ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}
                >
                  Week {w}
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cohorts" value={formatNumber(cohorts.length)} hint={`${cohorts.filter((c) => c.status === "active").length} active`} icon={<Folder className="h-4 w-4" />} accent="blue" />
        <StatCard label="Participants" value={formatNumber(participants.length)} hint={`${participants.filter((p) => p.status === "paid").length} paid`} icon={<Users className="h-4 w-4" />} accent="violet" />
        <StatCard label="Fees collected" value={formatUgx(participants.reduce((s, p) => s + Number(p.paidTotal ?? 0), 0))} hint="UGX" icon={<Folder className="h-4 w-4" />} accent="green" />
        <StatCard label="Outstanding" value={formatUgx(participants.reduce((s, p) => s + Number(p.lifetimeValue ?? 0) - Number(p.paidTotal ?? 0), 0))} hint="UGX" icon={<Folder className="h-4 w-4" />} accent="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold text-ink">Clinic track distribution</p>
          {Object.entries(clinicCounts).map(([name, count]) => {
            const max = Math.max(1, ...Object.values(clinicCounts));
            return (
              <div key={name} className="mb-2 flex items-center gap-2">
                <span className="w-40 truncate text-xs text-ink-soft">{name}</span>
                <div className="h-2 flex-1 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(count / max) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-xs font-semibold text-navy">{count}</span>
              </div>
            );
          })}
          {Object.keys(clinicCounts).length === 0 ? <p className="text-xs text-ink-soft">No participants yet.</p> : null}
        </Card>
        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold text-ink">Programme session distribution</p>
          {Object.entries(sessionCounts).map(([name, count]) => {
            const max = Math.max(1, ...Object.values(sessionCounts));
            return (
              <div key={name} className="mb-2 flex items-center gap-2">
                <span className="w-40 truncate text-xs text-ink-soft">{name.split(" (")[0]}</span>
                <div className="h-2 flex-1 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(count / max) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-xs font-semibold text-navy">{count}</span>
              </div>
            );
          })}
          {Object.keys(sessionCounts).length === 0 ? <p className="text-xs text-ink-soft">No participants yet.</p> : null}
        </Card>
      </div>

      <div className="flex gap-2">
        <Link href="/projects">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Create cohort
          </Button>
        </Link>
        <Link href="/customers">
          <Button size="sm" variant="secondary">
            <Users className="h-4 w-4" />
            Register participant
          </Button>
        </Link>
      </div>
    </div>
  );
}
