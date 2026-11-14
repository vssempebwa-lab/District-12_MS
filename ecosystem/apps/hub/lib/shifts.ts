import { createServiceClient, hasServiceRoleEnv, isFallbackError } from "@d12/db";
import type { SessionClaims } from "@d12/auth";
import {
  isTenantId,
  roleMeta,
  type ApiErrorCode,
  type ShiftDayView,
  type ShiftEndResult,
  type ShiftEndVia,
  type ShiftRecord,
  type ShiftSummary,
  type TenantId,
} from "@d12/contracts";
import { newId } from "@d12/telemetry";
import { getStore } from "./store";

const TABLE = "d12_shift_records";
const COLUMNS =
  "id, user_id, tenant_id, name, email, role, started_at, ended_at, minutes, ended_via, note";

export class ShiftError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ShiftError";
  }
}

interface ShiftRow {
  id: string;
  user_id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: string;
  started_at: string;
  ended_at: string;
  minutes: number;
  ended_via: string;
  note: string | null;
}

function rowToRecord(row: ShiftRow): ShiftRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tenantId: row.tenant_id as TenantId,
    name: row.name,
    email: row.email,
    role: row.role,
    roleLabel: roleMeta(row.role)?.label ?? row.role,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    minutes: row.minutes,
    endedVia: row.ended_via === "signout" ? "signout" : "shift",
    note: row.note ?? undefined,
  };
}

export function shiftDay(value: string | Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

interface ShiftRead {
  records: ShiftRecord[];
  mode: "demo" | "supabase";
}

async function readRecords(limit = 1000): Promise<ShiftRead> {
  if (hasServiceRoleEnv()) {
    try {
      const service = createServiceClient();
      const { data, error } = await service
        .from(TABLE)
        .select(COLUMNS)
        .order("ended_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return {
        records: ((data ?? []) as unknown as ShiftRow[]).map(rowToRecord),
        mode: "supabase",
      };
    } catch (error) {
      if (!isFallbackError(error)) throw error;
    }
  }
  return { records: (getStore().shifts ?? []).slice(0, limit), mode: "demo" };
}

function summarize(shifts: ShiftRecord[], tenants: TenantId[]): ShiftSummary[] {
  return tenants.map((tenantId) => {
    const rows = shifts.filter((shift) => shift.tenantId === tenantId);
    const seconds = rows.reduce((sum, shift) => sum + shift.minutes * 60, 0);
    return {
      tenantId,
      count: rows.length,
      minutes: rows.length ? Math.max(1, Math.round(seconds / 60)) : 0,
      people: new Set(rows.map((shift) => shift.userId)).size,
      lastEndedAt: rows[0]?.endedAt ?? null,
    };
  });
}

export interface ShiftDay extends ShiftDayView {
  mode: "demo" | "supabase";
}

export async function getShiftDay(day: string, tenants: TenantId[]): Promise<ShiftDay> {
  const { records, mode } = await readRecords();
  const allowed = new Set(tenants);
  const shifts = records.filter(
    (record) => allowed.has(record.tenantId) && shiftDay(record.endedAt) === day,
  );
  const people = new Set(shifts.map((shift) => shift.userId));
  return {
    day,
    shifts,
    summary: summarize(shifts, tenants),
    totals: {
      count: shifts.length,
      minutes: shifts.reduce((sum, shift) => sum + shift.minutes, 0),
      people: people.size,
    },
    mode,
  };
}

export async function endShift(
  session: SessionClaims,
  tenantId: TenantId,
  via: ShiftEndVia,
  note?: string,
): Promise<ShiftEndResult> {
  if (!session.tenants.includes(tenantId)) {
    throw new ShiftError(403, "FORBIDDEN", "You do not have access to this subsidiary");
  }

  const now = new Date();
  const sessionStart = new Date(session.iat * 1000);
  const { records } = await readRecords(400);
  const last = records.find(
    (record) => record.userId === session.sub && record.tenantId === tenantId,
  );

  if (last && now.getTime() - new Date(last.endedAt).getTime() < 60_000) {
    return {
      shift: last,
      recorded: false,
      duplicate: true,
      minutes: last.minutes,
      message: "This shift was just recorded.",
    };
  }

  const startedAt =
    last && new Date(last.endedAt) > sessionStart ? new Date(last.endedAt) : sessionStart;
  const seconds = Math.round((now.getTime() - startedAt.getTime()) / 1000);
  if (seconds < 60) {
    return {
      shift: null,
      recorded: false,
      duplicate: false,
      minutes: 0,
      message: "Less than a minute on shift — nothing to record yet.",
    };
  }

  const minutes = Math.round(seconds / 60);
  const record: ShiftRecord = {
    id: newId("sft"),
    userId: session.sub,
    tenantId,
    name: session.name,
    email: session.email,
    role: session.roles[0] ?? "employee",
    roleLabel: roleMeta(session.roles[0] ?? "")?.label ?? "Team member",
    startedAt: startedAt.toISOString(),
    endedAt: now.toISOString(),
    minutes,
    endedVia: via,
    note: note?.trim() || undefined,
  };

  let stored = false;
  if (hasServiceRoleEnv()) {
    try {
      const service = createServiceClient();
      const { error } = await service.from(TABLE).insert({
        id: record.id,
        user_id: record.userId,
        tenant_id: record.tenantId,
        name: record.name,
        email: record.email,
        role: record.role,
        started_at: record.startedAt,
        ended_at: record.endedAt,
        minutes: record.minutes,
        ended_via: record.endedVia,
        note: record.note ?? null,
      });
      if (error) throw error;
      stored = true;
    } catch (error) {
      if (!isFallbackError(error)) throw error;
    }
  }

  if (!stored) {
    const store = getStore();
    store.shifts = store.shifts ?? [];
    store.shifts.unshift(record);
    if (store.shifts.length > 2000) store.shifts.length = 2000;
  }

  return { shift: record, recorded: true, duplicate: false, minutes };
}

export function resolveShiftTenant(session: SessionClaims, requested?: string): TenantId {
  const tenant = requested ?? session.homeTenant ?? session.tenants[0];
  if (!tenant || !isTenantId(tenant) || !session.tenants.includes(tenant)) {
    throw new ShiftError(403, "FORBIDDEN", "Choose a subsidiary you belong to");
  }
  return tenant;
}
