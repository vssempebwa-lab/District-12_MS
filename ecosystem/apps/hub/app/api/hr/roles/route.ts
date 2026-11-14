import { NextResponse } from "next/server";
import { guardGlobalPermission } from "@d12/auth";
import { ROLES } from "@d12/contracts";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await guardGlobalPermission(request, "iam.read");
  if (!guard.ok) {
    return jsonError(guard.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", guard.message, guard.status);
  }
  return jsonOk({ roles: ROLES });
}
