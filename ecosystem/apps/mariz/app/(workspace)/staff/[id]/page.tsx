import { notFound } from "next/navigation";
import { hasPermission } from "@d12/auth";
import type { LeadRecord, ProjectRecord, StaffRecord, TaskRecord } from "@d12/contracts";
import { StaffDetail } from "@d12/tenant-workspace";
import { listEntity, requireTenantPage } from "@d12/tenant-workspace/server";
import { TENANT } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const SHORT_NAME = TENANT.shortName;

export function generateMetadata({ params }: { params: { id: string } }) {
  return { title: `Staff — ${SHORT_NAME}` };
}

export default async function StaffMemberPage({ params }: { params: { id: string } }) {
  const session = await requireTenantPage(TENANT.id, `/staff/${params.id}`);
  if (!hasPermission(session, "staff.read", TENANT.id)) notFound();

  const [staffRows, taskRows, leadRows, projectRows] = await Promise.all([
    listEntity(TENANT.id, "staff"),
    hasPermission(session, "tasks.read", TENANT.id)
      ? listEntity(TENANT.id, "tasks")
      : Promise.resolve([]),
    hasPermission(session, "leads.read", TENANT.id)
      ? listEntity(TENANT.id, "leads")
      : Promise.resolve([]),
    hasPermission(session, "projects.read", TENANT.id)
      ? listEntity(TENANT.id, "projects")
      : Promise.resolve([]),
  ]);

  const staff = (staffRows as StaffRecord[]).find((row) => row.id === params.id);
  if (!staff) notFound();

  const tasks = (taskRows as TaskRecord[]).filter((row) => row.assignee === staff.name);
  const leads = (leadRows as LeadRecord[]).filter((row) => row.owner === staff.name);
  const projects = (projectRows as ProjectRecord[]).filter((row) => row.owner === staff.name);

  return <StaffDetail staff={staff} tasks={tasks} leads={leads} projects={projects} />;
}
