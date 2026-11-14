"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  CalendarOff,
  Info,
  Pencil,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserPlus,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { HubRecord } from "@d12/contracts";
import { Badge, Card, cn } from "@d12/ui";
import { relativeTime } from "@/lib/format";
import { auditLabel } from "./hub-nav";

export interface DashboardAuditEntry {
  id: string;
  action: string;
  actor: string;
  target: string;
  at: string;
  detail?: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function CardTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-semibold text-navy">{title}</h2>
      {action}
    </div>
  );
}

function MetricCard({
  label,
  value,
  suffix,
  icon: Icon,
  tile,
  trend,
  trendUp,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon: LucideIcon;
  tile: string;
  trend: string;
  trendUp: boolean | null;
}) {
  const TrendIcon = trendUp === false ? TrendingDown : TrendingUp;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[13px] font-medium text-ink-soft">{label}</p>
          <p className="mt-2 flex items-baseline gap-2 text-3xl font-bold leading-none tracking-tight text-navy">
            {value}
            {suffix ? <span className="text-sm font-semibold text-emerald-600">{suffix}</span> : null}
          </p>
        </div>
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", tile)}>
          <Icon className="h-6 w-6" />
        </span>
      </div>
      <p className={cn("mt-4 flex items-center gap-1.5 text-xs font-medium", trendUp === null ? "text-ink-soft" : trendUp ? "text-emerald-600" : "text-red-600")}>
        {trendUp === null ? null : <TrendIcon className="h-3.5 w-3.5" />}
        {trend}
      </p>
    </Card>
  );
}

function Donut({ segments, total }: { segments: { label: string; value: number; color: string }[]; total: number }) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0" role="img" aria-label={`Employee overview: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`}>
      <circle cx="80" cy="80" r={radius} fill="none" stroke="#EEF2F7" strokeWidth="20" />
      {total
        ? segments.map((segment) => {
            const length = (segment.value / total) * circumference;
            const element = (
              <circle
                key={segment.label}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="20"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 80 80)"
              />
            );
            offset += length;
            return element;
          })
        : null}
      <text x="80" y="76" textAnchor="middle" className="fill-navy text-[26px] font-bold">{total}</text>
      <text x="80" y="96" textAnchor="middle" className="fill-slate-500 text-[11px]">Employees</text>
    </svg>
  );
}

function AttendanceChart({ present, absent }: { present: number[]; absent: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 560;
  const height = 230;
  const pad = { top: 16, right: 16, bottom: 30, left: 36 };
  const max = Math.max(4, ...present, ...absent);
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (index: number) => pad.left + (innerW / (DAYS.length - 1)) * index;
  const y = (value: number) => pad.top + innerH - (value / top) * innerH;
  const path = (values: number[]) => values.map((value, index) => `${index ? "L" : "M"}${x(index)},${y(value)}`).join(" ");
  const area = `${path(present)} L${x(DAYS.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Weekly attendance trend" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="present-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0066FF" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#0066FF" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick * step)} y2={y(tick * step)} stroke="#E4E7EC" strokeDasharray={tick ? "4 4" : undefined} />
            <text x={pad.left - 10} y={y(tick * step) + 4} textAnchor="end" className="fill-slate-400 text-[11px]">{tick * step}</text>
          </g>
        ))}
        {DAYS.map((day, index) => (
          <text key={day} x={x(index)} y={height - 8} textAnchor="middle" className={cn("text-[11px]", hover === index ? "fill-navy font-semibold" : "fill-slate-400")}>{day}</text>
        ))}
        <path d={area} fill="url(#present-fill)" />
        <path d={path(present)} fill="none" stroke="#0066FF" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={path(absent)} fill="none" stroke="#F04438" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={y(0)} stroke="#98A2B3" strokeDasharray="3 3" /> : null}
        {DAYS.map((day, index) => (
          <g key={`${day}-dots`}>
            <circle cx={x(index)} cy={y(present[index])} r={hover === index ? 5 : 3.5} fill="#fff" stroke="#0066FF" strokeWidth="2" />
            <circle cx={x(index)} cy={y(absent[index])} r={hover === index ? 5 : 3.5} fill="#fff" stroke="#F04438" strokeWidth="2" />
            <rect
              x={x(index) - innerW / (DAYS.length - 1) / 2}
              y={pad.top}
              width={innerW / (DAYS.length - 1)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
              onFocus={() => setHover(index)}
              tabIndex={0}
              aria-label={`${day}: ${present[index]} present, ${absent[index]} absent`}
            />
          </g>
        ))}
      </svg>
      {hover !== null ? (
        <div
          className="pointer-events-none absolute top-2 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-pop"
          style={{ left: `${(x(hover) / width) * 100}%`, transform: hover > 3 ? "translateX(calc(-100% - 10px))" : "translateX(10px)" }}
        >
          <p className="font-semibold text-navy">{DAYS[hover]}</p>
          <p className="mt-1 flex items-center gap-1.5 text-ink-soft"><span className="h-2 w-2 rounded-full bg-royal" />Present <b className="ml-auto pl-3 text-navy">{present[hover]}</b></p>
          <p className="flex items-center gap-1.5 text-ink-soft"><span className="h-2 w-2 rounded-full bg-[#F04438]" />Absent <b className="ml-auto pl-3 text-navy">{absent[hover]}</b></p>
        </div>
      ) : null}
    </div>
  );
}

function LeaveGauge({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const radius = 70;
  const length = Math.PI * radius;
  let offset = 0;
  return (
    <svg viewBox="0 0 180 104" className="mx-auto h-auto w-full max-w-[220px]" role="img" aria-label={`Leave requests this month: ${parts.map((p) => `${p.label} ${p.value}`).join(", ")}`}>
      <path d="M20,90 A70,70 0 0 1 160,90" fill="none" stroke="#EEF2F7" strokeWidth="16" strokeLinecap="round" />
      {total
        ? parts.map((part) => {
            const size = (part.value / total) * length;
            const element = part.value ? (
              <path
                key={part.label}
                d="M20,90 A70,70 0 0 1 160,90"
                fill="none"
                stroke={part.color}
                strokeWidth="16"
                strokeDasharray={`${size} ${length}`}
                strokeDashoffset={-offset}
              />
            ) : null;
            offset += size;
            return element;
          })
        : null}
      <text x="90" y="78" textAnchor="middle" className="fill-navy text-[26px] font-bold">{total}</text>
      <text x="90" y="96" textAnchor="middle" className="fill-slate-500 text-[11px]">Requests</text>
    </svg>
  );
}

const ACTIVITY_STYLE: Record<string, { icon: LucideIcon; tile: string }> = {
  "account.created": { icon: UserPlus, tile: "bg-emerald-50 text-emerald-600" },
  "account.updated": { icon: Pencil, tile: "bg-royal-50 text-royal" },
  "account.deleted": { icon: Trash2, tile: "bg-red-50 text-red-600" },
  "account.transferred": { icon: ArrowLeftRight, tile: "bg-violet-50 text-violet-600" },
};

export function HrDashboard({
  records,
  audit,
  now,
  mode,
}: {
  records: HubRecord[];
  audit: DashboardAuditEntry[];
  now: number;
  mode: "demo" | "supabase";
}) {
  const [week, setWeek] = useState<"this" | "last">("this");

  const stats = useMemo(() => {
    const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
    const today = new Date(`${todayKey}T00:00:00Z`);
    const current = monthKey(today);
    const previous = monthKey(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 15)));
    const employees = records.filter((record) => record.kind === "employees");
    const activeEmployees = employees.filter((record) => record.data.status === "active" && String(record.data.startOn) <= todayKey && (!record.data.endOn || String(record.data.endOn) >= todayKey));
    const activeIds = new Set(activeEmployees.map((record) => record.id));
    const attendance = records.filter((record) => record.kind === "attendance" && record.data.workOn === todayKey && activeIds.has(String(record.data.employeeId)));
    const requests = records.filter((record) => record.kind === "leave" && String(record.data.startOn).startsWith(current));
    const present = attendance.filter((record) => record.data.status === "present" || record.data.status === "late").length;
    const onLeave = new Set(records.filter((record) => record.kind === "leave" && record.data.status === "approved" && String(record.data.startOn) <= todayKey && String(record.data.endOn) >= todayKey && activeIds.has(String(record.data.employeeId))).map((record) => record.data.employeeId)).size;
    const countType = (type: string) => employees.filter((record) => record.data.employmentType === type).length;
    return {
      total: employees.length, active: activeEmployees.length,
      hires: employees.filter((record) => String(record.data.startOn).startsWith(current)).length,
      lastHires: employees.filter((record) => String(record.data.startOn).startsWith(previous)).length,
      onLeave, present, unrecorded: Math.max(0, activeEmployees.length - attendance.length - onLeave),
      permanent: countType("permanent"), contract: countType("contract"), interns: countType("intern"),
      others: employees.length - countType("permanent") - countType("contract") - countType("intern"),
      annual: requests.filter((record) => record.data.type === "annual").length,
      sick: requests.filter((record) => record.data.type === "sick").length,
      other: requests.filter((record) => record.data.type === "other").length,
      todayKey, monthLabel: today.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    };
  }, [records, now]);

  const trend = useMemo(() => {
    const date = new Date(`${stats.todayKey}T00:00:00Z`);
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7 - (week === "last" ? 7 : 0));
    const days = DAYS.map((_, index) => new Date(monday.getTime() + index * 86_400_000).toISOString().slice(0, 10));
    const entries = records.filter((record) => record.kind === "attendance");
    return {
      present: days.map((day) => entries.filter((record) => record.data.workOn === day && ["present", "late"].includes(String(record.data.status))).length),
      absent: days.map((day) => entries.filter((record) => record.data.workOn === day && record.data.status === "absent").length),
    };
  }, [records, stats.todayKey, week]);

  const presentRate = stats.active ? Math.round((stats.present / stats.active) * 100) : 0;
  const hireDelta = stats.hires - stats.lastHires;
  const overview = [
    { label: "Permanent", value: stats.permanent, color: "#0066FF" },
    { label: "Contract", value: stats.contract, color: "#12B76A" },
    { label: "Interns", value: stats.interns, color: "#F79009" },
    { label: "Other / unknown", value: stats.others, color: "#7A5AF8" },
  ];
  const leave = [
    { label: "Annual Leave", value: stats.annual, color: "#0066FF" },
    { label: "Sick Leave", value: stats.sick, color: "#F79009" },
    { label: "Other Leave", value: stats.other, color: "#7A5AF8" },
  ];
  const activities = audit.filter((entry) => entry.action !== "workspace.bootstrap").slice(0, 5);

  const quickActions: { label: string; icon: LucideIcon; tile: string; href: string }[] = [
    { label: "Add Employee", icon: UserPlus, tile: "bg-royal-50 text-royal", href: "/hr/team" },
    { label: "Manage Leave", icon: CalendarOff, tile: "bg-amber-50 text-amber-600", href: "/hr/leave" },
    { label: "Run Payroll", icon: Wallet, tile: "bg-emerald-50 text-emerald-600", href: "/hr/payroll" },
    { label: "View Reports", icon: BarChart3, tile: "bg-violet-50 text-violet-600", href: "/hr/reports" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-navy">HR Dashboard</h1>
            <Badge tone={mode === "supabase" ? "success" : "warning"}>{mode === "supabase" ? "Directory live" : "Directory demo"}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-soft">Your people at a glance across District 12 Group.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-navy">{stats.monthLabel}</span>
          <Link href="/hr/team" className="inline-flex h-9 items-center gap-2 rounded-lg bg-royal px-4 text-sm font-semibold text-white shadow-sm hover:bg-royal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40">
            <UserPlus className="h-4 w-4" />Add Employee
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Employees"
          value={stats.total}
          icon={UsersRound}
          tile="bg-royal-50 text-royal"
          trend={stats.hires ? `+${stats.hires} joined this month` : "No change this month"}
          trendUp={stats.hires ? true : null}
        />
        <MetricCard
          label="Present Today"
          value={stats.present}
          suffix={`${presentRate}%`}
          icon={UserCheck}
          tile="bg-emerald-50 text-emerald-600"
          trend={`${stats.unrecorded} employees unrecorded today`}
          trendUp={null}
        />
        <MetricCard
          label="On Leave"
          value={stats.onLeave}
          icon={CalendarOff}
          tile="bg-amber-50 text-amber-600"
          trend={`${stats.total ? Math.round((stats.onLeave / stats.total) * 100) : 0}% of workforce`}
          trendUp={null}
        />
        <MetricCard
          label="New Hires (This Month)"
          value={stats.hires}
          icon={UserPlus}
          tile="bg-violet-50 text-violet-600"
          trend={hireDelta === 0 ? "Same as last month" : `${hireDelta > 0 ? "+" : ""}${hireDelta} vs last month`}
          trendUp={hireDelta === 0 ? null : hireDelta > 0}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card className="p-5">
          <CardTitle title="Employee Overview" action={<Badge>Recorded</Badge>} />
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <Donut segments={overview} total={stats.total} />
            <ul className="w-full space-y-3">
              {overview.map((segment) => (
                <li key={segment.label} className="flex items-center gap-3 text-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                  <span className="flex-1 text-ink-soft">{segment.label}</span>
                  <span className="font-semibold text-navy">{segment.value}</span>
                  <span className="w-10 text-right text-xs text-slate-400">{stats.total ? Math.round((segment.value / stats.total) * 100) : 0}%</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
        <Card className="p-5">
          <CardTitle
            title="Attendance Trend"
            action={
              <div className="flex items-center gap-2">
                <select
                  aria-label="Attendance week"
                  value={week}
                  onChange={(event) => setWeek(event.target.value as "this" | "last")}
                  className="h-8 rounded-lg border border-line bg-white px-2 text-xs font-medium text-navy focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/10"
                >
                  <option value="this">This week</option>
                  <option value="last">Last week</option>
                </select>
              </div>
            }
          />
          <div className="mb-2 flex items-center gap-4 text-xs text-ink-soft">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-royal" />Present</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#F04438]" />Absent</span>
          </div>
          <AttendanceChart present={trend.present} absent={trend.absent} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="p-5">
          <CardTitle title="Leave Summary" action={<Badge>Recorded</Badge>} />
          <LeaveGauge parts={leave} />
          <ul className="mt-4 space-y-2.5">
            {leave.map((part) => (
              <li key={part.label} className="flex items-center gap-3 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: part.color }} />
                <span className="flex-1 text-ink-soft">{part.label}</span>
                <span className="font-semibold text-navy">{part.value}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <CardTitle title="Recent Activities" action={<Link href="/hr/employees" className="text-xs font-semibold text-royal hover:underline">View all</Link>} />
          {activities.length ? (
            <ul className="space-y-4">
              {activities.map((entry) => {
                const style = ACTIVITY_STYLE[entry.action] ?? { icon: Info, tile: "bg-slate-100 text-slate-600" };
                const Icon = style.icon;
                return (
                  <li key={entry.id} className="flex items-start gap-3">
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", style.tile)}><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-navy">{auditLabel(entry.action)}</p>
                      <p className="truncate text-xs text-ink-soft">{entry.detail ?? entry.target}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">{relativeTime(entry.at, now)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex h-40 flex-col items-center justify-center text-center">
              <p className="text-sm font-semibold text-navy">No HR activity yet</p>
              <p className="mt-1 max-w-[220px] text-xs text-ink-soft">New hires, record updates and transfers will appear here.</p>
            </div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2 xl:col-span-1">
          <CardTitle title="Quick Actions" />
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const content = (
                <>
                  <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", action.tile)}><action.icon className="h-5 w-5" /></span>
                  <span className="text-sm font-semibold text-navy">{action.label}</span>
                </>
              );
              const className = "flex min-h-[118px] flex-col items-center justify-center gap-2 rounded-xl border border-line p-3 text-center transition-colors";
              return <Link key={action.label} href={action.href} className={cn(className, "hover:border-royal/40 hover:bg-royal-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/30")}>{content}</Link>;
            })}
          </div>
        </Card>
      </div>

      <p className="flex items-start gap-2 text-xs text-ink-soft">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Headcount uses employment profiles, and hires use employment start dates. Attendance counts only recorded entries; unrecorded employees are not assumed absent. Leave totals come from saved requests.
      </p>
    </div>
  );
}
