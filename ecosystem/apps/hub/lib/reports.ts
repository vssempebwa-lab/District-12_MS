import type { SessionClaims } from "@d12/auth";
import { hubAudiencesForRole, type TenantId, type TenantReport } from "@d12/contracts";
import { createServiceClient, hasServiceRoleEnv, isFallbackError } from "@d12/db";

interface ReportRow {
  id: string;
  tenant_id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  audience: TenantReport["audience"];
  kind: TenantReport["kind"];
  title: string;
  summary: string;
  highlights: string | null;
  risks: string | null;
  next_steps: string | null;
  period_start: string;
  period_end: string;
  metrics: Record<string, number> | null;
  status: "submitted" | "acknowledged";
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

function rowToReport(row: ReportRow): TenantReport {
  return {
    id: row.id,
    tenantId: row.tenant_id as TenantId,
    authorId: row.author_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    audience: row.audience,
    kind: row.kind,
    title: row.title,
    summary: row.summary ?? "",
    highlights: row.highlights ?? "",
    risks: row.risks ?? "",
    nextSteps: row.next_steps ?? "",
    periodStart: row.period_start,
    periodEnd: row.period_end,
    metrics: row.metrics ?? {},
    status: row.status,
    acknowledgedBy: row.acknowledged_by,
    acknowledgedAt: row.acknowledged_at,
    createdAt: row.created_at,
  };
}

export function canReviewAudience(session: SessionClaims, audience: TenantReport["audience"]): boolean {
  const allowed = hubAudiencesForRole(session.roles[0] ?? "");
  return allowed === "all" || allowed.includes(audience);
}

export async function listGroupReports(
  session: SessionClaims,
): Promise<{ reports: TenantReport[]; mode: "supabase" | "demo" }> {
  const audiences = hubAudiencesForRole(session.roles[0] ?? "");
  if (audiences !== "all" && audiences.length === 0) return { reports: [], mode: "supabase" };
  if (!hasServiceRoleEnv()) return { reports: [], mode: "demo" };

  try {
    const service = createServiceClient();
    let query = service
      .from("d12_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (audiences !== "all") query = query.in("audience", audiences);
    const { data, error } = await query;
    if (error) throw error;
    return { reports: ((data ?? []) as unknown as ReportRow[]).map(rowToReport), mode: "supabase" };
  } catch (error) {
    if (!isFallbackError(error)) throw error;
  }
  return { reports: [], mode: "demo" };
}

export async function acknowledgeGroupReport(id: string, actor: string): Promise<boolean> {
  if (!hasServiceRoleEnv()) return false;
  const service = createServiceClient();
  const { data, error } = await service
    .from("d12_reports")
    .update({ status: "acknowledged", acknowledged_by: actor, acknowledged_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function getGroupReport(id: string): Promise<TenantReport | null> {
  if (!hasServiceRoleEnv()) return null;
  const service = createServiceClient();
  const { data, error } = await service.from("d12_reports").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? rowToReport(data as unknown as ReportRow) : null;
}
