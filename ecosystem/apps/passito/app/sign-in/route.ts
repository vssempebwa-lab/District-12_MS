import { NextResponse } from "next/server";
import { hubAppUrl } from "@d12/contracts";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const next = new URL(url.searchParams.get("next") ?? "/", url.origin).toString();
  const login = new URL("/login", hubAppUrl());
  login.searchParams.set("next", next);
  return NextResponse.redirect(login, 303);
}
