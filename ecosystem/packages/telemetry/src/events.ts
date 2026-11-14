import {
  TELEMETRY_SCHEMA_VERSION,
  isOpsEntity,
  type OpsEntity,
  type OutboxRow,
  type TelemetryBatch,
  type TelemetryEvent,
} from "@d12/contracts";

export function newId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`;
  return `${prefix}_${random.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
}

function camelKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

export function camelizeRecord(record: Record<string, unknown>): Record<string, unknown> {
  const camelized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    camelized[camelKey(key)] = value instanceof Date ? value.toISOString() : value;
  }
  return camelized;
}

const OP_WORDS: Record<string, string> = {
  insert: "created",
  update: "updated",
  delete: "deleted",
  created: "created",
  updated: "updated",
  deleted: "deleted",
};

const IRREGULAR_SINGULARS: Partial<Record<OpsEntity, string>> = {
  inventory: "inventory",
};

export function eventTypeFor(entity: OpsEntity, op: string): string {
  const singular = IRREGULAR_SINGULARS[entity] ?? entity.slice(0, -1);
  return `${singular}.${OP_WORDS[op.toLowerCase()] ?? "updated"}`;
}

export function eventFromRecord(
  tenantId: string,
  entity: OpsEntity,
  op: string,
  record: Record<string, unknown>,
): TelemetryEvent {
  const data = camelizeRecord(record);
  const entityId = typeof data.id === "string" && data.id ? data.id : newId("row");
  const occurredAt =
    typeof data.updatedAt === "string"
      ? data.updatedAt
      : typeof data.createdAt === "string"
        ? data.createdAt
        : new Date().toISOString();
  return {
    id: newId("evt"),
    tenantId,
    type: eventTypeFor(entity, op),
    entity,
    entityId,
    occurredAt,
    data,
  };
}

export function outboxRowToEvent(row: OutboxRow): TelemetryEvent | null {
  if (!isOpsEntity(row.entity)) return null;
  const record = row.payload?.record && typeof row.payload.record === "object" ? row.payload.record : {};
  const data = camelizeRecord(record);
  const occurred = new Date(row.occurred_at);
  return {
    id: row.event_id,
    tenantId: row.tenant_id,
    type: row.event_type,
    entity: row.entity,
    entityId: row.entity_id,
    occurredAt: Number.isNaN(occurred.getTime()) ? new Date().toISOString() : occurred.toISOString(),
    data,
  };
}

export function outboxRowsToEvents(rows: OutboxRow[]): TelemetryEvent[] {
  return rows
    .map((row) => outboxRowToEvent(row))
    .filter((event): event is TelemetryEvent => event !== null);
}

export function buildBatch(
  tenantId: string,
  events: TelemetryEvent[],
  batchId: string = newId("bat"),
): TelemetryBatch {
  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    batchId,
    tenantId,
    sentAt: new Date().toISOString(),
    events,
  };
}
