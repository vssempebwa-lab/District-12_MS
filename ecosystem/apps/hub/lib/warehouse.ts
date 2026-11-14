import { createServiceClient, hasServiceRoleEnv, isFallbackError } from "@d12/db";
import { TENANTS, type TenantId, type TelemetryEvent } from "@d12/contracts";
import { isMissingSchema } from "./accounts";
import { getStore, type StoredBatch } from "./store";

export interface DailyPoint {
  day: string;
  revenue: number;
  expenses: number;
  leads: number;
  tasks: number;
}

export interface TenantWarehouseRow {
  tenantId: TenantId;
  name: string;
  shortName: string;
  mark: string;
  color: string;
  revenue30d: number;
  expenses30d: number;
  transactions30d: number;
  leads30d: number;
  tasks30d: number;
  events: number | null;
  lastEventAt: string | null;
}

export interface WarehouseOverview {
  mode: "demo" | "supabase";
  expensesAvailable: boolean;
  tenants: TenantWarehouseRow[];
  batches: StoredBatch[];
  totalEvents: number;
  lastReceivedAt: string | null;
  daily: DailyPoint[];
}

function kampalaDay(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function recentDays(count: number): string[] {
  const days: string[] = [];
  const today = Date.now();
  for (let index = count - 1; index >= 0; index -= 1) {
    const day = kampalaDay(new Date(today - index * 86_400_000).toISOString());
    if (day) days.push(day);
  }
  return days;
}

function latestStates(events: TelemetryEvent[]): TelemetryEvent[] {
  const latest = new Map<string, TelemetryEvent>();
  for (const event of events) {
    const key = `${event.entity}:${event.entityId}`;
    const current = latest.get(key);
    if (!current || new Date(event.occurredAt).getTime() > new Date(current.occurredAt).getTime()) {
      latest.set(key, event);
    }
  }
  return Array.from(latest.values());
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function saleDay(event: TelemetryEvent): string | null {
  const occurredOn = event.data.occurredOn;
  if (typeof occurredOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) return occurredOn;
  const occurredAt = event.data.occurredAt;
  if (typeof occurredAt === "string") return kampalaDay(occurredAt);
  return null;
}

function ledgerDay(event: TelemetryEvent): string | null {
  const occurredOn = event.data.occurredOn;
  if (typeof occurredOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) return occurredOn;
  const occurredAt = event.data.occurredAt;
  if (typeof occurredAt === "string") return kampalaDay(occurredAt);
  return null;
}

function eventDay(event: TelemetryEvent): string | null {
  return kampalaDay(event.occurredAt);
}

function summarizeTenant(
  tenantId: TenantId,
  events: TelemetryEvent[],
  cutoff: string,
): TenantWarehouseRow {
  const meta = TENANTS[tenantId];
  const latest = latestStates(events);
  let revenue30d = 0;
  let expenses30d = 0;
  let transactions30d = 0;
  let tasks30d = 0;

  for (const event of latest) {
    if (event.type === "sale.deleted" || event.type === "transaction.deleted") continue;
    if (event.entity === "sales") {
      const day = saleDay(event);
      if (!day || day < cutoff) continue;
      if (event.data.status === "paid") {
        revenue30d += numberValue(event.data.amount);
        transactions30d += 1;
      }
    }
    if (event.entity === "transactions") {
      const day = ledgerDay(event);
      if (!day || day < cutoff) continue;
      if (event.data.kind === "expense") expenses30d += numberValue(event.data.amount);
    }
    if (event.entity === "tasks" && event.data.status === "done") {
      const day = eventDay(event);
      if (day && day >= cutoff) tasks30d += 1;
    }
  }

  const leads30d = events.filter((event) => {
    if (event.type !== "lead.created") return false;
    const day = eventDay(event);
    return Boolean(day && day >= cutoff);
  }).length;

  const lastEventAt = events.reduce<string | null>((latestAt, event) => {
    if (!latestAt) return event.occurredAt;
    return new Date(event.occurredAt) > new Date(latestAt) ? event.occurredAt : latestAt;
  }, null);

  return {
    tenantId,
    name: meta.name,
    shortName: meta.shortName,
    mark: meta.mark,
    color: meta.color,
    revenue30d,
    expenses30d,
    transactions30d,
    leads30d,
    tasks30d,
    events: events.length,
    lastEventAt,
  };
}

function demoOverview(windowDays = 14): WarehouseOverview {
  const store = getStore();
  const cutoff = recentDays(30)[0] ?? new Date().toISOString().slice(0, 10);
  const days = recentDays(windowDays);

  const tenants = Object.keys(TENANTS).map((tenantId) => {
    const id = tenantId as TenantId;
    return summarizeTenant(id, store.events[id] ?? [], cutoff);
  });

  const allLatest = Object.entries(store.events).flatMap(([tenantId, events]) =>
    latestStates(events ?? []).map((event) => ({ tenantId: tenantId as TenantId, event })),
  );

  const daily: DailyPoint[] = days.map((day) => {
    let revenue = 0;
    let expenses = 0;
    let leads = 0;
    let tasks = 0;
    for (const { event } of allLatest) {
      if (event.type === "sale.deleted" || event.type === "transaction.deleted") continue;
      if (event.entity === "sales" && event.data.status === "paid" && saleDay(event) === day) {
        revenue += numberValue(event.data.amount);
      }
      if (
        event.entity === "transactions" &&
        event.data.kind === "expense" &&
        ledgerDay(event) === day
      ) {
        expenses += numberValue(event.data.amount);
      }
      if (event.entity === "tasks" && event.data.status === "done" && eventDay(event) === day) {
        tasks += 1;
      }
    }
    for (const events of Object.values(store.events)) {
      leads += (events ?? []).filter(
        (event) => event.type === "lead.created" && eventDay(event) === day,
      ).length;
    }
    return { day, revenue, expenses, leads, tasks };
  });

  const totalEvents = Object.values(store.events).reduce(
    (sum, events) => sum + (events?.length ?? 0),
    0,
  );

  return {
    mode: "demo",
    expensesAvailable: true,
    tenants,
    batches: store.batches.slice(0, 20),
    totalEvents,
    lastReceivedAt: store.batches[0]?.receivedAt ?? null,
    daily,
  };
}

interface SummaryRow {
  tenant_id: string;
  name: string;
  short_name: string;
  mark: string;
  color: string;
  revenue_30d: string | number;
  expenses_30d: string | number;
  transactions_30d: string | number;
  leads_30d: string | number;
  tasks_30d: string | number;
}

async function supabaseOverview(windowDays = 14): Promise<WarehouseOverview> {
  const service = createServiceClient();
  const days = recentDays(windowDays);
  const cutoff = days[0];

  const { data: summary, error: summaryError } = await service
    .from("d12_wh_group_summary")
    .select("*");
  if (summaryError) throw summaryError;

  const { data: sales, error: salesError } = await service
    .from("d12_wh_daily_sales")
    .select("tenant_id, day, transactions, revenue")
    .gte("day", cutoff);
  if (salesError) throw salesError;

  const { data: costs, error: costsError } = await service
    .from("d12_wh_daily_costs")
    .select("tenant_id, day, entries, expenses")
    .gte("day", cutoff);
  if (costsError && !isMissingSchema(costsError)) throw costsError;

  const { data: activity, error: activityError } = await service
    .from("d12_wh_daily_activity")
    .select("tenant_id, day, leads_created, tasks_completed")
    .gte("day", cutoff);
  if (activityError) throw activityError;

  const { data: batchRows, error: batchError } = await service
    .from("d12_wh_batches")
    .select("id, tenant_id, received_at, event_count, accepted, duplicates, signature_verified")
    .order("received_at", { ascending: false })
    .limit(20);
  if (batchError) throw batchError;

  const { count: totalEvents, error: countError } = await service
    .from("d12_wh_events")
    .select("event_id", { count: "exact", head: true });
  if (countError) throw countError;

  const { data: latestEvent } = await service
    .from("d12_wh_events")
    .select("occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const rows = ((summary ?? []) as unknown as SummaryRow[]).map<TenantWarehouseRow>((row) => {
    const tenantId = row.tenant_id as TenantId;
    const meta = TENANTS[tenantId];
    return {
      tenantId,
      name: meta?.name ?? row.name,
      shortName: meta?.shortName ?? row.short_name,
      mark: meta?.mark ?? row.mark,
      color: meta?.color ?? row.color,
      revenue30d: Number(row.revenue_30d) || 0,
      expenses30d: Number(row.expenses_30d) || 0,
      transactions30d: Number(row.transactions_30d) || 0,
      leads30d: Number(row.leads_30d) || 0,
      tasks30d: Number(row.tasks_30d) || 0,
      events: null,
      lastEventAt: null,
    };
  });

  const dailyMap = new Map<string, DailyPoint>();
  for (const day of days) dailyMap.set(day, { day, revenue: 0, expenses: 0, leads: 0, tasks: 0 });
  for (const row of (sales ?? []) as Array<{ day: string; revenue: string | number }>) {
    const point = dailyMap.get(String(row.day));
    if (point) point.revenue += Number(row.revenue) || 0;
  }
  for (const row of (costs ?? []) as Array<{ day: string; expenses: string | number }>) {
    const point = dailyMap.get(String(row.day));
    if (point) point.expenses += Number(row.expenses) || 0;
  }
  for (const row of (activity ?? []) as Array<{ day: string; leads_created: number; tasks_completed: number }>) {
    const point = dailyMap.get(String(row.day));
    if (point) {
      point.leads += Number(row.leads_created) || 0;
      point.tasks += Number(row.tasks_completed) || 0;
    }
  }

  const batches = ((batchRows ?? []) as Array<{
    id: string;
    tenant_id: string;
    received_at: string;
    event_count: number;
    accepted: number;
    duplicates: number;
    signature_verified: boolean;
  }>).map<StoredBatch>((row) => ({
    id: row.id,
    tenantId: row.tenant_id as TenantId,
    receivedAt: row.received_at,
    eventCount: row.event_count,
    accepted: row.accepted,
    duplicates: row.duplicates,
    signatureVerified: row.signature_verified,
  }));

  return {
    mode: "supabase",
    expensesAvailable: !costsError,
    tenants: rows,
    batches,
    totalEvents: totalEvents ?? 0,
    lastReceivedAt:
      (latestEvent as { occurred_at?: string } | null)?.occurred_at ?? batches[0]?.receivedAt ?? null,
    daily: days.map(
      (day) => dailyMap.get(day) ?? { day, revenue: 0, expenses: 0, leads: 0, tasks: 0 },
    ),
  };
}

export async function getWarehouseOverview(windowDays = 14): Promise<WarehouseOverview> {
  if (hasServiceRoleEnv()) {
    try {
      return await supabaseOverview(windowDays);
    } catch (error) {
      if (!isFallbackError(error)) throw error;
    }
  }
  return demoOverview(windowDays);
}
