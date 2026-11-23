import { cookies } from "next/headers";
import { serviceCall } from "@d12/db";
import { SESSION_COOKIE, readSessionToken } from "@d12/auth";
import {

  LEAD_STAGES,
  type CustomerRecord,
  type InvoiceRecord,
  type LeadRecord,
  type OpsDraft,
  type OpsEntity,
  type OpsRecord,
  type SaleRecord,
  type TaskRecord,
  type TenantId,
  type TransactionRecord,
} from "@d12/contracts";
import { camelizeRecord, newId } from "@d12/telemetry";
import { personalWorkName } from "./session";
import {
  demoDelete,
  demoInsert,
  demoPendingCount,
  demoRecords,
  demoReplace,
} from "./store";

const ENTITY_TABLE: Record<OpsEntity, string> = {
  leads: "d12_ops_leads",
  customers: "d12_ops_customers",
  sales: "d12_ops_sales",
  tasks: "d12_ops_tasks",
  meetings: "d12_ops_meetings",
  calls: "d12_ops_calls",
  projects: "d12_ops_projects",
  inventory: "d12_ops_inventory",
  transactions: "d12_ops_transactions",
  invoices: "d12_ops_invoices",
  staff: "d12_ops_staff",
};

const OUTBOX_TABLE = "d12_telemetry_outbox";

const WORK_OWNER: Partial<Record<OpsEntity, "owner" | "assignee">> = {
  leads: "owner",
  customers: "owner",
  sales: "owner",
  tasks: "assignee",
  meetings: "owner",
  calls: "owner",
  projects: "owner",
  invoices: "owner",
};

interface WorkScope {
  personal: boolean;
  name: string;
  email: string;
}

/** Employees only ever see the records attributed to them; everyone else sees the subsidiary. */
async function currentWorkScope(): Promise<WorkScope | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await readSessionToken(token);
  if (!session) return null;
  const personalName = personalWorkName(session);
  return personalName
    ? { personal: true, name: personalName, email: session.email }
    : { personal: false, name: session.name, email: session.email };
}

function attributedTo(scope: WorkScope, value: unknown): boolean {
  const needle = String(value ?? "").trim().toLowerCase();
  if (!needle) return false;
  return (
    needle === scope.name.trim().toLowerCase() || needle === scope.email.trim().toLowerCase()
  );
}

function scopeRecords<T>(entity: OpsEntity, records: T[], scope: WorkScope | null): T[] {
  if (!scope?.personal) return records;
  const key = WORK_OWNER[entity];
  if (!key) return [];
  return records.filter((record) => attributedTo(scope, (record as Record<string, unknown>)[key]));
}

async function fetchEntity(
  tenantId: TenantId,
  entity: OpsEntity,
  id: string,
): Promise<Record<string, unknown> | null> {
  const result = await serviceCall(`tenant.read.${entity}`, (client) =>
    client
      .from(ENTITY_TABLE[entity])
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle(),
  );
  if (result.ok) {
    const row = result.value.data as Record<string, unknown> | null;
    return row ? (camelizeRecord(row) as Record<string, unknown>) : null;
  }
  const demo = demoRecords(tenantId, entity).find((record) => record.id === id);
  return demo ? (demo as unknown as Record<string, unknown>) : null;
}

/** True when the signed-in employee may not touch this record. */
function outsideWork(
  scope: WorkScope | null,
  entity: OpsEntity,
  record: Record<string, unknown> | null,
): boolean {
  if (!scope?.personal) return false;
  const key = WORK_OWNER[entity];
  return !key || !record || !attributedTo(scope, record[key]);
}

function snakeKey(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

const DATE_KEYS = new Set([
  "lastOrder",
  "occurredOn",
  "dueOn",
  "issueOn",
  "meetingOn",
  "callOn",
  "followUpOn",
  "joinedOn",
  "startDate",
  "lastPaymentOn",
]);

function draftToRow(draft: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(draft)) {
    if (value === undefined) continue;
    // Postgres date columns reject '' (22007); blank optional dates become null.
    row[snakeKey(key)] = DATE_KEYS.has(key) && value === "" ? null : value;
  }
  return row;
}

function sortByUpdated(records: OpsRecord[]): OpsRecord[] {
  return records
    .slice()
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
}

export async function listEntity(tenantId: TenantId, entity: OpsEntity): Promise<OpsRecord[]> {
  const scope = await currentWorkScope();
  const result = await serviceCall(`tenant.list.${entity}`, (client) =>
    client
      .from(ENTITY_TABLE[entity])
      .select("*")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(500),
  );
  if (result.ok) {
    const rows = (result.value.data ?? []) as Array<Record<string, unknown>>;
    return scopeRecords(
      entity,
      rows.map((row) => camelizeRecord(row) as OpsRecord),
      scope,
    );
  }
  return scopeRecords(entity, sortByUpdated(demoRecords(tenantId, entity)), scope);
}

export async function createEntity(
  tenantId: TenantId,
  entity: OpsEntity,
  draft: OpsDraft,
): Promise<OpsRecord> {
  const scope = await currentWorkScope();
  const ownerKey = WORK_OWNER[entity];
  const input =
    scope?.personal && ownerKey
      ? { ...(draft as Record<string, unknown>), [ownerKey]: scope.name }
      : (draft as Record<string, unknown>);
  const now = new Date().toISOString();
  const record = {
    id: newId(entity.slice(0, 4)),
    tenantId,
    createdAt: now,
    updatedAt: now,
    ...input,
  } as OpsRecord;

  const result = await serviceCall(`tenant.create.${entity}`, (client) =>
    client
      .from(ENTITY_TABLE[entity])
      .insert({
        id: record.id,
        tenant_id: tenantId,
        ...draftToRow(input),
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .maybeSingle(),
  );
  if (result.ok && result.value.data) {
    return camelizeRecord(result.value.data as Record<string, unknown>) as OpsRecord;
  }

  demoInsert(tenantId, entity, record);
  return record;
}

export async function updateEntity(
  tenantId: TenantId,
  entity: OpsEntity,
  id: string,
  patch: Partial<OpsDraft>,
): Promise<OpsRecord | null> {
  const scope = await currentWorkScope();
  const existing = await fetchEntity(tenantId, entity, id);
  if (outsideWork(scope, entity, existing)) return null;

  const ownerKey = WORK_OWNER[entity];
  const input =
    scope?.personal && ownerKey
      ? { ...(patch as Record<string, unknown>), [ownerKey]: scope.name }
      : (patch as Record<string, unknown>);
  const now = new Date().toISOString();

  const result = await serviceCall(`tenant.update.${entity}`, (client) =>
    client
      .from(ENTITY_TABLE[entity])
      .update({ ...draftToRow(input), updated_at: now })
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .select("*")
      .maybeSingle(),
  );
  if (result.ok) {
    const data = result.value.data as Record<string, unknown> | null;
    return data ? (camelizeRecord(data) as OpsRecord) : null;
  }

  if (!existing) return null;
  const updated = {
    ...existing,
    ...input,
    updatedAt: now,
  } as OpsRecord;
  demoReplace(tenantId, entity, updated);
  return updated;
}

export async function deleteEntity(
  tenantId: TenantId,
  entity: OpsEntity,
  id: string,
): Promise<boolean> {
  const scope = await currentWorkScope();
  const existing = await fetchEntity(tenantId, entity, id);
  if (outsideWork(scope, entity, existing)) return false;

  const result = await serviceCall(`tenant.delete.${entity}`, (client) =>
    client
      .from(ENTITY_TABLE[entity])
      .delete({ count: "exact" })
      .eq("tenant_id", tenantId)
      .eq("id", id),
  );
  if (result.ok) return (result.value.count ?? 0) > 0;

  const demo = demoRecords(tenantId, entity).find((record) => record.id === id);
  if (!demo) return false;
  demoDelete(tenantId, entity, demo);
  return true;
}

export interface StageBucket {
  stage: string;
  count: number;
  value: number;
}

export interface WorkspaceOverview {
  counts: Record<OpsEntity, number>;
  pipelineValue: number;
  wonValue: number;
  openLeads: number;
  pipelineByStage: StageBucket[];
  revenue30: number;
  expenses30: number;
  net30: number;
  receivables: number;
  overdueInvoices: number;
  revenue14: number[];
  pendingSales: number;
  customersActive: number;
  customerValue: number;
  tasksOpen: number;
  tasksOverdue: number;
  tasksDone: number;
  pendingEvents: number;
  lastActivity: string | null;
  recentSales: SaleRecord[];
  activeLeads: LeadRecord[];
}

function dayKey(offsetDays: number): string {
  return new Date(Date.now() - offsetDays * 86_400_000).toISOString().slice(0, 10);
}

async function pendingEventCount(tenantId: TenantId): Promise<number> {
  const result = await serviceCall("tenant.outbox.pending", (client) =>
    client
      .from(OUTBOX_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["pending", "failed"]),
  );
  if (result.ok) return result.value.count ?? 0;
  return demoPendingCount(tenantId);
}

export async function getWorkspaceOverview(tenantId: TenantId): Promise<WorkspaceOverview> {
  const [
    leadRows,
    customerRows,
    saleRows,
    taskRows,
    meetingRows,
    callRows,
    projectRows,
    inventoryRows,
    transactionRows,
    invoiceRows,
    staffRows,
    pending,
  ] = await Promise.all([
    listEntity(tenantId, "leads"),
    listEntity(tenantId, "customers"),
    listEntity(tenantId, "sales"),
    listEntity(tenantId, "tasks"),
    listEntity(tenantId, "meetings"),
    listEntity(tenantId, "calls"),
    listEntity(tenantId, "projects"),
    listEntity(tenantId, "inventory"),
    listEntity(tenantId, "transactions"),
    listEntity(tenantId, "invoices"),
    listEntity(tenantId, "staff"),
    pendingEventCount(tenantId),
  ]);

  const leads = leadRows as LeadRecord[];
  const customers = customerRows as CustomerRecord[];
  const sales = saleRows as SaleRecord[];
  const tasks = taskRows as TaskRecord[];
  const transactions = transactionRows as TransactionRecord[];
  const invoices = invoiceRows as InvoiceRecord[];

  const openStages = LEAD_STAGES.filter((stage) => stage !== "won" && stage !== "lost");
  const pipelineByStage = LEAD_STAGES.map((stage) => {
    const matching = leads.filter((lead) => lead.stage === stage);
    return {
      stage,
      count: matching.length,
      value: matching.reduce((sum, lead) => sum + Number(lead.value ?? 0), 0),
    };
  });

  const paidSales = sales.filter((sale) => sale.status === "paid");
  const thirtyDaysAgo = dayKey(30);
  const revenue30 = paidSales
    .filter((sale) => sale.occurredOn >= thirtyDaysAgo)
    .reduce((sum, sale) => sum + Number(sale.amount ?? 0), 0);
  const expenses30 = transactions
    .filter((entry) => entry.kind === "expense" && entry.occurredOn >= thirtyDaysAgo)
    .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);

  const revenue14 = Array.from({ length: 14 }, (_, index) => dayKey(13 - index)).map((day) =>
    paidSales
      .filter((sale) => sale.occurredOn === day)
      .reduce((sum, sale) => sum + Number(sale.amount ?? 0), 0),
  );

  const today = dayKey(0);
  const openTasks = tasks.filter((task) => task.status !== "done");
  const pendingInvoices = invoices.filter((invoice) => invoice.status === "pending");
  const updatedTimes = [
    ...leads,
    ...customers,
    ...sales,
    ...tasks,
    ...meetingRows,
    ...callRows,
    ...projectRows,
    ...inventoryRows,
    ...transactionRows,
    ...invoiceRows,
    ...staffRows,
  ]
    .map((record) => String(record.updatedAt))
    .filter(Boolean)
    .sort();

  return {
    counts: {
      leads: leads.length,
      customers: customers.length,
      sales: sales.length,
      tasks: tasks.length,
      meetings: meetingRows.length,
      calls: callRows.length,
      projects: projectRows.length,
      inventory: inventoryRows.length,
      transactions: transactionRows.length,
      invoices: invoiceRows.length,
      staff: staffRows.length,
    },
    pipelineValue: leads
      .filter((lead) => openStages.includes(lead.stage))
      .reduce((sum, lead) => sum + Number(lead.value ?? 0), 0),
    wonValue: leads
      .filter((lead) => lead.stage === "won")
      .reduce((sum, lead) => sum + Number(lead.value ?? 0), 0),
    openLeads: leads.filter((lead) => openStages.includes(lead.stage)).length,
    pipelineByStage,
    revenue30,
    expenses30,
    net30: revenue30 - expenses30,
    receivables: pendingInvoices.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0),
    overdueInvoices: pendingInvoices.filter((invoice) => invoice.dueOn && invoice.dueOn < today).length,
    revenue14,
    pendingSales: sales
      .filter((sale) => sale.status === "pending")
      .reduce((sum, sale) => sum + Number(sale.amount ?? 0), 0),
    customersActive: customers.filter((customer) => customer.status === "active").length,
    customerValue: customers.reduce(
      (sum, customer) => sum + Number(customer.lifetimeValue ?? 0),
      0,
    ),
    tasksOpen: openTasks.length,
    tasksOverdue: openTasks.filter((task) => task.dueOn && task.dueOn < today).length,
    tasksDone: tasks.filter((task) => task.status === "done").length,
    pendingEvents: pending,
    lastActivity: updatedTimes.length ? updatedTimes[updatedTimes.length - 1] : null,
    recentSales: sales
      .slice()
      .sort((left, right) => String(right.occurredOn).localeCompare(String(left.occurredOn)))
      .slice(0, 5),
    activeLeads: leads
      .filter((lead) => openStages.includes(lead.stage))
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
      .slice(0, 5),
  };
}
