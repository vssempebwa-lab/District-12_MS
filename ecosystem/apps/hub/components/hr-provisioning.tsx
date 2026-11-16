"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Ban,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  ShieldCheck,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  ROLES,
  TENANT_IDS,
  TENANTS,
  isGlobalRole,
  type AccountStatus,
  type AccountView,
  type RoleId,
  type TenantId,
} from "@d12/contracts";
import {
  Alert,
  Avatar,
  Badge,
  BrandMark,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  Panel,
  Select,
  TableShell,
  Td,
  Th,
  cn,
  rowClass,
} from "@d12/ui";
import { relativeTime } from "@/lib/format";

export interface HrAuditEntry {
  id: string;
  action: string;
  actor: string;
  target: string;
  tenantId: string | null;
  at: string;
  detail?: string;
}

interface EditorState {
  mode: "create" | "edit";
  accountId?: string;
  name: string;
  email: string;
  role: RoleId;
  tenants: TenantId[];
  status: AccountStatus;
  password: string;
}

const ROLE_STYLE: Record<RoleId, string> = {
  group_admin: "bg-violet-100 text-violet-700",
  hr_admin: "bg-pink-100 text-pink-700",
  group_accountant: "bg-emerald-100 text-emerald-700",
  tenant_admin: "bg-blue-100 text-blue-700",
  manager: "bg-indigo-100 text-indigo-700",
  hr_officer: "bg-teal-100 text-teal-700",
  accountant: "bg-cyan-100 text-cyan-700",
  account_executive: "bg-amber-100 text-amber-700",
  employee: "bg-slate-100 text-slate-600",
};

function blankEditor(): EditorState {
  return {
    mode: "create",
    name: "",
    email: "",
    role: "employee",
    tenants: [],
    status: "active",
    password: "",
  };
}

function editorFor(account: AccountView): EditorState {
  return {
    mode: "edit",
    accountId: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    tenants: account.tenants,
    status: account.status,
    password: "",
  };
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;
  return body?.error?.message ?? `Request failed (${response.status})`;
}

export function HrProvisioning({
  initialAccounts,
  initialAudit,
  currentUserId,
  initialTimestamp,
  mode,
  openCreate = false,
  initialSearch = "",
}: {
  initialAccounts: AccountView[];
  initialAudit: HrAuditEntry[];
  currentUserId: string;
  initialTimestamp: number;
  mode: "demo" | "supabase";
  openCreate?: boolean;
  initialSearch?: string;
}) {
  const [timestamp, setTimestamp] = useState(initialTimestamp);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [audit, setAudit] = useState(initialAudit);
  const [search, setSearch] = useState(initialSearch);
  const [roleFilter, setRoleFilter] = useState<"all" | RoleId>("all");
  const [tenantFilter, setTenantFilter] = useState<"all" | TenantId>("all");
  const [editor, setEditor] = useState<EditorState | null>(openCreate ? blankEditor() : null);
  const [transfer, setTransfer] = useState<AccountView | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AccountView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return accounts.filter((account) => {
      if (roleFilter !== "all" && account.role !== roleFilter) return false;
      if (tenantFilter !== "all" && !account.tenants.includes(tenantFilter)) return false;
      if (!needle) return true;
      return (
        account.name.toLowerCase().includes(needle) ||
        account.email.toLowerCase().includes(needle)
      );
    });
  }, [accounts, search, roleFilter, tenantFilter]);

  const counts = useMemo(() => {
    const active = accounts.filter((account) => account.status === "active").length;
    return { total: accounts.length, active, suspended: accounts.length - active };
  }, [accounts]);

  function upsert(account: AccountView): void {
    setAccounts((current) => {
      const index = current.findIndex((item) => item.id === account.id);
      if (index === -1) return [account, ...current];
      const next = [...current];
      next[index] = account;
      return next;
    });
  }

  async function refreshAudit(): Promise<void> {
    const response = await fetch("/api/hr/audit", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const body = (await response.json().catch(() => null)) as { audit?: HrAuditEntry[] } | null;
    if (body?.audit) {
      setAudit(body.audit);
      setTimestamp(Date.now());
    }
  }

  async function saveEditor(state: EditorState): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const payload = {
        name: state.name,
        email: state.email,
        role: state.role,
        tenants: isGlobalRole(state.role) ? [...TENANT_IDS] : state.tenants,
        status: state.status,
        ...(state.password ? { password: state.password } : {}),
      };
      const response = await fetch(
        state.mode === "create" ? "/api/hr/accounts" : `/api/hr/accounts/${state.accountId}`,
        {
          method: state.mode === "create" ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const body = (await response.json()) as { account: AccountView };
      upsert(body.account);
      setEditor(null);
      setNotice(
        state.mode === "create"
          ? `${body.account.name} can now sign in as ${body.account.roleLabel}.`
          : state.password
            ? `${body.account.name} updated · new password set.`
            : `${body.account.name} updated.`,
      );
      await refreshAudit();
    } finally {
      setBusy(false);
    }
  }

  async function patchAccount(account: AccountView, patch: Record<string, unknown>): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/hr/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const body = (await response.json()) as { account: AccountView };
      upsert(body.account);
      setNotice(`${body.account.name} is now ${body.account.status}.`);
      await refreshAudit();
    } finally {
      setBusy(false);
    }
  }

  async function runTransfer(account: AccountView, fromTenantId: TenantId, toTenantId: TenantId): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/hr/accounts/${account.id}/transfer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fromTenantId, toTenantId }),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const body = (await response.json()) as { account: AccountView };
      upsert(body.account);
      setTransfer(null);
      setNotice(
        `${body.account.name} moved from ${TENANTS[fromTenantId].shortName} to ${TENANTS[toTenantId].shortName}.`,
      );
      await refreshAudit();
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount(account: AccountView): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/hr/accounts/${account.id}`, { method: "DELETE" });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      setAccounts((current) => current.filter((item) => item.id !== account.id));
      setConfirmDelete(null);
      setNotice(`${account.name}'s account was deleted.`);
      await refreshAudit();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {mode === "demo" ? (
        <Alert tone="info" className="flex items-start gap-3 rounded-xl border-blue-200 bg-royal-50 px-4 py-3 text-blue-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-royal" />
          <span className="leading-relaxed">
            Directory runs on the in-memory demo store. Provisioned accounts can sign in immediately;
            apply <span className="font-mono">packages/db/sql</span> and set the service-role key to
            persist them.
          </span>
        </Alert>
      ) : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Panel
        title={<span className="flex items-center gap-2.5"><ShieldCheck className="h-5 w-5 text-blue-300" />Directory</span>}
        subtitle={`${counts.active} active · ${counts.suspended} suspended`}
        className="border-0 [&>header]:items-center [&>header]:bg-navy [&>header]:px-5 [&>header]:py-4 [&>header_h2]:text-base [&>header_h2]:text-white [&>header_p]:ml-[30px] [&>header_p]:text-slate-300"
        action={
          <Button
            className="h-10 gap-2 bg-royal px-4 text-sm shadow-sm hover:bg-royal-600 focus-visible:ring-blue-300"
            onClick={() => {
              setError(null);
              setEditor(blankEditor());
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            New account
          </Button>
        }
        bodyClassName="p-0"
      >
        <div className="flex flex-col gap-3 border-b border-line bg-white px-5 py-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email"
              aria-label="Search name or email"
              className="h-10 bg-canvas/50 pl-10 focus:border-royal focus:ring-royal/10"
            />
          </div>
          <Select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as "all" | RoleId)}
            className="h-10 bg-canvas/50 focus:border-royal focus:ring-royal/10 sm:w-44"
            aria-label="Filter by role"
          >
            <option value="all">All roles</option>
            {ROLES.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </Select>
          <Select
            value={tenantFilter}
            onChange={(event) => setTenantFilter(event.target.value as "all" | TenantId)}
            className="h-10 bg-canvas/50 focus:border-royal focus:ring-royal/10 sm:w-44"
            aria-label="Filter by subsidiary"
          >
            <option value="all">All subsidiaries</option>
            {TENANT_IDS.map((id) => (
              <option key={id} value={id}>
                {TENANTS[id].shortName}
              </option>
            ))}
          </Select>
        </div>

        {filtered.length ? (
          <TableShell className="rounded-none border-0 [&>table]:min-w-[920px] [&_th]:bg-canvas [&_th]:py-3 [&_th]:text-[10px] [&_th]:tracking-wider [&_td]:py-3.5">
            <thead>
              <tr>
                <Th>Account</Th>
                <Th>Role</Th>
                <Th>Subsidiaries</Th>
                <Th>Status</Th>
                <Th>Last active</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((account) => {
                const isSelf = account.id === currentUserId;
                const global = isGlobalRole(account.role);
                return (
                  <tr key={account.id} className={rowClass}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={account.name} className="h-9 w-9 bg-royal-50 text-xs text-royal" />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
                            {account.name}
                            {isSelf ? <Badge tone="neutral">you</Badge> : null}
                          </p>
                          <p className="truncate text-[11px] text-ink-mute">{account.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge className={cn("whitespace-nowrap px-2.5 py-1 text-[10px]", ROLE_STYLE[account.role])}>{account.roleLabel}</Badge>
                    </Td>
                    <Td>
                      {global ? (
                        <span className="text-xs text-ink-soft">Group-wide</span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1">
                          {account.tenants.map((id) => (
                            <span key={id} title={TENANTS[id].name}>
                              <BrandMark
                                mark={TENANTS[id].mark}
                                color={TENANTS[id].color}
                                logo={TENANTS[id].logo}
                                alt={`${TENANTS[id].shortName} logo`}
                                size="xs"
                                className="rounded-md"
                              />
                            </span>
                          ))}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={account.status === "active" ? "success" : "warning"} className={cn("gap-1.5 px-2.5 py-1 capitalize", account.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", account.status === "active" ? "bg-emerald-500" : "bg-amber-500")} />
                        {account.status}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-ink-soft">
                      {relativeTime(account.lastActive, timestamp)}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <IconAction
                          label="Edit account"
                          onClick={() => {
                            setError(null);
                            setEditor(editorFor(account));
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </IconAction>
                        <IconAction
                          label={
                            isSelf
                              ? "You cannot suspend your own account"
                              : account.status === "active"
                                ? "Suspend account"
                                : "Reactivate account"
                          }
                          disabled={isSelf || busy}
                          tone={account.status === "active" ? "warning" : "success"}
                          onClick={() =>
                            patchAccount(account, {
                              status: account.status === "active" ? "suspended" : "active",
                            })
                          }
                        >
                          {account.status === "active" ? (
                            <Ban className="h-3.5 w-3.5" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                        </IconAction>
                        <IconAction
                          label={global ? "Global accounts span every subsidiary" : "Transfer subsidiary"}
                          disabled={global || busy}
                          tone="transfer"
                          onClick={() => {
                            setError(null);
                            setTransfer(account);
                          }}
                        >
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                        </IconAction>
                        <IconAction
                          label={isSelf ? "You cannot delete your own account" : "Delete account"}
                          disabled={isSelf || busy}
                          tone="danger"
                          onClick={() => {
                            setError(null);
                            setConfirmDelete(account);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconAction>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        ) : (
          <EmptyState
            title="No accounts match"
            description="Clear the filters or provision a new account."
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("all");
                  setTenantFilter("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel title="Role model" subtitle="Ranks drive routing: 90+ lands in the group hub." bodyClassName="p-0">
          <ul className="divide-y divide-line">
            {ROLES.map((role) => (
              <li key={role.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas font-mono text-[10px] font-semibold text-ink-soft">
                  {role.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                    {role.label}
                    <Badge tone={role.scope === "global" ? "brand" : "neutral"}>{role.scope}</Badge>
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">
                    {role.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Audit trail" subtitle="Latest provisioning actions." bodyClassName="p-0">
          {audit.length ? (
            <ul className="divide-y divide-line">
              {audit.map((entry) => (
                <li key={entry.id} className="px-4 py-2.5">
                  <p className="truncate text-xs font-medium text-ink">
                    <span className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">
                      {entry.action}
                    </span>{" "}
                    {entry.detail ?? entry.target}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-mute">
                    {entry.actor} · {relativeTime(entry.at, timestamp)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No audit entries yet" />
          )}
        </Panel>
      </div>

      {editor ? (
        <AccountEditor
          key={editor.mode === "edit" ? editor.accountId : "create"}
          state={editor}
          busy={busy}
          onClose={() => setEditor(null)}
          onSubmit={saveEditor}
        />
      ) : null}

      {transfer ? (
        <TransferModal
          account={transfer}
          busy={busy}
          onClose={() => setTransfer(null)}
          onSubmit={(from, to) => runTransfer(transfer, from, to)}
        />
      ) : null}

      <Modal
        open={Boolean(confirmDelete)}
        title="Delete account"
        description="This removes the directory account and its subsidiary grants."
        onClose={() => setConfirmDelete(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => confirmDelete && removeAccount(confirmDelete)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete account
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          Delete <span className="font-semibold text-ink">{confirmDelete?.name}</span> (
          {confirmDelete?.email})? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  tone = "default",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "warning" | "success" | "transfer" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal disabled:cursor-not-allowed disabled:opacity-40",
        tone === "default" && "bg-royal-50 text-royal hover:bg-blue-100",
        tone === "warning" && "bg-amber-50 text-amber-600 hover:bg-amber-100",
        tone === "success" && "bg-emerald-50 text-emerald-600 hover:bg-emerald-100",
        tone === "transfer" && "bg-violet-50 text-violet-600 hover:bg-violet-100",
        tone === "danger" && "bg-red-50 text-red-600 hover:bg-red-100",
      )}
    >
      {children}
    </button>
  );
}

function AccountEditor({
  state,
  busy,
  onClose,
  onSubmit,
}: {
  state: EditorState;
  busy: boolean;
  onClose: () => void;
  onSubmit: (state: EditorState) => Promise<void>;
}) {
  const [draft, setDraft] = useState(state);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const global = isGlobalRole(draft.role);
  const canPeek = draft.tenants.includes("mariz");

  function toggleTenant(id: TenantId): void {
    setDraft((current) => ({
      ...current,
      tenants: current.tenants.includes(id)
        ? current.tenants.filter((tenant) => tenant !== id)
        : [...current.tenants, id],
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!draft.name.trim() || !draft.email.trim()) {
      setLocalError("Name and email are required.");
      return;
    }
    if (draft.mode === "create" || draft.password) {
      if (draft.password.length < 8) {
        setLocalError(
          draft.mode === "create"
            ? "Set an initial password of at least 8 characters."
            : "The new password must be at least 8 characters.",
        );
        return;
      }
      if (draft.password !== confirmPassword) {
        setLocalError("The passwords do not match.");
        return;
      }
    }
    if (!global && draft.tenants.length === 0) {
      setLocalError("Select at least one subsidiary for this role.");
      return;
    }
    setLocalError(null);
    await onSubmit(draft);
  }

  return (
    <Modal
      open
      title={draft.mode === "create" ? "Provision account" : `Edit ${draft.name}`}
      description={
        draft.mode === "create"
          ? "Set the password they will sign in with; the role and subsidiaries decide what they can reach."
          : "Roles and subsidiaries decide where this person lands after sign-in. Set a new password only if you need to change it."
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="d12-account-form" disabled={busy} className="bg-royal hover:bg-royal-600">
            <UserPlus className="h-3.5 w-3.5" />
            {draft.mode === "create" ? "Create account" : "Save changes"}
          </Button>
        </>
      }
    >
      <form id="d12-account-form" onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name">
            <Input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="e.g. Sarah Nakato"
              autoFocus
            />
          </Field>
          <Field label="Work email">
            <Input
              type="email"
              value={draft.email}
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
              placeholder="name@district12.co.ug"
            />
          </Field>
          <Field label="Role">
            <Select
              value={draft.role}
              onChange={(event) => {
                const role = event.target.value as RoleId;
                setDraft((current) => ({
                  ...current,
                  role,
                  tenants: isGlobalRole(role) ? [...TENANT_IDS] : current.tenants,
                }));
              }}
            >
              {ROLES.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={draft.status}
              onChange={(event) =>
                setDraft({ ...draft, status: event.target.value as AccountStatus })
              }
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={draft.mode === "create" ? "Initial password" : "New password (optional)"}>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={draft.password}
                onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                placeholder={draft.mode === "create" ? "At least 8 characters" : "Leave blank to keep current"}
                autoComplete="new-password"
                className={canPeek ? "pr-10" : undefined}
              />
              {canPeek ? (
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-mute transition-colors hover:bg-canvas hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              ) : null}
            </div>
          </Field>
          <Field label="Confirm password">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={draft.mode === "create" ? "Repeat the password" : "Repeat the new password"}
                autoComplete="new-password"
                className={canPeek ? "pr-10" : undefined}
              />
              {canPeek ? (
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-mute transition-colors hover:bg-canvas hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              ) : null}
            </div>
          </Field>
          <p className="text-[11px] leading-relaxed text-ink-soft sm:col-span-2">
            {draft.mode === "create"
              ? `Share this password with ${draft.name.trim() || "the new user"} privately. It unlocks only the role and subsidiaries selected above.`
              : `Leave blank to keep ${draft.name.trim() || "their"} current password. If you set one, share it with them privately.`}
            {canPeek ? " Use the eye icon to check it before sharing." : ""}
          </p>
        </div>

        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            Subsidiaries
          </p>
          {global ? (
            <p className="rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-ink-soft">
              Global role — access spans all {TENANT_IDS.length} subsidiaries automatically.
            </p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {TENANT_IDS.map((id) => {
                const meta = TENANTS[id];
                const checked = draft.tenants.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleTenant(id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                      checked
                        ? "border-navy bg-canvas ring-1 ring-navy/20"
                        : "border-line bg-white hover:bg-canvas/60",
                    )}
                    aria-pressed={checked}
                  >
                    <BrandMark
                      mark={meta.mark}
                      color={meta.color}
                      logo={meta.logo}
                      alt={`${meta.shortName} logo`}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-ink">
                        {meta.shortName}
                      </span>
                      <span className="block truncate text-[10px] text-ink-mute">{meta.sector}</span>
                    </span>
                    <span
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 rounded border",
                        checked ? "border-navy bg-navy" : "border-line bg-white",
                      )}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {localError ? <Alert tone="danger">{localError}</Alert> : null}
      </form>
    </Modal>
  );
}

function TransferModal({
  account,
  busy,
  onClose,
  onSubmit,
}: {
  account: AccountView;
  busy: boolean;
  onClose: () => void;
  onSubmit: (from: TenantId, to: TenantId) => Promise<void>;
}) {
  const [from, setFrom] = useState<TenantId>(account.tenants[0] ?? TENANT_IDS[0]);
  const targets = account.tenants.filter((id) => id !== from);
  const [to, setTo] = useState<TenantId | "">(
    TENANT_IDS.find((id) => !account.tenants.includes(id)) ?? "",
  );

  return (
    <Modal
      open
      title="Transfer subsidiary"
      description="Move this account's grant from one subsidiary to another."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            className="bg-royal hover:bg-royal-600"
            disabled={busy || !to}
            onClick={() => {
              if (to) void onSubmit(from, to);
            }}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Transfer
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-ink-soft">
          <span className="font-semibold text-ink">{account.name}</span> is currently in{" "}
          {account.tenants.map((id) => TENANTS[id].shortName).join(", ")}.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From">
            <Select
              value={from}
              onChange={(event) => {
                const value = event.target.value as TenantId;
                setFrom(value);
                if (value === to) setTo("");
              }}
            >
              {account.tenants.map((id) => (
                <option key={id} value={id}>
                  {TENANTS[id].shortName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="To">
            <Select
              value={to}
              onChange={(event) => setTo(event.target.value as TenantId | "")}
            >
              <option value="">Select subsidiary</option>
              {TENANT_IDS.filter((id) => id !== from).map((id) => (
                <option key={id} value={id} disabled={targets.includes(id)}>
                  {TENANTS[id].shortName}
                  {targets.includes(id) ? " (already assigned)" : ""}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
