"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect, useId, useMemo, useRef, useState, useTransition,
  type FormEvent, type KeyboardEvent, type ReactNode,
} from "react";
import { Download, Eye, LockKeyhole, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react";
import {
  HUB_MODULES, HUB_SCHEMAS, TENANTS, csvCell, hubDate, hubToday,
  type AccountView, type HubAction, type HubData, type HubField, type HubKind,
  type HubRecord, type TenantId,
} from "@d12/contracts";
import {
  Alert, Badge, Button, EmptyState, Field, Input, Modal, Panel, Select,
  TableShell, Td, Textarea, Th, cn, rowClass,
} from "@d12/ui";

type BoardProps = {
  kind: HubKind;
  records: HubRecord[];
  accounts: AccountView[];
  mode: "demo" | "supabase";
};
type FieldErrors = Record<string, string>;
type ReferenceOption = { value: string; label: string };
const PAYMENT_KEYS = new Set(["paymentReference", "paidOn", "notes"]);
const MONEY_KEYS = new Set(["basic", "allowances", "deductions", "gross", "net"]);
const EXTRA_LABELS: Record<string, string> = {
  status: "Status", employeeName: "Employee", gross: "Gross pay (UGX)", net: "Net pay (UGX)",
  workingDays: "Working days", decisionReason: "Decision reason", tenantId: "Subsidiary",
};
const REFERENCE_KINDS: Record<string, HubKind | "accounts"> = {
  employeeId: "employees", accountId: "accounts", assigneeId: "accounts", reviewerId: "accounts",
  vacancyId: "vacancies", trainingId: "training",
};
const ugx = new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 });

function humanize(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function scopeName(value: string): string {
  return value === "group" ? "District 12 Group" : TENANTS[value as TenantId]?.shortName ?? humanize(value);
}

function fieldLabel(kind: HubKind, key: string): string {
  return HUB_MODULES[kind].fields.find((field) => field.key === key)?.label ?? EXTRA_LABELS[key] ?? humanize(key);
}

function referenceName(record: HubRecord): string {
  const name = String(record.data.name || record.data.title || HUB_MODULES[record.kind].singular);
  return record.kind === "employees" && record.data.title ? `${name} · ${record.data.title}` : name;
}

function selectable(record: HubRecord): boolean {
  if (record.kind === "employees") return record.data.status === "active";
  if (record.kind === "vacancies") return record.data.status === "open";
  if (record.kind === "training") return record.data.status === "scheduled";
  return true;
}

function referenceOptions(field: HubField, records: HubRecord[], accounts: AccountView[], selected = ""): ReferenceOption[] {
  if (field.reference === "accounts") {
    const options = accounts.filter((account) => account.status === "active" || account.id === selected)
      .map((account) => ({ value: account.id, label: `${account.name}${account.status !== "active" ? " (suspended)" : ""}` }));
    if (selected && !options.some((option) => option.value === selected)) {
      options.push({ value: selected, label: `Unavailable account (${selected})` });
    }
    return options;
  }
  const options = records.filter((record) => record.kind === field.reference && (selectable(record) || record.id === selected))
    .map((record) => ({ value: record.id, label: `${referenceName(record)}${!selectable(record) ? ` (${humanize(String(record.data.status))})` : ""}` }));
  if (selected && !options.some((option) => option.value === selected)) {
    options.push({ value: selected, label: `Unavailable ${field.label.toLowerCase()} (${selected})` });
  }
  return options;
}

function displayValue(kind: HubKind, key: string, data: HubData, records: HubRecord[], accounts: AccountView[]): string {
  const value = data[key];
  if (value === undefined || value === "") return "—";
  const reference = HUB_MODULES[kind].fields.find((field) => field.key === key)?.reference ?? REFERENCE_KINDS[key];
  if (reference === "accounts") return accounts.find((account) => account.id === value)?.name ?? `Unavailable account (${value})`;
  if (reference) {
    const record = records.find((entry) => entry.kind === reference && entry.id === value);
    return record ? referenceName(record) : key === "employeeId" && data.employeeName
      ? String(data.employeeName) : `Unavailable ${HUB_MODULES[reference].singular.toLowerCase()} (${value})`;
  }
  if (key === "tenantId") return scopeName(String(value));
  if (kind === "payroll" && MONEY_KEYS.has(key)) return ugx.format(Number(value));
  if (["status", "employmentType", "priority", "type"].includes(key)) return humanize(String(value));
  return String(value);
}

function defaultData(kind: HubKind, records: HubRecord[]): HubData {
  const today = hubToday();
  const data: HubData = {};
  for (const field of HUB_MODULES[kind].fields) {
    data[field.key] = field.default ?? (field.type === "month" ? today.slice(0, 7)
      : field.type === "date" && field.required ? today
      : field.type === "number" ? field.min ?? 0
      : field.type === "select" ? field.options?.[0] ?? "" : "");
  }
  if (kind === "employees") {
    data.annualLeaveDays = records.find((record) => record.kind === "hr_settings")?.data.defaultAnnualLeaveDays ?? 0;
  }
  return data;
}

function canEdit(kind: HubKind, record: HubRecord): boolean {
  return !HUB_MODULES[kind].lockedStatuses?.includes(String(record.data.status));
}

function canDelete(kind: HubKind, record: HubRecord): boolean {
  if (kind === "employees" || kind === "attendance" || HUB_MODULES[kind].singleton) return false;
  if (kind !== "tasks" && ["approved", "submitted", "offered", "attended"].includes(String(record.data.status))) return false;
  return canEdit(kind, record);
}

function payrollData(data: HubData, records: HubRecord[], frozen: boolean): HubData {
  if (frozen) return data;
  const employee = records.find((record) => record.kind === "employees" && record.id === data.employeeId);
  const gross = Number(data.basic || 0) + Number(data.allowances || 0);
  return {
    ...data, gross, net: gross - Number(data.deductions || 0),
    employeeName: employee?.data.name ?? data.employeeName ?? "",
    tenantId: employee?.data.tenantId ?? data.tenantId ?? "group",
  };
}

function validateData(kind: HubKind, input: HubData, records: HubRecord[], accounts: AccountView[], original?: HubRecord) {
  const frozen = kind === "payroll" && original?.data.status === "approved";
  const merged = { ...original?.data, ...input };
  const data = kind === "payroll" ? payrollData(merged, records, frozen) : merged;
  const errors: FieldErrors = {};
  const parsed = HUB_SCHEMAS[kind].safeParse(data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] = issue.message;
  }
  for (const field of HUB_MODULES[kind].fields) {
    const value = String(data[field.key] ?? "");
    if (field.required && !value.trim()) errors[field.key] = "This field is required.";
    if (field.type === "reference" && value) {
      const retained = original?.data[field.key] === value;
      const valid = referenceOptions(field, records, accounts).some((option) => option.value === value);
      if (!retained && !valid) errors[field.key] = "Select an available record.";
    }
  }
  for (const [start, end] of [["startOn", "endOn"], ["startsOn", "endsOn"]]) {
    if (data[start] && data[end] && String(data[end]) < String(data[start])) errors[end] = "End date cannot precede start date.";
  }
  if (kind === "attendance") {
    if (String(data.workOn) > hubToday()) errors.workOn = "Attendance cannot be recorded for a future date.";
    if (data.checkIn && data.checkOut && String(data.checkOut) < String(data.checkIn)) errors.checkOut = "Check-out cannot precede check-in.";
    if (data.status === "absent" && (data.checkIn || data.checkOut)) errors.status = "Absent records cannot have check-in or check-out times.";
    if (original && !String(data.notes ?? "").trim()) errors.notes = "A reason is required when correcting attendance.";
  }
  if (kind === "payroll") {
    if (Number(data.deductions) > Number(data.gross)) errors.deductions = "Deductions cannot exceed gross pay.";
    if (data.status === "approved" && Number(data.gross) <= 0) errors.basic = "Approval requires positive gross pay.";
    if ((!original || original.data.status === "draft") && (data.paymentReference || data.paidOn)) {
      errors.paymentReference = "Draft payroll cannot contain payment details. Approve it first.";
    }
    if (data.status === "paid") {
      if (!String(data.paymentReference ?? "").trim()) errors.paymentReference = "Enter the payment reference.";
      if (!data.paidOn) errors.paidOn = "Enter the payment date.";
      else if (String(data.paidOn) > hubToday()) errors.paidOn = "Payment date cannot be in the future.";
    }
  }
  if (kind === "applications") {
    if (data.status === "hired" && !data.employeeId) errors.employeeId = "Link the hired employee profile first.";
    if (data.status === "interview" && !data.interviewOn) errors.interviewOn = "Enter the interview date.";
  }
  if (kind === "hr_settings") {
    const holidays = String(data.holidays ?? "").split(",").map((date) => date.trim()).filter(Boolean);
    if (holidays.some((date) => !hubDate.safeParse(date).success)) errors.holidays = "Use comma-separated valid YYYY-MM-DD dates.";
    const weekdays = String(data.workingWeekdays ?? "").split(",");
    if (new Set(weekdays).size !== weekdays.length) errors.workingWeekdays = "Working weekdays must be unique.";
  }
  const valid = parsed.success && !Object.keys(errors).length;
  // An approved payslip is a snapshot: even schema normalization must not change its frozen values.
  const result: HubData = parsed.success ? frozen && original ? {
    ...original.data,
    paymentReference: "paymentReference" in parsed.data ? parsed.data.paymentReference : "",
    paidOn: "paidOn" in parsed.data ? parsed.data.paidOn : "",
    notes: "notes" in parsed.data ? parsed.data.notes : "",
    status: data.status,
  } : parsed.data : data;
  return { valid, data: result, errors };
}

function ErrorAlert({ message }: { message: string | null }) {
  return message ? <div role="alert" className="break-words"><Alert tone="danger">{message}</Alert></div> : null;
}

// The shared modal supplies the visual shell; add keyboard containment and focus restoration here.
function AccessibleModal({ title, description, busy = false, onClose, children, footer }: {
  title: string; description?: string; busy?: boolean; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!root.current?.contains(document.activeElement)) root.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  useEffect(() => {
    const close = root.current?.querySelector<HTMLButtonElement>('button[aria-label="Close"]');
    if (close) close.disabled = busy;
  }, [busy]);
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!busy) onClose();
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(root.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
    ) ?? []).filter((element) => element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first) { event.preventDefault(); root.current?.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root.current)) {
      event.preventDefault(); first.focus();
    }
  }
  return (
    <div ref={root} tabIndex={-1} onKeyDown={onKeyDown} aria-busy={busy} className="[&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-50 [&_[role=dialog]>div]:min-w-0 [&_[role=dialog]_h2]:break-words">
      <Modal open title={title} description={description} onClose={() => { if (!busy) onClose(); }} footer={footer}>
        {children}
      </Modal>
    </div>
  );
}

function ConfigFields({ kind, fields, data, setData, records, accounts, busy, frozen = false, errors = {} }: {
  kind: HubKind; fields: HubField[]; data: HubData; setData: (data: HubData) => void;
  records: HubRecord[]; accounts: AccountView[]; busy: boolean; frozen?: boolean; errors?: FieldErrors;
}) {
  const prefix = useId();
  const departments = String(records.find((record) => record.kind === "hr_settings")?.data.departments ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      {fields.map((field) => {
        const awaitingApproval = kind === "payroll" && data.status !== "approved" && ["paymentReference", "paidOn"].includes(field.key);
        const readOnly = (frozen && !PAYMENT_KEYS.has(field.key)) || awaitingApproval;
        const id = `${prefix}-${field.key}`;
        const hint = [field.hint, awaitingApproval ? "Payment details are available after approval." : readOnly ? "Frozen after payroll approval." : "", field.type === "date" ? "Dates use Africa/Kampala." : ""].filter(Boolean).join(" ");
        const shared = {
          id, value: data[field.key] ?? "", required: field.required,
          disabled: busy, "aria-invalid": Boolean(errors[field.key]),
          "aria-describedby": `${hint ? `${id}-hint ` : ""}${errors[field.key] ? `${id}-error` : ""}`.trim() || undefined,
          className: cn("min-w-0 focus:border-royal focus:ring-royal/10", readOnly && "bg-slate-100 text-ink-soft"),
          onChange: (event: { target: { value: string } }) => setData({ ...data, [field.key]: event.target.value }),
        };
        return (
          <Field key={field.key} label={`${field.label}${field.required ? " *" : ""}${readOnly ? " (read-only)" : ""}`} className={cn("min-w-0", field.type === "textarea" && "sm:col-span-2")}>
            {field.type === "textarea" ? <Textarea {...shared} readOnly={readOnly} rows={3} />
              : field.type === "select" || field.type === "reference" ? (
                <Select {...shared} disabled={busy || readOnly} aria-readonly={readOnly || undefined}>
                  {field.type === "reference" ? <option value="">{field.required ? "Select a record" : "Not linked"}</option> : null}
                  {field.type === "reference"
                    ? referenceOptions(field, records, accounts, String(data[field.key] ?? "")).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)
                    : field.options?.map((option) => <option key={option} value={option}>{field.key === "tenantId" ? scopeName(option) : field.key === "reportingDays" ? `${option} days` : humanize(option)}</option>)}
                </Select>
              ) : <Input {...shared} type={field.type} min={field.min} max={field.max} step={field.type === "number" ? 1 : undefined}
                readOnly={readOnly} list={field.key === "department" && departments.length ? `${prefix}-departments` : undefined} />}
            {hint ? <span id={`${id}-hint`} className="block text-[11px] text-ink-mute">{hint}</span> : null}
            {errors[field.key] ? <span id={`${id}-error`} className="block text-xs text-red-700">{errors[field.key]}</span> : null}
          </Field>
        );
      })}
      {departments.length ? <datalist id={`${prefix}-departments`}>{departments.map((department, index) => <option key={`${department}-${index}`} value={department} />)}</datalist> : null}
    </div>
  );
}

function RecordEditor({ kind, record, records, accounts, busy, error, inline = false, onClose, onSave }: {
  kind: HubKind; record?: HubRecord; records: HubRecord[]; accounts: AccountView[]; busy: boolean;
  error: string | null; inline?: boolean; onClose: () => void; onSave: (data: HubData, record?: HubRecord) => Promise<boolean>;
}) {
  const config = HUB_MODULES[kind];
  const [data, setData] = useState<HubData>(() => ({ ...defaultData(kind, records), ...record?.data }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const formId = useId();
  const frozen = kind === "payroll" && record?.data.status === "approved";
  const preview = kind === "payroll" ? payrollData(data, records, frozen) : null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (record && !canEdit(kind, record)) { setErrors({ form: "This record is locked and cannot be edited." }); return; }
    const validation = validateData(kind, data, records, accounts, record);
    setErrors(validation.errors);
    if (validation.valid) await onSave(validation.data, record);
  }
  const submitButton = <Button type="submit" form={formId} disabled={busy} className="bg-royal hover:bg-royal-600">{busy ? "Saving…" : inline ? "Save settings" : record ? "Save changes" : `Create ${config.singular.toLowerCase()}`}</Button>;
  const form = (
    <form id={formId} onSubmit={submit} noValidate aria-busy={busy} className="min-w-0 space-y-4">
      <ErrorAlert message={error} />
      <ErrorAlert message={Object.keys(errors).length ? `Check the form: ${Object.entries(errors).map(([key, message]) => `${fieldLabel(kind, key)} — ${message}`).join(" ")}` : null} />
      {frozen ? <Alert tone="info">Approved payroll values are frozen. Only payment reference, payment date and notes can be edited. Approval does not record payment.</Alert> : null}
      <ConfigFields kind={kind} fields={config.fields} data={data} setData={setData} records={records} accounts={accounts} busy={busy} frozen={frozen} errors={errors} />
      {preview ? <div className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-canvas p-3 text-sm" aria-live="polite">
        <div><p className="text-xs text-ink-soft">Gross pay</p><p className="mt-1 font-semibold text-navy">{ugx.format(Number(preview.gross))}</p></div>
        <div><p className="text-xs text-ink-soft">Net pay</p><p className="mt-1 font-semibold text-navy">{ugx.format(Number(preview.net))}</p></div>
      </div> : null}
      {kind === "leave" ? <p className="text-xs text-ink-soft">Working days and entitlement checks are calculated by the server using HR settings; approval preserves that count.</p> : null}
      {inline ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-xs text-ink-soft">{record ? `Saved · version ${record.version}` : "Not yet saved. Save to create these settings."}</p>{submitButton}
      </div> : null}
    </form>
  );
  return inline ? form : (
    <AccessibleModal title={`${record ? "Edit" : "New"} ${config.singular.toLowerCase()}`} description="Required fields are marked *. Changes are version checked." busy={busy} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>{submitButton}</>}>
      {form}
    </AccessibleModal>
  );
}

function ActionDialog({ kind, record, action, records, accounts, busy, error, onClose, onRun }: {
  kind: HubKind; record: HubRecord; action: HubAction; records: HubRecord[]; accounts: AccountView[];
  busy: boolean; error: string | null; onClose: () => void; onRun: (data: HubData) => Promise<boolean>;
}) {
  const payment = kind === "payroll" && action.to === "paid";
  const hire = kind === "applications" && action.to === "hired";
  const interview = kind === "applications" && action.to === "interview";
  const formId = useId();
  const [data, setData] = useState<HubData>(() => ({ ...record.data, ...(payment && !record.data.paidOn ? { paidOn: hubToday() } : {}) }));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const fields = payment ? HUB_MODULES.payroll.fields.filter((field) => PAYMENT_KEYS.has(field.key))
    .map((field) => ({ ...field, required: field.key !== "notes" }))
    : hire || interview ? HUB_MODULES.applications.fields.filter((field) => field.key === (hire ? "employeeId" : "interviewOn")).map((field) => ({ ...field, required: true })) : [];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!action.from.includes(String(record.data.status))) { setErrors({ form: "This action is not available for the current status." }); return; }
    const validation = validateData(kind, { ...data, status: action.to, ...(action.reason ? { decisionReason: reason.trim() } : {}) }, records, accounts, record);
    if (action.reason && !reason.trim()) validation.errors.decisionReason = "Enter a decision reason.";
    if (reason.trim().length > 500) validation.errors.decisionReason = "Use no more than 500 characters.";
    setErrors(validation.errors);
    if (validation.valid && !Object.keys(validation.errors).length) await onRun(validation.data);
  }
  return (
    <AccessibleModal title={action.label} description={`${humanize(String(record.data.status))} → ${humanize(action.to)}`} busy={busy} onClose={onClose}
      footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" form={formId} disabled={busy} className="bg-royal hover:bg-royal-600">{busy ? "Saving…" : action.label}</Button></>}>
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <ErrorAlert message={error} />
        <ErrorAlert message={Object.keys(errors).length ? Object.entries(errors).map(([key, message]) => `${fieldLabel(kind, key)}: ${message}`).join(" ") : null} />
        <p className="break-words text-sm text-ink-soft">{action.label} for <strong className="text-navy">{record.data.employeeName || record.data.name || record.data.title || displayValue(kind, "employeeId", record.data, records, accounts)}</strong>?</p>
        {payment ? <Alert tone="info">Record an actual payment, not an approval. Confirm its reference and date; salary values remain frozen.</Alert> : null}
        {hire ? <p className="text-xs text-ink-soft">A hire requires an employment profile. <Link href="/team" className="font-semibold text-royal underline">Manage team profiles</Link>. This does not create a sign-in account.</p> : null}
        {fields.length ? <ConfigFields kind={kind} fields={fields} data={data} setData={setData} records={records} accounts={accounts} busy={busy} errors={errors} /> : null}
        {action.reason ? <Field label="Decision reason *" hint="Required; up to 500 characters."><Textarea value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={500} disabled={busy} aria-invalid={Boolean(errors.decisionReason)} rows={3} /></Field> : null}
      </form>
    </AccessibleModal>
  );
}

function printPayslip(element: HTMLElement, onError: (message: string) => void) {
  // A separate document contains only this payslip, never the board or the surrounding application.
  const frame = document.createElement("iframe");
  frame.title = "Printable individual payslip";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;bottom:0;left:0;width:0;height:0;border:0";
  frame.onload = () => {
    try {
      const printWindow = frame.contentWindow;
      if (!printWindow) throw new Error("Print window is unavailable.");
      printWindow.addEventListener("afterprint", () => frame.remove(), { once: true });
      printWindow.focus();
      printWindow.print();
      // Also clean up if a browser does not dispatch afterprint for an embedded document.
      window.setTimeout(() => frame.remove(), 60_000);
    } catch {
      frame.remove();
      onError("Unable to open the payslip print dialog. Please try again.");
    }
  };
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>Individual payslip</title><style>
    @page{size:A4;margin:18mm}body{font:14px Arial,sans-serif;color:#16233b}article{max-width:720px;margin:auto}
    h2{font-size:24px}p{line-height:1.5}table{width:100%;border-collapse:collapse;margin:20px 0}
    th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}td:last-child{text-align:right}
    dl{display:grid;grid-template-columns:1fr 1fr;gap:16px}dt{font-size:12px;color:#555}dd{margin:4px 0;overflow-wrap:anywhere}
    .whitespace-pre-wrap{white-space:pre-wrap}.font-semibold{font-weight:600}.text-right{text-align:right}
  </style></head><body>${element.outerHTML}</body></html>`;
  document.body.appendChild(frame);
}

function DetailsDialog({ kind, record, records, accounts, onClose }: {
  kind: HubKind; record: HubRecord; records: HubRecord[]; accounts: AccountView[]; onClose: () => void;
}) {
  const payslip = useRef<HTMLElement>(null);
  const [error, setError] = useState<string | null>(null);
  const payroll = kind === "payroll";
  const keys = Array.from(new Set([...HUB_MODULES[kind].fields.map((field) => field.key), ...HUB_MODULES[kind].columns, ...Object.keys(record.data)]));
  return (
    <AccessibleModal title={payroll ? "Individual payslip" : HUB_MODULES[kind].singular} onClose={onClose}
      footer={<>{payroll ? <Button variant="secondary" onClick={() => { if (payslip.current) printPayslip(payslip.current, setError); }}><Printer className="h-4 w-4" />Print payslip</Button> : null}<Button onClick={onClose}>Close</Button></>}>
      <ErrorAlert message={error} />
      {payroll ? <article ref={payslip} className="min-w-0 space-y-4 break-words">
        <header><p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">District 12 Group · UGX payslip</p><h2 className="mt-1 text-xl font-semibold text-navy">{String(record.data.employeeName || displayValue(kind, "employeeId", record.data, records, accounts))}</h2></header>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {["period", "tenantId", "status", "paymentReference", "paidOn"].map((key) => <div key={key} className="min-w-0"><dt className="text-xs text-ink-soft">{fieldLabel(kind, key)}</dt><dd className="mt-1 whitespace-pre-wrap">{displayValue(kind, key, record.data, records, accounts)}</dd></div>)}
        </dl>
        <table className="w-full text-sm"><caption className="sr-only">Individual salary amounts in Ugandan shillings</caption><thead><tr><th className="py-2 text-left">Pay item</th><th className="py-2 text-right">Amount (UGX)</th></tr></thead><tbody>
          {["basic", "allowances", "gross", "deductions", "net"].map((key) => <tr key={key} className="border-t border-line"><td className="py-2">{fieldLabel(kind, key)}</td><td className={cn("py-2 text-right", ["gross", "net"].includes(key) && "font-semibold")}>{displayValue(kind, key, record.data, records, accounts)}</td></tr>)}
        </tbody></table>
        {record.data.notes ? <p className="whitespace-pre-wrap text-xs text-ink-soft">Notes: {record.data.notes}</p> : null}
        <p className="text-xs text-ink-soft">{record.data.status === "paid" ? "Payment recorded with the reference and date above." : "This payslip is not proof of payment."} No tax or statutory rate is inferred.</p>
      </article> : <dl className="grid min-w-0 gap-4 sm:grid-cols-2">{keys.map((key) => <div key={key} className="min-w-0"><dt className="text-xs font-semibold text-ink-soft">{fieldLabel(kind, key)}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm text-navy">{displayValue(kind, key, record.data, records, accounts)}</dd></div>)}</dl>}
      <dl className="mt-5 space-y-2 border-t border-line pt-3 text-xs text-ink-soft">
        <div><dt className="inline font-semibold">Version: </dt><dd className="inline">{record.version}</dd></div>
        <div><dt className="inline font-semibold">Created by: </dt><dd className="inline break-words">{accounts.find((account) => account.id === record.createdBy)?.name ?? record.createdBy}</dd></div>
        <div><dt className="inline font-semibold">Created: </dt><dd className="inline">{formatTimestamp(record.createdAt)}</dd></div>
        <div><dt className="inline font-semibold">Updated: </dt><dd className="inline">{formatTimestamp(record.updatedAt)}</dd></div>
      </dl>
    </AccessibleModal>
  );
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("en-GB", { timeZone: "Africa/Kampala" }) + " (Kampala)" : value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseRecord(body: unknown, kind: HubKind): HubRecord | null {
  if (!isObject(body)) return null;
  const value = body.record ?? (isObject(body.data) ? body.data.record ?? body.data : undefined) ?? body;
  if (!isObject(value) || value.kind !== kind || typeof value.id !== "string" || typeof value.version !== "number"
    || !isObject(value.data) || !Object.values(value.data).every((item) => typeof item === "string" || typeof item === "number")
    || typeof value.createdAt !== "string" || typeof value.updatedAt !== "string" || typeof value.createdBy !== "string") return null;
  return value as unknown as HubRecord;
}

function responseError(body: unknown, status: number): string {
  const error = isObject(body) ? body.error : null;
  const message = typeof error === "string" ? error : isObject(error) && typeof error.message === "string" ? error.message : `Request failed (${status}).`;
  return status === 409 ? `${message} The record may have changed; close this dialog and reopen the latest record.` : message;
}

export function WorkflowBoard({ kind, records, accounts, mode }: BoardProps) {
  const config = HUB_MODULES[kind];
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [requestPending, setRequestPending] = useState(false);
  const requestLock = useRef(false);
  const busy = requestPending || refreshing;
  // Local updates belong to a particular props snapshot; refreshed dependencies always take precedence.
  const [local, setLocal] = useState<{ source: HubRecord[]; kind: HubKind; entries: HubRecord[] } | null>(null);
  const entries = useMemo(() => local?.source === records && local.kind === kind ? local.entries : records.filter((record) => record.kind === kind), [kind, records, local]);
  const dependencies = useMemo(() => [...records.filter((record) => record.kind !== kind), ...entries], [kind, records, entries]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [editor, setEditor] = useState<{ record?: HubRecord } | null>(null);
  const [decision, setDecision] = useState<{ record: HubRecord; action: HubAction } | null>(null);
  const [deleting, setDeleting] = useState<HubRecord | null>(null);
  const [detail, setDetail] = useState<HubRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    setEditor(null); setDecision(null); setDeleting(null); setDetail(null);
    setSearch(""); setStatusFilter("all"); setScopeFilter("all"); setError(null); setNotice(null);
  }, [kind]);

  function rowScope(record: HubRecord): string {
    if (record.data.tenantId) return String(record.data.tenantId);
    const employee = dependencies.find((entry) => entry.kind === "employees" && entry.id === record.data.employeeId);
    const vacancy = dependencies.find((entry) => entry.kind === "vacancies" && entry.id === record.data.vacancyId);
    const session = dependencies.find((entry) => entry.kind === "training" && entry.id === record.data.trainingId);
    return String(employee?.data.tenantId ?? vacancy?.data.tenantId ?? session?.data.tenantId ?? "");
  }
  const statuses = Array.from(new Set([
    ...entries.map((record) => String(record.data.status ?? "")).filter(Boolean),
    ...config.fields.find((field) => field.key === "status")?.options ?? [],
    ...config.actions?.flatMap((action) => [...action.from, action.to]) ?? [],
  ]));
  const scopes = Array.from(new Set(["group", ...Object.keys(TENANTS), ...entries.map(rowScope).filter(Boolean)]));
  const hasScope = config.fields.some((field) => field.key === "tenantId" || field.reference === "employees" || field.reference === "vacancies" || field.reference === "training");
  const filtered = entries.filter((record) => {
    if (statusFilter !== "all" && record.data.status !== statusFilter) return false;
    if (scopeFilter !== "all" && rowScope(record) !== scopeFilter) return false;
    const needle = search.trim().toLocaleLowerCase();
    return !needle || Object.keys(record.data).some((key) => displayValue(kind, key, record.data, dependencies, accounts).toLocaleLowerCase().includes(needle));
  });
  const columns = kind === "payroll" ? config.columns.flatMap((key) => key === "net" ? ["gross", key] : [key]) : config.columns;
  const missingRefs = config.fields.filter((field) => field.type === "reference" && field.required && !referenceOptions(field, dependencies, accounts).length);
  const singleton = entries[0];

  async function mutate(method: "POST" | "PATCH" | "DELETE", data?: HubData, record?: HubRecord): Promise<boolean> {
    if (requestLock.current || busy) return false;
    requestLock.current = true;
    setRequestPending(true); setError(null); setNotice(null);
    try {
      if (method !== "POST" && !record) throw new Error("Select a saved record first.");
      if (method === "DELETE" && record && !canDelete(kind, record)) throw new Error("This record cannot be deleted.");
      const response = await fetch(`/api/hub/records/${kind}${record ? `/${encodeURIComponent(record.id)}` : ""}`, {
        method, headers: { "content-type": "application/json" },
        body: JSON.stringify(method === "DELETE" ? { version: record?.version }
          : method === "PATCH" ? { version: record?.version, data: { ...record?.data, ...data } } : { data }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(responseError(body, response.status));
        if (response.status === 409) startRefresh(() => router.refresh());
        return false;
      }
      const saved = responseRecord(body, kind);
      setLocal((current) => {
        const previous = current?.source === records && current.kind === kind ? current.entries : records.filter((entry) => entry.kind === kind);
        return { source: records, kind, entries: method === "DELETE" ? previous.filter((entry) => entry.id !== record?.id)
          : saved ? [saved, ...previous.filter((entry) => entry.id !== saved.id)] : previous };
      });
      setNotice(`${config.singular} ${method === "DELETE" ? "deleted" : "saved"}.`);
      window.dispatchEvent(new Event("d12:workflow-changed"));
      startRefresh(() => router.refresh());
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save. Check your connection and try again.");
      return false;
    } finally {
      requestLock.current = false;
      setRequestPending(false);
    }
  }

  async function save(data: HubData, record?: HubRecord) {
    if (record && !canEdit(kind, record)) { setError("This record is locked and cannot be edited."); return false; }
    const success = await mutate(record ? "PATCH" : "POST", data, record);
    if (success) setEditor(null);
    return success;
  }

  function exportCsv() {
    try {
      const lines = [columns.map((key) => csvCell(fieldLabel(kind, key))).join(","),
        ...filtered.map((record) => columns.map((key) => csvCell(displayValue(kind, key, record.data, dependencies, accounts))).join(","))];
      const url = URL.createObjectURL(new Blob(["\uFEFF", lines.join("\r\n"), "\r\n"], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `${kind}-${hubToday()}.csv`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch { setError("Unable to export CSV in this browser."); }
  }

  function prerequisiteLink(field: HubField) {
    const href = field.reference === "accounts" ? "/hr/employees" : field.reference === "employees" ? "/team"
      : field.reference === "vacancies" ? "/hr/recruitment" : "/hr/training";
    return <Link key={field.key} href={href} className="font-semibold text-royal underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal">{field.reference === "accounts" ? "Manage sign-in accounts" : `Manage ${HUB_MODULES[field.reference as HubKind].title.toLowerCase()}`}</Link>;
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 break-words" aria-busy={busy}>
      <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight text-navy">{config.title}</h1><Badge tone={mode === "demo" ? "warning" : "success"}>{mode === "demo" ? "Demo" : "Supabase"}</Badge></div><p className="mt-1 max-w-3xl text-sm text-ink-soft">{config.description}</p></div>
        {!config.singleton ? <Button disabled={busy || Boolean(missingRefs.length)} className="shrink-0 self-start bg-royal hover:bg-royal-600" onClick={() => { setError(null); setEditor({}); }}><Plus className="h-4 w-4" />Add {config.singular.toLowerCase()}</Button> : null}
      </header>
      {mode === "demo" ? <Alert tone="warning">Demo records persist only during the current server process. A server restart clears them; they are not durable records.</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {!editor && !decision && !deleting && !config.singleton ? <ErrorAlert message={error} /> : null}
      {missingRefs.length ? <Alert tone="info"><p>Add available reference records before creating a {config.singular.toLowerCase()}. Missing: {missingRefs.map((field) => field.label.toLowerCase()).join(", ")}.</p><div className="mt-2 flex flex-wrap gap-3">{missingRefs.map(prerequisiteLink)}</div></Alert> : null}
      {config.singleton ? <Panel title="Saved settings" subtitle={singleton ? `Last saved ${formatTimestamp(singleton.updatedAt)}` : "No settings saved yet. Configure and save below."} className="min-w-0 [&>header]:bg-navy [&>header_h2]:text-white [&>header_p]:text-slate-300">
        <RecordEditor key={`${kind}-${singleton?.id ?? "new"}-${singleton?.version ?? 0}`} kind={kind} record={singleton} records={dependencies} accounts={accounts} busy={busy} error={error} inline onClose={() => {}} onSave={save} />
      </Panel> : <Panel title="Records" subtitle={`${filtered.length} of ${entries.length} records${refreshing ? " · refreshing dependencies…" : ""}`} className="w-full min-w-0 max-w-full [&>header]:bg-navy [&>header_h2]:text-white [&>header_p]:text-slate-300" bodyClassName="min-w-0 p-0">
        <div className="flex min-w-0 flex-col gap-3 border-b border-line p-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 sm:flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" /><Input value={search} onChange={(event) => setSearch(event.target.value)} aria-label={`Search ${config.title.toLowerCase()}`} placeholder="Search records" disabled={busy} className="min-w-0 pl-9 sm:min-w-[180px]" /></div>
          {statuses.length ? <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status" disabled={busy} className="min-w-0 sm:w-40"><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</Select> : null}
          {hasScope ? <Select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)} aria-label="Filter by subsidiary scope" disabled={busy} className="min-w-0 sm:w-48"><option value="all">All subsidiaries</option>{scopes.map((scope) => <option key={scope} value={scope}>{scopeName(scope)}</option>)}</Select> : null}
          <Button variant="secondary" size="sm" disabled={busy || !filtered.length} onClick={exportCsv}><Download className="h-4 w-4" />Export CSV</Button>
        </div>
        {filtered.length ? <TableShell className="relative w-full min-w-0 max-w-full rounded-none border-0 [&>table]:min-w-[980px] [&_th]:whitespace-nowrap [&_td]:py-3">
          <caption className="sr-only">{config.title}; {filtered.length} matching records. Scroll horizontally to see all columns and actions.</caption>
          <thead><tr>{columns.map((key) => <Th key={key} scope="col">{fieldLabel(kind, key)}</Th>)}<Th scope="col" className="text-right">Actions</Th></tr></thead>
          <tbody>{filtered.map((record) => {
            const editable = canEdit(kind, record);
            const availableActions = config.actions?.filter((action) => action.from.includes(String(record.data.status))) ?? [];
            return <tr key={record.id} className={rowClass}>
              {columns.map((key) => <Td key={key} className={cn("max-w-[260px]", kind === "payroll" && MONEY_KEYS.has(key) && "whitespace-nowrap tabular-nums")}>
                {key === "status" ? <Badge tone={["approved", "paid", "done", "active", "completed", "finalized", "hired"].includes(String(record.data.status)) ? "success" : ["rejected", "void", "cancelled", "inactive", "withdrawn"].includes(String(record.data.status)) ? "neutral" : "info"}>{displayValue(kind, key, record.data, dependencies, accounts)}</Badge>
                  : <span className="block truncate" title={displayValue(kind, key, record.data, dependencies, accounts)}>{displayValue(kind, key, record.data, dependencies, accounts)}</span>}
              </Td>)}
              <Td className="w-[320px] min-w-[320px]"><div className="flex flex-wrap items-center justify-end gap-1.5">
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => setDetail(record)}><Eye className="h-3.5 w-3.5" />{kind === "payroll" ? "Payslip" : "Details"}</Button>
                {editable ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setError(null); setEditor({ record }); }}><Pencil className="h-3.5 w-3.5" />{kind === "payroll" && record.data.status === "approved" ? "Payment / notes" : "Edit"}</Button>
                  : <span className="inline-flex items-center gap-1 px-2 text-xs text-ink-mute" title="This status locks editing"><LockKeyhole className="h-3.5 w-3.5" />Read-only</span>}
                {availableActions.map((action) => <Button key={`${action.label}-${action.to}`} size="sm" variant="secondary" disabled={busy} onClick={() => { setError(null); setDecision({ record, action }); }}>{action.label}</Button>)}
                {canDelete(kind, record) ? <Button size="sm" variant="ghost" disabled={busy} className="text-red-600 hover:text-red-700" onClick={() => { setError(null); setDeleting(record); }}><Trash2 className="h-3.5 w-3.5" />Delete</Button> : null}
              </div></Td>
            </tr>;
          })}</tbody>
        </TableShell> : <EmptyState title={entries.length ? "No records match your filters" : `No ${config.title.toLowerCase()} records yet`} description={entries.length ? "Clear search and filters to see saved records." : `No entries have been recorded. ${kind === "attendance" ? "Missing attendance is unrecorded, not absent." : "Create the first record when its prerequisites are available."}`}
          action={entries.length ? <Button variant="secondary" size="sm" disabled={busy} onClick={() => { setSearch(""); setStatusFilter("all"); setScopeFilter("all"); }}>Clear filters</Button> : undefined} />}
        <p className="border-t border-line px-3 py-2 text-[11px] text-ink-mute">{kind === "employees" ? "Employee profiles cannot be deleted; archive them instead. " : ""}CSV exports the filtered records. Wide tables scroll inside this panel.</p>
      </Panel>}
      {editor ? <RecordEditor key={editor.record?.id ?? `new-${kind}`} kind={kind} record={editor.record} records={dependencies} accounts={accounts} busy={busy} error={error} onClose={() => { if (!busy) { setEditor(null); setError(null); } }} onSave={save} /> : null}
      {decision ? <ActionDialog key={`${decision.record.id}-${decision.action.to}`} kind={kind} record={decision.record} action={decision.action} records={dependencies} accounts={accounts} busy={busy} error={error} onClose={() => { if (!busy) { setDecision(null); setError(null); } }} onRun={async (data) => {
        if (!decision.action.from.includes(String(decision.record.data.status))) { setError("This action is no longer available."); return false; }
        const success = await mutate("PATCH", data, decision.record);
        if (success) setDecision(null);
        return success;
      }} /> : null}
      {deleting ? <AccessibleModal title={`Delete ${config.singular.toLowerCase()}`} description="This permanently removes the record. This cannot be undone." busy={busy} onClose={() => { if (!busy) { setDeleting(null); setError(null); } }}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => { setDeleting(null); setError(null); }}>Cancel</Button><Button variant="danger" disabled={busy} onClick={async () => { if (await mutate("DELETE", undefined, deleting)) setDeleting(null); }}><Trash2 className="h-4 w-4" />{busy ? "Deleting…" : "Confirm delete"}</Button></>}>
        <ErrorAlert message={error} /><p className="break-words text-sm text-ink-soft">Delete <strong className="text-navy">{String(deleting.data.name || deleting.data.title || deleting.data.employeeName || displayValue(kind, "employeeId", deleting.data, dependencies, accounts))}</strong>?</p>
      </AccessibleModal> : null}
      {detail ? <DetailsDialog kind={kind} record={detail} records={dependencies} accounts={accounts} onClose={() => setDetail(null)} /> : null}
    </div>
  );
}
