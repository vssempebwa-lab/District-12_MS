import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient, hasServiceRoleEnv } from "./client";

const SCHEMA_CODES = new Set(["42P01", "42P17", "PGRST202", "PGRST205", "42883"]);

const TRANSPORT_PATTERN =
  /fetch failed|failed to fetch|network ?error|ECONNRESET|ECONNREFUSED|ECONNABORTED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EPIPE|socket hang up|other side closed|terminated|UND_ERR|aborted|timed? ?out/i;

function errorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  const message = (error as { message?: unknown }).message;
  if (typeof message === "string") return message;
  return error instanceof Error ? error.message : "";
}

export function isSchemaMissingError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && SCHEMA_CODES.has(code)) return true;
  return /does not exist|could not find the table|schema cache/i.test(errorMessage(error));
}

export function isTransportError(error: unknown): boolean {
  if (!error) return false;
  const status = (error as { status?: unknown }).status;
  if (typeof status === "number" && status >= 500) return true;

  const message = errorMessage(error);
  if (TRANSPORT_PATTERN.test(message)) return true;

  const cause = (error as { cause?: unknown }).cause;
  return cause && cause !== error ? isTransportError(cause) : false;
}

// Everything the app can recover from by using the in-memory store: the remote
// schema has not been applied yet, or Supabase is temporarily unreachable.
export function isFallbackError(error: unknown): boolean {
  return isSchemaMissingError(error) || isTransportError(error);
}

const warned = new Set<string>();

export function warnFallback(label: string, error: unknown): void {
  const detail = errorMessage(error) || "Supabase is unreachable";
  const key = `${label}:${detail}`;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[d12] ${label}: Supabase unavailable, using the in-memory store (${detail})`);
}

export type ServiceCall<T> = { ok: true; value: T } | { ok: false; error: unknown };

/**
 * Runs a Supabase query and reports whether its result can be trusted.
 * A schema or transport failure returns `ok: false` so the caller can fall back
 * to the in-memory store; any other database error is still raised.
 */
export async function serviceCall<T>(
  label: string,
  run: (client: SupabaseClient) => PromiseLike<T>,
): Promise<ServiceCall<T>> {
  if (!hasServiceRoleEnv()) return { ok: false, error: null };
  try {
    const value = await run(createServiceClient());
    const error = (value as { error?: unknown } | null | undefined)?.error;
    if (error) {
      if (!isFallbackError(error)) throw error;
      warnFallback(label, error);
      return { ok: false, error };
    }
    return { ok: true, value };
  } catch (error) {
    if (!isFallbackError(error)) throw error;
    warnFallback(label, error);
    return { ok: false, error };
  }
}
