import { NextResponse } from "next/server";
import { guardGlobalPermission } from "@d12/auth";
import { accountUpdateSchema } from "@d12/contracts";
import { AccountError, deleteAccount, findAccount, updateAccount } from "@/lib/accounts";
import { jsonError, jsonOk, zodDetails } from "@/lib/http";

interface RouteContext {
  params: { id: string };
}

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const guard = await guardGlobalPermission(request, "hr.provision");
  if (!guard.ok) {
    return jsonError(guard.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", guard.message, guard.status);
  }
  const account = await findAccount(context.params.id);
  if (!account) return jsonError("NOT_FOUND", "Account not found", 404);
  return jsonOk({ account });
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const guard = await guardGlobalPermission(request, "hr.provision");
  if (!guard.ok) {
    return jsonError(guard.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", guard.message, guard.status);
  }

  const parsed = accountUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("VALIDATION_FAILED", "Check the account details", 400, {
      issues: zodDetails(parsed.error),
    });
  }

  try {
    const account = await updateAccount(context.params.id, parsed.data, guard.session.sub);
    return jsonOk({ account });
  } catch (error) {
    if (error instanceof AccountError) {
      return jsonError(error.code, error.message, error.status);
    }
    console.error("[d12] update account failed", error);
    return jsonError("INTERNAL", "Could not update the account", 500);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  const guard = await guardGlobalPermission(request, "hr.provision");
  if (!guard.ok) {
    return jsonError(guard.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", guard.message, guard.status);
  }

  try {
    await deleteAccount(context.params.id, guard.session.sub);
    return jsonOk({});
  } catch (error) {
    if (error instanceof AccountError) {
      return jsonError(error.code, error.message, error.status);
    }
    console.error("[d12] delete account failed", error);
    return jsonError("INTERNAL", "Could not delete the account", 500);
  }
}
