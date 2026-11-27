import { NextResponse } from "next/server";
import { isDemoMode } from "@d12/auth";
import { loginSchema } from "@d12/contracts";
import { hasServiceRoleEnv, hasSupabaseEnv } from "@d12/db";
import { authenticateSupabase, demoSessionUser } from "@/lib/accounts";
import { jsonError, zodDetails } from "@/lib/http";
import { TwoFactorError, completeSignIn, startTwoFactor, twoFactorErrorResponse, twoFactorRequired } from "@/lib/two-factor";

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_FAILED", "Check the login details", 400, {
      issues: zodDetails(parsed.error),
    });
  }

  const { email, password, next } = parsed.data;

  try {
    const demo = isDemoMode();
    const supabaseReady = hasSupabaseEnv() && hasServiceRoleEnv();

    // Demo mode accepts the seeded directory. Everything else must pass
    // Supabase Auth and resolve to an active IAM account.
    let user = demo ? demoSessionUser(email, password) : null;
    const isDemoUser = user !== null;
    if (!user) {
      if (!supabaseReady) {
        if (!demo) {
          console.error("[d12] sign-in requires Supabase Auth and service-role credentials");
          return jsonError("INTERNAL", "Sign-in is unavailable right now", 500);
        }
      } else {
        user = await authenticateSupabase(email, password);
      }
    }

    if (!user) {
      return jsonError("UNAUTHORIZED", "Incorrect email or password", 401);
    }

    // Everyone confirms a code sent to their email before a session is issued.
    if (twoFactorRequired(isDemoUser)) return await startTwoFactor(user, next ?? "");
    return await completeSignIn(user, next ?? "");
  } catch (error) {
    if (error instanceof TwoFactorError) return twoFactorErrorResponse(error);
    console.error("[d12] login failed", error);
    return jsonError("INTERNAL", "Sign-in is unavailable right now", 500);
  }
}
