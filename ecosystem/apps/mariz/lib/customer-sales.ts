import { marizServiceLabel, type CustomerRecord, type SaleRecord } from "@d12/contracts";
import { createEntity, listEntity } from "@d12/tenant-workspace/server";
import { TENANT_ID } from "./tenant";

/** Marks a paid customer's agreed services as a sale, carrying the customer owner. */
export async function recordCustomerPayment(customer: CustomerRecord): Promise<void> {
  const services = customer.services ?? [];
  const agreed = services.reduce((sum, line) => sum + Number(line.amount ?? 0), 0);
  const amount = agreed > 0 ? agreed : Number(customer.lifetimeValue ?? 0);

  const sales = (await listEntity(TENANT_ID, "sales")) as SaleRecord[];
  const duplicate = sales.some(
    (sale) =>
      sale.customerId === customer.id &&
      sale.status === "paid" &&
      Number(sale.amount) === amount,
  );
  if (duplicate) return;

  const labels = services.map((line) => marizServiceLabel(line.service));
  const description = `${customer.name} — ${labels.length ? labels.join(", ") : "Customer payment"}`;

  await createEntity(TENANT_ID, "sales", {
    occurredOn: customer.issueOn || new Date().toISOString().slice(0, 10),
    description: description.slice(0, 160),
    customerId: customer.id,
    customerName: customer.name,
    amount,
    status: "paid",
    channel: "Direct",
    owner: customer.owner ?? "",
  });
}
