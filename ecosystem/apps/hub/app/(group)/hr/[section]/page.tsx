import { notFound } from "next/navigation";
import type { HubKind } from "@d12/contracts";
import { WorkflowSection } from "@/components/workflow-section";
import { HrReportsPage } from "@/components/hr-reports";
import { requirePermissionPage } from "@/lib/session-server";

export const dynamic = "force-dynamic";
const sections: Record<string, HubKind[]> = {
  team: ["employees"], attendance: ["attendance"], leave: ["leave"], payroll: ["payroll"],
  performance: ["performance"], recruitment: ["vacancies", "applications"],
  training: ["training", "enrolments"], settings: ["hr_settings"],
};
export default async function HrSectionPage({ params, searchParams }: { params: { section: string }; searchParams: { month?: string; tenant?: string } }) {
  // Mirrors middleware.ts so the page stays protected even if middleware is skipped.
  if (params.section === "reports") {
    await requirePermissionPage("hr.reports");
    return <HrReportsPage searchParams={searchParams} />;
  }
  const kinds = sections[params.section];
  if (!kinds) notFound();
  await requirePermissionPage(params.section === "payroll" ? "hr.payroll" : "hr.manage");
  return <WorkflowSection kinds={kinds} />;
}
