import { notFound } from "next/navigation";
import { hasPermission } from "@d12/auth";
import { isOpsEntity } from "@d12/contracts";
import { ENTITY_CONFIG, OpsBoard, type EntityRow } from "@d12/tenant-workspace";
import { listEntity, personalWorkName, requireTenantPage } from "@d12/tenant-workspace/server";
import { TENANT_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { entity: string } }) {
  if (!isOpsEntity(params.entity)) return { title: "Not found — Passito" };
  return { title: `${ENTITY_CONFIG[params.entity].plural} — Passito` };
}

export default async function EntityPage({ params }: { params: { entity: string } }) {
  if (!isOpsEntity(params.entity)) notFound();

  const session = await requireTenantPage(TENANT_ID, `/${params.entity}`);
  if (!hasPermission(session, `${params.entity}.read`, TENANT_ID)) notFound();
  const records = await listEntity(TENANT_ID, params.entity);
  const canWrite = hasPermission(session, `${params.entity}.write`, TENANT_ID);
  const canSync = hasPermission(session, "telemetry.write", TENANT_ID);

  return (
    <OpsBoard
      entity={params.entity}
      records={records as unknown as EntityRow[]}
      canWrite={canWrite}
      canSync={canSync}
      personalName={personalWorkName(session) ?? undefined}
    />
  );
}
