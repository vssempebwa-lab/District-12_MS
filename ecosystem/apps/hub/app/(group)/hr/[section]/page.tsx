import { notFound } from "next/navigation";
import type { HubKind } from "@d12/contracts";
import { WorkflowSection } from "@/components/workflow-section";
import { HrReportsPage } from "@/components/hr-reports";

export const dynamic = "force-dynamic";
const sections: Record<string, HubKind[]> = {
  team: ["employees"], attendance: ["attendance"], leave: ["leave"], payroll: ["payroll"],
  performance: ["performance"], recruitment: ["vacancies", "applications"],
  training: ["training", "enrolments"], settings: ["hr_settings"],
};
export default async function HrSectionPage({ params, searchParams }: { params: { section: string }; searchParams: { month?: string; tenant?: string } }) {
  if (params.section === "reports") return <HrReportsPage searchParams={searchParams} />;
  const kinds = sections[params.section];
  if (!kinds) notFound();
  return <WorkflowSection kinds={kinds} />;
}
