import { notFound } from "next/navigation";
import { hasPermission } from "@d12/auth";
import {
  REPORT_AUDIENCES,
  TENANTS,
  audienceForRole,
  receivableAudiences,
  reportKindsForRole,
  roleMeta,
  type ReportAudience,
  type TenantId,
} from "@d12/contracts";
import { primaryRoleLabel, requireTenantPage } from "./session";
import {
  getUserProfile,
  highestTenantRole,
  listTeam,
  listTenantReports,
  listTenantShifts,
  type TenantShift,
} from "./desk-data";
import {
  NotificationCenter,
  ProfileEditor,
  ReportDesk,
  SettingsPanel,
  ShiftBoard,
  TeamBoard,
  type NoticeItem,
} from "./desk-ui";

const PANELS = ["reports", "team", "shifts", "notifications", "settings", "profile"] as const;
type Panel = (typeof PANELS)[number];

function isPanel(value: string): value is Panel {
  return (PANELS as readonly string[]).includes(value);
}

function periodDefaults(): { periodStart: string; periodEnd: string } {
  const end = new Date().toISOString().slice(0, 10);
  return { periodStart: `${end.slice(0, 7)}-01`, periodEnd: end };
}

export async function WorkspaceDeskPage({
  panel,
  tenantId,
}: {
  panel: string;
  tenantId: TenantId;
}) {
  if (!isPanel(panel)) notFound();
  const session = await requireTenantPage(tenantId, `/desk/${panel}`);
  const tenant = TENANTS[tenantId];
  const role = highestTenantRole(session.roles);
  const roleLabel = primaryRoleLabel(session);
  const isGlobal = roleMeta(role)?.scope === "global";
  const all = session.permissions.includes("*");

  if (panel === "reports") {
    if (!hasPermission(session, "reports.read") && !hasPermission(session, "reports.submit")) notFound();
    const reports = await listTenantReports(tenantId);
    const receivable: ReportAudience[] = all ? [...REPORT_AUDIENCES] : receivableAudiences(role);
    return (
      <ReportDesk
        tenantName={tenant.shortName}
        viewer={{
          id: session.sub,
          name: session.name,
          roleLabel,
          audience: audienceForRole(role),
          receivable,
          canSubmit: !isGlobal && hasPermission(session, "reports.submit"),
          canAcknowledge: receivable.length > 0,
        }}
        reports={reports}
        kinds={reportKindsForRole(role)}
        defaults={periodDefaults()}
      />
    );
  }

  if (panel === "team") {
    if (!hasPermission(session, "team.manage")) notFound();
    const members = await listTeam(tenantId);
    return <TeamBoard members={members} />;
  }

  if (panel === "shifts") {
    if (!hasPermission(session, "shifts.read")) notFound();
    const shifts = await listTenantShifts(tenantId);
    return <ShiftBoard shifts={shifts} />;
  }

  if (panel === "notifications") {
    if (!hasPermission(session, "notifications.read")) notFound();
    const [reports, shifts] = await Promise.all([listTenantReports(tenantId), listTenantShifts(tenantId)]);
    const receivable: ReportAudience[] = all ? [...REPORT_AUDIENCES] : receivableAudiences(role);
    const items: NoticeItem[] = [
      ...reports
        .filter((report) => report.authorId !== session.sub && receivable.includes(report.audience))
        .map((report) => ({
          id: `report-${report.id}`,
          title: `Report received: ${report.title}`,
          body: `${report.authorName} · submitted to your desk`,
          at: report.createdAt,
          tone: "report" as const,
        })),
      ...reports
        .filter((report) => report.authorId === session.sub && report.status === "acknowledged")
        .map((report) => ({
          id: `ack-${report.id}`,
          title: `Report acknowledged: ${report.title}`,
          body: `Confirmed by ${report.acknowledgedBy ?? "the receiving desk"}`,
          at: report.acknowledgedAt ?? report.createdAt,
          tone: "report" as const,
        })),
      ...shifts.slice(0, 20).map((shift: TenantShift) => ({
        id: `shift-${shift.id}`,
        title: `Shift closed by ${shift.name}`,
        body: `${shift.roleLabel} · ${shift.minutes >= 60 ? `${Math.floor(shift.minutes / 60)}h ${shift.minutes % 60}m` : `${shift.minutes}m`} recorded`,
        at: shift.endedAt,
        tone: "shift" as const,
      })),
    ].sort((left, right) => right.at.localeCompare(left.at));
    return <NotificationCenter items={items.slice(0, 40)} />;
  }

  if (panel === "profile") {
    const profile = await getUserProfile(session.sub);
    return (
      <ProfileEditor
        profile={profile}
        email={session.email}
        roleLabel={roleLabel}
        tenantName={tenant.shortName}
      />
    );
  }

  const profile = await getUserProfile(session.sub);
  return <SettingsPanel profile={profile} tenantName={tenant.shortName} roleLabel={roleLabel} />;
}
