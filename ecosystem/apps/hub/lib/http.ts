import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { apiError, type ApiErrorCode } from "@d12/contracts";

export function jsonOk<T extends object>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, ...data }, init);
}

export function jsonError(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(apiError(code, message, details), { status });
}

export function zodDetails(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const candidate = (forwarded?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "").trim();
  return /^[0-9a-fA-F:.]{3,45}$/.test(candidate) ? candidate : null;
}
