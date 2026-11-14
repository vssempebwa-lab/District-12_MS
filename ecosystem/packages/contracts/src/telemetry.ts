import { z } from "zod";
import { opsEntitySchema } from "./schemas";

export const TELEMETRY_SCHEMA_VERSION = 1;
export const TELEMETRY_MAX_EVENTS = 500;
export const INGEST_MAX_SKEW_SECONDS = 300;

export const TENANT_HEADER = "x-d12-tenant";
export const TIMESTAMP_HEADER = "x-d12-timestamp";
export const SIGNATURE_HEADER = "x-d12-signature";

export const telemetryEventTypeSchema = z
  .string()
  .regex(
    /^(lead|customer|sale|task|project|inventory|transaction|invoice|staff)\.(created|updated|deleted)$/,
  );

export const telemetryEventSchema = z.object({
  id: z.string().min(8).max(80),
  tenantId: z.string().min(1).max(60),
  type: telemetryEventTypeSchema,
  entity: opsEntitySchema,
  entityId: z.string().min(1).max(120),
  occurredAt: z.string().datetime({ offset: true }),
  data: z.record(z.unknown()),
});

export const telemetryBatchSchema = z
  .object({
    schemaVersion: z.literal(TELEMETRY_SCHEMA_VERSION),
    batchId: z.string().min(8).max(80),
    tenantId: z.string().min(1).max(60),
    sentAt: z.string().datetime({ offset: true }),
    events: z.array(telemetryEventSchema).max(TELEMETRY_MAX_EVENTS),
  })
  .superRefine((batch, ctx) => {
    batch.events.forEach((event, index) => {
      if (event.tenantId !== batch.tenantId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Event tenantId must match the batch tenantId",
          path: ["events", index, "tenantId"],
        });
      }
      if (!event.type.startsWith(`${event.entity.replace(/s$/, "")}.`)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Event type ${event.type} does not belong to entity ${event.entity}`,
          path: ["events", index, "type"],
        });
      }
    });
  });

export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;
export type TelemetryBatch = z.infer<typeof telemetryBatchSchema>;

export interface IngestResult {
  ok: true;
  batchId: string;
  accepted: number;
  duplicates: number;
  rejected: number;
  totals: { events: number; batchesToday: number };
}

export interface OutboxRow {
  id: string;
  tenant_id: string;
  event_id: string;
  event_type: string;
  entity: string;
  entity_id: string;
  payload: { op?: string; record?: Record<string, unknown> };
  occurred_at: string;
}

export function signatureBase(timestamp: string, tenantId: string, rawBody: string): string {
  return `${timestamp}.${tenantId}.${rawBody}`;
}
