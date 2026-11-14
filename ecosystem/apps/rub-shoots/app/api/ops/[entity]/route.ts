import { handleCreate, handleList } from "@d12/tenant-workspace/server";
import { TENANT_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { entity: string } },
) {
  return handleList(request, TENANT_ID, params.entity);
}

export async function POST(
  request: Request,
  { params }: { params: { entity: string } },
) {
  return handleCreate(request, TENANT_ID, params.entity);
}
