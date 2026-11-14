import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  audienceForRole,
  receivableAudiences,
  reportInputSchema,
  type TenantId,
  type TenantReport,
} from "@d12/contracts";
import { guardPermission, sessionFromRequest } from "@d12/auth";
import { jsonError, jsonOk } from "./handlers";
import {
  ACCENTS,
  acknowledgeTenantReport,
  audienceLabel,
  buildReportMetrics,
  getUserProfile,
  highestTenantRole,
  insertTenantReport,
  listTenantReports,
  newReportId,
  saveUserProfile,
  type WorkspaceProfile,
} from "./desk-data";

const ackSchema = z.object({ id: z.string().trim().min(1).max(80) });

const profileSchema = z.object({
  displayName: z.string().trim().max(80).default(""),
  title: z.string().trim().max(80).default(""),
  phone: z.string().trim().max(40).default(""),
  bio: z.string().trim().max(400).default(""),
});

const settingsSchema = z.object({
  accent: z.string().trim().max(20).default(""),
  density: z.enum(["compact", "comfortable"]).default("comfortable"),
  notifyReports: z.boolean().default(true),
  notifyShifts: z.boolean().default(true),
  notifyWeekly: z.boolean().default(true),
});

function validation(error: ZodError): NextResponse {
  return jsonError("VALIDATION_FAILED", "Check the details and try again", 400, {
    issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  });
}

async function createReport(
  request: Request,
  tenantId: TenantId,
): Promise<NextResponse> {
  const guard = await guardPermission(request, "reports.submit", tenantId);
  if (!guard.ok) return jsonError(guard.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", guard.message, guard.status);

  const body = await request.json().catch(() => null);
  const parsed = reportInputSchema.safeParse(body);
  if (!parsed.success) return validation(parsed.error);
  const draft = parsed.data;

  const role = highestTenantRole(guard.session.roles);
  const audience = audienceForRole(role);
  const metrics = await buildReportMetrics(tenantId, draft);
  const report: TenantReport = {
    id: newReportId(),
    tenantId,
    authorId: guard.session.sub,
    authorName: guard.session.name,
    authorRole: role,
    audience,
    kind: draft.kind,
    title: draft.title,
    summary: draft.summary,
    highlights: draft.highlights,
    risks: draft.risks,
    nextSteps: draft.nextSteps,
    periodStart: draft.periodStart,
    periodEnd: draft.periodEnd,
    metrics,
    status: "submitted",
    acknowledgedBy: null,
    acknowledgedAt: null,
    createdAt: new Date().toISOString(),
  };

  const stored = await insertTenantReport(report);
  if (!stored) {
    return jsonError("UPSTREAM_FAILED", "Report storage is unavailable right now", 503);
  }
  return jsonOk({ report, recipient: audienceLabel(audience) }, 201);
}

async function acknowledgeReport(
  request: Request,
  tenantId: TenantId,
): Promise<NextResponse> {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("UNAUTHORIZED", "Sign in to continue", 401);

  const body = await request.json().catch(() => null);
  const parsed = ackSchema.safeParse(body);
  if (!parsed.success) return validation(parsed.error);

  const role = highestTenantRole(session.roles);
  const allowed = session.permissions.includes("*") || receivableAudiences(role).length > 0;
  if (!allowed) return jsonError("FORBIDDEN", "Only report recipients can acknowledge reports", 403);

  const report = (await listTenantReports(tenantId)).find((entry) => entry.id === parsed.data.id);
  if (!report) return jsonError("NOT_FOUND", "That report no longer exists", 404);
  if (!session.permissions.includes("*") && !receivableAudiences(role).includes(report.audience)) {
    return jsonError("FORBIDDEN", "This report is addressed to another desk", 403);
  }

  const stored = await acknowledgeTenantReport(tenantId, report.id, session.name);
  if (!stored) return jsonError("UPSTREAM_FAILED", "Report storage is unavailable right now", 503);
  return jsonOk({ id: report.id, status: "acknowledged" });
}

async function saveProfile(
  request: Request,
  tenantId: TenantId,
  patch: Partial<WorkspaceProfile>,
): Promise<NextResponse> {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("UNAUTHORIZED", "Sign in to continue", 401);
  const current = await getUserProfile(session.sub);
  const next: WorkspaceProfile = { ...current, ...patch };
  const stored = await saveUserProfile(session.sub, tenantId, next);
  if (!stored) return jsonError("UPSTREAM_FAILED", "Profile storage is unavailable right now", 503);
  return jsonOk({ profile: next });
}

export async function handleDeskPost(
  request: Request,
  tenantId: TenantId,
  action: string,
): Promise<NextResponse> {
  switch (action) {
    case "reports":
      return createReport(request, tenantId);
    case "reports-ack":
      return acknowledgeReport(request, tenantId);
    case "profile": {
      const body = await request.json().catch(() => null);
      const parsed = profileSchema.safeParse(body);
      if (!parsed.success) return validation(parsed.error);
      return saveProfile(request, tenantId, parsed.data);
    }
    case "settings": {
      const body = await request.json().catch(() => null);
      const parsed = settingsSchema.safeParse(body);
      if (!parsed.success) return validation(parsed.error);
      const accent = ACCENTS.some((entry) => entry.value === parsed.data.accent) ? parsed.data.accent : "";
      return saveProfile(request, tenantId, { ...parsed.data, accent });
    }
    default:
      return jsonError("NOT_FOUND", "Unknown workspace action", 404);
  }
}
