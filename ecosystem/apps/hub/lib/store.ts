import { DEMO_ACCOUNTS, type DemoAccount } from "@d12/auth";
import {
  TENANT_IDS,
  roleMeta,
  type AccountView,
  type ShiftRecord,
  type TelemetryEvent,
  type TenantId,
} from "@d12/contracts";
import { newId } from "@d12/telemetry";

export interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  target: string;
  tenantId: string | null;
  at: string;
  detail?: string;
}

export interface StoredBatch {
  id: string;
  tenantId: TenantId;
  receivedAt: string;
  eventCount: number;
  accepted: number;
  duplicates: number;
  signatureVerified: boolean;
}

export interface HubStore {
  accounts: AccountView[];
  passwordHashes: Record<string, string>;
  mustChangePassword: Record<string, true>;
  audit: AuditEntry[];
  batches: StoredBatch[];
  events: Partial<Record<TenantId, TelemetryEvent[]>>;
  shifts: ShiftRecord[];
  seededAt: string;
}

function demoAccountView(account: DemoAccount): AccountView {
  const role = account.roles[0] ?? "employee";
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role,
    roleLabel: roleMeta(role)?.label ?? role,
    tenants: account.tenants.length ? account.tenants : [...TENANT_IDS],
    status: "active",
    createdAt: "2026-11-05",
    lastActive: null,
  };
}

function createStore(): HubStore {
  const now = new Date().toISOString();
  return {
    accounts: DEMO_ACCOUNTS.map(demoAccountView),
    passwordHashes: {},
    mustChangePassword: {},
    audit: [
      {
        id: "aud_bootstrap",
        action: "workspace.bootstrap",
        actor: "system",
        target: "Demo directory loaded",
        tenantId: null,
        at: now,
        detail: "Seeded group, HR and subsidiary accounts. Seeded demo accounts accept any password; provisioned accounts use the password set when they were created.",
      },
    ],
    batches: [],
    events: {},
    shifts: [],
    seededAt: now,
  };
}

const globalStore = globalThis as typeof globalThis & { __d12HubStore?: HubStore };

export function getStore(): HubStore {
  if (!globalStore.__d12HubStore) globalStore.__d12HubStore = createStore();
  return globalStore.__d12HubStore;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function pushAudit(entry: Omit<AuditEntry, "id" | "at">): void {
  const store = getStore();
  store.audit.unshift({ ...entry, id: newId("aud"), at: new Date().toISOString() });
  if (store.audit.length > 200) store.audit.length = 200;
}

export interface DemoIngestOutcome {
  accepted: number;
  duplicates: number;
}

export function recordDemoBatch(
  batch: StoredBatch,
  events: TelemetryEvent[],
): DemoIngestOutcome {
  const store = getStore();
  const existing = store.events[batch.tenantId] ?? [];
  const seen = new Set(existing.map((event) => event.id));
  const fresh = events.filter((event) => !seen.has(event.id));

  store.events[batch.tenantId] = [...fresh, ...existing].slice(0, 4000);
  store.batches.unshift({ ...batch, accepted: fresh.length, duplicates: events.length - fresh.length });
  if (store.batches.length > 100) store.batches.length = 100;

  return { accepted: fresh.length, duplicates: events.length - fresh.length };
}

export function demoEventTotals(): { events: number; batchesToday: number } {
  const store = getStore();
  const totalEvents = Object.values(store.events).reduce(
    (sum, events) => sum + (events?.length ?? 0),
    0,
  );
  const today = todayIso();
  return {
    events: totalEvents,
    batchesToday: store.batches.filter((batch) => batch.receivedAt.slice(0, 10) === today).length,
  };
}
