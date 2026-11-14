import { NextResponse } from "next/server";
import { guardGlobalPermission } from "@d12/auth";
import { listAudit } from "@/lib/accounts";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await guardGlobalPermission(request, "hr.provision");
  if (!guard.ok) {
    return jsonError(guard.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", guard.message, guard.status);
  }
  return jsonOk({ audit: await listAudit(12) });
}
