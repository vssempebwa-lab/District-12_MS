import { guardPermission } from "@d12/auth";
import type { CustomerRecord } from "@d12/contracts";
import { jsonError, jsonOk, listEntity } from "@d12/tenant-workspace/server";
import { TENANT_ID } from "@/lib/tenant";
import { recordCustomerInstallment } from "@/lib/customer-sales";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const guard = await guardPermission(request, "customers.write", TENANT_ID);
  if (!guard.ok) {
    return jsonError(
      guard.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
      guard.message,
      guard.status,
    );
  }
  const recordedBy = { name: guard.session.name, email: guard.session.email };

  const body = (await request.json().catch(() => null)) as
    | { amount?: unknown; paidOn?: unknown }
    | null;
  const amount = Number(body?.amount);
  const paidOn = typeof body?.paidOn === "string" && body.paidOn ? body.paidOn : null;
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonError("VALIDATION_FAILED", "Enter a payment amount above zero.", 400);
  }
  if (!paidOn) {
    return jsonError("VALIDATION_FAILED", "Choose the date the payment was received.", 400);
  }

  const customers = (await listEntity(TENANT_ID, "customers")) as CustomerRecord[];
  const customer = customers.find((record) => record.id === params.id);
  if (!customer) return jsonError("NOT_FOUND", "That customer no longer exists.", 404);

  try {
    const result = await recordCustomerInstallment(customer, amount, paidOn, recordedBy);
    return jsonOk({ sale: result.sale, settled: result.settled, customer: result.customer }, 201);
  } catch (error) {
    return jsonError(
      "VALIDATION_FAILED",
      error instanceof Error ? error.message : "Could not record the payment.",
      400,
    );
  }
}
