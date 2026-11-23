import { marizServiceLabel, type CustomerRecord, type SaleRecord } from "@d12/contracts";
import { createEntity, listEntity, updateEntity } from "@d12/tenant-workspace/server";
import { TENANT_ID } from "./tenant";

export interface RecordedBy {
  name?: string;
  email?: string;
}

function agreedCustomerValue(customer: CustomerRecord): number {
  const services = customer.services ?? [];
  const agreed = services.reduce((sum, line) => sum + Number(line.amount ?? 0), 0);
  const base = agreed > 0 ? agreed : Number(customer.lifetimeValue ?? 0);
  // Round to 2 decimals to avoid floating-point drift in payment math.
  return Math.round(base * 100) / 100;
}

async function paidCustomerTotal(customerId: string): Promise<number> {
  const sales = (await listEntity(TENANT_ID, "sales")) as SaleRecord[];
  const total = sales
    .filter((sale) => sale.customerId === customerId && sale.status === "paid")
    .reduce((sum, sale) => sum + Number(sale.amount ?? 0), 0);
  return Math.round(total * 100) / 100;
}

async function installmentCount(customerId: string): Promise<number> {
  const sales = (await listEntity(TENANT_ID, "sales")) as SaleRecord[];
  return sales.filter((sale) => sale.customerId === customerId && sale.status === "paid").length;
}

async function createPaymentSale(
  customer: CustomerRecord,
  amount: number,
  occurredOn: string,
  partial: boolean,
  recordedBy?: RecordedBy,
  paidBefore?: number,
): Promise<SaleRecord> {
  const labels = (customer.services ?? []).map((line) => marizServiceLabel(line.service));
  const clinic = String((customer as Record<string, unknown>).clinic ?? "").trim();
  const cohort = String((customer as Record<string, unknown>).cohort ?? "").trim();
  const parts = [
    clinic ? `Clinic: ${clinic}` : "",
    cohort ? `Cohort: ${cohort}` : "",
    labels.length ? labels.join(", ") : "",
  ].filter(Boolean);
  const basis = parts.length ? parts.join(" · ") : "Registration fee";
  const description = `${customer.name} — ${basis}${partial ? " (partial payment)" : ""}`;

  const agreed = agreedCustomerValue(customer);
  const paidAfter = Math.round(((paidBefore ?? 0) + amount) * 100) / 100;
  const balanceAfter = Math.max(Math.round((agreed - paidAfter) * 100) / 100, 0);
  const no = (await installmentCount(customer.id)) + 1;

  return (await createEntity(TENANT_ID, "sales", {
    occurredOn,
    description: description.slice(0, 160),
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone ?? "",
    customerEmail: customer.email ?? "",
    amount,
    status: "paid",
    channel: "Direct",
    owner: customer.owner ?? "",
    paymentType: partial ? "partial" : "full",
    collectedBy: recordedBy?.name ?? "",
    collectedByEmail: recordedBy?.email ?? "",
    agreedValue: agreed,
    balanceAfter,
    installmentNo: no,
  })) as SaleRecord;
}

/** Bills the remaining balance when a customer is marked paid, so earlier installments are not double-counted. */
export async function recordCustomerPayment(
  customer: CustomerRecord,
  recordedBy?: RecordedBy,
): Promise<void> {
  const agreed = agreedCustomerValue(customer);
  if (agreed <= 0) return;
  const paid = await paidCustomerTotal(customer.id);
  const remainder = Math.round((agreed - paid) * 100) / 100;
  if (remainder <= 0) return;

  const paidOn = customer.issueOn || new Date().toISOString().slice(0, 10);
  await createPaymentSale(
    customer,
    remainder,
    paidOn,
    false,
    recordedBy,
    paid,
  );
  await updateEntity(TENANT_ID, "customers", customer.id, {
    paidTotal: agreed,
    lastPaymentOn: paidOn,
    lastPaymentBy: recordedBy?.name ?? customer.owner ?? "",
    lastPaymentByEmail: recordedBy?.email ?? "",
    status: "paid",
  });
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
  recordedBy?: RecordedBy,
): Promise<InstallmentResult> {
  const agreed = agreedCustomerValue(customer);
  if (agreed <= 0) {
    throw new Error("This customer has no agreed value to pay against.");
  }
  const paid = await paidCustomerTotal(customer.id);
  const remainder = Math.round((agreed - paid) * 100) / 100;
  if (remainder <= 0) {
    throw new Error("This customer is already fully paid.");
  }

  // A partial payment must not exceed the outstanding balance.
  const requested = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new Error("Enter a payment amount above zero.");
  }
  const saleAmount = Math.min(requested, remainder);
  const settled = paid + saleAmount >= agreed - 0.005;
  const sale = await createPaymentSale(
    customer,
    saleAmount,
    paidOn,
    !settled,
    recordedBy,
    paid,
  );
  const newPaidTotal = Math.round((paid + saleAmount) * 100) / 100;
  await updateEntity(TENANT_ID, "customers", customer.id, {
    paidTotal: newPaidTotal,
    lastPaymentOn: paidOn,
    lastPaymentBy: recordedBy?.name ?? customer.owner ?? "",
    lastPaymentByEmail: recordedBy?.email ?? "",
    ...(settled && customer.status !== "paid" ? { status: "paid" } : {}),
  });
  return { sale, settled };
}