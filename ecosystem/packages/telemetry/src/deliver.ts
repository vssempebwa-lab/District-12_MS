import type { TelemetryBatch } from "@d12/contracts";
import { signIngestRequest } from "./crypto";

export interface DeliveryResult {
  ok: boolean;
  status: number;
  body: unknown;
  error?: string;
}

export async function postBatch(
  hubUrl: string,
  secret: string,
  batch: TelemetryBatch,
  fetchImpl: typeof fetch = fetch,
): Promise<DeliveryResult> {
  const rawBody = JSON.stringify(batch);
  const signed = await signIngestRequest(secret, batch.tenantId, rawBody);
  const url = new URL("/api/ingest/v1/events", hubUrl).toString();

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...signed.headers,
      },
      body: rawBody,
      cache: "no-store",
    });
    const body = await response.json().catch(() => null);
    const errorMessage =
      response.ok || typeof body !== "object" || body === null
        ? undefined
        : (body as { error?: { message?: string } }).error?.message;
    return { ok: response.ok, status: response.status, body, error: errorMessage };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: null,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
