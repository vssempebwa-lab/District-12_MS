import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import {
  TwoFactorError,
  clearPendingCookie,
  completeSignIn,
  readPendingSignIn,
  twoFactorErrorResponse,
  verifyTwoFactor,
} from "@/lib/two-factor";

const verifySchema = z.object({
  code: z.string().trim().transform((value) => value.replace(/\s+/g, "")),
});

export async function POST(request: Request): Promise<NextResponse> {
  const pending = await readPendingSignIn(request);
  if (!pending) {
    const response = jsonError("UNAUTHORIZED", "This sign-in has expired. Sign in again.", 401, { restart: true });
    response.headers.append("set-cookie", clearPendingCookie());
    return response;
  }

  const parsed = verifySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !/^\d{6}$/.test(parsed.data.code)) {
    return jsonError("VALIDATION_FAILED", "Enter the 6-digit code from your email", 400);
  }

  try {
    const user = await verifyTwoFactor(pending, parsed.data.code);
    return await completeSignIn(user, pending.next);
  } catch (error) {
    if (error instanceof TwoFactorError) return twoFactorErrorResponse(error);
    console.error("[d12] two-factor verify failed", error);
    return jsonError("INTERNAL", "Sign-in is unavailable right now", 500);
  }
}
