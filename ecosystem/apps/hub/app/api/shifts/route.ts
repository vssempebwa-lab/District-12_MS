import { NextResponse } from "next/server";
import { hasPermission, sessionFromRequest } from "@d12/auth";
import { hubDate, isTenantId, type TenantId } from "@d12/contracts";
import { jsonError } from "@/lib/http";
import { getShiftDay, shiftDay } from "@/lib/shifts";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("UNAUTHORIZED", "Sign in to view shifts", 401);
  if (!hasPermission(session, "shifts.read")) {
    return jsonError("FORBIDDEN", "You do not have access to shift records", 403);
  }

  const url = new URL(request.url);
  const requestedDay = url.searchParams.get("day") ?? "";
  const day = requestedDay ? hubDate.safeParse(requestedDay) : null;
  if (day && !day.success) {
    return jsonError("VALIDATION_FAILED", "Use a valid YYYY-MM-DD date", 400);
  }

  const tenantParam = url.searchParams.get("tenant");
  let tenants: TenantId[] = session.tenants;
  if (tenantParam) {
    if (!isTenantId(tenantParam) || !session.tenants.includes(tenantParam)) {
      return jsonError("FORBIDDEN", "You do not have access to that subsidiary", 403);
    }
    tenants = [tenantParam];
  }

  const view = await getShiftDay(day?.success ? day.data : shiftDay(), tenants);
  return NextResponse.json({ ok: true, ...view });
}
