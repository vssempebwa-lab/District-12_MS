#!/usr/bin/env node
// Link the seeded d12_iam_users rows to Supabase Auth users.
//
//   node scripts/link-seed-users.mjs                     report only
//   node scripts/link-seed-users.mjs --apply             link matching auth users
//   node scripts/link-seed-users.mjs --create --apply    also create missing auth
//                                                       users from D12_SEED_PASSWORD
//
// Creation is opt-in because it writes to Supabase Auth. Never put the password
// on the command line; export D12_SEED_PASSWORD for the run and rotate it after
// the team has signed in once.
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
    "Usage: node scripts/link-seed-users.mjs [--apply] [--create]\n" +
      "  --apply   write links (without it the script only reports)\n" +
      "  --create  create auth users for unlinked rows using D12_SEED_PASSWORD",
  );
  process.exit(0);
}

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const apply = args.has("--apply");
const create = args.has("--create");
const seedPassword = (process.env.D12_SEED_PASSWORD || "").trim();

if (create && seedPassword.length < 12) {
  console.error("D12_SEED_PASSWORD must be set to at least 12 characters when --create is used.");
  process.exit(1);
}

const client = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function listAuthUsers() {
  const byEmail = new Map();
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const user of data.users) {
      if (user.email) byEmail.set(user.email.toLowerCase(), user);
    }
    if (data.users.length < 200) break;
  }
  return byEmail;
}

async function link(row, authId) {
  const { error } = await client
    .from("d12_iam_users")
    .update({ auth_id: authId })
    .eq("id", row.id)
    .is("auth_id", null);
  if (error) throw error;
}

async function main() {
  const { data: rows, error } = await client
    .from("d12_iam_users")
    .select("id, email, name, auth_id, status")
    .order("created_at");
  if (error) throw error;

  const authUsers = await listAuthUsers();
  const unlinked = rows.filter((row) => !row.auth_id);

  console.log(`IAM rows: ${rows.length} · linked: ${rows.length - unlinked.length} · unlinked: ${unlinked.length}`);
  console.log(`Auth users: ${authUsers.size}${apply ? "" : " (dry run — pass --apply to write)"}`);

  let linked = 0;
  let created = 0;
  let failed = 0;

  for (const row of unlinked) {
    const existing = authUsers.get(row.email.toLowerCase());

    if (existing) {
      if (!apply) {
        console.log(`create link  ${row.email} -> ${existing.id}`);
        continue;
      }
      try {
        await link(row, existing.id);
        linked += 1;
        console.log(`linked       ${row.email}`);
      } catch (error) {
        failed += 1;
        console.error(`failed       ${row.email}: ${error.message}`);
      }
      continue;
    }

    if (!create) {
      console.log(`no auth user ${row.email}`);
      continue;
    }

    if (!apply) {
      console.log(`create user  ${row.email}`);
      continue;
    }

    try {
      const { data, error: createError } = await client.auth.admin.createUser({
        email: row.email,
        password: seedPassword,
        email_confirm: true,
      });
      if (createError) throw createError;
      if (!data.user?.id) throw new Error("Supabase returned no user id");
      await link(row, data.user.id);
      created += 1;
      console.log(`created      ${row.email}`);
    } catch (error) {
      failed += 1;
      console.error(`failed       ${row.email}: ${error.message}`);
    }
  }

  if (apply) {
    console.log(`\nLinked ${linked}, created ${created}, failed ${failed}.`);
    console.log("Rotate D12_SEED_PASSWORD once everyone has signed in.");
  }

  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(`Link failed: ${error.message}`);
  process.exit(1);
});
