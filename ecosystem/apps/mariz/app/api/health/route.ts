import { NextResponse } from "next/server";
import { isDemoMode } from "@d12/auth";
import { hasServiceRoleEnv } from "@d12/db";
import { TENANT } from "@/lib/tenant";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    app: TENANT.id,
    name: TENANT.shortName,
    mode: isDemoMode() ? "demo" : "live",
    version: "1.0.0",
    supabase: hasServiceRoleEnv() ? "configured" : "demo-store",
  });
}
