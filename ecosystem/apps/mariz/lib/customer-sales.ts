import { marizServiceLabel, type CustomerRecord, type SaleRecord } from "@d12/contracts";
import { createEntity, listEntity, updateEntity } from "@d12/tenant-workspace/server";
import { TENANT_ID } from "./tenant";

function agreedCustomerValue(customer: CustomerRecord): number {
  const services = customer.services ?? [];
  const agreed = services.reduce((sum, line) => sum + Number(line.amount ?? 0), 0);
  return agreed > 0 ? agreed : Number(customer.lifetimeValue ?? 0);
}

async function paidCustomerTotal(customerId: string): Promise<number> {
  const sales = (await listEntity(TENANT_ID, "sales")) as SaleRecord[];
  return sales
    .filter((sale) => sale.customerId === customerId && sale.status === "paid")
    .reduce((sum, sale) => sum + Number(sale.amount ?? 0), 0);
}

async function createPaymentSale(
  customer: CustomerRecord,
  amount: number,
  occurredOn: string,
  partial: boolean,
): Promise<SaleRecord> {
  const labels = (customer.services ?? []).map((line) => marizServiceLabel(line.service));
  const basis = labels.length ? labels.join(", ") : "Customer payment";
  const description = `${customer.name} — ${basis}${partial ? " (partial payment)" : ""}`;

  return (await createEntity(TENANT_ID, "sales", {
    occurredOn,
    description: description.slice(0, 160),
    customerId: customer.id,
    customerName: customer.name,
    amount,
    status: "paid",
    channel: "Direct",
    owner: customer.owner ?? "",
  })) as SaleRecord;
}

/** Bills the remaining balance when a customer is marked paid, so earlier installments are not double-counted. */
export async function recordCustomerPayment(customer: CustomerRecord): Promise<void> {
  const agreed = agreedCustomerValue(customer);
  if (agreed <= 0) return;
  const paid = await paidCustomerTotal(customer.id);
  const remainder = agreed - paid;
  if (remainder <= 0) return;

  await createPaymentSale(
    customer,
    remainder,
    customer.issueOn || new Date().toISOString().slice(0, 10),
    false,
  );
}

export interface InstallmentResult {
  sale: SaleRecord;
  settled: boolean;
}

/** Books a partial payment; once the agreed value is reached the customer is marked paid. */
export async function recordCustomerInstallment(
  customer: CustomerRecord,
  amount: number,
  paidOn: string,
): Promise<InstallmentResult> {
  const agreed = agreedCustomerValue(customer);
  if (agreed <= 0) {
    throw new Error("This customer has no agreed value to pay against.");
  }
  const paid = await paidCustomerTotal(customer.id);
  const remainder = agreed - paid;
  if (remainder <= 0) {
    throw new Error("This customer is already fully paid.");
  }

  const saleAmount = Math.min(amount, remainder);
  const settled = paid + saleAmount >= agreed;
  const sale = await createPaymentSale(customer, saleAmount, paidOn, !settled);
  if (settled && customer.status !== "paid") {
    await updateEntity(TENANT_ID, "customers", customer.id, { status: "paid" });
  }
  return { sale, settled };
}
