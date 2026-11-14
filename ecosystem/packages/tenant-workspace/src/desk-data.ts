import { serviceCall } from "@d12/db";
import { newId } from "@d12/telemetry";
import {
  REPORT_AUDIENCE_LABELS,
  roleMeta,
  type InvoiceRecord,
  type LeadRecord,
  type ProjectRecord,
  type ReportDraft,
  type ReportKind,
  type SaleRecord,
  type StaffRecord,
  type TaskRecord,
  type TenantId,
  type TenantReport,
  type TransactionRecord,
} from "@d12/contracts";
import { listEntity } from "./data";
import { ACCENTS, type TeamMember, type TenantShift, type WorkspaceProfile } from "./desk-types";

export * from "./desk-types";

export const REPORTS_TABLE = "d12_reports";
export const PROFILES_TABLE = "d12_user_profiles";

interface ReportRow {
  id: string;
  tenant_id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  audience: TenantReport["audience"];
  kind: ReportKind;
  title: string;
  summary: string;
  highlights: string | null;
  risks: string | null;
  next_steps: string | null;
  period_start: string;
  period_end: string;
  metrics: Record<string, number> | null;
  status: "submitted" | "acknowledged";
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

function rowToReport(row: ReportRow): TenantReport {
  return {
    id: row.id,
    tenantId: row.tenant_id as TenantId,
    authorId: row.author_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    audience: row.audience,
    kind: row.kind,
    title: row.title,
    summary: row.summary ?? "",
    highlights: row.highlights ?? "",
    risks: row.risks ?? "",
    nextSteps: row.next_steps ?? "",
    periodStart: row.period_start,
    periodEnd: row.period_end,
    metrics: row.metrics ?? {},
    status: row.status,
    acknowledgedBy: row.acknowledged_by,
    acknowledgedAt: row.acknowledged_at,
    createdAt: row.created_at,
  };
}

export async function listTenantReports(tenantId: TenantId): Promise<TenantReport[]> {
  const result = await serviceCall("tenant.reports.list", (client) =>
    client
      .from(REPORTS_TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(500),
  );
  if (!result.ok) return [];
  return ((result.value.data ?? []) as unknown as ReportRow[]).map(rowToReport);
}

export async function insertTenantReport(report: TenantReport): Promise<boolean> {
  const result = await serviceCall("tenant.reports.create", (client) =>
    client
      .from(REPORTS_TABLE)
      .insert({
        id: report.id,
        tenant_id: report.tenantId,
        author_id: report.authorId,
        author_name: report.authorName,
        author_role: report.authorRole,
        audience: report.audience,
        kind: report.kind,
        title: report.title,
        summary: report.summary,
        highlights: report.highlights,
        risks: report.risks,
        next_steps: report.nextSteps,
        period_start: report.periodStart,
        period_end: report.periodEnd,
        metrics: report.metrics,
        status: report.status,
        created_at: report.createdAt,
      })
      .select("id")
      .maybeSingle(),
  );
  return result.ok && Boolean(result.value.data);
}

export async function acknowledgeTenantReport(
  tenantId: TenantId,
  id: string,
  actor: string,
): Promise<boolean> {
  const result = await serviceCall("tenant.reports.acknowledge", (client) =>
    client
      .from(REPORTS_TABLE)
      .update({
        status: "acknowledged",
        acknowledged_by: actor,
        acknowledged_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .select("id")
      .maybeSingle(),
  );
  return result.ok && Boolean(result.value.data);
}

export function newReportId(): string {
  return newId("rpt");
}

function within(start: string, end: string) {
  return (value?: string | null): boolean => Boolean(value && value >= start && value <= end);
}

function total(rows: { amount?: unknown }[]): number {
  return rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
}

/** Server-side snapshot attached to a report so the recipient sees trusted numbers. */
export async function buildReportMetrics(
  tenantId: TenantId,
  draft: Pick<ReportDraft, "kind" | "periodStart" | "periodEnd">,
): Promise<Record<string, number>> {
  const inPeriod = within(draft.periodStart, draft.periodEnd);
  const today = new Date().toISOString().slice(0, 10);

  switch (draft.kind) {
    case "sales": {
      const sales = (await listEntity(tenantId, "sales")) as unknown as SaleRecord[];
      const rows = sales.filter((sale) => inPeriod(sale.occurredOn));
      const paid = rows.filter((sale) => sale.status === "paid");
      const revenue = total(paid);
      return {
        sales: rows.length,
        paid: paid.length,
        revenue,
        averageSale: paid.length ? Math.round(revenue / paid.length) : 0,
      };
    }
    case "invoices": {
      const invoices = (await listEntity(tenantId, "invoices")) as unknown as InvoiceRecord[];
      const rows = invoices.filter((invoice) => inPeriod(invoice.issueOn));
      const open = rows.filter((invoice) => invoice.status === "pending");
      const overdue = open.filter((invoice) => Boolean(invoice.dueOn) && invoice.dueOn < today);
      return {
        invoices: rows.length,
        outstanding: total(open),
        overdue: overdue.length,
        overdueAmount: total(overdue),
      };
    }
    case "finance": {
      const [transactions, invoices] = await Promise.all([
        listEntity(tenantId, "transactions") as Promise<unknown>,
        listEntity(tenantId, "invoices") as Promise<unknown>,
      ]);
      const expenses = (transactions as TransactionRecord[]).filter(
        (row) => row.kind === "expense" && inPeriod(row.occurredOn),
      );
      const income = (transactions as TransactionRecord[]).filter(
        (row) => row.kind === "income" && inPeriod(row.occurredOn),
      );
      const outstanding = (invoices as InvoiceRecord[]).filter((row) => row.status === "pending");
      return {
        expenses: total(expenses),
        income: total(income),
        net: total(income) - total(expenses),
        outstanding: total(outstanding),
      };
    }
    case "operations": {
      const [leads, tasks, projects] = await Promise.all([
        listEntity(tenantId, "leads") as Promise<unknown>,
        listEntity(tenantId, "tasks") as Promise<unknown>,
        listEntity(tenantId, "projects") as Promise<unknown>,
      ]);
      const openLeads = (leads as LeadRecord[]).filter((lead) => lead.stage !== "won" && lead.stage !== "lost");
      const openTasks = (tasks as TaskRecord[]).filter((task) => task.status !== "done");
      const overdueTasks = openTasks.filter((task) => Boolean(task.dueOn) && task.dueOn < today);
      const activeProjects = (projects as ProjectRecord[]).filter((project) => project.status === "active");
      return {
        openLeads: openLeads.length,
        openTasks: openTasks.length,
        overdueTasks: overdueTasks.length,
        activeProjects: activeProjects.length,
      };
    }
    case "hr": {
      const staff = (await listEntity(tenantId, "staff")) as unknown as StaffRecord[];
      const active = staff.filter((person) => person.status === "active");
      const departments = new Set(staff.map((person) => person.department).filter(Boolean));
      return {
        staff: staff.length,
        active: active.length,
        departments: departments.size,
      };
    }
    default: {
      const [sales, invoices] = await Promise.all([
        listEntity(tenantId, "sales") as Promise<unknown>,
        listEntity(tenantId, "invoices") as Promise<unknown>,
      ]);
      const paid = (sales as SaleRecord[]).filter(
        (sale) => sale.status === "paid" && inPeriod(sale.occurredOn),
      );
      const outstanding = (invoices as InvoiceRecord[]).filter((row) => row.status === "pending");
      return { revenue: total(paid), outstanding: total(outstanding) };
    }
  }
}

export function audienceLabel(audience: TenantReport["audience"]): string {
  return REPORT_AUDIENCE_LABELS[audience];
}

export function highestTenantRole(roles: string[]): string {
  const ranked = roles
    .filter((role) => roleMeta(role)?.scope === "tenant")
    .sort((left, right) => (roleMeta(right)?.rank ?? 0) - (roleMeta(left)?.rank ?? 0));
  return ranked[0] ?? roles[0] ?? "employee";
}

export const DEFAULT_PROFILE: WorkspaceProfile = {
  displayName: "",
  title: "",
  phone: "",
  bio: "",
  accent: "",
  density: "comfortable",
  notifyReports: true,
  notifyShifts: true,
  notifyWeekly: true,
};

export async function getUserProfile(userId: string): Promise<WorkspaceProfile> {
  const result = await serviceCall("tenant.profile.read", (client) =>
    client.from(PROFILES_TABLE).select("*").eq("user_id", userId).maybeSingle(),
  );
  if (!result.ok || !result.value.data) return DEFAULT_PROFILE;
  const row = result.value.data as Record<string, unknown>;
  const density = row.density === "compact" ? "compact" : "comfortable";
  return {
    displayName: String(row.display_name ?? ""),
    title: String(row.title ?? ""),
    phone: String(row.phone ?? ""),
    bio: String(row.bio ?? ""),
    accent: String(row.accent ?? ""),
    density,
    notifyReports: row.notify_reports !== false,
    notifyShifts: row.notify_shifts !== false,
    notifyWeekly: row.notify_weekly !== false,
  };
}

export async function saveUserProfile(
  userId: string,
  tenantId: TenantId,
  profile: WorkspaceProfile,
): Promise<boolean> {
  const result = await serviceCall("tenant.profile.write", (client) =>
    client
      .from(PROFILES_TABLE)
      .upsert(
        {
          user_id: userId,
          tenant_id: tenantId,
          display_name: profile.displayName,
          title: profile.title,
          phone: profile.phone,
          bio: profile.bio,
          accent: profile.accent,
          density: profile.density,
          notify_reports: profile.notifyReports,
          notify_shifts: profile.notifyShifts,
          notify_weekly: profile.notifyWeekly,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("user_id")
      .maybeSingle(),
  );
  return result.ok && Boolean(result.value.data);
}

export async function listTeam(tenantId: TenantId): Promise<TeamMember[]> {
  const grants = await serviceCall("tenant.team.grants", (client) =>
    client.from("d12_iam_grants").select("user_id, role_id").eq("tenant_id", tenantId),
  );
  if (!grants.ok) return [];
  const grantRows = (grants.value.data ?? []) as { user_id: string; role_id: string }[];
  if (!grantRows.length) return [];
  const ids = Array.from(new Set(grantRows.map((grant) => grant.user_id)));
  const users = await serviceCall("tenant.team.users", (client) =>
    client
      .from("d12_iam_users")
      .select("id, name, email, status, created_at, last_active")
      .in("id", ids),
  );
  if (!users.ok) return [];
  const userRows = (users.value.data ?? []) as {
    id: string;
    name: string;
    email: string;
    status: string;
    created_at: string;
    last_active: string | null;
  }[];
  const staff = (await listEntity(tenantId, "staff")) as unknown as StaffRecord[];
  const roleByUser = new Map<string, string>();
  for (const grant of grantRows) roleByUser.set(grant.user_id, grant.role_id);

  return userRows
    .map((user) => {
      const role = roleByUser.get(user.id) ?? "employee";
      const directory = staff.find(
        (person) =>
          person.email?.toLowerCase() === user.email.toLowerCase() ||
          person.name.toLowerCase() === user.name.toLowerCase(),
      );
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        role,
        roleLabel: roleMeta(role)?.label ?? role,
        joinedOn: user.created_at,
        lastActive: user.last_active,
        department: directory?.department ?? "",
        title: directory?.role ?? "",
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function listTenantShifts(tenantId: TenantId): Promise<TenantShift[]> {
  const result = await serviceCall("tenant.shifts.list", (client) =>
    client
      .from("d12_shift_records")
      .select("id, name, email, role, started_at, ended_at, minutes, ended_via, note")
      .eq("tenant_id", tenantId)
      .order("ended_at", { ascending: false })
      .limit(200),
  );
  if (!result.ok) return [];
  const rows = (result.value.data ?? []) as {
    id: string;
    name: string;
    email: string;
    role: string;
    started_at: string;
    ended_at: string;
    minutes: number;
    ended_via: string;
    note: string | null;
  }[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    roleLabel: roleMeta(row.role)?.label ?? row.role,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    minutes: row.minutes,
    endedVia: row.ended_via === "signout" ? "signout" : "shift",
    note: row.note ?? undefined,
  }));
}
