import { NextResponse } from "next/server";
import { sessionFromRequest } from "@d12/auth";
import { TENANT_IDS, hubAppUrl, shiftEndSchema, tenantAppUrl } from "@d12/contracts";
import { jsonError } from "@/lib/http";
import { ShiftError, endShift, resolveShiftTenant } from "@/lib/shifts";

export const dynamic = "force-dynamic";

function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

const ALLOWED_ORIGINS = new Set(
  [hubAppUrl(), ...TENANT_IDS.map((tenant) => tenantAppUrl(tenant))].map(normalizeOrigin),
);

function originAllowed(origin: string | null): boolean {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (ALLOWED_ORIGINS.has(normalized)) return true;
  try {
    const url = new URL(normalized);
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return false;
    return ALLOWED_ORIGINS.has(`${url.protocol}//localhost:${url.port}`);
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!originAllowed(request.headers.get("origin"))) {
    return jsonError("FORBIDDEN", "Cross-origin shift updates are not allowed", 403);
  }

  const session = await sessionFromRequest(request);
  if (!session) return jsonError("UNAUTHORIZED", "Sign in to end your shift", 401);

  const body = await request.json().catch(() => null);
  const parsed = shiftEndSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return jsonError("VALIDATION_FAILED", "Check the shift details", 400);
  }

  try {
    const tenantId = resolveShiftTenant(session, parsed.data.tenantId);
    const result = await endShift(session, tenantId, parsed.data.via, parsed.data.note);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ShiftError) {
      return jsonError(error.code, error.message, error.status);
    }
    console.error("[d12] end shift failed", error);
    return jsonError("INTERNAL", "Could not record the shift end", 500);
  }
}
