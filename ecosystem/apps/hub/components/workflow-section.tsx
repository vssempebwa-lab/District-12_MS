import Link from "next/link";
import { hasPermission } from "@d12/auth";
import { HUB_MODULES, type HubKind } from "@d12/contracts";
import { Card } from "@d12/ui";
import { listAccounts } from "@/lib/accounts";
import { HubRecordError, listHubRecords } from "@/lib/records";
import { requirePermissionPage } from "@/lib/session-server";
import { WorkflowBoard } from "./workflow-board";

export async function WorkflowSection({ kinds }: { kinds: HubKind[] }) {
  const session = await requirePermissionPage(HUB_MODULES[kinds[0]].permission);
  const dependencies = new Set(kinds);
  for (const kind of kinds) {
    for (const field of HUB_MODULES[kind].fields) {
      if (field.reference && field.reference !== "accounts") dependencies.add(field.reference);
    }
    if (kind === "employees" || kind === "leave") dependencies.add("hr_settings");
  }
  for (const kind of dependencies) {
    if (!hasPermission(session, HUB_MODULES[kind].permission)) await requirePermissionPage(HUB_MODULES[kind].permission);
  }
  try {
    const [{ records, mode }, { accounts }] = await Promise.all([listHubRecords([...dependencies]), listAccounts()]);
    return <div className="space-y-6">{kinds.map((kind) => <WorkflowBoard key={kind} kind={kind} records={records} accounts={accounts} mode={mode} />)}</div>;
  } catch (error) {
    return <Card className="space-y-3 p-5"><h1 className="text-xl font-semibold text-navy">Workflow storage needs attention</h1><p className="text-sm text-ink-soft">{error instanceof HubRecordError ? error.message : "Unable to load records. Check the database connection and workflow migration."}</p><Link href={HUB_MODULES[kinds[0]].href} className="text-sm font-semibold text-royal">Retry</Link></Card>;
  }
}
