import { hasPermission, type SessionClaims } from "@d12/auth";
import { createServiceClient } from "@d12/db";
import {
  HUB_KINDS, HUB_MODULES, HUB_SCHEMAS, hubDate, hubPermission, hubToday,
  isGlobalRole, permissionsForRoles,
  type AccountView, type ApiErrorCode, type HubData, type HubKind,
  type HubNotification, type HubRecord,
} from "@d12/contracts";
import { newId } from "@d12/telemetry";
import { isMissingSchema, listAccounts, type AccountList } from "./accounts";
import { getStore, pushAudit } from "./store";

type Mode = AccountList["mode"];
export class HubRecordError extends Error {
  constructor(public readonly status: number, public readonly code: ApiErrorCode, message: string) {
    super(message);
    this.name = "HubRecordError";
  }
}
const invalid = (message: string): never => { throw new HubRecordError(400, "VALIDATION_FAILED", message); };
const conflict = (message: string): never => { throw new HubRecordError(409, "CONFLICT", message); };
const missing = (): never => { throw new HubRecordError(404, "NOT_FOUND", "Workflow record not found"); };
const migrationMessage = "Hub workflows are unavailable. Configure the directory service backend and apply ecosystem/packages/db/sql/008_hub_workflows.sql after migrations 001–007.";
function databaseError(error: unknown): never {
  if (error instanceof HubRecordError) throw error;
  const code = (error as { code?: string } | null)?.code;
  if (code === "23505" || code === "40001" || code === "40P01") conflict("A conflicting record or newer version exists. Reload and try again.");
  if (code === "P0002") missing();
  if (code === "23514" || code === "23503" || code === "22007" || code === "22008" || code === "22P02" || code === "22003") {
    invalid("The workflow violates its dates, references or lifecycle rules. Reload related records and check the submitted values.");
  }
  throw new HubRecordError(503, isMissingSchema(error) || code === "PGRST202" || code === "42883" ? "SCHEMA_UNSUPPORTED" : "UPSTREAM_FAILED", migrationMessage);
}

interface Memory { records: HubRecord[]; notifications: HubNotification[] }
const globalMemory = globalThis as typeof globalThis & { __d12HubWorkflows?: Memory };
function memory(): Memory {
  getStore(); // Share the directory's process lifetime, but never seed employment or financial facts.
  return globalMemory.__d12HubWorkflows ??= { records: [], notifications: [] };
}
const copy = <T>(value: T): T => structuredClone(value);
async function directory(): Promise<AccountList> {
  try {
    const result = await listAccounts();
    if (result.mode === "demo" && process.env.D12_DEMO_MODE === "false") {
      throw new HubRecordError(503, "SCHEMA_UNSUPPORTED", migrationMessage);
    }
    return result;
  } catch (error) { return databaseError(error); }
}
function checkKind(kind: HubKind): void {
  if (!HUB_KINDS.includes(kind)) invalid("Unknown workflow kind");
}
function authorize(kind: HubKind, actor: SessionClaims): void {
  checkKind(kind);
  if (actor.scope !== "group" || !hasPermission(actor, hubPermission(kind))) {
    throw new HubRecordError(403, "FORBIDDEN", "You do not have permission for this workflow");
  }
}
function checkVersion(version: number): void {
  if (!Number.isSafeInteger(version) || version < 1) invalid("A positive record version is required");
}
interface RecordRow { id: string; kind: HubKind; data: HubData; version: number; created_at: string; updated_at: string; created_by: string }
interface NotificationRow { id: string; recipient_id: string; title: string; href: string; created_at: string; read_at: string | null; archived_at: string | null }
const recordView = (row: RecordRow): HubRecord => ({ id: row.id, kind: row.kind, data: row.data, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at, createdBy: row.created_by });
const notificationView = (row: NotificationRow): HubNotification => ({ id: row.id, recipientId: row.recipient_id, title: row.title, href: row.href, createdAt: row.created_at, readAt: row.read_at, archivedAt: row.archived_at });
async function recordsFromDb(kinds: HubKind[]): Promise<HubRecord[]> {
  try {
    const records: HubRecord[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await createServiceClient().from("d12_hub_records")
        .select("id,kind,data,version,created_at,updated_at,created_by").in("kind", kinds)
        .order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
      if (error) databaseError(error);
      const rows = (data ?? []) as RecordRow[];
      records.push(...rows.map(recordView));
      if (rows.length < 500) return records;
    }
  } catch (error) { return databaseError(error); }
}
export async function listHubRecords(kinds: HubKind[]): Promise<{ records: HubRecord[]; mode: Mode }> {
  kinds.forEach(checkKind);
  const { mode } = await directory();
  if (!kinds.length) return { records: [], mode };
  try {
    return { records: mode === "demo" ? copy(memory().records.filter((r) => kinds.includes(r.kind))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : await recordsFromDb(kinds), mode };
  } catch (error) { return databaseError(error); }
}

function referenced(records: HubRecord[], kind: HubKind, id: string): HubRecord {
  return records.find((r) => r.kind === kind && r.id === id) ?? invalid(`Select an existing ${HUB_MODULES[kind].singular.toLowerCase()}`);
}
function accountRef(accounts: AccountView[], id: string, tenant: string): void {
  if (!id) return;
  const account = accounts.find((a) => a.id === id && a.status === "active") ?? invalid("Select an active directory account");
  if (tenant !== "group" && !account.tenants.some((t) => t === tenant)) invalid("The account must belong to the selected subsidiary");
}
function employed(employee: HubData, start: string, end = start): void {
  if (start < String(employee.startOn) || (employee.endOn && end > String(employee.endOn))) {
    invalid("The dates must fall within the employee's employment dates");
  }
}
function employeeDates(kind: HubKind, data: HubData, records: HubRecord[]): [string, string] | null {
  if (kind === "attendance") return [String(data.workOn), String(data.workOn)];
  if (kind === "leave") return [String(data.startOn), String(data.endOn)];
  if (kind === "payroll" || kind === "performance") {
    const start = `${data.period}-01`;
    const date = new Date(`${start}T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + 1, 0);
    return [start, date.toISOString().slice(0, 10)];
  }
  if (kind === "enrolments") {
    const session = referenced(records, "training", String(data.trainingId)).data;
    return [String(session.startsOn), String(session.endsOn)];
  }
  return null;
}
function checkEmployment(kind: HubKind, data: HubData, employee: HubData, records: HubRecord[]): void {
  const dates = employeeDates(kind, data, records);
  if (!dates) return;
  if (kind === "payroll" || kind === "performance") {
    if (dates[1] < String(employee.startOn) || (employee.endOn && dates[0] > String(employee.endOn))) invalid("The period must overlap the employee's employment dates");
  } else employed(employee, ...dates);
}
function calendar(data?: HubData): { weekdays: number[]; holidays: Set<string> } {
  const weekdays = String(data?.workingWeekdays ?? "1,2,3,4,5").split(",").map(Number);
  if (new Set(weekdays).size !== weekdays.length) invalid("Working weekdays must be unique");
  const raw = String(data?.holidays ?? "").trim();
  const holidays = raw ? raw.split(",").map((day) => day.trim()) : [];
  if (holidays.some((day) => !hubDate.safeParse(day).success)) invalid("Every holiday must be a valid YYYY-MM-DD calendar date");
  return { weekdays, holidays: new Set(holidays) };
}
function workingDays(data: HubData, records: HubRecord[]): number {
  const { weekdays, holidays } = calendar(records.find((r) => r.kind === "hr_settings")?.data);
  let count = 0;
  const end = new Date(`${data.endOn}T00:00:00Z`).getTime();
  for (let date = new Date(`${data.startOn}T00:00:00Z`); date.getTime() <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    if (weekdays.includes(date.getUTCDay()) && !holidays.has(date.toISOString().slice(0, 10))) count++;
  }
  return count;
}
function frozen(before: HubData, after: HubData, mutable: string[]): void {
  for (const key of Object.keys(before)) {
    if (!mutable.includes(key) && before[key] !== after[key]) conflict("Approved or historical fields are read-only");
  }
}
function lifecycle(kind: HubKind, data: HubData, previous?: HubRecord): void {
  const module = HUB_MODULES[kind];
  if (!previous) {
    if (kind !== "attendance" && "status" in data) {
      const statusSchema = HUB_SCHEMAS[kind].shape as Record<string, { safeParse: (value: unknown) => { success: boolean; data?: unknown } }>;
      const defaultStatus = statusSchema.status?.safeParse(undefined);
      if (!defaultStatus?.success || data.status !== defaultStatus.data) invalid("Create the record in its initial workflow state");
    }
    return;
  }
  const before = String(previous.data.status ?? "");
  const after = String(data.status ?? "");
  if (module.lockedStatuses?.includes(before) && !(kind === "leave" && before === "approved")) conflict("This historical record is read-only");
  if (before !== after && kind !== "attendance" && !module.actions?.some((a) => a.from.includes(before) && a.to === after)) invalid("This workflow transition is not allowed");
  if (kind === "leave" && before === "approved") {
    frozen(previous.data, data, ["status", "decisionReason"]);
    if (after !== "cancelled") conflict("Approved leave can only be cancelled with a reason");
  }
  if (kind === "payroll" && before === "approved") frozen(previous.data, data, ["status", "paymentReference", "paidOn", "notes"]);
}
function validate(kind: HubKind, input: unknown, records: HubRecord[], accounts: AccountView[], previous?: HubRecord): HubData {
  const parsed = HUB_SCHEMAS[kind].safeParse(input);
  if (!parsed.success) invalid(parsed.error.issues.map((issue) => `${issue.path.join(".") || "record"}: ${issue.message}`).join("; "));
  const data: HubData = { ...parsed.data };
  if (previous && HUB_MODULES[kind].lockedStatuses?.includes(String(previous.data.status)) &&
      !(kind === "leave" && previous.data.status === "approved")) conflict("This historical record is read-only");
  const others = records.filter((r) => r.id !== previous?.id);
  const duplicate = (test: (r: HubRecord) => boolean): void => {
    if (others.some((r) => r.kind === kind && test(r))) conflict("A record already exists for this account, employee or period");
  };
  let employee: HubData | undefined;
  if (data.employeeId) {
    employee = referenced(records, "employees", String(data.employeeId)).data;
    if ((!previous || previous.data.employeeId !== data.employeeId) && employee.status !== "active") invalid("Select an active employee profile");
    checkEmployment(kind, data, employee, records);
  }
  if (HUB_MODULES[kind].singleton) duplicate(() => true);
  if (kind === "employees") {
    if (data.endOn && String(data.endOn) < String(data.startOn)) invalid("Employment end must not precede start");
    accountRef(accounts, String(data.accountId), String(data.tenantId));
    if (data.accountId) duplicate((r) => r.data.accountId === data.accountId);
    if (previous) {
      for (const linked of others.filter((r) => r.data.employeeId === previous.id)) {
        checkEmployment(linked.kind, linked.data, data, records);
        if (linked.kind === "enrolments") {
          const session = referenced(records, "training", String(linked.data.trainingId)).data;
          if (session.tenantId !== "group" && session.tenantId !== data.tenantId) conflict("The subsidiary conflicts with an existing training enrolment");
        }
        if (linked.kind === "applications" && referenced(records, "vacancies", String(linked.data.vacancyId)).data.tenantId !== data.tenantId) conflict("The subsidiary conflicts with a linked recruitment application");
      }
      const totals = new Map<string, number>();
      for (const leave of others.filter((r) => r.kind === "leave" && r.data.employeeId === previous.id && r.data.type === "annual" && r.data.status === "approved")) {
        const year = String(leave.data.startOn).slice(0, 4);
        totals.set(year, (totals.get(year) ?? 0) + Number(leave.data.workingDays));
      }
      if ([...totals.values()].some((total) => total > Number(data.annualLeaveDays))) conflict("Entitlement cannot be reduced below approved annual leave");
    }
  }
  if (kind === "tasks") accountRef(accounts, String(data.assigneeId), String(data.tenantId));
  if (kind === "attendance") {
    duplicate((r) => r.data.employeeId === data.employeeId && r.data.workOn === data.workOn);
    if (String(data.workOn) > hubToday()) invalid("Attendance cannot be recorded for a future day");
    if (data.checkIn && data.checkOut && String(data.checkOut) < String(data.checkIn)) invalid("Check-out must be at or after check-in");
    if (data.status === "absent" && (data.checkIn || data.checkOut)) invalid("Absent records cannot have attendance times");
    if (previous && !data.notes) invalid("A correction note is required");
  }
  if (kind === "leave") {
    const start = String(data.startOn), end = String(data.endOn);
    if (start > end || start.slice(0, 4) !== end.slice(0, 4) || (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 + 1 > 366) invalid("Leave must be an ordered interval of at most 366 days in one calendar year");
    data.workingDays = previous?.data.status === "approved" ? previous.data.workingDays : workingDays(data, records);
    if (!data.workingDays) invalid("Leave must contain at least one configured working day");
    if (["rejected", "cancelled"].includes(String(data.status)) && !data.decisionReason) invalid("A decision reason is required");
    if (["requested", "approved"].includes(String(data.status))) {
      duplicate((r) => r.data.employeeId === data.employeeId && ["requested", "approved"].includes(String(r.data.status)) && String(r.data.startOn) <= end && String(r.data.endOn) >= start);
    }
    if (data.status === "approved" && data.type === "annual") {
      const used = others.filter((r) => r.kind === "leave" && r.data.employeeId === data.employeeId && r.data.status === "approved" && r.data.type === "annual" && String(r.data.startOn).slice(0, 4) === start.slice(0, 4)).reduce((total, r) => total + Number(r.data.workingDays), 0);
      if (used + Number(data.workingDays) > Number(employee?.annualLeaveDays ?? 0)) conflict("Approval exceeds the employee's calendar-year annual leave entitlement");
    }
  }
  if (kind === "payroll") {
    if (data.status !== "void") duplicate((r) => r.data.status !== "void" && r.data.employeeId === data.employeeId && r.data.period === data.period);
    if (previous && previous.data.status !== "draft") {
      for (const key of ["gross", "net", "employeeName", "tenantId"]) data[key] = previous.data[key];
    } else {
      data.gross = Number(data.basic) + Number(data.allowances);
      data.net = Number(data.gross) - Number(data.deductions);
      data.employeeName = employee?.name ?? "";
      data.tenantId = employee?.tenantId ?? "group";
    }
    if (!Number.isSafeInteger(data.gross) || !Number.isSafeInteger(data.net) || Number(data.net) < 0) invalid("Payroll gross and net must be nonnegative safe integer UGX amounts");
    if ((data.status === "draft" || (!previous || previous.data.status === "draft")) && (data.paidOn || data.paymentReference)) invalid("Draft payroll cannot contain a payment date or reference");
    if (data.status === "approved" && Number(data.gross) <= 0) invalid("A positive gross amount is required before approval");
    if (data.status === "paid" && (!data.paymentReference || !data.paidOn || String(data.paidOn) > hubToday())) invalid("Payment requires a reference and a date that is not in the future");
  }
  if (kind === "performance") {
    duplicate((r) => r.data.employeeId === data.employeeId && r.data.period === data.period);
    accountRef(accounts, String(data.reviewerId), String(employee?.tenantId));
  }
  if (kind === "vacancies" && previous) {
    for (const app of others.filter((r) => r.kind === "applications" && r.data.vacancyId === previous.id && r.data.employeeId)) {
      if (referenced(records, "employees", String(app.data.employeeId)).data.tenantId !== data.tenantId) conflict("The subsidiary conflicts with a linked applicant employee");
    }
  }
  if (kind === "applications") {
    const vacancy = referenced(records, "vacancies", String(data.vacancyId)).data;
    if ((!previous || data.vacancyId !== previous.data.vacancyId) && (vacancy.status !== "open" || (vacancy.closesOn && String(vacancy.closesOn) < hubToday()))) invalid("Select an open vacancy that has not closed");
    if (data.status === "interview" && !data.interviewOn) invalid("An interview date is required");
    if (employee && employee.tenantId !== vacancy.tenantId) invalid("The linked employee must match the vacancy subsidiary");
    if (data.status === "hired") {
      if (!employee) invalid("Create and link an existing employee profile before recording a hire");
      duplicate((r) => r.data.status === "hired" && r.data.employeeId === data.employeeId);
    }
  }
  if (kind === "training") {
    if (String(data.startsOn) > String(data.endsOn)) invalid("Training end must not precede start");
    if (previous) for (const enrolment of others.filter((r) => r.kind === "enrolments" && r.data.trainingId === previous.id)) {
      const person = referenced(records, "employees", String(enrolment.data.employeeId)).data;
      employed(person, String(data.startsOn), String(data.endsOn));
      if (data.tenantId !== "group" && data.tenantId !== person.tenantId) conflict("The session subsidiary conflicts with an existing enrolment");
    }
  }
  if (kind === "enrolments") {
    duplicate((r) => r.data.employeeId === data.employeeId && r.data.trainingId === data.trainingId);
    const session = referenced(records, "training", String(data.trainingId)).data;
    if (session.tenantId !== "group" && session.tenantId !== employee?.tenantId) invalid("The employee must match the training subsidiary");
    if ((!previous || data.trainingId !== previous.data.trainingId) && session.status !== "scheduled") invalid("Enrolment requires a scheduled session");
    if (session.status === "cancelled" && ["attended", "completed"].includes(String(data.status))) invalid("Attendance or completion cannot be recorded for a cancelled session");
  }
  if (kind === "hr_settings") calendar(data);
  lifecycle(kind, data, previous);
  const normalized = HUB_SCHEMAS[kind].safeParse(data);
  if (!normalized.success) invalid("Calculated values exceed the workflow schema limits");
  return data;
}
function deletable(record: HubRecord, records: HubRecord[]): void {
  if (record.kind === "employees" || record.kind === "attendance" || HUB_MODULES[record.kind].singleton) conflict("Profiles, attendance history and settings must be retained");
  const status = String(record.data.status ?? "");
  if (HUB_MODULES[record.kind].lockedStatuses?.includes(status) || (record.kind !== "tasks" && ["approved", "submitted", "offered", "attended"].includes(status))) conflict("Approval and historical records must be retained");
  if (records.some((r) => r.id !== record.id && ((record.kind === "employees" && r.data.employeeId === record.id) || (record.kind === "vacancies" && r.data.vacancyId === record.id) || (record.kind === "training" && r.data.trainingId === record.id)))) conflict("Referenced records cannot be deleted");
}
function audit(record: HubRecord, action: string, actor: SessionClaims): void {
  pushAudit({ action: `hub.${record.kind}.${action}`, actor: actor.sub, target: record.id,
    tenantId: record.data.tenantId && record.data.tenantId !== "group" ? String(record.data.tenantId) : null,
    detail: `${record.kind} ${record.id} v${record.version}` });
}
function demoEffects(record: HubRecord, action: string, actor: SessionClaims, accounts: AccountView[]): void {
  audit(record, action, actor);
  const module = HUB_MODULES[record.kind];
  const recipients = accounts.filter((a) => {
    if (a.status !== "active") return false;
    const permissions = permissionsForRoles([a.role]);
    const permitted = permissions.includes("*") || permissions.includes(hubPermission(record.kind));
    return a.role === "group_admin" || (a.role === "hr_admin" && permitted) ||
      (record.kind === "tasks" && a.id === record.data.assigneeId && isGlobalRole(a.role) && permitted);
  });
  for (const recipient of recipients) memory().notifications.unshift({ id: newId("hnt"), recipientId: recipient.id,
    title: `${module.singular} ${action}`, href: module.href, createdAt: new Date().toISOString(), readAt: null, archivedAt: null });
}
async function dbWrite(operation: "create" | "update" | "delete", kind: HubKind, id: string, version: number | null, data: HubData | null, actor: SessionClaims): Promise<HubRecord> {
  try {
    // RPC owns the advisory transaction lock, CAS, cross-record checks, persisted audit and notifications atomically.
    const result = await createServiceClient().rpc("d12_hub_write", { p_operation: operation, p_kind: kind, p_id: id, p_version: version, p_data: data, p_actor: actor.sub });
    if (result.error) databaseError(result.error);
    if (!result.data) throw new HubRecordError(503, "UPSTREAM_FAILED", migrationMessage);
    const record = recordView(result.data as RecordRow);
    audit(record, operation === "create" ? "created" : operation === "update" ? "updated" : "deleted", actor);
    return record;
  } catch (error) { return databaseError(error); }
}
export async function createHubRecord(kind: HubKind, input: unknown, actor: SessionClaims): Promise<HubRecord> {
  authorize(kind, actor);
  const { mode, accounts } = await directory();
  const records = mode === "demo" ? memory().records : await recordsFromDb(HUB_KINDS);
  const data = validate(kind, input, records, accounts);
  const now = new Date().toISOString();
  const record: HubRecord = { id: newId("hub"), kind, data, version: 1, createdAt: now, updatedAt: now, createdBy: actor.sub };
  if (mode === "supabase") return dbWrite("create", kind, record.id, null, data, actor);
  memory().records.push(record);
  demoEffects(record, "created", actor, accounts);
  return copy(record);
}
export async function updateHubRecord(kind: HubKind, id: string, version: number, input: unknown, actor: SessionClaims): Promise<HubRecord> {
  authorize(kind, actor); checkVersion(version);
  const { mode, accounts } = await directory();
  const records = mode === "demo" ? memory().records : await recordsFromDb(HUB_KINDS);
  const previous = records.find((r) => r.kind === kind && r.id === id) ?? missing();
  if (previous.version !== version) conflict("This record has changed. Reload before saving.");
  if (!Number.isSafeInteger(version + 1)) conflict("This record has reached its maximum supported version");
  const data = validate(kind, input, records, accounts, previous);
  if (mode === "supabase") return dbWrite("update", kind, id, version, data, actor);
  const record = { ...previous, data, version: version + 1, updatedAt: new Date().toISOString() };
  memory().records[records.indexOf(previous)] = record;
  demoEffects(record, "updated", actor, accounts);
  return copy(record);
}
export async function deleteHubRecord(kind: HubKind, id: string, version: number, actor: SessionClaims): Promise<void> {
  authorize(kind, actor); checkVersion(version);
  const { mode, accounts } = await directory();
  const records = mode === "demo" ? memory().records : await recordsFromDb(HUB_KINDS);
  const record = records.find((r) => r.kind === kind && r.id === id) ?? missing();
  if (record.version !== version) conflict("This record has changed. Reload before deleting.");
  deletable(record, records);
  if (mode === "supabase") { await dbWrite("delete", kind, id, version, null, actor); return; }
  memory().records.splice(records.indexOf(record), 1);
  demoEffects(record, "deleted", actor, accounts);
}
export async function listHubNotifications(recipientId: string): Promise<{ notifications: HubNotification[]; mode: Mode }> {
  if (!recipientId) invalid("A recipient is required");
  const { mode } = await directory();
  if (mode === "demo") return { notifications: copy(memory().notifications.filter((n) => n.recipientId === recipientId)), mode };
  try {
    const notifications: HubNotification[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await createServiceClient().from("d12_hub_notifications").select("id,recipient_id,title,href,created_at,read_at,archived_at")
        .eq("recipient_id", recipientId).order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
      if (error) databaseError(error);
      const rows = (data ?? []) as NotificationRow[];
      notifications.push(...rows.map(notificationView));
      if (rows.length < 500) return { notifications, mode };
    }
  } catch (error) { return databaseError(error); }
}
export async function updateHubNotification(id: string, recipientId: string, action: "read" | "unread" | "archive"): Promise<HubNotification> {
  if (!recipientId || !id || !["read", "unread", "archive"].includes(action)) invalid("A valid notification, recipient and action are required");
  const { mode } = await directory();
  const change = action === "archive" ? { archived_at: new Date().toISOString() } : { read_at: action === "read" ? new Date().toISOString() : null };
  if (mode === "demo") {
    const notification = memory().notifications.find((n) => n.id === id && n.recipientId === recipientId);
    if (!notification) throw new HubRecordError(404, "NOT_FOUND", "Notification not found");
    if (action === "archive") notification.archivedAt = change.archived_at ?? null;
    else notification.readAt = change.read_at ?? null;
    return copy(notification);
  }
  try {
    const { data, error } = await createServiceClient().from("d12_hub_notifications").update(change)
      .eq("id", id).eq("recipient_id", recipientId).select("id,recipient_id,title,href,created_at,read_at,archived_at").maybeSingle();
    if (error) databaseError(error);
    if (!data) throw new HubRecordError(404, "NOT_FOUND", "Notification not found");
    return notificationView(data as NotificationRow);
  } catch (error) { return databaseError(error); }
}
