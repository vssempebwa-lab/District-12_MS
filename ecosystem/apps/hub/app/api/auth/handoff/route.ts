import { NextResponse } from "next/server";
import {
  claimsToUser,
  createSessionToken,
  canAccessTenant,
  safeLocalPath,
  sessionFromRequest,
  tenantCallbackUrl,
} from "@d12/auth";
import { isTenantId } from "@d12/contracts";
import { jsonError } from "@/lib/http";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const tenant = url.searchParams.get("tenant") ?? "";
  const next = safeLocalPath(url.searchParams.get("next"), "/");

  if (!isTenantId(tenant)) {
    return jsonError("UNKNOWN_TENANT", "Unknown subsidiary", 404);
  }

  const session = await sessionFromRequest(request);
  if (!session) {
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("next", `${url.pathname}${url.search}`);
    return NextResponse.redirect(loginUrl);
  }
  if (!canAccessTenant(session, tenant)) {
    return jsonError("FORBIDDEN", "You do not have access to this subsidiary", 403);
  }

  const token = await createSessionToken(claimsToUser(session));
  return NextResponse.redirect(tenantCallbackUrl(token, tenant, next), 307);
}
