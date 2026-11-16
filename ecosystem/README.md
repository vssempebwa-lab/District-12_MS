# District 12 Ecosystem

A multi-tenant workspace for the District 12 group. It contains a central hub
(unified login, HR provisioning, data warehouse) and five standalone subsidiary
applications that report into it.

The repository root now serves this ecosystem. The retired single-app ERP is
kept only as a reversible archive in `legacy-erp/`; it is not part of any build.

## What is in the box

| App | Tenant id | Dev URL | Purpose |
| --- | --- | --- | --- |
| `apps/hub` | `group` | http://localhost:3100 | SSO gateway, group dashboard, HR provisioning, warehouse, ingestion API |
| `apps/passito` | `passito` | http://localhost:3001 | Reference tenant workspace (Passito Marketing) |
| `apps/mariz` | `mariz` | http://localhost:3002 | Mariz Outsourcing |
| `apps/rub-shoots` | `rub-shoots` | http://localhost:3003 | Rub Shoots Photography |
| `apps/shop-for-me` | `shop-for-me` | http://localhost:3004 | Shop For Me |
| `apps/expresso-point` | `expresso-point` | http://localhost:3005 | Expresso Point |

Shared packages:

| Package | Responsibility |
| --- | --- |
| `packages/contracts` | Tenant registry, zod schemas for ops records and telemetry events, API types |
| `packages/auth` | HS256 session tokens, role/permission model, demo directory, claim helpers |
| `packages/db` | Supabase client factories (browser, server, service role) |
| `packages/ui` | Compact shared primitives and the Tailwind preset |
| `packages/telemetry` | Outbox event building, HMAC signing and delivery client |
| `packages/tenant-workspace` | The entire subsidiary workspace (shell, dashboard, CRUD modules, server data access) |

## Quick start

Prerequisites: Node 18+ and access to the existing root `node_modules` (the
ecosystem initially reuses the hub's installed dependencies).

```bash
# 1. Configure
cd ecosystem
cp .env.example .env.local        # optional for demo mode; demo is the default

# 2. Apply the database schema (see below), or skip it and run on fixtures.

# 3. Run the hub and the reference tenant in separate terminals
npm run dev:hub        # http://localhost:3100
npm run dev:passito    # http://localhost:3001
```

With `D12_DEMO_MODE=true` (the development default) the apps run entirely on
seeded fixtures and an in-memory store. No Supabase project is required to
explore the product. Writes survive until the process restarts. Production
builds default to demo mode off unless `D12_DEMO_MODE=true` is set explicitly.

### Demo accounts

The login page accepts any password for these addresses:

| Email | Role | Scope |
| --- | --- | --- |
| `marvin@district12.co.ug` | Group admin | All subsidiaries, full provisioning |
| `hr@district12.co.ug` | HR admin | All subsidiaries, provisioning only |
| `sarah@passito.ug` | Tenant admin | Passito workspace |
| `joseph@mariz.ug` | Tenant admin | Mariz workspace |
| `patricia@rubshoots.ug` | Tenant admin | Rub Shoots workspace |
| `andrew@shopforme.ug` | Tenant admin | Shop For Me workspace |
| `hadijah@expresso.ug` | Tenant admin | Expresso Point workspace |

Group admins land on the hub dashboard; tenant users are handed off directly to
their workspace. From the hub you can open any subsidiary you have access to.

## Database

The schema is additive: every new table uses the `d12_` prefix and a distinct
name from the tables used by the root app. Apply in order in the Supabase SQL
editor (Dashboard → SQL Editor):

1. `packages/db/sql/001_schema.sql` — tenants, IAM, ops tables, outbox, warehouse, triggers
2. `packages/db/sql/002_rls.sql` — helper functions and tenant-scoped policies
3. `packages/db/sql/003_seed.sql` — tenants, roles, demo accounts and grants

Then link each demo account to a Supabase Auth user. `021_link_seed_auth_users.sql`
fills `d12_iam_users.auth_id` for emails that already exist in `auth.users`, and
`npm run link:seed-users` reports what is still missing (add `--create --apply`
with `D12_SEED_PASSWORD` set to create the remaining accounts). Request claims
are resolved through `auth.uid()`, so RLS works with normal Supabase Auth
sessions.

Set `SUPABASE_SERVICE_ROLE_KEY` to let the hub provision accounts and ingest
events; tenant apps use it server-side as well in this starter (documented in
`docs/architecture.md` as the first hardening item).

## Telemetry and warehouse

Tenant writes enqueue rows in `d12_telemetry_outbox` through database triggers.
A worker (or the "Flush telemetry" button in a tenant workspace) signs a batch
with the tenant secret and posts it to the hub:

```
POST /api/ingest/v1/events
x-d12-tenant: passito
x-d12-timestamp: 1762848000
x-d12-signature: v1=<hex HMAC-SHA256(timestamp + "." + tenant + "." + rawBody)>
```

The hub validates the signature, rejects stale timestamps, stores the batch and
raw events idempotently, then refreshes daily sales/activity facts. The group
dashboard reads those facts. Full contract: `docs/api-contracts.md`.

Each tenant app ships its own outbox worker. It reads `ecosystem/.env.local`,
requires `D12_TELEMETRY_WORKER_TOKEN`, and flushes every
`D12_TELEMETRY_INTERVAL_MS` (default 15s):

```bash
node apps/passito/worker/telemetry.mjs        # http://localhost:3001
node apps/mariz/worker/telemetry.mjs          # http://localhost:3002
node apps/rub-shoots/worker/telemetry.mjs     # http://localhost:3003
node apps/shop-for-me/worker/telemetry.mjs    # http://localhost:3004
node apps/expresso-point/worker/telemetry.mjs # http://localhost:3005
```

Set `D12_TENANT_URL` to point a worker at a deployed app instead of localhost.

## Docs

- [`docs/architecture.md`](docs/architecture.md) — topology, request flows, data model, RLS, production checklist
- [`docs/deployment.md`](docs/deployment.md) — six-site Netlify setup, environment variables, domains and account linking
- [`docs/api-contracts.md`](docs/api-contracts.md) — every endpoint, event schema, signing and retry rules

## Adding another subsidiary

```bash
node scripts/scaffold-tenant.mjs venture-id "Venture Name" 3006
```

The script copies the Passito reference app, rewrites the tenant id, port and
package name, and prints the registry and env keys you still need to add. Then
add a row to `d12_tenants` and create the tenant workspace.

## Production checklist

- Set a long random `D12_SESSION_SECRET` and `D12_COOKIE_DOMAIN=.district12.co.ug`.
- Set `D12_DEMO_MODE=false`; production already defaults to off, and
  `npm run check:deploy` fails a build if demo mode, the session secret,
  Supabase keys or the site URLs are misconfigured.
- Deploy the hub and each subsidiary as its own Netlify site (`docs/deployment.md`)
  and link seeded accounts with `npm run link:seed-users`.
- Give each app its own hostname; keep API routes server-only.
- Stop using the service role from tenant apps: issue tenant-scoped Supabase
  JWTs or call the hub through a tenant gateway instead.
- Set a unique `D12_TENANT_*_SECRET` per tenant and rotate on a schedule.
- Run the outbox worker as a scheduled job (pg_cron, a queue, or a cron host).
- Back up the warehouse facts and raw event tables.
