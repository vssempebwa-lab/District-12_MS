import { NextResponse } from "next/server";
import {
  claimsToUser,
  createSessionToken,
  landingFor,
  sessionCookie,
  sessionFromRequest,
  tenantCallbackUrl,
} from "@d12/auth";
import { configuredTenantAppUrl, passwordChangeSchema } from "@d12/contracts";
import { AccountError, changeTemporaryPassword } from "@/lib/accounts";
import { jsonError, zodDetails } from "@/lib/http";

export async function POST(request: Request): Promise<NextResponse> {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("UNAUTHORIZED", "Sign in again to choose a password", 401);
  if (!session.mustChangePassword) {
    return jsonError("CONFLICT", "This sign-in already has a password you chose", 409);
  }

  const parsed = passwordChangeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("VALIDATION_FAILED", "Check the new password", 400, { issues: zodDetails(parsed.error) });
  }

  try {
    await changeTemporaryPassword(
      session.sub,
      session.email,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );
  } catch (error) {
    if (error instanceof AccountError) return jsonError(error.code, error.message, error.status);
    console.error("[d12] password change failed", error);
    return jsonError("INTERNAL", "The new password could not be saved", 500);
  }

  const user = claimsToUser({ ...session, mustChangePassword: false });
  const token = await createSessionToken(user);
  const landing = landingFor({ ...session, mustChangePassword: false });
  const redirectTo = landing.kind === "tenant" && configuredTenantAppUrl(landing.tenant)
    ? tenantCallbackUrl(token, landing.tenant, landing.path)
    : landing.kind === "hub" ? landing.path : "/dashboard";

  return NextResponse.json(
    { ok: true, redirect: redirectTo },
    { headers: { "set-cookie": sessionCookie(token) } },
  );
}
