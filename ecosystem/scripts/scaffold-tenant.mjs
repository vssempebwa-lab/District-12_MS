#!/usr/bin/env node
// Copies the Passito reference workspace into a new subsidiary app.
// Usage: node scripts/scaffold-tenant.mjs <tenant-id> "<Tenant Name>" <port>

import { cpSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [id, name, portArg] = process.argv.slice(2);

if (!id || !name || !portArg) {
  console.error('Usage: node scripts/scaffold-tenant.mjs <tenant-id> "<Tenant Name>" <port>');
  process.exit(1);
}
if (!/^[a-z][a-z0-9-]{1,30}$/.test(id)) {
  console.error("Tenant id must be lowercase kebab-case, e.g. venture-one");
  process.exit(1);
}
const port = Number(portArg);
if (!Number.isInteger(port) || port < 3000 || port > 3999) {
  console.error("Port must be an integer between 3000 and 3999");
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");
const source = join(root, "apps", "passito");
const target = join(root, "apps", id);

if (existsSync(target)) {
  console.error(`apps/${id} already exists. Remove it first or pick another id.`);
  process.exit(1);
}

cpSync(source, target, {
  recursive: true,
  filter: (path) => !path.includes(`${join("", ".next")}`) && !path.includes("node_modules"),
});

function rewrite(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      rewrite(path);
      continue;
    }
    if (!/\.(ts|tsx|js|mjs|json|css)$/.test(entry)) continue;
    const before = readFileSync(path, "utf8");
    const after = before
      .replaceAll("passito", id)
      .replaceAll("Passito", name);
    if (after !== before) writeFileSync(path, after);
  }
}
rewrite(target);

const pkgPath = join(target, "package.json");
writeFileSync(pkgPath, readFileSync(pkgPath, "utf8").replaceAll("-p 3001", `-p ${port}`));

const envKey = id.toUpperCase().replaceAll("-", "_");
console.log(`\nCreated apps/${id}.\n`);
console.log("Next steps:");
console.log(`1. Add a tenant entry in packages/contracts/src/tenants.ts (id: "${id}", port: ${port}).`);
console.log(`2. Add root scripts in ecosystem/package.json:`);
console.log(`   "dev:${id}": "next dev apps/${id} -p ${port}",`);
console.log(`   "build:${id}": "next build apps/${id}",`);
console.log(`3. Add env keys in ecosystem/.env.local:`);
console.log(`   NEXT_PUBLIC_D12_${envKey}_URL=http://localhost:${port}`);
console.log(`   D12_TENANT_${envKey}_SECRET=`);
console.log(`4. Insert the tenant row via packages/db/sql/003_seed.sql pattern, then grant access through the hub HR page.\n`);
