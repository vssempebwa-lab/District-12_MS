import Link from "next/link";
import { CalendarDays, Clock3, RefreshCw, UsersRound } from "lucide-react";
import {
  TENANTS,
  hubDate,
  isTenantId,
  type ShiftEndVia,
  type TenantId,
} from "@d12/contracts";
import {
  Avatar,
  Badge,
  BrandMark,
  EmptyState,
  PageHeader,
  Panel,
  StatCard,
  TableShell,
  Td,
  Th,
} from "@d12/ui";
import { requirePermissionPage } from "@/lib/session-server";
import { getShiftDay, shiftDay } from "@/lib/shifts";
import { relativeTime } from "@/lib/format";

export const metadata = { title: "Shift sign-outs — District 12" };
export const dynamic = "force-dynamic";

function shiftTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kampala",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function dayLabel(day: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kampala",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${day}T12:00:00+03:00`));
}

function viaLabel(via: ShiftEndVia): string {
  return via === "signout" ? "Signed out" : "Ended shift";
}

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: { day?: string | string[]; tenant?: string | string[] };
}) {
  const session = await requirePermissionPage("shifts.read");
  const rawDay = Array.isArray(searchParams.day) ? searchParams.day[0] : searchParams.day;
  const parsedDay = rawDay ? hubDate.safeParse(rawDay) : null;
  const day = parsedDay?.success ? parsedDay.data : shiftDay();

  const rawTenant = Array.isArray(searchParams.tenant) ? searchParams.tenant[0] : searchParams.tenant;
  const tenant =
    rawTenant && isTenantId(rawTenant) && session.tenants.includes(rawTenant) ? rawTenant : null;
  const tenants: TenantId[] = tenant ? [tenant] : session.tenants;

  const view = await getShiftDay(day, tenants);
  const reporting = view.summary.filter((row) => row.count > 0);
  const isToday = day === shiftDay();

  return (
    <div className="space-y-4">
      <PageHeader
        className="[&_h1]:font-bold [&_h1]:text-navy [&_p:first-child]:text-royal"
        eyebrow="People operations"
        title="Shift sign-outs"
        description="Every shift ended or signed out from a subsidiary workspace, with who closed it and when."
        actions={
          <>
            <Badge tone={view.mode === "supabase" ? "success" : "warning"}>
              {view.mode === "supabase" ? "Live records" : "Demo records"}
            </Badge>
            <Badge tone="info">{tenant ? TENANTS[tenant].shortName : "All subsidiaries"}</Badge>
            <form action="/shifts" method="get" className="flex flex-wrap items-center gap-2">
              {tenant ? <input type="hidden" name="tenant" value={tenant} /> : null}
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-1.5 text-xs text-ink-soft">
                <CalendarDays className="h-3.5 w-3.5" />
                <input
                  type="date"
                  name="day"
                  defaultValue={day}
                  className="bg-transparent text-xs text-ink outline-none"
                />
              </label>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-navy hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Show day
              </button>
            </form>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Shifts closed"
          value={view.totals.count}
          hint={dayLabel(day)}
          icon={<Clock3 className="h-4 w-4" />}
        />
        <StatCard
          label="People"
          value={view.totals.people}
          hint="Distinct staff who closed a shift"
          icon={<UsersRound className="h-4 w-4" />}
          accent="blue"
        />
        <StatCard
          label="Time recorded"
          value={shiftTime(view.totals.minutes)}
          hint="Total worked time across closures"
          icon={<Clock3 className="h-4 w-4" />}
          accent="green"
        />
        <StatCard
          label="Subsidiaries reporting"
          value={`${reporting.length}/${view.summary.length}`}
          hint={isToday ? "Today so far" : "For the selected day"}
          icon={<CalendarDays className="h-4 w-4" />}
          accent="violet"
        />
      </div>

      <Panel
        title={tenant ? `${TENANTS[tenant].shortName} shift log` : "Group shift log"}
        subtitle={`${dayLabel(day)} · times shown in Africa/Kampala`}
        action={
          <div className="flex items-center gap-3 text-xs font-medium">
            {tenant ? (
              <Link href={`/shifts?day=${day}`} className="text-royal hover:underline">
                All subsidiaries
              </Link>
            ) : null}
            {!isToday ? (
              <Link href="/shifts" className="text-royal hover:underline">
                Today
              </Link>
            ) : null}
          </div>
        }
        bodyClassName="p-0"
      >
        {view.shifts.length ? (
          <>
            <TableShell className="rounded-none border-0">
              <thead>
                <tr>
                  <Th>Person</Th>
                  <Th>Subsidiary</Th>
                  <Th>Role</Th>
                  <Th>Started</Th>
                  <Th>Ended</Th>
                  <Th className="text-right">Duration</Th>
                  <Th>Closed by</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {view.shifts.slice(0, 300).map((shift) => {
                  const meta = TENANTS[shift.tenantId];
                  return (
                    <tr key={shift.id} className="hover:bg-canvas/60">
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={shift.name} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink">{shift.name}</p>
                            <p className="truncate text-[11px] text-ink-mute">
                              {shift.note ?? shift.email}
                            </p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <BrandMark
                            mark={meta.mark}
                            color={meta.color}
                            logo={meta.logo}
                            alt={`${meta.shortName} logo`}
                            size="sm"
                          />
                          <span className="text-xs font-medium text-ink-soft">{meta.shortName}</span>
                        </div>
                      </Td>
                      <Td className="text-xs text-ink-soft">{shift.roleLabel}</Td>
                      <Td className="whitespace-nowrap text-xs tabular-nums text-ink-soft">
                        {clock(shift.startedAt)}
                      </Td>
                      <Td className="whitespace-nowrap text-xs tabular-nums text-ink-soft">
                        {clock(shift.endedAt)}
                      </Td>
                      <Td className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-ink">
                        {shiftTime(shift.minutes)}
                      </Td>
                      <Td>
                        <Badge tone={shift.endedVia === "signout" ? "neutral" : "info"}>
                          {viaLabel(shift.endedVia)}
                        </Badge>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
            {view.shifts.length > 300 ? (
              <p className="border-t border-line px-4 py-2 text-[11px] text-ink-mute">
                Showing the latest 300 of {view.shifts.length} closures.
              </p>
            ) : null}
          </>
        ) : (
          <EmptyState
            title="Nothing closed on this day"
            description="Staff end their shift from the sidebar of their workspace, or automatically when they sign out."
          />
        )}
      </Panel>

      <p className="text-[11px] text-ink-mute">
        Last closure{" "}
        {view.shifts[0] ? relativeTime(view.shifts[0].endedAt) : "—"} · A shift starts at sign-in and
        restarts after each recorded closure.
      </p>
    </div>
  );
}
