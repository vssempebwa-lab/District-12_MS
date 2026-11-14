import { NextResponse } from "next/server";
import { hasPermission, sessionFromRequest, type SessionClaims } from "@d12/auth";
import { isGlobalRole, permissionsForRoles } from "@d12/contracts";
import { listAccounts } from "./accounts";
import { jsonError } from "./http";
import { HubRecordError } from "./records";

export async function currentWorkflowActor(request: Request, permission: string): Promise<SessionClaims | NextResponse> {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("UNAUTHORIZED", "Sign in to continue", 401);
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
      return jsonError("FORBIDDEN", "Cross-origin writes are not allowed", 403);
    }
  }
  const { accounts } = await listAccounts();
  const account = accounts.find((entry) => entry.id === session.sub);
  if (!account || account.status !== "active" || !isGlobalRole(account.role)) {
    return jsonError("FORBIDDEN", "An active group account is required", 403);
  }
  const actor: SessionClaims = { ...session, roles: [account.role], permissions: permissionsForRoles([account.role]), name: account.name, email: account.email, tenants: account.tenants, scope: "group" };
  if (!hasPermission(actor, permission)) return jsonError("FORBIDDEN", "You do not have access to this module", 403);
  return actor;
}

export async function workflowBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new HubRecordError(400, "VALIDATION_FAILED", "Send a JSON request");
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 65_536) throw new HubRecordError(413, "PAYLOAD_TOO_LARGE", "The record is too large");
  try { return JSON.parse(raw); } catch { throw new HubRecordError(400, "VALIDATION_FAILED", "Invalid JSON request"); }
}

export function workflowFailure(error: unknown): NextResponse {
  if (error instanceof HubRecordError) return jsonError(error.code, error.message, error.status);
  console.error("[d12] workflow request failed", error);
  return jsonError("INTERNAL", "Could not save or load the workflow. Check the server connection.", 500);
}
