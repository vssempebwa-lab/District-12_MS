import { z } from "zod";
import type { TenantId } from "./tenants";

export const shiftEndViaSchema = z.enum(["shift", "signout"]);
export type ShiftEndVia = z.infer<typeof shiftEndViaSchema>;

export const shiftEndSchema = z
  .object({
    tenantId: z.string().trim().max(60).optional(),
    via: shiftEndViaSchema.default("shift"),
    note: z.string().trim().max(200).optional(),
  })
  .strict();

export interface ShiftRecord {
  id: string;
  userId: string;
  tenantId: TenantId;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  startedAt: string;
  endedAt: string;
  minutes: number;
  endedVia: ShiftEndVia;
  note?: string;
}

export interface ShiftSummary {
  tenantId: TenantId;
  count: number;
  minutes: number;
  people: number;
  lastEndedAt: string | null;
}

export interface ShiftEndResult {
  shift: ShiftRecord | null;
  recorded: boolean;
  duplicate: boolean;
  minutes: number;
  message?: string;
}

export interface ShiftDayView {
  day: string;
  shifts: ShiftRecord[];
  summary: ShiftSummary[];
  totals: { count: number; minutes: number; people: number };
}
