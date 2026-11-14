import { NextResponse } from "next/server";
import { canAccessTenant, sessionFromRequest, sessionToView } from "@d12/auth";
import { apiError } from "@d12/contracts";
import { TENANT_ID } from "@/lib/tenant";

export async function GET(request: Request): Promise<NextResponse> {
  const session = await sessionFromRequest(request);
  if (!session) {
    return NextResponse.json(apiError("UNAUTHORIZED", "No active session"), { status: 401 });
  }
  if (!canAccessTenant(session, TENANT_ID)) {
    return NextResponse.json(
      apiError("FORBIDDEN", "You do not have access to this subsidiary"),
      { status: 403 },
    );
  }
  return NextResponse.json(sessionToView(session));
}
