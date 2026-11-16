import { handleDelete, handleUpdate, listEntity } from "@d12/tenant-workspace/server";
import type { CustomerRecord } from "@d12/contracts";
import { TENANT_ID } from "@/lib/tenant";
import { recordCustomerPayment } from "@/lib/customer-sales";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { entity: string; id: string } },
) {
  if (params.entity !== "customers") {
    return handleUpdate(request, TENANT_ID, params.entity, params.id);
  }

  const patch = (await request.clone().json().catch(() => null)) as
    | { status?: string }
    | null;

  let wasPaid = true;
  if (patch?.status === "paid") {
    const customers = (await listEntity(TENANT_ID, "customers")) as CustomerRecord[];
    wasPaid = customers.find((customer) => customer.id === params.id)?.status === "paid";
  }

  const response = await handleUpdate(request, TENANT_ID, params.entity, params.id);
  if (response.ok && patch?.status === "paid" && !wasPaid) {
    const payload = (await response
      .clone()
      .json()
      .catch(() => null)) as { record?: CustomerRecord } | null;
    if (payload?.record) {
      try {
        await recordCustomerPayment(payload.record);
      } catch (error) {
        console.error("[mariz] paid customer did not reach sales", error);
      }
    }
  }
  return response;
}

export async function DELETE(
  request: Request,
  { params }: { params: { entity: string; id: string } },
) {
  return handleDelete(request, TENANT_ID, params.entity, params.id);
}
