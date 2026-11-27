// Renders the hub's transactional emails to local files for review. Sends nothing.
//
//   node apps/hub/scripts/preview-emails.mjs [outDir]
//
// Writes <outDir>/{credentials,sign-in-code,smtp-test}.{html,txt} plus a copy of public/brand so
// the logo loads offline. Default outDir: apps/hub/.email-previews
import { registerHooks } from "node:module";
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Silence the "typeless package.json" notice from loading .ts sources directly.
process.removeAllListeners("warning");

const hubDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(hubDir, "../..");
const outDir = resolve(process.argv[2] ?? resolve(hubDir, ".email-previews"));

// Resolve @d12/* workspace packages and extensionless relative imports to their .ts sources.
registerHooks({
  resolve(specifier, context, next) {
    const pkg = /^@d12\/([^/]+)$/.exec(specifier);
    if (pkg) return { url: pathToFileURL(resolve(root, "packages", pkg[1], "src/index.ts")).href, shortCircuit: true };
    if ((specifier.startsWith(".") || specifier.startsWith("/")) && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      const base = fileURLToPath(new URL(specifier, context.parentURL));
      for (const candidate of [`${base}.ts`, `${base}.tsx`, resolve(base, "index.ts")]) {
        if (existsSync(candidate)) return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
    return next(specifier, context);
  },
});

mkdirSync(outDir, { recursive: true });
cpSync(resolve(hubDir, "public/brand"), resolve(outDir, "brand"), { recursive: true });
// Point absolute asset URLs at the local copy unless a hub URL is set explicitly.
process.env.NEXT_PUBLIC_D12_HUB_URL ??= pathToFileURL(outDir).href;

const { renderCredentialEmail, renderTestEmail, renderTwoFactorEmail } = await import(pathToFileURL(resolve(hubDir, "lib/mail.ts")).href);
const { TENANT_IDS } = await import("@d12/contracts");

const tenantIds = TENANT_IDS.slice(0, 4);
const emails = {
  credentials: renderCredentialEmail({
    name: "Amara Nakato",
    email: "amara.nakato@example.com",
    password: "Qk7#mP2v-Xr9L",
    tenants: tenantIds,
  }),
  "sign-in-code": renderTwoFactorEmail({ name: "Amara Nakato", code: "482913", minutes: 10 }),
  "smtp-test": renderTestEmail({ host: "smtp.example.com", port: 587, from: "no-reply@example.com" }),
};

for (const [name, email] of Object.entries(emails)) {
  writeFileSync(resolve(outDir, `${name}.html`), email.html);
  writeFileSync(resolve(outDir, `${name}.txt`), `Subject: ${email.subject}\n\n${email.text}\n`);
  console.log(`${name}: ${resolve(outDir, `${name}.html`)}`);
}
