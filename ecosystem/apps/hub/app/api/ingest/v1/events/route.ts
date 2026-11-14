import { NextResponse } from "next/server";
import { createServiceClient, hasServiceRoleEnv } from "@d12/db";
import {
  INGEST_MAX_SKEW_SECONDS,
  SIGNATURE_HEADER,
  TELEMETRY_MAX_EVENTS,
  TELEMETRY_SCHEMA_VERSION,
  TENANT_HEADER,
  TIMESTAMP_HEADER,
  isTenantId,
  telemetryBatchSchema,
  type TelemetryBatch,
} from "@d12/contracts";
import { getTenantSecret, verifyIngestSignature } from "@d12/telemetry";
import { isMissingSchema } from "@/lib/accounts";
import { clientIp, jsonError, jsonOk, zodDetails } from "@/lib/http";
import { demoEventTotals, recordDemoBatch, todayIso, type StoredBatch } from "@/lib/store";

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

function demoIngest(batch: TelemetryBatch): Record<string, unknown> {
  const stored: StoredBatch = {
    id: batch.batchId,
    tenantId: batch.tenantId as StoredBatch["tenantId"],
    receivedAt: new Date().toISOString(),
    eventCount: batch.events.length,
    accepted: 0,
    duplicates: 0,
    signatureVerified: true,
  };
  const outcome = recordDemoBatch(stored, batch.events);
  return {
    batchId: batch.batchId,
    accepted: outcome.accepted,
    duplicates: outcome.duplicates,
    rejected: 0,
    totals: demoEventTotals(),
  };
}

async function supabaseIngest(
  batch: TelemetryBatch,
  ip: string | null,
): Promise<Record<string, unknown>> {
  const service = createServiceClient();

  const { error: batchError } = await service.from("d12_wh_batches").upsert(
    {
      id: batch.batchId,
      tenant_id: batch.tenantId,
      signature_verified: true,
      event_count: batch.events.length,
      accepted: 0,
      duplicates: 0,
      source_ip: ip,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (batchError) throw batchError;

  let accepted = 0;
  if (batch.events.length > 0) {
    const rows = batch.events.map((event) => ({
      event_id: event.id,
      tenant_id: batch.tenantId,
      batch_id: batch.batchId,
      event_type: event.type,
      entity: event.entity,
      entity_id: event.entityId,
      occurred_at: event.occurredAt,
      payload: event,
    }));
    const { data, error } = await service
      .from("d12_wh_events")
      .upsert(rows, { onConflict: "event_id", ignoreDuplicates: true })
      .select("event_id");
    if (error) throw error;
    accepted = (data ?? []).length;
  }

  const duplicates = batch.events.length - accepted;
  await service
    .from("d12_wh_batches")
    .update({ accepted, duplicates, event_count: batch.events.length })
    .eq("id", batch.batchId);

  const days = new Set<string>();
  for (const event of batch.events) {
    const day = kampalaDay(event.occurredAt);
    if (day) days.add(day);
  }
  for (const day of days) {
    const { error: refreshError } = await service.rpc("d12_wh_refresh_facts", {
      p_tenant: batch.tenantId,
      p_day: day,
    });
    if (refreshError && !isMissingSchema(refreshError)) {
      console.error("[d12] fact refresh failed", refreshError);
    }
  }

  const { count: totalEvents } = await service
    .from("d12_wh_events")
    .select("event_id", { count: "exact", head: true });
  const { count: batchesToday } = await service
    .from("d12_wh_batches")
    .select("id", { count: "exact", head: true })
    .gte("received_at", `${todayIso()}T00:00:00Z`);

  return {
    batchId: batch.batchId,
    accepted,
    duplicates,
    rejected: 0,
    totals: { events: totalEvents ?? 0, batchesToday: batchesToday ?? 0 },
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  if (rawBody.length > 1_000_000) {
    return jsonError("PAYLOAD_TOO_LARGE", "Batches must be under 1 MB", 413);
  }

  const tenant = (request.headers.get(TENANT_HEADER) ?? "").trim();
  if (!isTenantId(tenant)) {
    return jsonError("UNKNOWN_TENANT", "Unknown subsidiary", 404);
  }

  let secret: string;
  try {
    secret = getTenantSecret(tenant);
  } catch {
    return jsonError("INTERNAL", "Ingestion is not configured for this subsidiary", 500);
  }

  const configuredSkew = Number(process.env.D12_INGEST_MAX_SKEW_SECONDS ?? INGEST_MAX_SKEW_SECONDS);
  const verification = await verifyIngestSignature({
    secret,
    tenantId: tenant,
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    rawBody,
    signatureHeader: request.headers.get(SIGNATURE_HEADER),
    maxSkewSeconds: Number.isFinite(configuredSkew) ? configuredSkew : INGEST_MAX_SKEW_SECONDS,
  });

  if (!verification.ok) {
    if (verification.reason === "stale") {
      return jsonError("STALE_TIMESTAMP", "Batch timestamp is outside the accepted window", 401);
    }
    if (verification.reason === "missing") {
      return jsonError("SIGNATURE_INVALID", "Missing signature headers", 401);
    }
    return jsonError("SIGNATURE_INVALID", "Signature could not be verified", 401);
  }

  let payload: unknown = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = null;
  }
  if (typeof payload === "object" && payload !== null && "schemaVersion" in payload) {
    const version = (payload as { schemaVersion?: unknown }).schemaVersion;
    if (version !== TELEMETRY_SCHEMA_VERSION) {
      return jsonError(
        "SCHEMA_UNSUPPORTED",
        `schemaVersion ${String(version)} is not supported`,
        422,
      );
    }
  }

  const parsed = telemetryBatchSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError("VALIDATION_FAILED", "Batch failed validation", 400, {
      issues: zodDetails(parsed.error),
    });
  }

  const batch = parsed.data;
  if (batch.events.length > TELEMETRY_MAX_EVENTS) {
    return jsonError("PAYLOAD_TOO_LARGE", `A batch may carry at most ${TELEMETRY_MAX_EVENTS} events`, 413);
  }
  if (batch.tenantId !== tenant) {
    return jsonError("FORBIDDEN", "Batch tenant does not match the signed tenant", 403);
  }

  if (hasServiceRoleEnv()) {
    try {
      const result = await supabaseIngest(batch, clientIp(request));
      return jsonOk(result, { status: 202 });
    } catch (error) {
      if (!isMissingSchema(error)) {
        console.error("[d12] ingestion failed", error);
        return jsonError("INTERNAL", "Ingestion failed", 500);
      }
    }
  }

  return jsonOk(demoIngest(batch), { status: 202 });
}
