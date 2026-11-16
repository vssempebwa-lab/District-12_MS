# District 12 ecosystem architecture

## 1. Topology

```
                       ┌──────────────────────────────┐
                       │  Hub — apps/hub (:3100)      │
                       │  SSO gateway · HR · warehouse│
                       └──────────┬───────────────────┘
             d12_session cookie   │  ingestion API (HMAC)
        ┌─────────────┬───────────┼───────────┬─────────────┐
        ▼             ▼           ▼           ▼             ▼
   Passito :3001  Mariz :3002  Rub Shoots  Shop For Me  Expresso Point
        └─────────────┴───────────┴───────────┴─────────────┘
             standalone Next apps · own ops CRUD · own outbox
                              │
                              ▼
                 Supabase Postgres (single project)
             tenant rows · RLS · outbox · raw events · facts
```

Each subsidiary is a standalone application. It owns its UI, API routes and
session enforcement. It is *not* a tenant route inside the hub, so one tenant's
deploy, outage or release cadence cannot affect another. All apps share the
same Postgres database; isolation is enforced by `tenant_id` plus RLS.

## 2. Application layers

| Layer | Code | Notes |
| --- | --- | --- |
| Contracts | `packages/contracts` | Single source of truth for tenant ids, record shapes and wire formats |
| Identity | `packages/auth` | JWT create/verify, permission model, demo directory, landing resolution |
| Data | `packages/db` | Supabase client factories and SQL migrations |
| Product | `packages/tenant-workspace` | Shell, dashboard, module pages, server data access, API handlers |
| Delivery | `apps/*` | Thin Next.js wrappers: routes, layouts, middleware, theming |

The five tenant apps are generated from the Passito reference. They import the
same workspace package and differ only in tenant config, port and credentials.
That keeps five apps honest without five copies of the business logic.

## 3. Identity and SSO

### Token

`d12_session` is an HttpOnly, SameSite=Lax cookie holding an HS256 JWT signed
with `D12_SESSION_SECRET`.

```json
{
  "sub": "usr_marvin",
  "email": "marvin@district12.co.ug",
  "name": "Marvin",
  "scope": "group",
  "roles": ["group_admin"],
  "tenants": ["passito", "mariz", "rub-shoots", "shop-for-me", "expresso-point"],
  "permissions": ["*"],
  "homeTenant": null,
  "iss": "district12",
  "iat": 1762848000,
  "exp": 1762891200
}
```

`scope` is `group` when the user holds a global role (rank ≥ 90); otherwise
`tenant`. `tenants` is the resolved set of workspaces the user can enter: all
tenants for group scope, explicit grants for tenant scope.

### Login flow

```
Browser ──POST /api/auth/login──▶ Hub
                                  │ demo: look up seeded account
                                  │ prod: Supabase Auth + d12_iam grants
                                  ▼
                       claims + token
                                  │
        group scope ──────────────┴────────────── tenant scope
             │                                        │
             ▼                                        ▼
     Set d12_session cookie                 302 → tenant /auth/callback?token=…
     redirect /dashboard                    tenant verifies token for its id,
                                            sets its own cookie, redirects home
```

Group admins and HR admins land on `/dashboard`. A tenant user is handed off to
their workspace. Cross-origin handoff uses a short-lived token in the URL; the
callback sets the cookie on the tenant origin and immediately redirects, so the
token never stays in the address bar.

Local development on `localhost` shares cookies across ports, but the handoff
still runs so the production path is exercised every time.

### Tenant enforcement

Each tenant app has `middleware.ts`. It verifies the signature and expiry,
requires `tenants` to include the app's tenant id, and otherwise redirects to
the hub login with `?next=` set to the current URL. API route handlers repeat
the check server-side (`requireTenantSession`); middleware is a UX layer, not
the security boundary.

### Roles

| Role | Scope | Rank | Permissions |
| --- | --- | --- | --- |
| `group_admin` | global | 100 | `*` |
| `hr_admin` | global | 90 | `hr.provision`, `iam.read`, `warehouse.read`, `reports.read` |
| `tenant_admin` | tenant | 60 | `leads.*`, `customers.*`, `sales.*`, `tasks.*`, `telemetry.write`, `reports.read` |
| `manager` | tenant | 40 | `*.read`, `leads.write`, `tasks.write`, `reports.read` |
| `employee` | tenant | 10 | `leads.read`, `customers.read`, `tasks.read` |

Permissions are stored on the role row (`text[]`), so HR can add granular
permissions without a schema change. Grants are additive and can be global
(`tenant_id IS NULL`) or scoped to one tenant.

## 4. Data model

### Global / identity

| Table | Purpose |
| --- | --- |
| `d12_tenants` | Registry mirror of the subsidiaries (name, mark, colour, domain, app URL) |
| `d12_iam_users` | Provisioned accounts; `auth_id` links to `auth.users` for Supabase Auth |
| `d12_iam_roles` | Role catalogue with scope, rank and permission array |
| `d12_iam_grants` | (user, role, tenant?) assignments; one row per grant |
| `d12_iam_audit` | Every provisioning action with actor, target, tenant and detail |

### Tenant operational tables

`d12_ops_leads`, `d12_ops_customers`, `d12_ops_sales`, `d12_ops_tasks`. Every row
carries `tenant_id`; every read and write goes through RLS.

### Telemetry

| Table | Purpose |
| --- | --- |
| `d12_telemetry_outbox` | Local change queue written by triggers; drained by a worker |
| `d12_wh_batches` | One row per accepted ingestion request |
| `d12_wh_events` | Immutable raw events, unique on `event_id` for idempotency |
| `d12_wh_daily_sales` | Daily transactions and revenue per tenant |
| `d12_wh_daily_activity` | Daily leads created/won and tasks completed per tenant |

Facts are recomputed from raw events, never written by tenants. Deleting and
replaying raw events therefore cannot drift the warehouse.

## 5. Telemetry pipeline

```
tenant write ──▶ trigger ──▶ d12_telemetry_outbox (pending)
                                   │
                       worker / flush endpoint
                                   │  sign + POST
                                   ▼
                      hub /api/ingest/v1/events
                       verify HMAC + timestamp
                       insert batch (idempotent)
                       insert raw events (unique event_id)
                       recompute daily facts
                                   │
                                   ▼
                       group warehouse dashboard
```

- Events are immutable facts (`lead.created`, `sale.updated`, …).
- Delivery is at-least-once; idempotency is enforced by `d12_wh_events.event_id`.
- A batch is rejected as a unit if the signature, tenant header or payload
  schema fails. Individual duplicate events are counted and skipped.
- Retries use exponential backoff in the worker; the outbox records attempts
  and the last error for observability.

## 6. RLS model

Helper functions (all `security definer`, stable):

- `d12_is_group_admin()` — the current `auth.uid()` has a global role with rank ≥ 100.
- `d12_has_tenant_access(tenant)` — group admin, or an active user with a grant for that tenant.
- `d12_has_permission(permission, tenant)` — access plus `*` or the permission in the role array.

Policies:

- Ops tables: `select` requires `<entity>.read`, writes require `<entity>.write`
  for `USING` and `WITH CHECK`, so a row can never be moved to a tenant the
  caller cannot write.
- IAM: users can read themselves; `hr.provision` can read and write everything;
  group admin can do anything.
- Warehouse: read requires `warehouse.read`; writes are service-role only.
- Outbox: tenant roles with `telemetry.write` can read; inserts happen in the
  definer trigger, so end users never need insert rights.
- `anon` has no grants on any ecosystem table and no policies.

## 7. Environments

| Concern | Local | Production |
| --- | --- | --- |
| Cookie domain | unset | `.district12.co.ug` |
| Session secret | dev fallback (warning) | 48-byte random secret in a secret manager |
| Login | demo directory | Supabase Auth email/password or SSO |
| Tenant DB access | service role server-side | tenant-scoped JWT / gateway |
| Telemetry secrets | `demo-<tenant>-secret` | unique per tenant, rotated |
| Apps | ports 3001–3005 + 3100 | `passito.district12.co.ug`, `hub.district12.co.ug`, … |

## 8. Production hardening checklist

1. Set `D12_DEMO_MODE=false` (production already defaults to off), provide a
   32+ character `D12_SESSION_SECRET`, and link seeded accounts with
   `021_link_seed_auth_users.sql` or `npm run link:seed-users`. Login then goes
   through Supabase Auth and loads grants by `auth_id`.
2. Stop using the service role inside tenant apps. Either mint Supabase JWTs
   with the user's `sub`/roles for the tenant, or proxy all tenant data through
   a hub gateway. RLS is only meaningful when requests are not privileged.
3. Add a custom access-token hook (or rely on lookup helpers) so database
   policies see the user's grants. The helpers in `002_rls.sql` already resolve
   claims from `auth.uid()` and tables, so no custom claim is required.
4. Enforce HTTPS, `Secure` cookies (automatic when `NODE_ENV=production`), and
   a strict CSP on the hub.
5. Rate-limit `/api/auth/login` and `/api/ingest/v1/events` at the edge.
6. Store per-tenant ingest secrets in a vault and support overlapping secrets
   during rotation (`v1=` accepts any active key).
7. Schedule the outbox worker and alert when `attempts` grows or `pending` is
   older than 15 minutes.
8. Point the hub's warehouse dashboard at materialised facts only; never at raw
   payloads from other tenants.
