import { NextResponse } from "next/server";
import { guardGlobalPermission } from "@d12/auth";
import { accountCreateSchema, isGlobalRole } from "@d12/contracts";
import { AccountError, createAccount, deleteAccount, listAccounts } from "@/lib/accounts";
import { jsonError, jsonOk, zodDetails } from "@/lib/http";
import { HubRecordError, createHubRecord } from "@/lib/records";

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await guardGlobalPermission(request, "hr.provision");
  if (!guard.ok) {
    return jsonError(guard.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", guard.message, guard.status);
  }
  const { accounts, mode } = await listAccounts();
  return jsonOk({ accounts, mode });
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await guardGlobalPermission(request, "hr.provision");
  if (!guard.ok) {
    return jsonError(guard.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", guard.message, guard.status);
  }

  const parsed = accountCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("VALIDATION_FAILED", "Check the account details", 400, {
      issues: zodDetails(parsed.error),
    });
  }

  try {
    const { account, mail } = await createAccount(parsed.data, guard.session.sub);
    try {
      await createHubRecord(
        "employees",
        {
          name: account.name,
          email: account.email,
          tenantId: isGlobalRole(account.role) ? "group" : account.tenants[0],
          accountId: account.id,
          startOn: account.createdAt,
          notes:
            "Created automatically with the sign-in account. Add the department, job title and employment dates.",
        },
        guard.session,
      );
    } catch (error) {
      await deleteAccount(account.id, guard.session.sub).catch((rollback) => {
        console.error("[d12] employment profile rollback failed", rollback);
      });
      throw error;
    }
    return jsonOk({ account, mail }, { status: 201 });
  } catch (error) {
    if (error instanceof AccountError) {
      return jsonError(error.code, error.message, error.status);
    }
    if (error instanceof HubRecordError) {
      return jsonError(error.code, error.message, error.status);
    }
    console.error("[d12] create account failed", error);
    return jsonError("INTERNAL", "Could not create the account", 500);
  }
}
