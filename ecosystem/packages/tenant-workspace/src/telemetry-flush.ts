import { createServiceClient, hasServiceRoleEnv, isFallbackError, serviceCall } from "@d12/db";
import {
  TELEMETRY_MAX_EVENTS,
  hubAppUrl,
  type OutboxRow,
  type TenantId,
} from "@d12/contracts";
import {
  buildBatch,
  getTenantSecret,
  outboxRowsToEvents,
  postBatch,
} from "@d12/telemetry";
import {
  demoClearOutbox,
  demoPendingOutbox,
} from "./store";

const OUTBOX_TABLE = "d12_telemetry_outbox";
const OUTBOX_COLUMNS = "id, tenant_id, event_id, event_type, entity, entity_id, payload, occurred_at";

export interface FlushResult {
  ok: boolean;
  status: number;
  sent: number;
  accepted: number;
  duplicates: number;
  error?: string;
}

async function deliver(tenantId: TenantId, rows: OutboxRow[]): Promise<FlushResult> {
  const events = outboxRowsToEvents(rows);
  if (!events.length) {
    return { ok: true, status: 0, sent: 0, accepted: 0, duplicates: 0 };
  }

  const batch = buildBatch(tenantId, events);
  const result = await postBatch(hubAppUrl(), getTenantSecret(tenantId), batch);
  const body = (result.body ?? null) as { accepted?: number; duplicates?: number } | null;

  return {
    ok: result.ok,
    status: result.status,
    sent: events.length,
    accepted: body?.accepted ?? 0,
    duplicates: body?.duplicates ?? 0,
    error: result.error,
  };
}

async function flushDemo(tenantId: TenantId): Promise<FlushResult> {
  const rows = demoPendingOutbox(tenantId, TELEMETRY_MAX_EVENTS);
  const result = await deliver(tenantId, rows);
  if (result.ok && result.sent > 0) {
    demoClearOutbox(tenantId, new Set(rows.map((row) => row.id)));
  }
  return result;
}

async function flushSupabase(tenantId: TenantId): Promise<FlushResult | null> {
  const client = createServiceClient();
  const pending = await serviceCall("tenant.outbox.flush", (service) =>
    service
      .from(OUTBOX_TABLE)
      .select(OUTBOX_COLUMNS)
      .eq("tenant_id", tenantId)
      .in("status", ["pending", "failed"])
      .order("occurred_at", { ascending: true })
      .limit(TELEMETRY_MAX_EVENTS),
  );
  if (!pending.ok) return null;

  const rows = (pending.value.data ?? []) as unknown as OutboxRow[];
  if (!rows.length) {
    return { ok: true, status: 0, sent: 0, accepted: 0, duplicates: 0 };
  }

  const result = await deliver(tenantId, rows);
  const ids = rows.map((row) => row.id);

  if (result.ok) {
    await client
      .from(OUTBOX_TABLE)
      .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
      .in("id", ids);
  } else {
    await client
      .from(OUTBOX_TABLE)
      .update({ status: "failed", last_error: result.error ?? "Delivery failed" })
      .in("id", ids);
  }

  return result;
}

export async function flushTelemetry(tenantId: TenantId): Promise<FlushResult> {
  if (hasServiceRoleEnv()) {
    try {
      const result = await flushSupabase(tenantId);
      if (result) return result;
    } catch (error) {
      if (isFallbackError(error)) return flushDemo(tenantId);
      return {
        ok: false,
        status: 0,
        sent: 0,
        accepted: 0,
        duplicates: 0,
        error: error instanceof Error ? error.message : "Supabase outbox unavailable",
      };
    }
  }
  return flushDemo(tenantId);
}
