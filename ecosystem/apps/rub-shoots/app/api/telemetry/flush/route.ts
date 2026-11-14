import { handleFlush } from "@d12/tenant-workspace/server";
import { TENANT_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleFlush(request, TENANT_ID);
}
