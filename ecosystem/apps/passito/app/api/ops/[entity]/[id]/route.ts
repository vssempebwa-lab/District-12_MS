import { handleDelete, handleUpdate } from "@d12/tenant-workspace/server";
import { TENANT_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { entity: string; id: string } },
) {
  return handleUpdate(request, TENANT_ID, params.entity, params.id);
}

export async function DELETE(
  request: Request,
  { params }: { params: { entity: string; id: string } },
) {
  return handleDelete(request, TENANT_ID, params.entity, params.id);
}
