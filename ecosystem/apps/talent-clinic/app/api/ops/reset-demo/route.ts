import type { OpsDraft } from "@d12/contracts";
import {
  createEntity,
  deleteEntity,
  demoReset,
  listEntity,
  seedRecords,
} from "@d12/tenant-workspace/server";
import { TENANT_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";

function toDraft(record: Record<string, unknown>): OpsDraft {
  const { id: _id, tenantId: _tenantId, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = record;
  return draft as OpsDraft;
}

export async function POST() {
  // Clear both the live data source and the in-memory demo store.
  for (const entity of ["customers", "projects"] as const) {
    const existing = await listEntity(TENANT_ID, entity);
    for (const record of existing) await deleteEntity(TENANT_ID, entity, record.id);
  }
  demoReset(TENANT_ID);

  const seed = seedRecords(TENANT_ID);
  for (const cohort of seed.projects) {
    await createEntity(TENANT_ID, "projects", toDraft(cohort as unknown as Record<string, unknown>));
  }
  for (const participant of seed.customers) {
    await createEntity(TENANT_ID, "customers", toDraft(participant as unknown as Record<string, unknown>));
  }

  return Response.json({ ok: true, cohorts: seed.projects.length, participants: seed.customers.length });
}
