import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, hasPermission, landingFor, readSessionToken } from "@d12/auth";
import { permissionsForRoles } from "@d12/contracts";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await readSessionToken(token) : null;

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const pathname = request.nextUrl.pathname;
  const permission = pathname.startsWith("/hr/payroll") ? "hr.payroll"
    : pathname.startsWith("/hr/reports") ? "hr.reports"
    : pathname === "/hr" || pathname.startsWith("/hr/employees") ? "hr.provision"
    : pathname.startsWith("/hr/") ? "hr.manage"
    : pathname.startsWith("/finance") ? "finance.read"
    : pathname.startsWith("/warehouse") ? "warehouse.read"
    : pathname.startsWith("/team") ? "team.manage"
    : pathname.startsWith("/tasks") ? "group.tasks"
    : pathname.startsWith("/settings") ? "group.settings"
    : pathname.startsWith("/notifications") ? "notifications.read"
    : pathname.startsWith("/analytics") ? "reports.read" : "iam.read";

  if (session.scope !== "group" || !hasPermission({ ...session, permissions: permissionsForRoles(session.roles) }, permission)) {
    const landing = landingFor(session);
    return NextResponse.redirect(new URL(landing.kind === "hub" ? landing.path : "/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/warehouse/:path*", "/hr/:path*", "/finance/:path*", "/team/:path*", "/analytics/:path*", "/tasks/:path*", "/notifications/:path*", "/settings/:path*"],
};
