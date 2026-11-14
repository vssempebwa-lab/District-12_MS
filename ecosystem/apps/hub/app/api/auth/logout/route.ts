import { NextResponse } from "next/server";
import { clearSessionCookie } from "@d12/auth";

export async function POST(): Promise<NextResponse> {
  return NextResponse.json({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } });
}
