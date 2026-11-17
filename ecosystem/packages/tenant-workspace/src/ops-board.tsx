"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRightLeft,
  Banknote,
  CalendarClock,
  FileText,
  Pencil,
  Plus,
  Scale,
  Search,
  TrendingUp,
  Trash2,
  UsersRound,
  Wallet,
} from "lucide-react";
import type { OpsEntity, ServiceLine, TenantId } from "@d12/contracts";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  StatCard,
  TableShell,
  Td,
  Textarea,
  Th,
  cn,
  rowClass,
  type Tone,
} from "@d12/ui";
import {
  entityConfigFor,
  type ColumnConfig,
  type EntityConfig,
  type FieldConfig,
} from "./entity-config";
import { formatUgx, shortDate, titleCase } from "./format";
import { SyncButton, syncTelemetry } from "./sync-button";

export type EntityRow = Record<string, unknown> & { id: string };

export interface OpsBoardProps {
  entity: OpsEntity;
  records: EntityRow[];
  canWrite: boolean;
  canSync?: boolean;
  /** Set for employees: the board only holds work attributed to this person. */
  personalName?: string;
  /** Selects tenant-specific forms without changing other subsidiaries. */
  tenantId?: TenantId;
  /** Mariz leads can be turned into customer accounts in one step. */
  canConvertLeads?: boolean;
  /** Sales records used to show how much of each customer's agreed value is already paid. */
  paymentSales?: EntityRow[];
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function parseServices(value: unknown): ServiceLine[] {
  try {
    const parsed = typeof value === "string" ? (JSON.parse(value) as unknown) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((line): line is Record<string, unknown> => typeof line === "object" && line !== null)
      .map((line) => ({ service: String(line.service ?? ""), amount: Number(line.amount ?? 0) }))
      .filter((line) => line.service);
  } catch {
    return [];
  }
}

function servicesTotal(lines: ServiceLine[]): number {
  return lines.reduce((sum, line) => sum + Number(line.amount ?? 0), 0);
}

function sortRows(rows: EntityRow[]): EntityRow[] {
  return rows
    .slice()
    .sort((left, right) => text(right.updatedAt).localeCompare(text(left.updatedAt)));
}

function toneFor(value: string): Tone {
  switch (value) {
    case "won":
    case "paid":
    case "active":
    case "done":
    case "completed":
    case "income":
    case "held":
    case "connected":
    case "closed":
      return "success";
    case "qualified":
    case "growth":
    case "in_progress":
    case "planned":
    case "contract":
    case "scheduled":
    case "inbound":
      return "info";
    case "contacted":
    case "pending":
    case "medium":
    case "on_hold":
    case "on_leave":
    case "follow_up":
      return "warning";
    case "high":
    case "refunded":
    case "lost":
    case "cancelled":
    case "expense":
    case "missed":
      return "danger";
    case "key":
      return "brand";
    default:
      return "neutral";
  }
}

function ownerKey(config: EntityConfig): "owner" | "assignee" | null {
  if (config.fields.some((field) => field.key === "owner")) return "owner";
  if (config.fields.some((field) => field.key === "assignee")) return "assignee";
  return null;
}

function defaultForm(config: EntityConfig, personalName?: string): Record<string, string> {
  const form: Record<string, string> = {};
  for (const field of config.fields) {
    form[field.key] =
      field.type === "number" ? "0" : field.type === "services" ? "[]" : "";
  }
  for (const [key, value] of Object.entries(config.defaults)) {
    form[key] = String(value);
  }
  const key = ownerKey(config);
  if (personalName && key) form[key] = personalName;
  return form;
}

function rowToForm(row: EntityRow, config: EntityConfig): Record<string, string> {
  const form = defaultForm(config);
  for (const field of config.fields) {
    form[field.key] =
      field.type === "services"
        ? JSON.stringify(Array.isArray(row[field.key]) ? row[field.key] : [])
        : text(row[field.key]);
  }
  return form;
}

function buildPayload(config: EntityConfig, form: Record<string, string>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of config.fields) {
    const raw = form[field.key] ?? "";
    payload[field.key] =
      field.type === "number"
        ? Number(raw === "" ? 0 : raw)
        : field.type === "services"
          ? parseServices(raw)
          : raw;
  }
  return payload;
}

function sublineFor(row: EntityRow, config: EntityConfig): string {
  const candidates: Record<OpsEntity, string[]> = {
    leads: ["company", "email", "phone"],
    customers: ["company", "email", "phone"],
    sales: ["customerName", "channel"],
    tasks: ["related", "assignee"],
    meetings: ["location", "attendees"],
    calls: ["company", "phone"],
    projects: ["client", "owner"],
    inventory: ["sku", "category", "supplier"],
    transactions: ["counterparty", "category", "reference"],
    invoices: ["customerName"],
    staff: ["role", "department", "email"],
  };
  for (const key of candidates[config.entity]) {
    const value = text(row[key]);
    if (value) return value;
  }
  return "";
}

interface SummaryCard {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  accent: "navy" | "blue" | "green" | "amber" | "violet" | "red";
}

function summaryCards(entity: OpsEntity, rows: EntityRow[]): SummaryCard[] {
  if (entity === "transactions") {
    const income = rows
      .filter((row) => text(row.kind) === "income")
      .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const expenses = rows
      .filter((row) => text(row.kind) === "expense")
      .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    return [
      {
        label: "Income recorded",
        value: formatUgx(income),
        hint: "All time · client payments and sales",
        icon: <TrendingUp className="h-4 w-4" />,
        accent: "green",
      },
      {
        label: "Expenses recorded",
        value: formatUgx(expenses),
        hint: "All time · rent, payroll and running costs",
        icon: <ArrowDownRight className="h-4 w-4" />,
        accent: "red",
      },
      {
        label: "Net position",
        value: formatUgx(income - expenses),
        hint: `${rows.length} ledger ${rows.length === 1 ? "entry" : "entries"}`,
        icon: <Scale className="h-4 w-4" />,
        accent: "navy",
      },
    ];
  }
  if (entity === "invoices") {
    const today = new Date().toISOString().slice(0, 10);
    const pending = rows.filter((row) => text(row.status) === "pending");
    const overdue = pending.filter((row) => {
      const due = text(row.dueOn);
      return Boolean(due) && due < today;
    });
    const paid = rows
      .filter((row) => text(row.status) === "paid")
      .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    return [
      {
        label: "Outstanding",
        value: formatUgx(pending.reduce((sum, row) => sum + Number(row.amount ?? 0), 0)),
        hint: `${pending.length} awaiting payment`,
        icon: <FileText className="h-4 w-4" />,
        accent: "violet",
      },
      {
        label: "Overdue",
        value: formatUgx(overdue.reduce((sum, row) => sum + Number(row.amount ?? 0), 0)),
        hint: `${overdue.length} past the due date`,
        icon: <AlertTriangle className="h-4 w-4" />,
        accent: overdue.length ? "red" : "navy",
      },
      {
        label: "Collected",
        value: formatUgx(paid),
        hint: "All time · paid invoices",
        icon: <Wallet className="h-4 w-4" />,
        accent: "green",
      },
    ];
  }
  if (entity === "staff") {
    const active = rows.filter((row) => text(row.status) === "active");
    const onLeave = rows.filter((row) => text(row.status) === "on_leave");
    const contract = rows.filter((row) => text(row.status) === "contract");
    return [
      {
        label: "Active staff",
        value: String(active.length),
        hint: `${rows.length} people on the roster`,
        icon: <UsersRound className="h-4 w-4" />,
        accent: "green",
      },
      {
        label: "On leave",
        value: String(onLeave.length),
        hint: onLeave.length ? "Currently away from work" : "Nobody on leave",
        icon: <CalendarClock className="h-4 w-4" />,
        accent: onLeave.length ? "amber" : "navy",
      },
      {
        label: "Contractors",
        value: String(contract.length),
        hint: "On fixed-term contracts",
        icon: <FileText className="h-4 w-4" />,
        accent: "blue",
      },
    ];
  }
  return [];
}

function errorMessage(body: unknown): string {
  const error = (
    body as
      | {
          error?: {
            message?: string;
            details?: { issues?: Array<{ path?: string; message?: string }> };
          };
        }
      | null
  )?.error;
  const issue = error?.details?.issues?.[0];
  if (issue?.message) {
    return issue.path ? `${issue.path}: ${issue.message}` : issue.message;
  }
  return error?.message ?? "Could not save the record. Try again.";
}

function renderField(
  field: FieldConfig,
  value: string,
  onChange: (value: string) => void,
  locked = false,
) {
  if (field.type === "select") {
    return (
      <Select value={value} onChange={(event) => onChange(event.target.value)} required={field.required}>
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    );
  }
  if (field.type === "textarea") {
    return (
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        required={field.required}
      />
    );
  }
  return (
    <Input
      type={field.type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
      required={field.required}
      readOnly={locked}
      className={locked ? "bg-canvas text-ink-soft" : undefined}
      min={field.type === "number" ? 0 : undefined}
      step={field.type === "number" ? "any" : undefined}
    />
  );
}

function agreedValueFor(row: EntityRow): number {
  const agreed = servicesTotal(parseServices(row.services));
  return agreed > 0 ? agreed : Number(row.lifetimeValue ?? 0);
}

function renderCell(
  row: EntityRow,
  column: ColumnConfig,
  config: EntityConfig,
  canWrite: boolean,
  onEdit: () => void,
  paidByCustomer?: Map<string, number>,
) {
  const value = text(row[column.key]);

  if (column.kind === "paid") {
    const agreed = agreedValueFor(row);
    const paid = paidByCustomer?.get(row.id) ?? 0;
    if (agreed <= 0) return <span className="text-ink-mute">—</span>;
    const complete = paid >= agreed;
    return (
      <div className="whitespace-nowrap">
        <span className={cn("font-medium", complete ? "text-emerald-700" : "text-ink")}>
          {formatUgx(paid)}
        </span>
        <span className="text-xs text-ink-mute"> / {formatUgx(agreed)}</span>
        {!complete ? (
          <span className="block text-[11px] text-ink-mute">
            {formatUgx(agreed - paid)} remaining
          </span>
        ) : null}
      </div>
    );
  }

  if (column.kind === "stacked") {
    const body = (
      <>
        <span className="block truncate font-medium text-ink">{value || "Untitled"}</span>
        <span className="block truncate text-[11px] text-ink-mute">
          {sublineFor(row, config) || "—"}
        </span>
      </>
    );
    if (config.detailBase) {
      return (
        <Link href={`${config.detailBase}/${text(row.id)}`} className="block max-w-[240px] text-left hover:underline">
          {body}
        </Link>
      );
    }
    if (!canWrite) return <div className="max-w-[240px]">{body}</div>;
    return (
      <button type="button" onClick={onEdit} className="block max-w-[240px] text-left hover:underline">
        {body}
      </button>
    );
  }

  if (column.kind === "services") {
    const lines = parseServices(row[column.key]);
    if (!lines.length) return <span className="text-ink-mute">—</span>;
    const labelField = config.fields.find((field) => field.key === column.key);
    const names = lines.map(
      (line) =>
        labelField?.options?.find((option) => option.value === line.service)?.label ??
        titleCase(line.service.replace(/_/g, " ")),
    );
    const summary =
      names.length <= 2 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
    return (
      <div className="max-w-[220px]" title={names.join(", ")}>
        <span className="block truncate text-xs text-ink-soft">{summary}</span>
        <span className="block text-[11px] text-ink-mute">{formatUgx(servicesTotal(lines))}</span>
      </div>
    );
  }
  if (column.kind === "currency") {
    return <span className="whitespace-nowrap font-medium">{formatUgx(Number(value || 0))}</span>;
  }
  if (column.kind === "percent") {
    return <span className="whitespace-nowrap text-xs text-ink-soft">{Math.round(Number(value || 0))}%</span>;
  }
  if (column.kind === "date") {
    return <span className="whitespace-nowrap text-xs text-ink-soft">{shortDate(value)}</span>;
  }
  if (column.kind === "badge") {
    return value ? (
      <Badge tone={toneFor(value)}>{titleCase(value)}</Badge>
    ) : (
      <span className="text-ink-mute">—</span>
    );
  }
  if (column.kind === "muted") {
    return <span className="text-xs text-ink-soft">{value || "—"}</span>;
  }
  return <span className="text-sm">{value || "—"}</span>;
}

function ServicesField({
  field,
  value,
  onChange,
}: {
  field: FieldConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = parseServices(value);
  const setLines = (lines: ServiceLine[]) => onChange(JSON.stringify(lines));

  function toggle(key: string): void {
    setLines(
      selected.some((line) => line.service === key)
        ? selected.filter((line) => line.service !== key)
        : [...selected, { service: key, amount: 0 }],
    );
  }

  function setAmount(key: string, amount: number): void {
    setLines(selected.map((line) => (line.service === key ? { ...line, amount } : line)));
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-line p-3">
      {field.options?.map((option) => {
        const checked = selected.some((line) => line.service === option.value);
        const amount = selected.find((line) => line.service === option.value)?.amount ?? 0;
        return (
          <div key={option.value} className="flex flex-wrap items-center gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-ink">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(option.value)}
                className="h-3.5 w-3.5 shrink-0 rounded border-line accent-navy"
              />
              <span className="min-w-0">{option.label}</span>
            </label>
            {checked ? (
              <input
                type="number"
                min={0}
                step="any"
                value={amount}
                onChange={(event) => setAmount(option.value, Number(event.target.value))}
                placeholder="Agreed value (UGX)"
                aria-label={`${option.label} agreed value`}
                className="h-8 w-40 rounded-md border border-line bg-white px-2 text-xs text-ink outline-none focus:border-navy/40"
              />
            ) : null}
          </div>
        );
      })}
      <p className="border-t border-line pt-1.5 text-[11px] font-semibold text-ink-soft">
        Total agreed value: {formatUgx(servicesTotal(selected))}
      </p>
    </div>
  );
}

export function OpsBoard({
  entity,
  records,
  canWrite,
  canSync = false,
  personalName,
  tenantId,
  canConvertLeads = false,
  paymentSales,
}: OpsBoardProps) {
  const config = entityConfigFor(entity, tenantId);
  const lockedKey = personalName ? ownerKey(config) : null;
  const [rows, setRows] = useState<EntityRow[]>(() => sortRows(records));
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editor, setEditor] = useState<{ mode: "create" | "edit"; row: EntityRow | null } | null>(null);
  const [form, setForm] = useState<Record<string, string>>(() => defaultForm(config, personalName));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<EntityRow | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [converting, setConverting] = useState<EntityRow | null>(null);
  const [convertPending, setConvertPending] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [paying, setPaying] = useState<EntityRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payPending, setPayPending] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  // Keep payments local so the "paid so far" figures update without a page reload.
  const [salesForPayments, setSalesForPayments] = useState<EntityRow[]>(paymentSales ?? []);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setSalesForPayments(paymentSales ?? []);
  }, [paymentSales]);

  const filterField = config.fields.find((field) => field.key === config.filterKey);
  const filterOptions = filterField?.options ?? [];

  const canRecordPayments =
    tenantId === "mariz" && entity === "customers" && canWrite && Boolean(paymentSales);
  const paidByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    for (const sale of salesForPayments) {
      if (text(sale.status) !== "paid") continue;
      const customerId = text(sale.customerId);
      if (!customerId) continue;
      map.set(customerId, (map.get(customerId) ?? 0) + Number(sale.amount ?? 0));
    }
    return map;
  }, [salesForPayments]);

  function hasBalance(row: EntityRow): boolean {
    return agreedValueFor(row) > (paidByCustomer.get(row.id) ?? 0);
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && text(row[config.filterKey]) !== filter) return false;
      if (!query) return true;
      return config.columns.some((column) => text(row[column.key]).toLowerCase().includes(query));
    });
  }, [rows, search, filter, config]);

  function openCreate(): void {
    setForm(defaultForm(config, personalName));
    setFormError(null);
    setEditor({ mode: "create", row: null });
  }

  function openEdit(row: EntityRow): void {
    setForm(rowToForm(row, config));
    setFormError(null);
    setEditor({ mode: "edit", row });
  }

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    setFormError(null);

    const isCreate = editor.mode === "create";
    const url = isCreate ? `/api/ops/${entity}` : `/api/ops/${entity}/${editor.row?.id ?? ""}`;

    try {
      const response = await fetch(url, {
        method: isCreate ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildPayload(config, form)),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; record?: EntityRow; error?: { message?: string } }
        | null;
      if (!response.ok || !body?.ok || !body.record) {
        setFormError(errorMessage(body));
        return;
      }
      const record = body.record;
      setRows((previous) =>
        sortRows(
          isCreate
            ? [record, ...previous]
            : previous.map((row) => (row.id === record.id ? record : row)),
        ),
      );
      setEditor(null);
      void syncTelemetry();
    } catch {
      setFormError("Network error — the workspace could not be reached.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleting) return;
    setDeletePending(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/ops/${entity}/${deleting.id}`, { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: { message?: string } }
        | null;
      if (!response.ok || !body?.ok) {
        setDeleteError(body?.error?.message ?? "Could not delete this record.");
        return;
      }
      setRows((previous) => previous.filter((row) => row.id !== deleting.id));
      setDeleting(null);
      void syncTelemetry();
    } catch {
      setDeleteError("Network error — the workspace could not be reached.");
    } finally {
      setDeletePending(false);
    }
  }

  async function convertLead(): Promise<void> {
    if (!converting) return;
    setConvertPending(true);
    setConvertError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const customerResponse = await fetch("/api/ops/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: text(converting.name),
          company: text(converting.company),
          email: text(converting.email),
          phone: text(converting.phone),
          tier: "standard",
          status: "active",
          owner: text(converting.owner),
          lifetimeValue: Number(converting.value ?? 0),
          lastOrder: "",
          issueOn: today,
          services: [],
        }),
      });
      const customerBody = (await customerResponse.json().catch(() => null)) as
        | { ok?: boolean; record?: EntityRow; error?: { message?: string } }
        | null;
      if (!customerResponse.ok || !customerBody?.ok || !customerBody.record) {
        setConvertError(errorMessage(customerBody));
        return;
      }
      const leadResponse = await fetch(`/api/ops/leads/${converting.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage: "won" }),
      });
      if (leadResponse.ok) {
        setRows((previous) =>
          previous.map((row) => (row.id === converting.id ? { ...row, stage: "won" } : row)),
        );
      }
      setNotice(
        `${text(converting.name)} is now a customer${leadResponse.ok ? " and the lead is marked won" : ""}.`,
      );
      setConverting(null);
      void syncTelemetry();
    } catch {
      setConvertError("Network error — the workspace could not be reached.");
    } finally {
      setConvertPending(false);
    }
  }

  async function confirmPayment(): Promise<void> {
    if (!paying || !(Number(payAmount) > 0)) return;
    setPayPending(true);
    setPayError(null);
    try {
      const response = await fetch(`/api/ops/customers/${paying.id}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: Number(payAmount), paidOn: payDate }),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; sale?: EntityRow; settled?: boolean; customer?: EntityRow; error?: { message?: string } }
        | null;
      if (!response.ok || !body?.ok || !body.sale) {
        setPayError(body?.error?.message ?? "Could not record the payment.");
        return;
      }
      if (body.customer) {
        setRows((previous) =>
          sortRows(previous.map((row) => (row.id === paying.id ? body.customer! : row))),
        );
      }
      if (body.sale) {
        setSalesForPayments((previous) => [body.sale!, ...previous]);
      }
      setNotice(
        `Payment of ${formatUgx(Number(body.sale.amount ?? 0))} recorded for ${text(paying.name)}` +
          (body.settled ? " — fully paid." : "."),
      );
      setPaying(null);
      setPayAmount("");
      void syncTelemetry();
    } catch {
      setPayError("Network error — the workspace could not be reached.");
    } finally {
      setPayPending(false);
    }
  }

  const deletingLabel = deleting ? text(deleting[config.primaryKey]) || config.singular : config.singular;
  const formId = `entity-form-${entity}`;
  const summary = summaryCards(entity, rows);
  const singular = config.singular.toLowerCase();
  const singularArticle = /^[aeiou]/.test(singular) ? "an" : "a";
  const filterNoun =
    config.filterKey === "stage"
      ? "stages"
      : config.filterKey === "category"
        ? "categories"
        : config.filterKey === "kind"
          ? "types"
          : "statuses";

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Subsidiary workspace"
        title={config.plural}
        description={config.description}
        actions={
          <>
            {canWrite ? (
              <Button type="button" size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                New {config.singular.toLowerCase()}
              </Button>
            ) : null}
            {canSync ? <SyncButton pending={0} compact /> : null}
          </>
        }
      />

      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {summary.length ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {summary.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              hint={card.hint}
              icon={card.icon}
              accent={card.accent}
            />
          ))}
        </div>
      ) : null}

      <Card className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-mute" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${config.countLabel ?? config.plural.toLowerCase()}`}
            className="pl-8"
          />
        </div>
        {filterOptions.length ? (
          <Select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="sm:w-44"
            aria-label={`Filter by ${config.filterKey}`}
          >
            <option value="all">All {filterNoun}</option>
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : null}
        <p className="shrink-0 px-1 text-xs text-ink-mute">
          {filtered.length === rows.length
            ? `${rows.length} ${rows.length === 1 ? config.singular.toLowerCase() : (config.countLabel ?? config.plural.toLowerCase())}`
            : `${filtered.length} of ${rows.length}`}
        </p>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title={
              personalName
                ? `Nothing assigned to you yet`
                : `No ${config.countLabel ?? config.plural.toLowerCase()} yet`
            }
            description={
              personalName
                ? `Work assigned to ${personalName} appears here. Anything you create stays under your name.`
                : `Add ${singularArticle} ${singular} to start streaming updates to the group warehouse.`
            }
            action={
              canWrite ? (
                <Button type="button" size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  New {config.singular.toLowerCase()}
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing matches"
            description="Try a different search term or clear the filter."
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <TableShell>
          <thead>
            <tr>
              {config.columns.map((column) => (
                <Th key={column.key} className={column.align === "right" ? "text-right" : undefined}>
                  {column.label}
                </Th>
              ))}
              {canWrite ? <Th className="w-20 text-right">Actions</Th> : null}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className={rowClass}>
                {config.columns.map((column) => (
                  <Td
                    key={column.key}
                    className={cn(
                      column.align === "right" ? "text-right" : undefined,
                      column.kind === "muted" ? "text-ink-soft" : undefined,
                    )}
                  >
                    {renderCell(row, column, config, canWrite, () => openEdit(row), paidByCustomer)}
                  </Td>
                ))}
                {canWrite ? (
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canConvertLeads &&
                      entity === "leads" &&
                      text(row.stage) !== "won" &&
                      text(row.stage) !== "lost" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setConvertError(null);
                            setConverting(row);
                          }}
                          aria-label="Convert lead to customer"
                          title="Convert to customer"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-mute transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      {canRecordPayments && text(row.status) !== "paid" && hasBalance(row) ? (
                        <button
                          type="button"
                          onClick={() => {
                            const agreed = agreedValueFor(row);
                            const paid = paidByCustomer.get(row.id) ?? 0;
                            setPayAmount(String(Math.max(agreed - paid, 0)));
                            setPayError(null);
                            setPaying(row);
                          }}
                          aria-label={`Record payment for ${config.singular.toLowerCase()}`}
                          title="Record payment"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-mute transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                        >
                          <Banknote className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        aria-label={`Edit ${config.singular.toLowerCase()}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-mute transition-colors hover:bg-canvas hover:text-ink"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleting(row);
                        }}
                        aria-label={`Delete ${config.singular.toLowerCase()}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-mute transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <Modal
        open={editor !== null}
        title={editor?.mode === "edit" ? `Edit ${config.singular.toLowerCase()}` : `New ${config.singular.toLowerCase()}`}
        description={
          editor?.mode === "edit"
            ? "Updates stream to the group warehouse as soon as you save."
            : `Add ${singularArticle} ${singular} to this subsidiary.`
        }
        onClose={() => {
          if (!saving) setEditor(null);
        }}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setEditor(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form={formId} disabled={saving}>
              {saving ? "Saving" : editor?.mode === "edit" ? "Save changes" : `Create ${config.singular.toLowerCase()}`}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {config.fields.map((field) => (
            <Field
              key={field.key}
              label={field.required ? `${field.label} *` : field.label}
              className={field.wide ? "sm:col-span-2" : undefined}
            >
              {field.type === "services" ? (
                <ServicesField
                  field={field}
                  value={form[field.key] ?? "[]"}
                  onChange={(value) =>
                    setForm((previous) => ({ ...previous, [field.key]: value }))
                  }
                />
              ) : (
                renderField(
                  field,
                  form[field.key] ?? "",
                  (value) => setForm((previous) => ({ ...previous, [field.key]: value })),
                  field.key === lockedKey,
                )
              )}
              {field.key === lockedKey ? (
                <p className="mt-1 text-[11px] leading-relaxed text-ink-mute">
                  Only your own work is listed here, so this stays on your name.
                </p>
              ) : null}
            </Field>
          ))}
          {formError ? (
            <div className="sm:col-span-2">
              <Alert tone="danger">{formError}</Alert>
            </div>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={deleting !== null}
        title={`Delete ${config.singular.toLowerCase()}`}
        description="This removes the record here and sends a delete event to the group warehouse."
        onClose={() => {
          if (!deletePending) setDeleting(null);
        }}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleting(null)}
              disabled={deletePending}
            >
              Keep it
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={confirmDelete}
              disabled={deletePending}
            >
              {deletePending ? "Deleting" : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          Delete <span className="font-semibold">{deletingLabel}</span>?
        </p>
        {deleting ? (
          <p className="mt-1 text-xs text-ink-soft">{sublineFor(deleting, config) || "This cannot be undone."}</p>
        ) : null}
        {deleteError ? (
          <div className="mt-3">
            <Alert tone="danger">{deleteError}</Alert>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={converting !== null}
        title="Convert lead to customer"
        description="Creates a customer with the lead's details and marks the lead as won."
        onClose={() => {
          if (!convertPending) setConverting(null);
        }}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConverting(null)}
              disabled={convertPending}
            >
              Keep as lead
            </Button>
            <Button type="button" onClick={convertLead} disabled={convertPending}>
              {convertPending ? "Converting" : "Convert to customer"}
            </Button>
          </>
        }
      >
        {converting ? (
          <div className="space-y-2">
            <p className="text-sm text-ink">
              Turn <span className="font-semibold">{text(converting.name)}</span> into a customer?
            </p>
            <p className="text-xs text-ink-soft">
              {text(converting.company) || "No company"} · Owner {text(converting.owner) || "unassigned"} ·{" "}
              {formatUgx(Number(converting.value ?? 0))}
            </p>
            {convertError ? <Alert tone="danger">{convertError}</Alert> : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={paying !== null}
        title="Record payment"
        description="Books a paid sale for this customer and streams it to the group warehouse."
        onClose={() => {
          if (!payPending) setPaying(null);
        }}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPaying(null)}
              disabled={payPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmPayment}
              disabled={payPending || !(Number(payAmount) > 0)}
            >
              {payPending ? "Recording" : "Record payment"}
            </Button>
          </>
        }
      >
        {paying ? (
          <div className="space-y-3">
            <p className="text-sm text-ink">
              <span className="font-semibold">{text(paying.name)}</span>{" "}
              <span className="text-ink-soft">· Owner {text(paying.owner) || "unassigned"}</span>
            </p>
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-line p-3 text-center">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ink-mute">Agreed</p>
                <p className="text-sm font-semibold text-ink">{formatUgx(agreedValueFor(paying))}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ink-mute">Paid so far</p>
                <p className="text-sm font-semibold text-emerald-700">
                  {formatUgx(paidByCustomer.get(paying.id) ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ink-mute">Remaining</p>
                <p className="text-sm font-semibold text-ink">
                  {formatUgx(
                    Math.max(agreedValueFor(paying) - (paidByCustomer.get(paying.id) ?? 0), 0),
                  )}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Amount received (UGX)">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={payAmount}
                  onChange={(event) => setPayAmount(event.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="Payment date">
                <Input
                  type="date"
                  value={payDate}
                  onChange={(event) => setPayDate(event.target.value)}
                />
              </Field>
            </div>
            <p className="text-[11px] leading-relaxed text-ink-mute">
              Paying the full remaining balance marks the customer as paid automatically. Amounts
              above the balance are recorded only up to the balance.
            </p>
            {payError ? <Alert tone="danger">{payError}</Alert> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
