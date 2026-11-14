import { z } from "zod";
import type { TenantId } from "./tenants";

export const REPORT_AUDIENCES = ["accountant", "group_accountant", "group_hr", "group_admin"] as const;
export type ReportAudience = (typeof REPORT_AUDIENCES)[number];

export const REPORT_KINDS = ["sales", "invoices", "finance", "operations", "hr", "general"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_AUDIENCE_LABELS: Record<ReportAudience, string> = {
  accountant: "Subsidiary accountant",
  group_accountant: "Group accountant",
  group_hr: "Group HR",
  group_admin: "Group administrator",
};

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  sales: "Sales report",
  invoices: "Invoice report",
  finance: "Finance report",
  operations: "Operations report",
  hr: "HR report",
  general: "General report",
};

/** Figures captured automatically for each report type. */
export const REPORT_KIND_METRICS: Record<ReportKind, string[]> = {
  sales: ["sales", "paid", "revenue", "averageSale"],
  invoices: ["invoices", "outstanding", "overdue", "overdueAmount"],
  finance: ["expenses", "income", "net", "outstanding"],
  operations: ["openLeads", "openTasks", "overdueTasks", "activeProjects"],
  hr: ["staff", "active", "departments"],
  general: ["revenue", "outstanding"],
};

export interface ReportMetricMeta {
  label: string;
  hint: string;
  money?: boolean;
}

/** Plain-language label and meaning for every figure a report can carry. */
export const REPORT_METRIC_META: Record<string, ReportMetricMeta> = {
  sales: { label: "Sales recorded", hint: "Sales entered in the period, whatever their status" },
  paid: { label: "Paid sales", hint: "Sales marked as paid" },
  revenue: { label: "Revenue collected", hint: "Value of paid sales in the period", money: true },
  averageSale: { label: "Average paid sale", hint: "Revenue divided by paid sales", money: true },
  invoices: { label: "Invoices issued", hint: "Invoices raised in the period" },
  outstanding: { label: "Outstanding", hint: "Pending invoices still awaiting payment", money: true },
  overdue: { label: "Overdue invoices", hint: "Pending invoices past their due date" },
  overdueAmount: { label: "Overdue value", hint: "Value of pending invoices past their due date", money: true },
  expenses: { label: "Expenses recorded", hint: "Expense transactions in the period", money: true },
  income: { label: "Income recorded", hint: "Income transactions in the period", money: true },
  net: { label: "Net movement", hint: "Income less expenses in the period", money: true },
  openLeads: { label: "Open leads", hint: "Leads not yet won or lost" },
  openTasks: { label: "Open tasks", hint: "Tasks not yet completed" },
  overdueTasks: { label: "Overdue tasks", hint: "Open tasks past their due date" },
  activeProjects: { label: "Active projects", hint: "Projects currently in progress" },
  staff: { label: "Staff on the roster", hint: "People in the staff directory" },
  active: { label: "Active staff", hint: "Staff marked active" },
  departments: { label: "Departments", hint: "Distinct departments represented" },
};

export function reportMetricMeta(key: string): ReportMetricMeta {
  const known = REPORT_METRIC_META[key];
  if (known) return known;
  const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
  return { label, hint: "" };
}

export const REPORT_SECTIONS = ["highlights", "risks", "nextSteps"] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

export const REPORT_SECTION_META: Record<ReportSection, { label: string; hint: string }> = {
  highlights: { label: "Highlights and wins", hint: "What went well in this period" },
  risks: { label: "Risks and issues", hint: "What needs attention or could stall the work" },
  nextSteps: { label: "Next steps", hint: "What happens next, and who owns it" },
};

/** Section text is written one point per line; blank lines are ignored. */
export function sectionLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

const reportDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid calendar date");

export const reportInputSchema = z
  .object({
    kind: z.enum(REPORT_KINDS),
    title: z.string().trim().min(3, "Give the report a title").max(160),
    summary: z.string().trim().max(2000).default(""),
    highlights: z.string().trim().max(1200, "Keep highlights under 1200 characters").default(""),
    risks: z.string().trim().max(1200, "Keep risks under 1200 characters").default(""),
    nextSteps: z.string().trim().max(1200, "Keep next steps under 1200 characters").default(""),
    periodStart: reportDate,
    periodEnd: reportDate,
  })
  .refine((value) => value.periodEnd >= value.periodStart, {
    message: "The period end must be on or after the start",
    path: ["periodEnd"],
  });

export type ReportDraft = z.infer<typeof reportInputSchema>;

export interface TenantReport {
  id: string;
  tenantId: TenantId;
  authorId: string;
  authorName: string;
  authorRole: string;
  audience: ReportAudience;
  kind: ReportKind;
  title: string;
  summary: string;
  highlights: string;
  risks: string;
  nextSteps: string;
  periodStart: string;
  periodEnd: string;
  metrics: Record<string, number>;
  status: "submitted" | "acknowledged";
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
}

export function isReportAudience(value: unknown): value is ReportAudience {
  return typeof value === "string" && (REPORT_AUDIENCES as readonly string[]).includes(value);
}

export function isReportKind(value: unknown): value is ReportKind {
  return typeof value === "string" && (REPORT_KINDS as readonly string[]).includes(value);
}

/** The next desk a role reports to. Everyone ultimately feeds the group administrator. */
export function audienceForRole(role: string): ReportAudience {
  switch (role) {
    case "hr_officer":
      return "group_hr";
    case "accountant":
      return "group_accountant";
    case "manager":
    case "tenant_admin":
      return "group_admin";
    default:
      return "accountant";
  }
}

/** Report types a role is expected to produce. */
export function reportKindsForRole(role: string): ReportKind[] {
  switch (role) {
    case "accountant":
      return ["finance", "invoices", "sales", "general"];
    case "hr_officer":
      return ["hr", "general"];
    case "manager":
    case "tenant_admin":
      return ["operations", "sales", "invoices", "finance", "hr", "general"];
    case "account_executive":
      return ["sales", "invoices", "general"];
    default:
      return ["sales", "invoices", "general"];
  }
}

/** Audiences a role can read and acknowledge inside a subsidiary. */
export function receivableAudiences(role: string): ReportAudience[] {
  switch (role) {
    case "accountant":
      return ["accountant"];
    case "manager":
    case "tenant_admin":
      // Subsidiary leads see the desk the team reports into; upward desks
      // acknowledge at the group hub, not inside the subsidiary workspace.
      return ["accountant"];
    default:
      return [];
  }
}

/** Audiences a group role may review in the hub. The group administrator sees everything. */
export function hubAudiencesForRole(role: string): ReportAudience[] | "all" {
  switch (role) {
    case "group_admin":
      return "all";
    case "hr_admin":
      return ["group_hr"];
    case "group_accountant":
      return ["group_accountant"];
    default:
      return [];
  }
}

/** The reporting chain shown in the workspace, from the subsidiary up to the group. */
export const REPORTING_CHAIN: { audience: ReportAudience; detail: string }[] = [
  { audience: "accountant", detail: "Employees submit sales, invoice and delivery reports" },
  { audience: "group_accountant", detail: "Subsidiary accountants consolidate the books" },
  { audience: "group_hr", detail: "Subsidiary HR officers send people reports" },
  { audience: "group_admin", detail: "Managers and every group desk report upward" },
];
