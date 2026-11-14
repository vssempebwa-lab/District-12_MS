import { tenantSecretEnvKey, type TenantId } from "@d12/contracts";

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (let index = 0; index < bytes.length; index += 1) {
    hex += bytes[index].toString(16).padStart(2, "0");
  }
  return hex;
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is required for District 12 telemetry");
  }
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toHex(new Uint8Array(signature));
}

export function getTenantSecret(tenantId: TenantId): string {
  const secret = process.env[tenantSecretEnvKey(tenantId)]?.trim();
  if (secret) return secret;
  if (process.env.D12_DEMO_MODE !== "false") return `demo-${tenantId}-secret`;
  throw new Error(`Missing ${tenantSecretEnvKey(tenantId)}`);
}

export interface SignedHeaders {
  timestamp: string;
  signature: string;
  headers: Record<string, string>;
}

export async function signIngestRequest(
  secret: string,
  tenantId: string,
  rawBody: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<SignedHeaders> {
  const timestamp = String(nowSeconds);
  const signature = await hmacHex(secret, `${timestamp}.${tenantId}.${rawBody}`);
  return {
    timestamp,
    signature,
    headers: {
      "x-d12-tenant": tenantId,
      "x-d12-timestamp": timestamp,
      "x-d12-signature": `v1=${signature}`,
    },
  };
}

export type SignatureFailure = "missing" | "stale" | "invalid";

export interface VerifySignatureInput {
  secret: string;
  tenantId: string;
  timestamp: string | null;
  rawBody: string;
  signatureHeader: string | null;
  maxSkewSeconds?: number;
  nowSeconds?: number;
}

export async function verifyIngestSignature(
  input: VerifySignatureInput,
): Promise<{ ok: true } | { ok: false; reason: SignatureFailure }> {
  if (!input.timestamp || !input.signatureHeader) return { ok: false, reason: "missing" };

  const timestamp = Number(input.timestamp);
  if (!Number.isInteger(timestamp)) return { ok: false, reason: "invalid" };

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const maxSkew = input.maxSkewSeconds ?? 300;
  if (Math.abs(now - timestamp) > maxSkew) return { ok: false, reason: "stale" };

  const expected = await hmacHex(input.secret, `${timestamp}.${input.tenantId}.${input.rawBody}`);
  const candidates = input.signatureHeader
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3).toLowerCase());

  if (!candidates.some((candidate) => constantTimeEqual(candidate, expected))) {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true };
}
