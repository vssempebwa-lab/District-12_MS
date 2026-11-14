#!/usr/bin/env node
// Drains the tenant telemetry outbox on a schedule.
// Usage: node --env-file=../../.env.local apps/passito/worker/telemetry.mjs

import { fileURLToPath } from "node:url";

try {
  process.loadEnvFile(fileURLToPath(new URL("../../../.env.local", import.meta.url)));
} catch {
  // Fall back to the ambient environment when no local env file exists.
}

const base = process.env.D12_TENANT_URL ?? process.env.NEXT_PUBLIC_D12_PASSITO_URL ?? "http://localhost:3001";
const token = process.env.D12_TELEMETRY_WORKER_TOKEN;
const interval = Number(process.env.D12_TELEMETRY_INTERVAL_MS ?? "15000");

if (!token) {
  console.error("D12_TELEMETRY_WORKER_TOKEN is required to drain the outbox.");
  process.exit(1);
}

async function tick() {
  try {
    const response = await fetch(`${base}/api/telemetry/flush`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) {
      console.error(`[telemetry] ${body?.error ?? `HTTP ${response.status}`}`);
      return;
    }
    if (body.sent > 0) {
      console.log(
        `[telemetry] sent ${body.sent} · accepted ${body.accepted} · duplicates ${body.duplicates}`,
      );
    }
  } catch (error) {
    console.error(`[telemetry] ${error instanceof Error ? error.message : error}`);
  }
}

console.log(`[telemetry] draining ${base} every ${interval}ms`);
await tick();
setInterval(tick, interval);
