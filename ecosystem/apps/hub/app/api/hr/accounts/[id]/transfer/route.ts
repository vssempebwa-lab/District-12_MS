import { NextResponse } from "next/server";
import { guardGlobalPermission } from "@d12/auth";
import { accountTransferSchema } from "@d12/contracts";
import { AccountError, transferAccount } from "@/lib/accounts";
import { jsonError, jsonOk, zodDetails } from "@/lib/http";

interface RouteContext {
  params: { id: string };
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const guard = await guardGlobalPermission(request, "hr.provision");
  if (!guard.ok) {
    return jsonError(guard.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", guard.message, guard.status);
  }

  const parsed = accountTransferSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("VALIDATION_FAILED", "Choose two different subsidiaries", 400, {
      issues: zodDetails(parsed.error),
    });
  }

  try {
    const account = await transferAccount(
      context.params.id,
      parsed.data.fromTenantId,
      parsed.data.toTenantId,
      guard.session.sub,
    );
    return jsonOk({ account });
  } catch (error) {
    if (error instanceof AccountError) {
      return jsonError(error.code, error.message, error.status);
    }
    console.error("[d12] transfer account failed", error);
    return jsonError("INTERNAL", "Could not transfer the account", 500);
  }
}
