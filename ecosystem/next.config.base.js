const fs = require("fs");
const path = require("path");
const { loadEnvConfig } = require("@next/env");

// Each app shares the ecosystem env file. The repository env is the fallback
// so the existing Supabase project stays connected after the legacy UI retires.
// Next has already loaded the app env by now, so only fill in missing keys.
loadEnvConfig(__dirname, process.env.NODE_ENV !== "production");

function loadRepoEnv(dir) {
  for (const name of [".env.local", ".env"]) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)?\s*$/);
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
}

loadRepoEnv(path.resolve(__dirname, ".."));

const packages = path.resolve(__dirname, "packages");

/**
 * Shared Next.js config for every app in the ecosystem.
 * Packages are consumed from source so a single `npm install` at the
 * workspace root is enough to run all six apps.
 */
function createNextConfig(appDir) {
  const appRoot = appDir ?? __dirname;
  return {
    reactStrictMode: true,
    poweredByHeader: false,
    experimental: {
      externalDir: true,
    },
    transpilePackages: [
      "@d12/contracts",
      "@d12/auth",
      "@d12/db",
      "@d12/ui",
      "@d12/telemetry",
      "@d12/tenant-workspace",
    ],
    webpack(config) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@/": `${appRoot}${path.sep}`,
        "@d12/tenant-workspace/server": path.join(packages, "tenant-workspace/src/server.ts"),
        "@d12/tenant-workspace": path.join(packages, "tenant-workspace/src/index.tsx"),
        "@d12/contracts": path.join(packages, "contracts/src/index.ts"),
        "@d12/auth": path.join(packages, "auth/src/index.ts"),
        "@d12/db": path.join(packages, "db/src/index.ts"),
        "@d12/ui": path.join(packages, "ui/src/index.tsx"),
        "@d12/telemetry": path.join(packages, "telemetry/src/index.ts"),
      };
      return config;
    },
  };
}

module.exports = { createNextConfig };
