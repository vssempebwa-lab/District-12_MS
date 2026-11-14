"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
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
import type { OpsEntity } from "@d12/contracts";
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
  ENTITY_CONFIG,
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
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
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
      return "success";
    case "qualified":
    case "growth":
    case "in_progress":
    case "planned":
    case "contract":
      return "info";
    case "contacted":
    case "pending":
    case "medium":
    case "on_hold":
    case "on_leave":
      return "warning";
    case "high":
    case "refunded":
    case "lost":
    case "cancelled":
    case "expense":
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
    form[field.key] = field.type === "number" ? "0" : "";
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
    form[field.key] = text(row[field.key]);
  }
  return form;
}

function buildPayload(config: EntityConfig, form: Record<string, string>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of config.fields) {
    const raw = form[field.key] ?? "";
    payload[field.key] = field.type === "number" ? Number(raw === "" ? 0 : raw) : raw;
  }
  return payload;
}

function sublineFor(row: EntityRow, config: EntityConfig): string {
  const candidates: Record<OpsEntity, string[]> = {
    leads: ["company", "email", "phone"],
    customers: ["company", "email", "phone"],
    sales: ["customerName", "channel"],
    tasks: ["related", "assignee"],
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

function renderCell(row: EntityRow, column: ColumnConfig, config: EntityConfig, canWrite: boolean, onEdit: () => void) {
  const value = text(row[column.key]);

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

export function OpsBoard({
  entity,
  records,
  canWrite,
  canSync = false,
  personalName,
}: OpsBoardProps) {
  const config = ENTITY_CONFIG[entity];
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

  const filterField = config.fields.find((field) => field.key === config.filterKey);
  const filterOptions = filterField?.options ?? [];

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
                    {renderCell(row, column, config, canWrite, () => openEdit(row))}
                  </Td>
                ))}
                {canWrite ? (
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1">
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
              {renderField(
                field,
                form[field.key] ?? "",
                (value) => setForm((previous) => ({ ...previous, [field.key]: value })),
                field.key === lockedKey,
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
    </div>
  );
}
