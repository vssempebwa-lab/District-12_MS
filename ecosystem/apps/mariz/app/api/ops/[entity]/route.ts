import { handleCreate, handleList } from "@d12/tenant-workspace/server";
import { sessionFromRequest } from "@d12/auth";
import type { CustomerRecord } from "@d12/contracts";
import { TENANT_ID } from "@/lib/tenant";
import { recordCustomerPayment } from "@/lib/customer-sales";

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
  if (params.entity !== "customers") {
    return handleCreate(request, TENANT_ID, params.entity);
  }

  const body = (await request.clone().json().catch(() => null)) as
    | { status?: string }
    | null;

  const response = await handleCreate(request, TENANT_ID, params.entity);
  if (response.ok && body?.status === "paid") {
    const payload = (await response
      .clone()
      .json()
      .catch(() => null)) as { record?: CustomerRecord } | null;
    if (payload?.record) {
      try {
        const session = await sessionFromRequest(request);
        await recordCustomerPayment(payload.record, session ? { name: session.name, email: session.email } : undefined);
      } catch (error) {
        console.error("[mariz] paid customer did not reach sales", error);
      }
    }
  }
  return response;
}
