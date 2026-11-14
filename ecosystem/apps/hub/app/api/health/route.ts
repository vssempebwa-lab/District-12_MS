import { NextResponse } from "next/server";
import { isDemoMode } from "@d12/auth";
import { hasServiceRoleEnv } from "@d12/db";
import { jsonOk } from "@/lib/http";

export async function GET(): Promise<NextResponse> {
  return jsonOk({
    app: "hub",
    mode: isDemoMode() ? "demo" : "live",
    version: "1.0.0",
    supabase: hasServiceRoleEnv() ? "configured" : "demo-store",
  });
}
