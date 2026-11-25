import { notFound } from "next/navigation";
import type { HubKind } from "@d12/contracts";
import { MailSettings } from "@/components/mail-settings";
import { WorkflowSection } from "@/components/workflow-section";
import { requirePermissionPage } from "@/lib/session-server";

export const dynamic = "force-dynamic";
const sections: Record<string, HubKind[]> = { team: ["employees"], tasks: ["tasks"], settings: ["group_settings"] };
// Mirrors middleware.ts so the page stays protected even if middleware is skipped.
const permissions: Record<string, string> = { team: "team.manage", tasks: "group.tasks", settings: "group.settings" };
export default async function GroupSectionPage({ params }: { params: { section: string } }) {
  const kinds = sections[params.section];
  if (!kinds) notFound();
  await requirePermissionPage(permissions[params.section]);
  if (params.section === "settings") {
    return (
      <div className="space-y-6">
        <MailSettings />
        <WorkflowSection kinds={kinds} />
      </div>
    );
  }
  return <WorkflowSection kinds={kinds} />;
}
