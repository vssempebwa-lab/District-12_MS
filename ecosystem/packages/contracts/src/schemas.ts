import { z } from "zod";
import { ROLE_IDS, type RoleId } from "./roles";
import { TENANT_IDS, type TenantId } from "./tenants";

// ---------------------------------------------------------------------------
// Operational entities
// ---------------------------------------------------------------------------
export const LEAD_STAGES = ["new", "contacted", "qualified", "won", "lost"] as const;
export const CUSTOMER_TIERS = ["key", "growth", "standard"] as const;
export const CUSTOMER_STATUSES = ["active", "dormant", "paid"] as const;
export const SALE_STATUSES = ["paid", "pending", "refunded"] as const;
export const SALE_PAYMENT_TYPES = ["full", "partial"] as const;
export const TASK_PRIORITIES = ["high", "medium", "low"] as const;
export const TASK_STATUSES = ["open", "in_progress", "done"] as const;
export const PROJECT_STATUSES = ["planned", "active", "on_hold", "completed", "cancelled"] as const;
export const TRANSACTION_KINDS = ["income", "expense"] as const;
export const INVOICE_STATUSES = ["draft", "pending", "paid", "void"] as const;
export const STAFF_STATUSES = ["active", "on_leave", "contract"] as const;
export const MEETING_STATUSES = ["scheduled", "held", "cancelled"] as const;
export const CALL_DIRECTIONS = ["inbound", "outbound"] as const;
export const CALL_OUTCOMES = ["connected", "missed", "follow_up", "closed"] as const;

export const MARIZ_SERVICES = [
  { key: "software_development", label: "Software and website development" },
  { key: "recruitment", label: "Recruitment and Talent acquisition" },
  { key: "photography", label: "Photography and cinematography" },
  { key: "consultancy", label: "Business consultancy and Advisory" },
  { key: "digital_marketing", label: "Digital Marketing" },
  { key: "call_support", label: "Call support and audio services" },
  { key: "corporate_branding", label: "Corporate branding" },
  { key: "sales_outsourcing", label: "Sales and Marketing outsourcing" },
  { key: "community_service", label: "Community service" },
  { key: "property_finishing", label: "Property painting and finishing solutions" },
] as const;

export type MarizServiceKey = (typeof MARIZ_SERVICES)[number]["key"];

export function marizServiceLabel(key: string): string {
  return MARIZ_SERVICES.find((service) => service.key === key)?.label ?? key;
}

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const optionalDate = z.union([dateString, z.literal("")]).default("");
const optionalTime = z.union([timeString, z.literal("")]).default("");
const emailOrBlank = z.union([z.string().trim().email(), z.literal("")]).default("");
const shortText = (max = 120) => z.string().trim().max(max).default("");

export const serviceLineSchema = z.object({
  service: z.string().trim().min(1).max(60),
  amount: z.coerce.number().min(0).max(1_000_000_000_000).default(0),
});

export const leadInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  company: shortText(120),
  email: emailOrBlank,
  phone: shortText(40),
  source: z.string().trim().max(60).default("Referral"),
  stage: z.enum(LEAD_STAGES).default("new"),
  value: z.coerce.number().min(0).max(1_000_000_000_000).default(0),
  owner: shortText(80),
  nextStep: shortText(160),
  description: shortText(2000),
});

export const customerInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  company: shortText(120),
  address: shortText(160),
  email: emailOrBlank,
  phone: shortText(40),
  tier: z.enum(CUSTOMER_TIERS).default("standard"),
  status: z.enum(CUSTOMER_STATUSES).default("active"),
  owner: shortText(80),
  lifetimeValue: z.coerce.number().min(0).max(1_000_000_000_000).default(0),
  lastOrder: optionalDate,
  issueOn: optionalDate,
  services: z.array(serviceLineSchema).max(20).default([]),
  // Talent Clinic participant details (optional for other subsidiaries).
  registrationNumber: shortText(40),
  clinic: shortText(40),
  programSession: shortText(40),
  cohort: shortText(80),
  startDate: optionalDate,
  // Mariz partial-payment tracking, mirrored on the customer for quick reference.
  paidTotal: z.coerce.number().min(0).max(1_000_000_000_000).default(0),
  lastPaymentOn: optionalDate,
  lastPaymentBy: shortText(80),
  lastPaymentByEmail: shortText(120),
});

export const saleInputSchema = z.object({
  occurredOn: dateString,
  description: z.string().trim().min(1, "Description is required").max(160),
  customerId: shortText(60),
  customerName: shortText(120),
  customerPhone: shortText(40),
  customerEmail: emailOrBlank,
  amount: z.coerce.number().min(0).max(1_000_000_000_000).default(0),
  status: z.enum(SALE_STATUSES).default("pending"),
  channel: z.string().trim().max(60).default("Direct"),
  owner: shortText(80),
  // Mariz partial-payment details: who collected the money and how it relates
  // to the customer's agreed value.
  paymentType: z.enum(SALE_PAYMENT_TYPES).default("full"),
  collectedBy: shortText(80),
  collectedByEmail: shortText(120),
  agreedValue: z.coerce.number().min(0).max(1_000_000_000_000).default(0),
  balanceAfter: z.coerce.number().min(0).max(1_000_000_000_000).default(0),
  installmentNo: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const taskInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  assignee: shortText(80),
  dueOn: optionalDate,
  dueTime: optionalTime,
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  status: z.enum(TASK_STATUSES).default("open"),
  related: shortText(120),
  description: shortText(2000),
});

export const meetingInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  meetingOn: dateString,
  startTime: optionalTime,
  endTime: optionalTime,
  location: shortText(160),
  attendees: shortText(300),
  status: z.enum(MEETING_STATUSES).default("scheduled"),
  owner: shortText(80),
  followUpOn: optionalDate,
  agenda: shortText(2000),
  notes: shortText(2000),
});

export const callInputSchema = z.object({
  contactName: z.string().trim().min(1, "Contact name is required").max(120),
  company: shortText(120),
  phone: shortText(40),
  direction: z.enum(CALL_DIRECTIONS).default("outbound"),
  callOn: dateString,
  callTime: optionalTime,
  durationMin: z.coerce.number().min(0).max(10_000).default(0),
  purpose: shortText(200),
  outcome: z.enum(CALL_OUTCOMES).default("connected"),
  owner: shortText(80),
  followUpOn: optionalDate,
  notes: shortText(2000),
});

export const projectInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(160),
  client: shortText(120),
  status: z.enum(PROJECT_STATUSES).default("active"),
  budget: z.coerce.number().min(0).max(1_000_000_000_000).default(0),
  spent: z.coerce.number().min(0).max(1_000_000_000_000).default(0),
  progress: z.coerce.number().min(0).max(100).default(0),
  dueOn: optionalDate,
  startDate: optionalDate,
  durationWeeks: z.coerce.number().min(1).max(52).default(6),
  programSession: shortText(40),
  owner: shortText(80),
  description: shortText(240),
});

export const inventoryInputSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(40),
  name: z.string().trim().min(1, "Name is required").max(160),
  category: z.string().trim().max(60).default("Stock"),
  quantity: z.coerce.number().min(0).max(1_000_000).default(0),
  reorderLevel: z.coerce.number().min(0).max(1_000_000).default(0),
  unitCost: z.coerce.number().min(0).max(1_000_000_000_000).default(0),
  supplier: shortText(120),
  location: shortText(120),
});

export const transactionInputSchema = z.object({
  occurredOn: dateString,
  kind: z.enum(TRANSACTION_KINDS).default("expense"),
  description: z.string().trim().min(1, "Description is required").max(160),
  category: z.string().trim().max(60).default("Operations"),
  amount: z.coerce.number().min(0).max(1_000_000_000_000).default(0),
  reference: shortText(60),
  counterparty: shortText(120),
});

export const invoiceInputSchema = z.object({
  number: z.string().trim().min(1, "Invoice number is required").max(40),
  customerName: z.string().trim().min(1, "Customer is required").max(120),
  customerId: shortText(60),
  issueOn: dateString,
  dueOn: optionalDate,
  amount: z.coerce.number().min(0).max(1_000_000_000_000).default(0),
  status: z.enum(INVOICE_STATUSES).default("pending"),
  notes: shortText(240),
  owner: shortText(80),
});

export const staffInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  role: z.string().trim().max(120).default("Staff"),
  department: z.string().trim().max(60).default("Operations"),
  email: emailOrBlank,
  phone: shortText(40),
  status: z.enum(STAFF_STATUSES).default("active"),
  joinedOn: optionalDate,
  notes: shortText(240),
});

export const opsEntitySchema = z.enum([
  "leads",
  "customers",
  "sales",
  "tasks",
  "meetings",
  "calls",
  "projects",
  "inventory",
  "transactions",
  "invoices",
  "staff",
]);
export type OpsEntity = z.infer<typeof opsEntitySchema>;

export const OPS_ENTITIES = opsEntitySchema.options;

export const OPS_LABELS: Record<OpsEntity, { singular: string; plural: string }> = {
  leads: { singular: "Lead", plural: "Leads" },
  customers: { singular: "Customer", plural: "Customers" },
  sales: { singular: "Sale", plural: "Sales" },
  tasks: { singular: "Task", plural: "Tasks" },
  meetings: { singular: "Meeting", plural: "Meetings" },
  calls: { singular: "Call", plural: "Calls" },
  projects: { singular: "Project", plural: "Projects" },
  inventory: { singular: "Item", plural: "Inventory" },
  transactions: { singular: "Transaction", plural: "Finance" },
  invoices: { singular: "Invoice", plural: "Invoices" },
  staff: { singular: "Staff member", plural: "Staff" },
};

export const OPS_INPUT_SCHEMAS = {
  leads: leadInputSchema,
  customers: customerInputSchema,
  sales: saleInputSchema,
  tasks: taskInputSchema,
  meetings: meetingInputSchema,
  calls: callInputSchema,
  projects: projectInputSchema,
  inventory: inventoryInputSchema,
  transactions: transactionInputSchema,
  invoices: invoiceInputSchema,
  staff: staffInputSchema,
} as const;

const recordBase = {
  id: z.string().min(1),
  tenantId: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
};

export const leadRecordSchema = leadInputSchema.extend(recordBase);
export const customerRecordSchema = customerInputSchema.extend(recordBase);
export const saleRecordSchema = saleInputSchema.extend(recordBase);
export const taskRecordSchema = taskInputSchema.extend(recordBase);
export const meetingRecordSchema = meetingInputSchema.extend(recordBase);
export const callRecordSchema = callInputSchema.extend(recordBase);
export const projectRecordSchema = projectInputSchema.extend(recordBase);
export const inventoryRecordSchema = inventoryInputSchema.extend(recordBase);
export const transactionRecordSchema = transactionInputSchema.extend(recordBase);
export const invoiceRecordSchema = invoiceInputSchema.extend(recordBase);
export const staffRecordSchema = staffInputSchema.extend(recordBase);

export const OPS_RECORD_SCHEMAS = {
  leads: leadRecordSchema,
  customers: customerRecordSchema,
  sales: saleRecordSchema,
  tasks: taskRecordSchema,
  meetings: meetingRecordSchema,
  calls: callRecordSchema,
  projects: projectRecordSchema,
  inventory: inventoryRecordSchema,
  transactions: transactionRecordSchema,
  invoices: invoiceRecordSchema,
  staff: staffRecordSchema,
} as const;

export type LeadInput = z.input<typeof leadInputSchema>;
export type CustomerInput = z.input<typeof customerInputSchema>;
export type SaleInput = z.input<typeof saleInputSchema>;
export type TaskInput = z.input<typeof taskInputSchema>;
export type MeetingInput = z.input<typeof meetingInputSchema>;
export type CallInput = z.input<typeof callInputSchema>;
export type ProjectInput = z.input<typeof projectInputSchema>;
export type InventoryInput = z.input<typeof inventoryInputSchema>;
export type TransactionInput = z.input<typeof transactionInputSchema>;
export type InvoiceInput = z.input<typeof invoiceInputSchema>;
export type StaffInput = z.input<typeof staffInputSchema>;
export type OpsInput =
  | LeadInput
  | CustomerInput
  | SaleInput
  | TaskInput
  | MeetingInput
  | CallInput
  | ProjectInput
  | InventoryInput
  | TransactionInput
  | InvoiceInput
  | StaffInput;

export type LeadDraft = z.infer<typeof leadInputSchema>;
export type CustomerDraft = z.infer<typeof customerInputSchema>;
export type SaleDraft = z.infer<typeof saleInputSchema>;
export type TaskDraft = z.infer<typeof taskInputSchema>;
export type MeetingDraft = z.infer<typeof meetingInputSchema>;
export type CallDraft = z.infer<typeof callInputSchema>;
export type ProjectDraft = z.infer<typeof projectInputSchema>;
export type InventoryDraft = z.infer<typeof inventoryInputSchema>;
export type TransactionDraft = z.infer<typeof transactionInputSchema>;
export type InvoiceDraft = z.infer<typeof invoiceInputSchema>;
export type StaffDraft = z.infer<typeof staffInputSchema>;
export type OpsDraft =
  | LeadDraft
  | CustomerDraft
  | SaleDraft
  | TaskDraft
  | MeetingDraft
  | CallDraft
  | ProjectDraft
  | InventoryDraft
  | TransactionDraft
  | InvoiceDraft
  | StaffDraft;

export type LeadRecord = z.infer<typeof leadRecordSchema>;
export type CustomerRecord = z.infer<typeof customerRecordSchema>;
export type SaleRecord = z.infer<typeof saleRecordSchema>;
export type TaskRecord = z.infer<typeof taskRecordSchema>;
export type MeetingRecord = z.infer<typeof meetingRecordSchema>;
export type CallRecord = z.infer<typeof callRecordSchema>;
export type ProjectRecord = z.infer<typeof projectRecordSchema>;
export type InventoryRecord = z.infer<typeof inventoryRecordSchema>;
export type TransactionRecord = z.infer<typeof transactionRecordSchema>;
export type InvoiceRecord = z.infer<typeof invoiceRecordSchema>;
export type StaffRecord = z.infer<typeof staffRecordSchema>;
export type ServiceLine = z.infer<typeof serviceLineSchema>;
export type OpsRecord =
  | LeadRecord
  | CustomerRecord
  | SaleRecord
  | TaskRecord
  | MeetingRecord
  | CallRecord
  | ProjectRecord
  | InventoryRecord
  | TransactionRecord
  | InvoiceRecord
  | StaffRecord;

export interface OpsRecordMap {
  leads: LeadRecord;
  customers: CustomerRecord;
  sales: SaleRecord;
  tasks: TaskRecord;
  meetings: MeetingRecord;
  calls: CallRecord;
  projects: ProjectRecord;
  inventory: InventoryRecord;
  transactions: TransactionRecord;
  invoices: InvoiceRecord;
  staff: StaffRecord;
}

export function isOpsEntity(value: string): value is OpsEntity {
  return (OPS_ENTITIES as readonly string[]).includes(value);
}

export function parseOpsInput(entity: OpsEntity, value: unknown): OpsDraft {
  return (OPS_INPUT_SCHEMAS[entity] as z.AnyZodObject).parse(value) as OpsDraft;
}

export function parseOpsUpdate(
  entity: OpsEntity,
  value: unknown,
): Partial<
  LeadDraft &
    CustomerDraft &
    SaleDraft &
    TaskDraft &
    MeetingDraft &
    CallDraft &
    ProjectDraft &
    InventoryDraft &
    TransactionDraft &
    InvoiceDraft &
    StaffDraft
> {
  return (OPS_INPUT_SCHEMAS[entity] as z.AnyZodObject).partial().parse(value) as Partial<
    LeadDraft &
      CustomerDraft &
      SaleDraft &
      TaskDraft &
      MeetingDraft &
      CallDraft &
      ProjectDraft &
      InventoryDraft &
      TransactionDraft &
      InvoiceDraft &
      StaffDraft
  >;
}

export function parseOpsRecord(entity: OpsEntity, value: unknown): OpsRecord {
  return OPS_RECORD_SCHEMAS[entity].parse(value) as OpsRecord;
}

// ---------------------------------------------------------------------------
// Accounts and auth payloads
// ---------------------------------------------------------------------------
export const accountStatusSchema = z.enum(["active", "suspended"]);
export type AccountStatus = z.infer<typeof accountStatusSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  next: z.string().max(500).optional(),
});

export const accountPasswordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(200, "Use at most 200 characters");

export const accountCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email"),
  role: z.enum(ROLE_IDS),
  tenants: z.array(z.enum(TENANT_IDS)).default([]),
  status: accountStatusSchema.default("active"),
  password: accountPasswordSchema,
});

export const accountUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email("Enter a valid email"),
    role: z.enum(ROLE_IDS),
    tenants: z.array(z.enum(TENANT_IDS)),
    status: accountStatusSchema,
    password: accountPasswordSchema,
  })
  .partial();

export const accountTransferSchema = z
  .object({
    fromTenantId: z.enum(TENANT_IDS),
    toTenantId: z.enum(TENANT_IDS),
  })
  .refine((value) => value.fromTenantId !== value.toTenantId, {
    message: "Choose two different subsidiaries",
    path: ["toTenantId"],
  });

export interface AccountView {
  id: string;
  name: string;
  email: string;
  role: RoleId;
  roleLabel: string;
  tenants: TenantId[];
  status: AccountStatus;
  createdAt: string;
  lastActive: string | null;
}

export type LoginInput = z.input<typeof loginSchema>;
export type AccountCreateInput = z.input<typeof accountCreateSchema>;
export type AccountUpdateInput = z.input<typeof accountUpdateSchema>;
export type AccountTransferInput = z.input<typeof accountTransferSchema>;
export type AccountCreatePayload = z.infer<typeof accountCreateSchema>;
export type AccountUpdatePayload = z.infer<typeof accountUpdateSchema>;
export type AccountTransferPayload = z.infer<typeof accountTransferSchema>;
