import { NextResponse } from "next/server";
import {
  canAccessTenant,
  readSessionToken,
  safeLocalPath,
  sessionCookie,
} from "@d12/auth";
import { apiError, hubAppUrl } from "@d12/contracts";
import { TENANT, TENANT_ID } from "@/lib/tenant";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const next = safeLocalPath(url.searchParams.get("next"), "/");

  if (!token) {
    const login = new URL("/login", hubAppUrl());
    return NextResponse.redirect(login, 303);
  }

  const claims = await readSessionToken(token);
  if (!claims || !canAccessTenant(claims, TENANT_ID)) {
    return NextResponse.json(
      apiError("UNAUTHORIZED", `This session cannot open ${TENANT.shortName}`),
      { status: 401 },
    );
  }

  const response = new NextResponse(null, { status: 303, headers: { location: next } });
  response.headers.append("set-cookie", sessionCookie(token));
  return response;
}
