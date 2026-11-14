import { NextResponse } from "next/server";
import { sessionFromRequest, sessionToView } from "@d12/auth";
import { jsonError } from "@/lib/http";

export async function GET(request: Request): Promise<NextResponse> {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("UNAUTHORIZED", "No active session", 401);
  return NextResponse.json(sessionToView(session));
}
