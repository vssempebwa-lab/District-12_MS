import { NextResponse } from "next/server";
import {
  apiError,
  hubAppUrl,
  isCrossOriginRequest,
  shiftEndViaSchema,
  type ApiErrorCode,
  type TenantId,
} from "@d12/contracts";
import { canAccessTenant, sessionFromRequest } from "@d12/auth";

function failure(code: ApiErrorCode, message: string, status: number): NextResponse {
  return NextResponse.json(apiError(code, message), { status });
}

export async function handleShiftEnd(request: Request, tenantId: TenantId): Promise<NextResponse> {
  if (isCrossOriginRequest(request)) {
    return failure("FORBIDDEN", "Cross-origin shift updates are not allowed", 403);
  }

  const session = await sessionFromRequest(request);
  if (!session) return failure("UNAUTHORIZED", "Sign in to end your shift", 401);
  if (!canAccessTenant(session, tenantId)) {
    return failure("FORBIDDEN", "You do not have access to this subsidiary", 403);
  }

  let via: "shift" | "signout" = "shift";
  let note: string | undefined;
  const raw = await request.text();
  if (raw) {
    try {
      const body = JSON.parse(raw) as { via?: unknown; note?: unknown };
      const parsed = shiftEndViaSchema.safeParse(body.via ?? "shift");
      via = parsed.success ? parsed.data : "shift";
      if (typeof body.note === "string") note = body.note.slice(0, 200);
    } catch {
      return failure("VALIDATION_FAILED", "Invalid shift request", 400);
    }
  }

  try {
    const response = await fetch(`${hubAppUrl()}/api/shifts/end`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({ tenantId, via, note }),
      cache: "no-store",
    });
    const payload =
      (await response.json().catch(() => null)) ??
      apiError("UPSTREAM_FAILED", "The group hub returned an unreadable response");
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return failure("UPSTREAM_FAILED", "The group hub is unreachable. Try again in a moment.", 502);
  }
}
