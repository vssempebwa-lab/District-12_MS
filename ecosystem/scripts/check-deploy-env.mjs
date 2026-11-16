#!/usr/bin/env node
// Preflight for Netlify (and any production) builds. Run as `npm run check:deploy`.
// Starts from process.env, then fills gaps from .env.production[.local] in the
// ecosystem workspace. Development files such as .env.local are ignored.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

loadEnvFile(path.join(root, ".env.production.local"));
loadEnvFile(path.join(root, ".env.production"));

const TENANTS = [
  ["passito", "NEXT_PUBLIC_D12_PASSITO_URL"],
  ["mariz", "NEXT_PUBLIC_D12_MARIZ_URL"],
  ["rub-shoots", "NEXT_PUBLIC_D12_RUB_SHOOTS_URL"],
  ["shop-for-me", "NEXT_PUBLIC_D12_SHOP_FOR_ME_URL"],
  ["expresso-point", "NEXT_PUBLIC_D12_EXPRESSO_POINT_URL"],
];

const DEV_SECRET = "d12-dev-session-secret-change-me";
const COOKIE_DOMAIN_PATTERN = /^\.?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

const errors = [];
const warnings = [];
const ok = [];

function value(name) {
  return process.env[name]?.trim() ?? "";
}

function normalizeDomain(raw) {
  return raw
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .split(/[/?#]/, 1)[0]
    .split(":")[0]
    .replace(/\.$/, "")
    .toLowerCase();
}

// Demo mode -----------------------------------------------------------------
if (value("D12_DEMO_MODE").toLowerCase() === "false") {
  ok.push("D12_DEMO_MODE=false (seeded demo directory disabled)");
} else {
  errors.push(
    `D12_DEMO_MODE must be set to false for production (currently "${value("D12_DEMO_MODE") || "unset"}")`,
  );
}

// Session secret ------------------------------------------------------------
const secret = value("D12_SESSION_SECRET");
if (!secret) {
  errors.push("D12_SESSION_SECRET is missing");
} else if (secret.length < 32) {
  errors.push(`D12_SESSION_SECRET must be at least 32 characters (currently ${secret.length})`);
} else if (secret === DEV_SECRET) {
  errors.push("D12_SESSION_SECRET still uses the development fallback");
} else {
  ok.push("D12_SESSION_SECRET is set and long enough");
}

// Supabase ------------------------------------------------------------------
const supabaseUrl = value("NEXT_PUBLIC_SUPABASE_URL") || value("SUPABASE_URL");
const anonKey = value("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceKey = value("SUPABASE_SERVICE_ROLE_KEY") || value("SUPABASE_SECRET_KEY");

if (!supabaseUrl) {
  errors.push("NEXT_PUBLIC_SUPABASE_URL is missing");
} else if (!/^https:\/\/[a-z0-9-]+\.[a-z0-9.-]+$/i.test(supabaseUrl)) {
  errors.push(`NEXT_PUBLIC_SUPABASE_URL must be an https project URL (got "${supabaseUrl}")`);
} else {
  ok.push("NEXT_PUBLIC_SUPABASE_URL is an https project URL");
}

if (!anonKey) errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");
if (!serviceKey) errors.push("SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) is missing");
if (anonKey && serviceKey && anonKey === serviceKey) {
  errors.push("The anon key and service-role key are identical; the anon key must not be privileged");
}
if (anonKey && serviceKey && anonKey !== serviceKey) {
  ok.push("Supabase anon and service-role keys are both present");
}

// Cookie domain and URLs ----------------------------------------------------
// Preview deployments on separate *.netlify.app hosts cannot share a cookie
// domain (netlify.app is a public suffix), so host-only cookies are allowed
// only when the operator opts in explicitly.
const hostOnlyCookies = value("D12_HOST_ONLY_COOKIES").toLowerCase() === "true";
const rawDomain = hostOnlyCookies ? "" : value("D12_COOKIE_DOMAIN");
const domain = rawDomain ? normalizeDomain(rawDomain) : "";
if (hostOnlyCookies) {
  warnings.push(
    "D12_HOST_ONLY_COOKIES=true: sessions are per-site; sign-in is not shared across apps",
  );
} else if (!rawDomain) {
  errors.push("D12_COOKIE_DOMAIN is missing (use the shared parent domain, e.g. .district12.co.ug)");
} else if (!COOKIE_DOMAIN_PATTERN.test(domain)) {
  errors.push(`D12_COOKIE_DOMAIN "${rawDomain}" is not a valid cookie domain`);
} else {
  ok.push(`D12_COOKIE_DOMAIN is ${domain}`);
}

const hubUrl = value("NEXT_PUBLIC_D12_HUB_URL");
function checkAppUrl(label, name) {
  const raw = value(name);
  if (!raw) {
    errors.push(`${name} is missing (${label})`);
    return;
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    errors.push(`${name} is not a valid URL (got "${raw}")`);
    return;
  }
  if (url.protocol !== "https:") {
    errors.push(`${name} must use https in production (got "${raw}")`);
  }
  if (domain && COOKIE_DOMAIN_PATTERN.test(domain)) {
    const bare = domain.replace(/^\./, "");
    const host = url.hostname.toLowerCase();
    if (host !== bare && !host.endsWith(`.${bare}`)) {
      errors.push(`${name} host "${host}" is outside D12_COOKIE_DOMAIN "${domain}"`);
    }
  }
}

checkAppUrl("hub", "NEXT_PUBLIC_D12_HUB_URL");
for (const [tenant, name] of TENANTS) checkAppUrl(tenant, name);
if (hubUrl && TENANTS.every(([, name]) => value(name))) {
  const urls = [hubUrl, ...TENANTS.map(([, name]) => value(name))];
  if (new Set(urls.map((raw) => raw.replace(/\/$/, ""))).size !== urls.length) {
    errors.push("Hub and subsidiary URLs must all be distinct");
  } else {
    ok.push("Hub and all five subsidiary URLs are distinct");
  }
}

// Optional settings ---------------------------------------------------------
const ttl = value("D12_SESSION_TTL_HOURS");
if (ttl && !(Number.isFinite(Number(ttl)) && Number(ttl) > 0)) {
  warnings.push(`D12_SESSION_TTL_HOURS "${ttl}" is not a positive number; the default of 12 hours will be used`);
}
if (value("NEXT_PUBLIC_D12_HUB_URL").startsWith("http://localhost")) {
  warnings.push("NEXT_PUBLIC_D12_HUB_URL still points at localhost");
}

// Report --------------------------------------------------------------------
for (const line of ok) console.log(`  ok    ${line}`);
for (const line of warnings) console.log(`  warn  ${line}`);
for (const line of errors) console.error(`  fail  ${line}`);

if (errors.length) {
  console.error(`\nDeployment environment is incomplete: ${errors.length} error(s).`);
  process.exit(1);
}
console.log("\nDeployment environment looks ready.");
