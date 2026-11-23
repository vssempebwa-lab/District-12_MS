#!/usr/bin/env node
// Wipe operational data and every account except the group administrator.
//
//   node scripts/reset-data.mjs            report what would be deleted
//   node scripts/reset-data.mjs --apply    perform the reset
//
// Keeps: d12_tenants, d12_iam_roles, the usr_marvin IAM row, Marvin's
// group_admin grant, and the matching Supabase Auth user.
// Deletes: every other row in every data table, every other grant and IAM
// user, and every other Supabase Auth user.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "..");
const args = new Set(process.argv.slice(2));

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*)?\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = (match[2] ?? "").trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

for (const dir of [root, repoRoot]) {
  loadEnvFile(path.join(dir, ".env.local"));
  loadEnvFile(path.join(dir, ".env"));
}

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
const serviceKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  ""
).trim();

if (args.has("--help") || args.has("-h")) {
  console.log(
    "Usage: node scripts/reset-data.mjs [--apply]\n" +
      "  --apply  delete the data (without it the script only counts rows)",
  );
  process.exit(0);
}

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const apply = args.has("--apply");
const ADMIN_ID = "usr_marvin";
const ADMIN_EMAIL = "marvin@district12.co.ug";

const client = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init) =>
      fetch(input, { ...init, signal: AbortSignal.timeout(45_000) }),
  },
});

// Ordered so child rows go before the rows they reference.
// d12_hub_records is handled separately: its DELETE privilege is revoked from
// service_role and the version-checked d12_hub_write RPC is the only path.
const TABLES = [
  ["d12_hub_notifications", [{ column: "id", op: "notnull" }]],
  ["d12_iam_audit", [{ column: "id", op: "gt", value: 0 }]],
  ["d12_telemetry_outbox", [{ column: "id", op: "notnull" }]],
  ["d12_wh_events", [{ column: "event_id", op: "notnull" }]],
  ["d12_wh_batches", [{ column: "id", op: "notnull" }]],
  ["d12_wh_daily_sales", [{ column: "day", op: "gte", value: "1900-01-01" }]],
  ["d12_wh_daily_activity", [{ column: "day", op: "gte", value: "1900-01-01" }]],
  ["d12_wh_daily_costs", [{ column: "day", op: "gte", value: "1900-01-01" }]],
  ["d12_shift_records", [{ column: "id", op: "notnull" }]],
  ["d12_reports", [{ column: "id", op: "notnull" }]],
  ["d12_user_profiles", [{ column: "user_id", op: "notnull" }]],
  ["d12_ops_customers", [{ column: "id", op: "notnull" }]],
  ["d12_ops_inventory", [{ column: "id", op: "notnull" }]],
  ["d12_ops_invoices", [{ column: "id", op: "notnull" }]],
  ["d12_ops_leads", [{ column: "id", op: "notnull" }]],
  ["d12_ops_projects", [{ column: "id", op: "notnull" }]],
  ["d12_ops_sales", [{ column: "id", op: "notnull" }]],
  ["d12_ops_staff", [{ column: "id", op: "notnull" }]],
  ["d12_ops_tasks", [{ column: "id", op: "notnull" }]],
  ["d12_ops_transactions", [{ column: "id", op: "notnull" }]],
];

function isMissingTable(error) {
  return error?.code === "PGRST205" || /could not find the table/i.test(error?.message ?? "");
}

function applyFilter(query, filter) {
  if (filter.op === "neq") return query.neq(filter.column, filter.value);
  if (filter.op === "gt") return query.gt(filter.column, filter.value);
  if (filter.op === "eq") return query.eq(filter.column, filter.value);
  if (filter.op === "notnull") return query.not(filter.column, "is", null);
  return query.gte(filter.column, filter.value);
}

async function countRows(table, filters) {
  let query = client.from(table).select("*", { count: "exact", head: true });
  for (const filter of filters) query = applyFilter(query, filter);
  const { count, error } = await query;
  if (error) {
    if (isMissingTable(error)) return null;
    throw new Error(`${table}: ${error.code ?? ""} ${error.message || error.details || "query failed"}`);
  }
  return count ?? 0;
}

async function deleteRows(table, filters) {
  let query = client.from(table).delete({ count: "exact" });
  for (const filter of filters) query = applyFilter(query, filter);
  const { count, error } = await query;
  if (error) {
    if (isMissingTable(error)) return null;
    throw new Error(`${table}: ${error.code ?? ""} ${error.message || error.details || "query failed"}`);
  }
  return count ?? 0;
}

async function readAdmin() {
  const { data: user, error } = await client
    .from("d12_iam_users")
    .select("id, name, email, status, auth_id")
    .eq("id", ADMIN_ID)
    .maybeSingle();
  if (error) throw error;
  if (!user) {
    throw new Error(`The group administrator ${ADMIN_ID} is missing; refusing to reset.`);
  }

  const { data: grants, error: grantError } = await client
    .from("d12_iam_grants")
    .select("id, role_id")
    .eq("user_id", ADMIN_ID);
  if (grantError) throw grantError;

  return { user, grants: grants ?? [] };
}

async function listAuthUsers() {
  const all = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    all.push(...data.users);
    if (data.users.length < 200) break;
  }
  return all;
}

async function clearHubRecords() {
  const { data, error } = await client.from("d12_hub_records").select("id, kind, version");
  if (error) {
    if (isMissingTable(error)) return null;
    throw new Error(
      `d12_hub_records: ${error.code ?? ""} ${error.message || error.details || "query failed"}`,
    );
  }
  if (!apply) return (data ?? []).length;

  let deleted = 0;
  for (const row of data ?? []) {
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const { error: rpcError } = await client.rpc("d12_hub_write", {
        p_operation: "delete",
        p_kind: row.kind,
        p_id: row.id,
        p_version: row.version,
        p_data: null,
        p_actor: ADMIN_ID,
      });
      // A gateway timeout can still land, so a retry may find the row gone.
      if (!rpcError || rpcError.code === "P0002" || /not found/i.test(rpcError.message ?? "")) {
        lastError = null;
        deleted += 1;
        break;
      }
      lastError = rpcError;
      if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (lastError) {
      console.error(`  hub record ${row.id} (${row.kind}) kept: ${lastError.message}`);
    }
  }
  return deleted;
}

async function main() {
  const { user: admin, grants } = await readAdmin();
  const authUsers = await listAuthUsers();

  const keeper =
    authUsers.find((authUser) => authUser.id === admin.auth_id) ??
    authUsers.find((authUser) => (authUser.email ?? "").toLowerCase() === ADMIN_EMAIL);

  console.log(`Project      ${url}`);
  console.log(
    `Mode         ${apply ? "APPLY — rows will be deleted" : "dry run — pass --apply to delete"}`,
  );
  console.log(
    `Keep         ${admin.name} <${admin.email}> (${admin.id})${admin.status === "active" ? "" : " [INACTIVE]"}`,
  );
  console.log(
    `Keep auth    ${keeper ? `${keeper.email} (${keeper.id})` : "NOT FOUND — sign-in will break"}`,
  );
  console.log("");

  const doomedAuth = authUsers.filter((authUser) => authUser.id !== keeper?.id);
  if (args.has("--auth-only")) {
    console.log(`Auth users to delete: ${doomedAuth.length}`);
    for (const authUser of doomedAuth) {
      console.log(`  ${authUser.email ?? authUser.id}`);
      if (!apply) continue;
      const { error } = await client.auth.admin.deleteUser(authUser.id);
      if (error) console.error(`  failed ${authUser.email ?? authUser.id}: ${error.message}`);
    }
    if (!apply) console.log("\nDry run. Re-run with --auth-only --apply to delete them.");
    process.exit(0);
  }

  let total = 0;

  const hubRecords = await clearHubRecords();
  if (hubRecords === null) {
    console.log(`${"d12_hub_records".padEnd(24)} (table not present, skipped)`);
  } else {
    total += hubRecords;
    console.log(`${"d12_hub_records".padEnd(24)} ${apply ? "deleted" : "rows"} ${hubRecords}`);
  }

  for (const [table, filters] of TABLES) {
    const count = apply ? await deleteRows(table, filters) : await countRows(table, filters);
    if (count === null) {
      console.log(`${table.padEnd(24)} (table not present, skipped)`);
      continue;
    }
    total += count;
    console.log(`${table.padEnd(24)} ${apply ? "deleted" : "rows"} ${count}`);
  }

  const otherGrants = apply
    ? await deleteRows("d12_iam_grants", [{ column: "user_id", op: "neq", value: ADMIN_ID }])
    : await countRows("d12_iam_grants", [{ column: "user_id", op: "neq", value: ADMIN_ID }]);
  total += otherGrants ?? 0;
  console.log(`${"d12_iam_grants (others)".padEnd(24)} ${apply ? "deleted" : "rows"} ${otherGrants}`);

  const extraGrantFilters = [
    { column: "user_id", op: "eq", value: ADMIN_ID },
    { column: "role_id", op: "neq", value: "group_admin" },
  ];
  const extraGrants = apply
    ? await deleteRows("d12_iam_grants", extraGrantFilters)
    : await countRows("d12_iam_grants", extraGrantFilters);
  total += extraGrants ?? 0;
  console.log(
    `${"d12_iam_grants (marvin)".padEnd(24)} ${apply ? "deleted" : "rows"} ${extraGrants} (non-admin)`,
  );

  const otherUsers = apply
    ? await deleteRows("d12_iam_users", [{ column: "id", op: "neq", value: ADMIN_ID }])
    : await countRows("d12_iam_users", [{ column: "id", op: "neq", value: ADMIN_ID }]);
  total += otherUsers ?? 0;
  console.log(`${"d12_iam_users (others)".padEnd(24)} ${apply ? "deleted" : "rows"} ${otherUsers}`);

  console.log(
    `${"auth users (others)".padEnd(24)} ${apply ? "deleted" : "rows"} ${doomedAuth.length}`,
  );

  if (!apply) {
    console.log("");
    console.log("Nothing was deleted. Re-run with --apply to reset the project.");
    if (!keeper) {
      console.log(`Warning: no Supabase Auth user found for ${ADMIN_EMAIL}; signing in will fail.`);
    }
    console.log("Note: existing session cookies stay valid up to 12 h after the reset.");
    process.exit(0);
  }

  for (const authUser of doomedAuth) {
    const { error } = await client.auth.admin.deleteUser(authUser.id);
    if (error) {
      console.error(`failed to delete auth user ${authUser.email ?? authUser.id}: ${error.message}`);
    }
  }

  // Guarantee exactly one group_admin grant for the administrator.
  if (!grants.some((grant) => grant.role_id === "group_admin")) {
    const { error } = await client
      .from("d12_iam_grants")
      .insert({
        id: "grt_marvin_group",
        user_id: ADMIN_ID,
        role_id: "group_admin",
        tenant_id: null,
        granted_by: ADMIN_ID,
      });
    if (error) throw error;
  }

  const { data: check } = await client
    .from("d12_iam_users")
    .select("id, email, auth_id")
    .eq("id", ADMIN_ID)
    .maybeSingle();

  console.log("");
  console.log(`Remaining accounts: ${otherUsers === null ? "unknown" : 1}`);
  console.log(
    `Administrator row:  ${check ? `${check.email} (auth ${check.auth_id ?? "not linked"})` : "MISSING"}`,
  );
  console.log(`Deleted rows:       ${total}`);
  console.log("Note: existing session cookies stay valid up to 12 h after the reset.");
  process.exit(0);
}

main().catch((error) => {
  console.error(`Reset failed: ${error.message || error.code || String(error)}`);
  process.exit(1);
});
