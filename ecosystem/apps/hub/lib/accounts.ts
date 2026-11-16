import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  createAnonClient,
  createServiceClient,
  hasServiceRoleEnv,
  isFallbackError,
  isSchemaMissingError,
} from "@d12/db";
import type { SessionUser } from "@d12/auth";
import {
  TENANT_IDS,
  isGlobalRole,
  isRoleId,
  isTenantId,
  roleMeta,
  type AccountCreatePayload,
  type AccountStatus,
  type AccountUpdatePayload,
  type AccountView,
  type ApiErrorCode,
  type RoleId,
  type TenantId,
} from "@d12/contracts";
import { newId } from "@d12/telemetry";
import { getStore, pushAudit, todayIso } from "./store";

export class AccountError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AccountError";
  }
}

export const isMissingSchema = isSchemaMissingError;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function passwordMatches(password: string, stored: string): boolean {
  const [salt, digest] = stored.split(":");
  if (!salt || !digest) return false;
  const expected = Buffer.from(digest, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function authEmailTaken(error: { code?: string; message?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return error.code === "email_exists" || message.includes("already been registered");
}

interface GrantRow {
  role_id: string;
  tenant_id: string | null;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  status: AccountStatus;
  created_at: string;
  last_active: string | null;
  d12_iam_grants?: GrantRow[];
}

function uniqueTenants(tenants: string[]): TenantId[] {
  const unique = new Set<TenantId>();
  for (const tenant of tenants) {
    if (isTenantId(tenant)) unique.add(tenant);
  }
  return Array.from(unique);
}

function highestRole(roleIds: string[]): RoleId {
  const valid = roleIds.filter(isRoleId);
  valid.sort((left, right) => (roleMeta(right)?.rank ?? 0) - (roleMeta(left)?.rank ?? 0));
  return valid[0] ?? "employee";
}

function toView(row: UserRow): AccountView {
  const grants = row.d12_iam_grants ?? [];
  const role = highestRole(grants.map((grant) => grant.role_id));
  const tenants = isGlobalRole(role)
    ? [...TENANT_IDS]
    : uniqueTenants(grants.map((grant) => grant.tenant_id ?? ""));
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role,
    roleLabel: roleMeta(role)?.label ?? role,
    tenants,
    status: row.status,
    createdAt: row.created_at,
    lastActive: row.last_active,
  };
}

function sortAccounts(accounts: AccountView[]): AccountView[] {
  return [...accounts].sort((left, right) => {
    const rank = (roleMeta(right.role)?.rank ?? 0) - (roleMeta(left.role)?.rank ?? 0);
    return rank !== 0 ? rank : left.name.localeCompare(right.name);
  });
}

async function listFromDb(): Promise<AccountView[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("d12_iam_users")
    .select("id, name, email, status, created_at, last_active, d12_iam_grants(role_id, tenant_id)")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as UserRow[]).map(toView);
}

export interface AccountList {
  accounts: AccountView[];
  mode: "demo" | "supabase";
}

export async function listAccounts(): Promise<AccountList> {
  if (hasServiceRoleEnv()) {
    try {
      return { accounts: sortAccounts(await listFromDb()), mode: "supabase" };
    } catch (error) {
      if (!isFallbackError(error)) throw error;
    }
  }
  return { accounts: sortAccounts(getStore().accounts), mode: "demo" };
}

export async function findAccount(id: string): Promise<AccountView | null> {
  const { accounts } = await listAccounts();
  return accounts.find((account) => account.id === id) ?? null;
}

function ensureRole(role: string): RoleId {
  if (!isRoleId(role)) throw new AccountError(400, "VALIDATION_FAILED", "Unknown role");
  return role;
}

function resolveTenants(role: RoleId, requested: string[]): TenantId[] {
  if (isGlobalRole(role)) return [...TENANT_IDS];
  const tenants = uniqueTenants(requested);
  if (tenants.length === 0) {
    throw new AccountError(400, "VALIDATION_FAILED", "Select at least one subsidiary for this role");
  }
  return tenants;
}

async function writeAudit(
  action: string,
  actor: string,
  target: string,
  tenantId: string | null,
  detail?: string,
): Promise<void> {
  pushAudit({ action, actor, target, tenantId, detail });
  if (!hasServiceRoleEnv()) return;
  try {
    const service = createServiceClient();
    await service.from("d12_iam_audit").insert({
      actor_id: actor,
      action,
      target_user_id: target,
      tenant_id: tenantId,
      detail: detail ? { message: detail } : {},
    });
  } catch (error) {
    console.error("[d12] audit write failed", error);
  }
}

async function replaceGrants(
  userId: string,
  role: RoleId,
  tenants: TenantId[],
  actor: string,
): Promise<void> {
  const service = createServiceClient();
  const { error: deleteError } = await service
    .from("d12_iam_grants")
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw deleteError;

  const rows: Array<{
    id: string;
    user_id: string;
    role_id: RoleId;
    tenant_id: TenantId | null;
    granted_by: string;
  }> = isGlobalRole(role)
    ? [{ id: newId("grt"), user_id: userId, role_id: role, tenant_id: null, granted_by: actor }]
    : tenants.map((tenant) => ({
        id: newId("grt"),
        user_id: userId,
        role_id: role,
        tenant_id: tenant,
        granted_by: actor,
      }));

  const { error } = await service.from("d12_iam_grants").insert(rows);
  if (error) throw error;
}

function emailTaken(accounts: AccountView[], email: string, exceptId?: string): boolean {
  return accounts.some(
    (account) =>
      account.id !== exceptId && account.email.toLowerCase() === email.trim().toLowerCase(),
  );
}

async function authIdFor(userId: string): Promise<string | null> {
  const service = createServiceClient();
  const { data } = await service
    .from("d12_iam_users")
    .select("auth_id")
    .eq("id", userId)
    .maybeSingle();
  return ((data as { auth_id?: string | null } | null)?.auth_id) ?? null;
}

async function ensureProvisioningAuthority(actorId: string, requestedRole: RoleId, currentRole?: RoleId): Promise<void> {
  const actor = await findAccount(actorId);
  if (!actor || actor.status !== "active" || !["group_admin", "hr_admin"].includes(actor.role)) {
    throw new AccountError(403, "FORBIDDEN", "An active provisioning account is required");
  }
  const rank = roleMeta(actor.role)!.rank;
  if (roleMeta(requestedRole)!.rank > rank || (currentRole && roleMeta(currentRole)!.rank > rank)) {
    throw new AccountError(403, "FORBIDDEN", "Only the group administrator can assign or manage this role");
  }
}

export async function createAccount(
  payload: AccountCreatePayload,
  actor: string,
): Promise<AccountView> {
  const role = ensureRole(payload.role);
  await ensureProvisioningAuthority(actor, role);
  const tenants = resolveTenants(role, payload.tenants);
  const email = payload.email.trim().toLowerCase();
  const name = payload.name.trim();

  if (hasServiceRoleEnv()) {
    try {
      const existing = await listFromDb();
      if (emailTaken(existing, email)) {
        throw new AccountError(409, "CONFLICT", "An account with that email already exists");
      }
      const service = createServiceClient();
      const { data: auth, error: authError } = await service.auth.admin.createUser({
        email,
        password: payload.password,
        email_confirm: true,
        user_metadata: { name },
      });
      if (authError) {
        if (authEmailTaken(authError)) {
          throw new AccountError(409, "CONFLICT", "An account with that email already exists");
        }
        throw authError;
      }
      const authId = auth.user.id;
      const id = newId("usr");
      try {
        const { error } = await service.from("d12_iam_users").insert({
          id,
          auth_id: authId,
          name,
          email,
          status: payload.status,
          created_at: todayIso(),
        });
        if (error) {
          if (error.code === "23505") {
            throw new AccountError(409, "CONFLICT", "An account with that email already exists");
          }
          throw error;
        }
        await replaceGrants(id, role, tenants, actor);
        await writeAudit("account.created", actor, id, tenants[0] ?? null, `${name} · ${role}`);

        const { accounts } = await listAccounts();
        const created = accounts.find((account) => account.id === id);
        if (!created) throw new AccountError(500, "INTERNAL", "Account was created but could not be read");
        return created;
      } catch (error) {
        await service.auth.admin.deleteUser(authId).catch((cleanup) => {
          console.error("[d12] auth cleanup failed", cleanup);
        });
        throw error;
      }
    } catch (error) {
      if (!isFallbackError(error)) throw error;
    }
  }

  const store = getStore();
  if (emailTaken(store.accounts, email)) {
    throw new AccountError(409, "CONFLICT", "An account with that email already exists");
  }
  const account: AccountView = {
    id: newId("usr"),
    name,
    email,
    role,
    roleLabel: roleMeta(role)?.label ?? role,
    tenants,
    status: payload.status,
    createdAt: todayIso(),
    lastActive: null,
  };
  store.accounts.push(account);
  store.passwordHashes[account.id] = hashPassword(payload.password);
  pushAudit({
    action: "account.created",
    actor,
    target: account.id,
    tenantId: tenants[0] ?? null,
    detail: `${name} · ${role}`,
  });
  return account;
}

export async function updateAccount(
  id: string,
  payload: AccountUpdatePayload,
  actor: string,
): Promise<AccountView> {
  const current = await findAccount(id);
  if (!current) throw new AccountError(404, "NOT_FOUND", "Account not found");

  const role = payload.role ? ensureRole(payload.role) : current.role;
  await ensureProvisioningAuthority(actor, role, current.role);
  const tenants = payload.tenants ? resolveTenants(role, payload.tenants) : resolveTenants(role, current.tenants);
  const name = payload.name?.trim() ?? current.name;
  const email = payload.email?.trim().toLowerCase() ?? current.email;
  const status = payload.status ?? current.status;

  if (hasServiceRoleEnv()) {
    try {
      const existing = await listFromDb();
      if (emailTaken(existing, email, id)) {
        throw new AccountError(409, "CONFLICT", "An account with that email already exists");
      }
      const service = createServiceClient();
      const authId = email === current.email ? null : await authIdFor(id);
      if (authId) {
        const { error: authError } = await service.auth.admin.updateUserById(authId, {
          email,
          email_confirm: true,
        });
        if (authError) {
          if (authEmailTaken(authError)) {
            throw new AccountError(409, "CONFLICT", "An account with that email already exists");
          }
          throw authError;
        }
      }
      const { error } = await service
        .from("d12_iam_users")
        .update({ name, email, status })
        .eq("id", id);
      if (error) {
        if (authId) {
          await service.auth.admin
            .updateUserById(authId, { email: current.email, email_confirm: true })
            .catch((revert) => console.error("[d12] auth email revert failed", revert));
        }
        if (error.code === "23505") {
          throw new AccountError(409, "CONFLICT", "An account with that email already exists");
        }
        throw error;
      }
      await replaceGrants(id, role, tenants, actor);
      await writeAudit("account.updated", actor, id, tenants[0] ?? null, `${name} · ${role}`);

      const { accounts } = await listAccounts();
      return accounts.find((account) => account.id === id) ?? { ...current, role, tenants };
    } catch (error) {
      if (!isFallbackError(error)) throw error;
    }
  }

  const store = getStore();
  if (emailTaken(store.accounts, email, id)) {
    throw new AccountError(409, "CONFLICT", "An account with that email already exists");
  }
  const index = store.accounts.findIndex((account) => account.id === id);
  const updated: AccountView = {
    ...current,
    name,
    email,
    role,
    roleLabel: roleMeta(role)?.label ?? role,
    tenants,
    status,
  };
  if (index >= 0) store.accounts[index] = updated;
  pushAudit({
    action: "account.updated",
    actor,
    target: id,
    tenantId: tenants[0] ?? null,
    detail: `${name} · ${role}`,
  });
  return updated;
}

export async function deleteAccount(id: string, actor: string): Promise<void> {
  if (id === actor) {
    throw new AccountError(409, "CONFLICT", "You cannot delete the account you are signed in with");
  }
  const current = await findAccount(id);
  if (!current) throw new AccountError(404, "NOT_FOUND", "Account not found");
  await ensureProvisioningAuthority(actor, current.role, current.role);

  if (hasServiceRoleEnv()) {
    try {
      const service = createServiceClient();
      const authId = await authIdFor(id);
      const { error } = await service.from("d12_iam_users").delete().eq("id", id);
      if (error) throw error;
      await writeAudit("account.deleted", actor, id, current.tenants[0] ?? null, current.email);
      if (authId) {
        await service.auth.admin.deleteUser(authId).catch((cleanup) => {
          console.error("[d12] auth cleanup failed", cleanup);
        });
      }
      return;
    } catch (error) {
      if (!isFallbackError(error)) throw error;
    }
  }

  const store = getStore();
  store.accounts = store.accounts.filter((account) => account.id !== id);
  delete store.passwordHashes[id];
  pushAudit({
    action: "account.deleted",
    actor,
    target: id,
    tenantId: current.tenants[0] ?? null,
    detail: current.email,
  });
}

export async function transferAccount(
  id: string,
  fromTenantId: TenantId,
  toTenantId: TenantId,
  actor: string,
): Promise<AccountView> {
  const current = await findAccount(id);
  if (!current) throw new AccountError(404, "NOT_FOUND", "Account not found");
  if (isGlobalRole(current.role)) {
    throw new AccountError(409, "CONFLICT", "Global accounts are not tied to a single subsidiary");
  }
  if (!current.tenants.includes(fromTenantId)) {
    throw new AccountError(409, "CONFLICT", "The account is not assigned to that subsidiary");
  }
  if (current.tenants.includes(toTenantId)) {
    throw new AccountError(409, "CONFLICT", "The account is already assigned to the target subsidiary");
  }
  const tenants = current.tenants.map((tenant) => (tenant === fromTenantId ? toTenantId : tenant));
  const updated = await updateAccount(id, { tenants }, actor);
  await writeAudit(
    "account.transferred",
    actor,
    id,
    toTenantId,
    `${current.name}: ${fromTenantId} → ${toTenantId}`,
  );
  return updated;
}

export function demoSessionUser(email: string, password = ""): SessionUser | null {
  const store = getStore();
  const account = store.accounts.find(
    (candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase(),
  );
  if (!account || account.status !== "active") return null;
  const stored = store.passwordHashes[account.id];
  if (stored && !passwordMatches(password, stored)) return null;
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    roles: [account.role],
    tenants: account.tenants,
    homeTenant: isGlobalRole(account.role) ? null : (account.tenants[0] ?? null),
  };
}

export async function authenticateSupabase(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const anon = createAnonClient();
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;

  const service = createServiceClient();
  const { data: row, error: rowError } = await service
    .from("d12_iam_users")
    .select("id, name, email, status, d12_iam_grants(role_id, tenant_id)")
    .eq("auth_id", data.user.id)
    .maybeSingle();
  if (rowError) throw rowError;
  if (!row) return null;

  const user = row as unknown as UserRow;
  if (user.status !== "active") return null;

  const grants = user.d12_iam_grants ?? [];
  const roles = Array.from(new Set(grants.map((grant) => grant.role_id).filter(isRoleId)));
  const primary = highestRole(roles);
  const tenants = isGlobalRole(primary)
    ? [...TENANT_IDS]
    : uniqueTenants(grants.map((grant) => grant.tenant_id ?? ""));

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: roles.length ? roles : [primary],
    tenants,
    homeTenant: isGlobalRole(primary) ? null : (tenants[0] ?? null),
  };
}

export interface AuditView {
  id: string;
  action: string;
  actor: string;
  target: string;
  tenantId: string | null;
  at: string;
  detail?: string;
}

export async function listAudit(limit = 8): Promise<AuditView[]> {
  if (hasServiceRoleEnv()) {
    try {
      const service = createServiceClient();
      const { data, error } = await service
        .from("d12_iam_audit")
        .select("id, action, actor_id, target_user_id, tenant_id, created_at, detail")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as unknown as Array<{
        id: number;
        action: string;
        actor_id: string | null;
        target_user_id: string | null;
        tenant_id: string | null;
        created_at: string;
        detail: { message?: string } | null;
      }>).map((row) => ({
        id: String(row.id),
        action: row.action,
        actor: row.actor_id ?? "system",
        target: row.target_user_id ?? "",
        tenantId: row.tenant_id,
        at: row.created_at,
        detail: row.detail?.message,
      }));
    } catch (error) {
      if (!isFallbackError(error)) throw error;
    }
  }
  return getStore().audit.slice(0, limit);
}
