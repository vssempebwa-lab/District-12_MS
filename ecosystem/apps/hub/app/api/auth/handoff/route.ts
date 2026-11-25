import { NextResponse } from "next/server";
import {
  claimsToUser,
  createSessionToken,
  canAccessTenant,
  safeLocalPath,
  sessionFromRequest,
  tenantCallbackUrl,
} from "@d12/auth";
import { configuredTenantAppUrl, hubAppUrl, isTenantId } from "@d12/contracts";
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
    const loginUrl = new URL("/login", hubAppUrl());
    loginUrl.searchParams.set("next", `${url.pathname}${url.search}`);
    return NextResponse.redirect(loginUrl);
  }
  if (session.mustChangePassword) {
    return NextResponse.redirect(new URL("/account/password", hubAppUrl()));
  }
  if (!canAccessTenant(session, tenant)) {
    return jsonError("FORBIDDEN", "You do not have access to this subsidiary", 403);
  }

  if (!configuredTenantAppUrl(tenant)) {
    return NextResponse.redirect(new URL("/dashboard", hubAppUrl()), 303);
  }

  const token = await createSessionToken(claimsToUser(session));
  return NextResponse.redirect(tenantCallbackUrl(token, tenant, next), 307);
}
