import {
  OPS_ENTITIES,
  type OpsEntity,
  type OpsRecord,
  type OutboxRow,
  type TenantId,
} from "@d12/contracts";
import { eventFromRecord, newId } from "@d12/telemetry";
import { seedRecords, type TenantRecords } from "./fixtures";

export interface TenantStore {
  tenantId: TenantId;
  records: TenantRecords;
  outbox: OutboxRow[];
  seededAt: string;
}

const globalStores = globalThis as typeof globalThis & {
  __d12TenantStores?: Partial<Record<TenantId, TenantStore>>;
};

export function outboxRowFor(
  tenantId: TenantId,
  entity: OpsEntity,
  op: string,
  record: OpsRecord,
): OutboxRow {
  const event = eventFromRecord(tenantId, entity, op, record as unknown as Record<string, unknown>);
  return {
    id: newId("out"),
    tenant_id: tenantId,
    event_id: event.id,
    event_type: event.type,
    entity,
    entity_id: event.entityId,
    payload: { op, record: record as unknown as Record<string, unknown> },
    occurred_at: event.occurredAt,
  };
}

function createStore(tenantId: TenantId): TenantStore {
  const records = seedRecords(tenantId);
  const outbox: OutboxRow[] = [];
  for (const entity of OPS_ENTITIES) {
    for (const record of records[entity] as OpsRecord[]) {
      outbox.push(outboxRowFor(tenantId, entity, "insert", record));
    }
  }
  outbox.sort((left, right) => left.occurred_at.localeCompare(right.occurred_at));
  return { tenantId, records, outbox, seededAt: new Date().toISOString() };
}

export function getTenantStore(tenantId: TenantId): TenantStore {
  globalStores.__d12TenantStores ??= {};
  const stores = globalStores.__d12TenantStores;
  const existing = stores[tenantId];
  const missingEntity =
    existing && OPS_ENTITIES.some((entity) => !Array.isArray(existing.records[entity]));
  if (!existing || missingEntity) {
    stores[tenantId] = createStore(tenantId);
  }
  return stores[tenantId] as TenantStore;
}

export function demoRecords(tenantId: TenantId, entity: OpsEntity): OpsRecord[] {
  return getTenantStore(tenantId).records[entity] as OpsRecord[];
}

export function demoInsert(tenantId: TenantId, entity: OpsEntity, record: OpsRecord): void {
  const store = getTenantStore(tenantId);
  (store.records[entity] as OpsRecord[]).unshift(record);
  store.outbox.push(outboxRowFor(tenantId, entity, "insert", record));
}

export function demoReplace(tenantId: TenantId, entity: OpsEntity, record: OpsRecord): void {
  const store = getTenantStore(tenantId);
  const rows = store.records[entity] as OpsRecord[];
  const index = rows.findIndex((row) => row.id === record.id);
  if (index >= 0) rows.splice(index, 1, record);
  store.outbox.push(outboxRowFor(tenantId, entity, "update", record));
}

export function demoDelete(tenantId: TenantId, entity: OpsEntity, record: OpsRecord): void {
  const store = getTenantStore(tenantId);
  const rows = store.records[entity] as OpsRecord[];
  const index = rows.findIndex((row) => row.id === record.id);
  if (index >= 0) rows.splice(index, 1);
  store.outbox.push(outboxRowFor(tenantId, entity, "delete", record));
}

export function demoPendingOutbox(tenantId: TenantId, limit = 500): OutboxRow[] {
  return getTenantStore(tenantId).outbox.slice(0, limit);
}

export function demoPendingCount(tenantId: TenantId): number {
  return getTenantStore(tenantId).outbox.length;
}

export function demoClearOutbox(tenantId: TenantId, ids: Set<string>): void {
  const store = getTenantStore(tenantId);
  store.outbox = store.outbox.filter((row) => !ids.has(row.id));
}

/** Drop the in-memory demo store so the next read reseeds from fixtures. */
export function demoReset(tenantId: TenantId): void {
  const stores = globalStores.__d12TenantStores;
  if (stores) delete stores[tenantId];
}
