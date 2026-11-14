import {
  CUSTOMER_STATUSES,
  CUSTOMER_TIERS,
  INVOICE_STATUSES,
  LEAD_STAGES,
  PROJECT_STATUSES,
  SALE_STATUSES,
  STAFF_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TRANSACTION_KINDS,
  type OpsEntity,
} from "@d12/contracts";

export type FieldType = "text" | "email" | "number" | "date" | "select" | "textarea";

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: FieldOption[];
  placeholder?: string;
  wide?: boolean;
}

export interface ColumnConfig {
  key: string;
  label: string;
  kind?: "text" | "currency" | "percent" | "date" | "badge" | "muted" | "stacked";
  align?: "left" | "right";
}

export interface EntityConfig {
  entity: OpsEntity;
  singular: string;
  plural: string;
  countLabel?: string;
  description: string;
  primaryKey: "name" | "title" | "description" | "number";
  filterKey: string;
  columns: ColumnConfig[];
  fields: FieldConfig[];
  defaults: Record<string, string | number>;
  detailBase?: string;
}

function options(values: readonly string[]): FieldOption[] {
  return values.map((value) => ({
    value,
    label: value.replace(/_/g, " ").replace(/^\w/, (char) => char.toUpperCase()),
  }));
}

const TODAY = new Date().toISOString().slice(0, 10);

export const ENTITY_CONFIG: Record<OpsEntity, EntityConfig> = {
  leads: {
    entity: "leads",
    singular: "Lead",
    plural: "Leads",
    description: "Pipeline conversations from first contact to signed work.",
    primaryKey: "name",
    filterKey: "stage",
    columns: [
      { key: "name", label: "Lead", kind: "stacked" },
      { key: "stage", label: "Stage", kind: "badge" },
      { key: "value", label: "Value", kind: "currency", align: "right" },
      { key: "source", label: "Source", kind: "muted" },
      { key: "owner", label: "Owner" },
      { key: "nextStep", label: "Next step", kind: "muted" },
    ],
    fields: [
      { key: "name", label: "Contact name", type: "text", required: true, placeholder: "e.g. Aisha Kamya" },
      { key: "company", label: "Company", type: "text", placeholder: "Organisation" },
      { key: "email", label: "Email", type: "email", placeholder: "name@company.com" },
      { key: "phone", label: "Phone", type: "text", placeholder: "+256 ..." },
      { key: "source", label: "Source", type: "text", placeholder: "Referral, walk-in, campaign" },
      { key: "stage", label: "Stage", type: "select", options: options(LEAD_STAGES) },
      { key: "value", label: "Estimated value (UGX)", type: "number" },
      { key: "owner", label: "Owner", type: "text" },
      { key: "nextStep", label: "Next step", type: "text", wide: true },
    ],
    defaults: { source: "Referral", stage: "new", value: 0 },
  },
  customers: {
    entity: "customers",
    singular: "Customer",
    plural: "Customers",
    description: "Accounts that already buy from this subsidiary.",
    primaryKey: "name",
    filterKey: "status",
    columns: [
      { key: "name", label: "Customer", kind: "stacked" },
      { key: "tier", label: "Tier", kind: "badge" },
      { key: "status", label: "Status", kind: "badge" },
      { key: "lifetimeValue", label: "Lifetime value", kind: "currency", align: "right" },
      { key: "owner", label: "Owner" },
      { key: "lastOrder", label: "Last order", kind: "date" },
    ],
    fields: [
      { key: "name", label: "Customer name", type: "text", required: true },
      { key: "company", label: "Company", type: "text" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone", type: "text" },
      { key: "tier", label: "Tier", type: "select", options: options(CUSTOMER_TIERS) },
      { key: "status", label: "Status", type: "select", options: options(CUSTOMER_STATUSES) },
      { key: "owner", label: "Account owner", type: "text" },
      { key: "lifetimeValue", label: "Lifetime value (UGX)", type: "number" },
      { key: "lastOrder", label: "Last order", type: "date", wide: true },
    ],
    defaults: { tier: "standard", status: "active", lifetimeValue: 0, lastOrder: "" },
  },
  sales: {
    entity: "sales",
    singular: "Sale",
    plural: "Sales",
    description: "Invoices and receipts streamed to the group warehouse.",
    primaryKey: "description",
    filterKey: "status",
    columns: [
      { key: "description", label: "Sale", kind: "stacked" },
      { key: "status", label: "Status", kind: "badge" },
      { key: "amount", label: "Amount", kind: "currency", align: "right" },
      { key: "channel", label: "Channel" },
      { key: "owner", label: "Owner" },
      { key: "occurredOn", label: "Date", kind: "date", align: "right" },
    ],
    fields: [
      { key: "description", label: "Description", type: "text", required: true, wide: true },
      { key: "customerName", label: "Customer", type: "text" },
      { key: "customerId", label: "Customer id", type: "text", placeholder: "Optional link" },
      { key: "amount", label: "Amount (UGX)", type: "number" },
      { key: "status", label: "Status", type: "select", options: options(SALE_STATUSES) },
      { key: "channel", label: "Channel", type: "text" },
      { key: "owner", label: "Owner", type: "text", placeholder: "Account executive" },
      { key: "occurredOn", label: "Date", type: "date", required: true, wide: true },
    ],
    defaults: { status: "paid", channel: "Direct", amount: 0 },
  },
  tasks: {
    entity: "tasks",
    singular: "Task",
    plural: "Tasks",
    description: "Delivery work with owners, priorities and due dates.",
    primaryKey: "title",
    filterKey: "status",
    columns: [
      { key: "title", label: "Task", kind: "stacked" },
      { key: "priority", label: "Priority", kind: "badge" },
      { key: "status", label: "Status", kind: "badge" },
      { key: "assignee", label: "Assignee" },
      { key: "dueOn", label: "Due", kind: "date", align: "right" },
    ],
    fields: [
      { key: "title", label: "Task", type: "text", required: true, wide: true },
      { key: "assignee", label: "Assignee", type: "text" },
      { key: "related", label: "Related to", type: "text", placeholder: "Customer, campaign, order" },
      { key: "priority", label: "Priority", type: "select", options: options(TASK_PRIORITIES) },
      { key: "status", label: "Status", type: "select", options: options(TASK_STATUSES) },
      { key: "dueOn", label: "Due date", type: "date" },
    ],
    defaults: { priority: "medium", status: "open", dueOn: "" },
  },
  projects: {
    entity: "projects",
    singular: "Project",
    plural: "Projects",
    description: "Delivery work with budgets, progress and due dates.",
    primaryKey: "name",
    filterKey: "status",
    columns: [
      { key: "name", label: "Project", kind: "stacked" },
      { key: "status", label: "Status", kind: "badge" },
      { key: "client", label: "Client" },
      { key: "budget", label: "Budget", kind: "currency", align: "right" },
      { key: "spent", label: "Spent", kind: "currency", align: "right" },
      { key: "progress", label: "Progress", kind: "percent", align: "right" },
      { key: "dueOn", label: "Due", kind: "date", align: "right" },
    ],
    fields: [
      { key: "name", label: "Project name", type: "text", required: true, placeholder: "e.g. Q4 brand campaign" },
      { key: "client", label: "Client", type: "text" },
      { key: "status", label: "Status", type: "select", options: options(PROJECT_STATUSES) },
      { key: "owner", label: "Owner", type: "text" },
      { key: "budget", label: "Budget (UGX)", type: "number" },
      { key: "spent", label: "Spent (UGX)", type: "number" },
      { key: "progress", label: "Progress (%)", type: "number" },
      { key: "dueOn", label: "Due date", type: "date" },
      { key: "description", label: "Notes", type: "textarea", wide: true },
    ],
    defaults: { status: "active", budget: 0, spent: 0, progress: 0, dueOn: "" },
  },
  inventory: {
    entity: "inventory",
    singular: "Item",
    plural: "Inventory",
    countLabel: "items",
    description: "Stock levels, reorder points and unit costs.",
    primaryKey: "name",
    filterKey: "category",
    columns: [
      { key: "name", label: "Item", kind: "stacked" },
      { key: "category", label: "Category", kind: "badge" },
      { key: "quantity", label: "On hand", align: "right" },
      { key: "reorderLevel", label: "Reorder at", align: "right" },
      { key: "unitCost", label: "Unit cost", kind: "currency", align: "right" },
      { key: "supplier", label: "Supplier", kind: "muted" },
    ],
    fields: [
      { key: "sku", label: "SKU", type: "text", required: true, placeholder: "e.g. PTO-001" },
      { key: "name", label: "Item name", type: "text", required: true },
      { key: "category", label: "Category", type: "text", placeholder: "Stock, supplies, equipment" },
      { key: "quantity", label: "Quantity on hand", type: "number" },
      { key: "reorderLevel", label: "Reorder level", type: "number" },
      { key: "unitCost", label: "Unit cost (UGX)", type: "number" },
      { key: "supplier", label: "Supplier", type: "text" },
      { key: "location", label: "Location", type: "text", wide: true },
    ],
    defaults: { category: "Stock", quantity: 0, reorderLevel: 0, unitCost: 0 },
  },
  transactions: {
    entity: "transactions",
    singular: "Transaction",
    plural: "Finance",
    countLabel: "entries",
    description: "Money in and money out, streamed to the group ledger.",
    primaryKey: "description",
    filterKey: "kind",
    columns: [
      { key: "description", label: "Transaction", kind: "stacked" },
      { key: "kind", label: "Type", kind: "badge" },
      { key: "category", label: "Category", kind: "muted" },
      { key: "amount", label: "Amount", kind: "currency", align: "right" },
      { key: "occurredOn", label: "Date", kind: "date", align: "right" },
      { key: "reference", label: "Reference", kind: "muted" },
    ],
    fields: [
      { key: "kind", label: "Type", type: "select", options: options(TRANSACTION_KINDS) },
      { key: "occurredOn", label: "Date", type: "date", required: true },
      { key: "description", label: "Description", type: "text", required: true, wide: true },
      { key: "category", label: "Category", type: "text", placeholder: "Operations, rent, marketing" },
      { key: "amount", label: "Amount (UGX)", type: "number" },
      { key: "counterparty", label: "Paid to / from", type: "text" },
      { key: "reference", label: "Reference", type: "text", placeholder: "Receipt or voucher no." },
    ],
    defaults: { kind: "expense", occurredOn: TODAY, category: "Operations", amount: 0 },
  },
  invoices: {
    entity: "invoices",
    singular: "Invoice",
    plural: "Invoices",
    description: "Issued invoices and what the group is still owed.",
    primaryKey: "number",
    filterKey: "status",
    columns: [
      { key: "number", label: "Invoice", kind: "stacked" },
      { key: "status", label: "Status", kind: "badge" },
      { key: "amount", label: "Amount", kind: "currency", align: "right" },
      { key: "owner", label: "Owner" },
      { key: "issueOn", label: "Issued", kind: "date", align: "right" },
      { key: "dueOn", label: "Due", kind: "date", align: "right" },
    ],
    fields: [
      { key: "number", label: "Invoice number", type: "text", required: true, placeholder: "e.g. INV-1042" },
      { key: "customerName", label: "Customer", type: "text", required: true },
      { key: "customerId", label: "Customer id", type: "text", placeholder: "Optional link" },
      { key: "amount", label: "Amount (UGX)", type: "number" },
      { key: "status", label: "Status", type: "select", options: options(INVOICE_STATUSES) },
      { key: "owner", label: "Owner", type: "text", placeholder: "Account executive" },
      { key: "issueOn", label: "Issued on", type: "date", required: true },
      { key: "dueOn", label: "Due on", type: "date" },
      { key: "notes", label: "Notes", type: "textarea", wide: true },
    ],
    defaults: { status: "pending", issueOn: TODAY, dueOn: "", amount: 0 },
  },
  staff: {
    entity: "staff",
    singular: "Staff member",
    plural: "Staff",
    countLabel: "people",
    description: "The people behind this subsidiary, with roles and departments.",
    primaryKey: "name",
    filterKey: "status",
    columns: [
      { key: "name", label: "Name", kind: "stacked" },
      { key: "role", label: "Role" },
      { key: "department", label: "Department", kind: "badge" },
      { key: "status", label: "Status", kind: "badge" },
      { key: "phone", label: "Phone", kind: "muted" },
      { key: "joinedOn", label: "Joined", kind: "date", align: "right" },
    ],
    fields: [
      { key: "name", label: "Full name", type: "text", required: true, placeholder: "e.g. Sarah Nakato" },
      { key: "role", label: "Role", type: "text", placeholder: "Job title" },
      { key: "department", label: "Department", type: "text", placeholder: "Operations, finance, creative" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone", type: "text" },
      { key: "status", label: "Status", type: "select", options: options(STAFF_STATUSES) },
      { key: "joinedOn", label: "Joined on", type: "date", wide: true },
      { key: "notes", label: "Notes", type: "textarea", wide: true },
    ],
    defaults: { role: "Staff", department: "Operations", status: "active", joinedOn: TODAY },
    detailBase: "/staff",
  },
};
