import { NextResponse } from "next/server";
import { guardGlobalPermission } from "@d12/auth";
import { AccountError, issueTemporaryPassword } from "@/lib/accounts";
import { jsonError, jsonOk } from "@/lib/http";

interface RouteContext {
  params: { id: string };
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const guard = await guardGlobalPermission(request, "hr.provision");
  if (!guard.ok) {
    return jsonError(guard.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", guard.message, guard.status);
  }
  try {
    const result = await issueTemporaryPassword(context.params.id, guard.session.sub);
    return jsonOk(result);
  } catch (error) {
    if (error instanceof AccountError) return jsonError(error.code, error.message, error.status);
    console.error("[d12] temporary password failed", error);
    return jsonError("INTERNAL", "Could not send a temporary password", 500);
  }
}
