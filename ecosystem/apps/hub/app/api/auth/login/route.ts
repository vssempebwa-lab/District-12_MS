import { NextResponse } from "next/server";
import {
  buildClaims,
  createSessionToken,
  isDemoMode,
  landingFor,
  safeLocalPath,
  sessionCookie,
  tenantCallbackUrl,
} from "@d12/auth";
import { loginSchema } from "@d12/contracts";
import { hasServiceRoleEnv } from "@d12/db";
import { authenticateSupabase, demoEmailExists, demoSessionUser } from "@/lib/accounts";
import { jsonError, zodDetails } from "@/lib/http";

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
    let user = isDemoMode() ? demoSessionUser(email, password) : null;
    if (!user && (!isDemoMode() || (!demoEmailExists(email) && hasServiceRoleEnv()))) {
      user = await authenticateSupabase(email, password);
    }

    if (!user) {
      return jsonError("UNAUTHORIZED", "Incorrect email or password", 401);
    }

    const claims = buildClaims(user);
    const token = await createSessionToken(user);
    const landing = landingFor(claims);
    const redirectTo =
      landing.kind === "tenant"
        ? tenantCallbackUrl(token, landing.tenant, landing.path)
        : safeLocalPath(next, landing.path);

    return NextResponse.json(
      {
        ok: true,
        redirect: redirectTo,
        user: { id: claims.sub, email: claims.email, name: claims.name },
        scope: claims.scope,
        tenants: claims.tenants,
      },
      { headers: { "set-cookie": sessionCookie(token) } },
    );
  } catch (error) {
    console.error("[d12] login failed", error);
    return jsonError("INTERNAL", "Sign-in is unavailable right now", 500);
  }
}
