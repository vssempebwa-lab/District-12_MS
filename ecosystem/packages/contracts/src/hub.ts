import { z } from "zod";
import { TENANT_IDS } from "./tenants";

export const hubDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid calendar date");
const optionalDate = z.union([hubDate, z.literal("")]).default("");
const text = (max = 120) => z.string().trim().max(max).default("");
const name = z.string().trim().min(1, "A name or title is required").max(120);
const reference = z.string().min(1, "Select a record").max(100);
const money = z.coerce.number().int().min(0).max(1_000_000_000_000).default(0);
const scope = z.enum(["group", ...TENANT_IDS]);
const email = z.union([z.string().trim().email(), z.literal("")]).default("");
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM");
const notes = text(2000);

export const HUB_SCHEMAS = {
  employees: z.object({
    name, email, phone: text(40), accountId: text(100), tenantId: scope,
    department: text(80), title: text(120), employmentType: z.enum(["permanent", "contract", "intern", "other", "unknown"]).default("unknown"),
    status: z.enum(["active", "inactive"]).default("active"), startOn: hubDate, endOn: optionalDate,
    annualLeaveDays: z.coerce.number().int().min(0).max(366).default(0), notes,
  }).strict(),
  tasks: z.object({
    title: name, tenantId: scope, assigneeId: text(100), dueOn: optionalDate,
    priority: z.enum(["low", "normal", "high"]).default("normal"),
    status: z.enum(["open", "in_progress", "done", "cancelled"]).default("open"), notes,
  }).strict(),
  attendance: z.object({
    employeeId: reference, workOn: hubDate, status: z.enum(["present", "late", "absent"]),
    checkIn: z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.literal("")]).default(""),
    checkOut: z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.literal("")]).default(""), notes,
  }).strict(),
  leave: z.object({
    employeeId: reference, type: z.enum(["annual", "sick", "other"]), startOn: hubDate, endOn: hubDate,
    status: z.enum(["requested", "approved", "rejected", "cancelled"]).default("requested"),
    workingDays: z.number().int().min(0).default(0), decisionReason: text(500), notes,
  }).strict(),
  payroll: z.object({
    employeeId: reference, period: month, basic: money, allowances: money, deductions: money,
    gross: money, net: money, employeeName: text(120), tenantId: scope.default("group"),
    status: z.enum(["draft", "approved", "paid", "void"]).default("draft"),
    paymentReference: text(120), paidOn: optionalDate, notes,
  }).strict(),
  performance: z.object({
    employeeId: reference, reviewerId: reference, period: month, objectives: z.string().trim().min(1).max(2000),
    rating: z.coerce.number().int().min(1).max(5), notes,
    status: z.enum(["draft", "submitted", "finalized"]).default("draft"),
  }).strict(),
  vacancies: z.object({
    title: name, tenantId: scope, department: text(80), openings: z.coerce.number().int().min(1).max(1000).default(1),
    closesOn: optionalDate, status: z.enum(["open", "closed"]).default("open"), notes,
  }).strict(),
  applications: z.object({
    name, email, vacancyId: reference, interviewOn: optionalDate, employeeId: text(100),
    status: z.enum(["applied", "shortlisted", "interview", "offered", "hired", "rejected"]).default("applied"), notes,
  }).strict(),
  training: z.object({
    title: name, tenantId: scope, startsOn: hubDate, endsOn: hubDate, trainer: text(120),
    status: z.enum(["scheduled", "completed", "cancelled"]).default("scheduled"), notes,
  }).strict(),
  enrolments: z.object({
    employeeId: reference, trainingId: reference,
    status: z.enum(["enrolled", "attended", "completed", "withdrawn"]).default("enrolled"), notes,
  }).strict(),
  group_settings: z.object({
    organizationName: name, contactEmail: email, contactPhone: text(40),
    reportingDays: z.enum(["14", "30", "90"]).default("30"),
  }).strict(),
  hr_settings: z.object({
    departments: text(1000), workingWeekdays: z.string().regex(/^[0-6](,[0-6])*$/, "Use comma-separated weekday numbers, Sunday 0 to Saturday 6"),
    holidays: text(4000), defaultAnnualLeaveDays: z.coerce.number().int().min(0).max(366).default(0),
  }).strict(),
} as const;

export type HubKind = keyof typeof HUB_SCHEMAS;
export const HUB_KINDS = Object.keys(HUB_SCHEMAS) as HubKind[];
export const hubKindSchema = z.enum(HUB_KINDS as [HubKind, ...HubKind[]]);
export type HubData = Record<string, string | number>;
export interface HubRecord {
  id: string;
  kind: HubKind;
  data: HubData;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}
export interface HubNotification {
  id: string;
  recipientId: string;
  title: string;
  href: string;
  createdAt: string;
  readAt: string | null;
  archivedAt: string | null;
}
export interface HubField {
  key: string;
  label: string;
  type: "text" | "email" | "number" | "date" | "month" | "time" | "textarea" | "select" | "reference";
  options?: readonly string[];
  reference?: HubKind | "accounts";
  required?: boolean;
  min?: number;
  max?: number;
  hint?: string;
  default?: string | number;
}
export interface HubAction {
  label: string;
  from: string[];
  to: string;
  reason?: boolean;
}
export interface HubModule {
  title: string;
  singular: string;
  description: string;
  href: string;
  permission: string;
  fields: HubField[];
  columns: string[];
  actions?: HubAction[];
  lockedStatuses?: string[];
  singleton?: boolean;
}
const tenantField: HubField = { key: "tenantId", label: "Subsidiary", type: "select", options: ["group", ...TENANT_IDS], default: "group" };
const employeeField: HubField = { key: "employeeId", label: "Employee", type: "reference", reference: "employees", required: true };
const notesField: HubField = { key: "notes", label: "Notes", type: "textarea" };

export const HUB_MODULES: Record<HubKind, HubModule> = {
  employees: {
    title: "Team management", singular: "Employee profile", href: "/team", permission: "team.manage",
    description: "Employment records across the group. Sign-in access is granted from the directory.",
    fields: [
      { key: "name", label: "Name", type: "text", required: true }, tenantField,
      { key: "email", label: "Email", type: "email" }, { key: "phone", label: "Phone", type: "text" },
      { key: "department", label: "Department", type: "text" }, { key: "title", label: "Job title", type: "text" },
      { key: "employmentType", label: "Employment type", type: "select", options: ["unknown", "permanent", "contract", "intern", "other"], default: "unknown" },
      { key: "startOn", label: "Employment start", type: "date", required: true }, { key: "endOn", label: "Employment end", type: "date" },
      { key: "annualLeaveDays", label: "Annual leave entitlement (days)", type: "number", min: 0, max: 366, default: 0, hint: "Explicit calendar-year entitlement; no statutory rate is assumed." }, notesField,
    ], columns: ["name", "tenantId", "department", "employmentType", "startOn", "status"],
    actions: [{ label: "Archive", from: ["active"], to: "inactive" }, { label: "Reactivate", from: ["inactive"], to: "active" }],
  },
  tasks: {
    title: "Group tasks", singular: "Task", href: "/tasks", permission: "group.tasks",
    description: "Assign and track group work. These tasks are separate from subsidiary operational tasks.",
    fields: [{ key: "title", label: "Title", type: "text", required: true }, tenantField,
      { key: "assigneeId", label: "Assignee", type: "reference", reference: "accounts" },
      { key: "dueOn", label: "Due date", type: "date" }, { key: "priority", label: "Priority", type: "select", options: ["normal", "low", "high"], default: "normal" }, notesField],
    columns: ["title", "tenantId", "assigneeId", "dueOn", "priority", "status"],
    actions: [{ label: "Start", from: ["open"], to: "in_progress" }, { label: "Complete", from: ["open", "in_progress"], to: "done" }, { label: "Reopen", from: ["done", "cancelled"], to: "open" }, { label: "Cancel", from: ["open", "in_progress"], to: "cancelled" }],
  },
  attendance: {
    title: "Attendance", singular: "Attendance record", href: "/hr/attendance", permission: "hr.manage",
    description: "Record one entry per employee per day. Missing records mean unrecorded, not absent. Times use Africa/Kampala.",
    fields: [employeeField, { key: "workOn", label: "Work date", type: "date", required: true },
      { key: "status", label: "Attendance", type: "select", options: ["present", "late", "absent"], default: "present" },
      { key: "checkIn", label: "Check-in", type: "time" }, { key: "checkOut", label: "Check-out", type: "time" }, { ...notesField, hint: "A reason is required when correcting an existing entry." }],
    columns: ["employeeId", "workOn", "status", "checkIn", "checkOut", "notes"],
  },
  leave: {
    title: "Leave management", singular: "Leave request", href: "/hr/leave", permission: "hr.manage",
    description: "Request and decide leave using configured working days, holidays and individual annual entitlements.",
    fields: [employeeField, { key: "type", label: "Leave type", type: "select", options: ["annual", "sick", "other"], default: "annual" },
      { key: "startOn", label: "Start date", type: "date", required: true }, { key: "endOn", label: "End date", type: "date", required: true }, notesField],
    columns: ["employeeId", "type", "startOn", "endOn", "workingDays", "status", "decisionReason"],
    actions: [{ label: "Approve", from: ["requested"], to: "approved" }, { label: "Reject", from: ["requested"], to: "rejected", reason: true }, { label: "Cancel", from: ["requested", "approved"], to: "cancelled", reason: true }],
    lockedStatuses: ["approved", "rejected", "cancelled"],
  },
  payroll: {
    title: "Payroll", singular: "Payroll entry", href: "/hr/payroll", permission: "hr.payroll",
    description: "Prepare monthly UGX payslips from explicit salary, allowances and deductions. Approval is not payment; payroll is not automatically posted to warehouse expenses.",
    fields: [employeeField, { key: "period", label: "Pay period", type: "month", required: true },
      { key: "basic", label: "Basic salary (UGX)", type: "number", min: 0, default: 0 },
      { key: "allowances", label: "Allowances (UGX)", type: "number", min: 0, default: 0 },
      { key: "deductions", label: "Deductions (UGX)", type: "number", min: 0, default: 0, hint: "Enter approved deductions; no tax or statutory rate is inferred." },
      { key: "paymentReference", label: "Payment reference", type: "text" }, { key: "paidOn", label: "Payment date", type: "date" }, notesField],
    columns: ["employeeName", "period", "basic", "allowances", "deductions", "net", "status", "paymentReference"],
    actions: [{ label: "Approve", from: ["draft"], to: "approved" }, { label: "Record payment", from: ["approved"], to: "paid" }, { label: "Void", from: ["draft", "approved"], to: "void" }],
    lockedStatuses: ["paid", "void"],
  },
  performance: {
    title: "Performance", singular: "Performance review", href: "/hr/performance", permission: "hr.manage",
    description: "Employee objectives, reviewer feedback and finalized ratings on a 1–5 scale.",
    fields: [employeeField, { key: "reviewerId", label: "Reviewer", type: "reference", reference: "accounts", required: true },
      { key: "period", label: "Review period", type: "month", required: true },
      { key: "objectives", label: "Objectives", type: "textarea", required: true }, { key: "rating", label: "Rating (1–5)", type: "number", min: 1, max: 5, default: 3 }, notesField],
    columns: ["employeeId", "reviewerId", "period", "rating", "status"],
    actions: [{ label: "Submit", from: ["draft"], to: "submitted" }, { label: "Finalize", from: ["submitted"], to: "finalized" }, { label: "Return to draft", from: ["submitted"], to: "draft" }], lockedStatuses: ["finalized"],
  },
  vacancies: {
    title: "Recruitment · vacancies", singular: "Vacancy", href: "/hr/recruitment", permission: "hr.manage",
    description: "Open positions and hiring needs by subsidiary.",
    fields: [{ key: "title", label: "Job title", type: "text", required: true }, tenantField,
      { key: "department", label: "Department", type: "text" }, { key: "openings", label: "Openings", type: "number", min: 1, default: 1 }, { key: "closesOn", label: "Closing date", type: "date" }, notesField],
    columns: ["title", "tenantId", "department", "openings", "closesOn", "status"],
    actions: [{ label: "Close", from: ["open"], to: "closed" }, { label: "Reopen", from: ["closed"], to: "open" }],
  },
  applications: {
    title: "Recruitment · applicants", singular: "Application", href: "/hr/recruitment", permission: "hr.manage",
    description: "Track applicants through interview and offer. To record a hire, create the employment profile and link it here; this does not provision a login.",
    fields: [{ key: "name", label: "Applicant name", type: "text", required: true }, { key: "email", label: "Applicant email", type: "email" },
      { key: "vacancyId", label: "Vacancy", type: "reference", reference: "vacancies", required: true }, { key: "interviewOn", label: "Interview date", type: "date" },
      { key: "employeeId", label: "Hired employee profile", type: "reference", reference: "employees" }, notesField],
    columns: ["name", "vacancyId", "interviewOn", "employeeId", "status"],
    actions: [{ label: "Shortlist", from: ["applied"], to: "shortlisted" }, { label: "Interview", from: ["shortlisted"], to: "interview" }, { label: "Offer", from: ["interview"], to: "offered" }, { label: "Record hire", from: ["offered"], to: "hired" }, { label: "Reject", from: ["applied", "shortlisted", "interview", "offered"], to: "rejected" }], lockedStatuses: ["hired", "rejected"],
  },
  training: {
    title: "Training & development", singular: "Training session", href: "/hr/training", permission: "hr.manage",
    description: "Schedule training and track enrolment, attendance and completion.",
    fields: [{ key: "title", label: "Title", type: "text", required: true }, tenantField,
      { key: "startsOn", label: "Start date", type: "date", required: true }, { key: "endsOn", label: "End date", type: "date", required: true }, { key: "trainer", label: "Trainer", type: "text" }, notesField],
    columns: ["title", "tenantId", "startsOn", "endsOn", "trainer", "status"],
    actions: [{ label: "Complete session", from: ["scheduled"], to: "completed" }, { label: "Cancel session", from: ["scheduled"], to: "cancelled" }], lockedStatuses: ["completed", "cancelled"],
  },
  enrolments: {
    title: "Training enrolments", singular: "Enrolment", href: "/hr/training", permission: "hr.manage",
    description: "Each employee can be enrolled once per session.",
    fields: [employeeField, { key: "trainingId", label: "Training session", type: "reference", reference: "training", required: true }, notesField],
    columns: ["employeeId", "trainingId", "status", "notes"],
    actions: [{ label: "Mark attended", from: ["enrolled"], to: "attended" }, { label: "Complete training", from: ["attended"], to: "completed" }, { label: "Withdraw", from: ["enrolled", "attended"], to: "withdrawn" }], lockedStatuses: ["completed", "withdrawn"],
  },
  group_settings: {
    title: "Group settings", singular: "Group settings", href: "/settings", permission: "group.settings", singleton: true,
    description: "Organization identity, contacts and the default analytics reporting window. District 12 brand and sign-in security remain unchanged.",
    fields: [{ key: "organizationName", label: "Organization name", type: "text", required: true, default: "District 12 Group" },
      { key: "contactEmail", label: "Contact email", type: "email" }, { key: "contactPhone", label: "Contact phone", type: "text" },
      { key: "reportingDays", label: "Default reporting window", type: "select", options: ["14", "30", "90"], default: "30" }],
    columns: ["organizationName", "contactEmail", "contactPhone", "reportingDays"],
  },
  hr_settings: {
    title: "HR settings", singular: "HR settings", href: "/hr/settings", permission: "hr.manage", singleton: true,
    description: "Working calendar and employee-profile defaults. Leave requests retain their calculated day count after approval.",
    fields: [{ key: "departments", label: "Departments", type: "textarea", hint: "Comma-separated choices suggested when creating profiles." },
      { key: "workingWeekdays", label: "Working weekdays", type: "text", required: true, default: "1,2,3,4,5", hint: "Sunday 0, Monday 1 … Saturday 6; comma-separated." },
      { key: "holidays", label: "Holidays", type: "textarea", hint: "Comma-separated YYYY-MM-DD dates excluded from leave days." },
      { key: "defaultAnnualLeaveDays", label: "Default annual leave days", type: "number", min: 0, max: 366, default: 0 }],
    columns: ["workingWeekdays", "defaultAnnualLeaveDays", "departments", "holidays"],
  },
};

export function hubPermission(kind: HubKind): string {
  return HUB_MODULES[kind].permission;
}

export function hubToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function csvCell(value: unknown): string {
  const raw = String(value ?? "");
  const safe = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
