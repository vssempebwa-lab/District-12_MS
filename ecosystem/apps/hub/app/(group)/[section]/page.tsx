import { notFound } from "next/navigation";
import type { HubKind } from "@d12/contracts";
import { WorkflowSection } from "@/components/workflow-section";

export const dynamic = "force-dynamic";
const sections: Record<string, HubKind[]> = { team: ["employees"], tasks: ["tasks"], settings: ["group_settings"] };
export default async function GroupSectionPage({ params }: { params: { section: string } }) {
  const kinds = sections[params.section];
  if (!kinds) notFound();
  return <WorkflowSection kinds={kinds} />;
}
