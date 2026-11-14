import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, canAccessTenant, readSessionToken } from "@d12/auth";
import { hubAppUrl } from "@d12/contracts";
import { TENANT_ID } from "@/lib/tenant";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await readSessionToken(token) : null;

  if (!session || !canAccessTenant(session, TENANT_ID)) {
    const login = new URL("/login", hubAppUrl());
    login.searchParams.set("next", request.nextUrl.href);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|auth|sign-in|favicon.ico).*)"],
};
