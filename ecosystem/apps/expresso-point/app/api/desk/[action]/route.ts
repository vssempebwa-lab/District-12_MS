import { handleDeskPost } from "@d12/tenant-workspace/server";
import { TENANT_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { action: string } }) {
  return handleDeskPost(request, TENANT_ID, params.action);
}
