import { NextResponse } from "next/server";
import { apiError } from "@d12/contracts";
import { guardGlobalPermission } from "@d12/auth";
import { acknowledgeGroupReport, canReviewAudience, getGroupReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await guardGlobalPermission(_request, "reports.read");
  if (!guard.ok) {
    return NextResponse.json(apiError(guard.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", guard.message), {
      status: guard.status,
    });
  }

  const report = await getGroupReport(params.id);
  if (!report) {
    return NextResponse.json(apiError("NOT_FOUND", "That report no longer exists"), { status: 404 });
  }
  if (!canReviewAudience(guard.session, report.audience)) {
    return NextResponse.json(apiError("FORBIDDEN", "This report belongs to another group desk"), { status: 403 });
  }

  const stored = await acknowledgeGroupReport(report.id, guard.session.name);
  if (!stored) {
    return NextResponse.json(apiError("UPSTREAM_FAILED", "Report storage is unavailable right now"), { status: 503 });
  }
  return NextResponse.json({ ok: true, id: report.id, status: "acknowledged" });
}
