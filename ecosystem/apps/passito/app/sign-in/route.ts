import { NextResponse } from "next/server";
import { safeLocalPath } from "@d12/auth";
import { hubAppUrl, tenantAppUrl } from "@d12/contracts";
import { TENANT_ID } from "@/lib/tenant";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const path = safeLocalPath(url.searchParams.get("next"), "/");
  const next = new URL(path, tenantAppUrl(TENANT_ID)).toString();
  const login = new URL("/login", hubAppUrl());
  login.searchParams.set("next", next);
  return NextResponse.redirect(login, 303);
}
