import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import {
  TwoFactorError,
  clearPendingCookie,
  readPendingSignIn,
  resendTwoFactor,
  twoFactorErrorResponse,
} from "@/lib/two-factor";

export async function POST(request: Request): Promise<NextResponse> {
  const pending = await readPendingSignIn(request);
  if (!pending) {
    const response = jsonError("UNAUTHORIZED", "This sign-in has expired. Sign in again.", 401, { restart: true });
    response.headers.append("set-cookie", clearPendingCookie());
    return response;
  }
  try {
    return await resendTwoFactor(pending);
  } catch (error) {
    if (error instanceof TwoFactorError) return twoFactorErrorResponse(error);
    console.error("[d12] two-factor resend failed", error);
    return jsonError("INTERNAL", "A new code could not be sent right now", 500);
  }
}
