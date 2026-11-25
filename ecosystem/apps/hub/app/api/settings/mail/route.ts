import { NextResponse } from "next/server";
import { guardGlobalPermission } from "@d12/auth";
import { mailSettingsSchema } from "@d12/contracts";
import { jsonError, jsonOk, zodDetails } from "@/lib/http";
import { readMailSettingsView, saveMailSettings, sendTestEmail } from "@/lib/mail";

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await guardGlobalPermission(request, "group.settings");
  if (!guard.ok) {
    return jsonError(guard.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", guard.message, guard.status);
  }
  try {
    return jsonOk({ settings: await readMailSettingsView() });
  } catch (error) {
    console.error("[d12] mail settings read failed", error);
    return jsonError("UPSTREAM_FAILED", "Mail settings are unavailable. Apply the mail migration and reload.", 503);
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  const guard = await guardGlobalPermission(request, "group.settings");
  if (!guard.ok) {
    return jsonError(guard.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", guard.message, guard.status);
  }
  const parsed = mailSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("VALIDATION_FAILED", "Check the mail settings", 400, { issues: zodDetails(parsed.error) });
  }
  try {
    const settings = await saveMailSettings(parsed.data);
    return jsonOk({ settings });
  } catch (error) {
    console.error("[d12] mail settings save failed", error);
    return jsonError("UPSTREAM_FAILED", "Mail settings could not be saved. Apply the mail migration and reload.", 503);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await guardGlobalPermission(request, "group.settings");
  if (!guard.ok) {
    return jsonError(guard.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", guard.message, guard.status);
  }
  try {
    const result = await sendTestEmail("vssempebwa@gmail.com");
    return jsonOk({ mail: result }, { status: result.sent ? 200 : 502 });
  } catch (error) {
    console.error("[d12] test email failed", error);
    return jsonError("UPSTREAM_FAILED", "The test email could not be sent. Apply the mail migration and check SMTP.", 503);
  }
}
