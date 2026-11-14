import type { ReactNode } from "react";
import { HubShell } from "@/components/hub-shell";
import { listHubRecords } from "@/lib/records";
import { primaryRoleLabel, requireGroupPage } from "@/lib/session-server";

export default async function GroupLayout({ children }: { children: ReactNode }) {
  const session = await requireGroupPage();
  let organizationName = "District 12";
  try {
    const { records } = await listHubRecords(["group_settings"]);
    organizationName = String(records[0]?.data.organizationName ?? organizationName);
  } catch { /* The shell must remain available to resolve workflow storage setup. */ }
  return <HubShell session={session} roleLabel={primaryRoleLabel(session)} organizationName={organizationName}>{children}</HubShell>;
}
