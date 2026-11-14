# District 12 API contracts

All endpoints speak JSON. Authenticated endpoints use the `d12_session`
HttpOnly cookie. Errors share one envelope:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "role is required",
    "details": { "field": "role" }
  }
}
```

| HTTP | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | Body or query fails the zod contract |
| 401 | `UNAUTHORIZED` | Missing, expired or invalid session / signature |
| 403 | `FORBIDDEN` | Valid identity without the required tenant or permission |
| 404 | `NOT_FOUND` | Record, tenant or account does not exist |
| 409 | `CONFLICT` | Duplicate email, duplicate grant, invalid state transition |
| 422 | `SCHEMA_UNSUPPORTED` | Ingest payload `schemaVersion` is not supported |
| 500 | `INTERNAL` | Unhandled failure; details are logged, never returned |

## 1. Hub — authentication

### `POST /api/auth/login`

```json
{ "email": "marvin@district12.co.ug", "password": "anything-in-demo", "next": "/dashboard" }
```

Response `200`:

```json
{
  "ok": true,
  "redirect": "/dashboard",
  "user": { "id": "usr_marvin", "email": "marvin@district12.co.ug", "name": "Marvin" },
  "scope": "group",
  "tenants": ["passito", "mariz", "rub-shoots", "shop-for-me", "expresso-point"]
}
```

For tenant-scoped users `redirect` is the absolute tenant callback URL:

```
http://localhost:3001/auth/callback?token=<jwt>&next=%2F
```

A `next` hint is honoured only when it is a same-origin hub path or a tenant URL
the resolved user can access.

### `GET /api/auth/session`

Returns the session summary or `401`. Used by client components to refresh role
badges after provisioning changes.

```json
{
  "user": { "id": "usr_hr", "email": "hr@district12.co.ug", "name": "HR Desk" },
  "scope": "group",
  "roles": ["hr_admin"],
  "permissions": ["hr.provision", "iam.read", "warehouse.read", "reports.read"],
  "tenants": ["passito", "…"],
  "homeTenant": null,
  "expiresAt": "2026-11-12T21:00:00.000Z"
}
```

### `POST /api/auth/logout`

Clears `d12_session`, returns `{ "ok": true }`.

### `GET /api/auth/handoff?tenant=passito&next=%2Fleads`

Hub-side bridge for opening a workspace from the group dashboard. Requires a
valid session that includes the tenant. Responds `307` to:

```
<tenant app url>/auth/callback?token=<short-lived jwt>&next=%2Fleads
```

`403 FORBIDDEN` when the session does not cover the tenant.

## 2. Hub — HR provisioning

All routes require the `hr.provision` permission (group admin or HR admin) and
write an audit row on every mutation.

### Account object

```json
{
  "id": "usr_9f2c",
  "name": "Brian Ssemakula",
  "email": "brian@passito.ug",
  "role": "manager",
  "roleLabel": "Manager",
  "tenants": ["passito"],
  "status": "active",
  "createdAt": "2026-11-12",
  "lastActive": null
}
```

### `GET /api/hr/accounts`

`200 { "accounts": [Account] }`, sorted by role rank then name.

### `POST /api/hr/accounts`

```json
{
  "name": "Brian Ssemakula",
  "email": "brian@passito.ug",
  "role": "manager",
  "tenants": ["passito"]
}
```

- `role` must exist in `d12_iam_roles`.
- `tenants` is required for tenant-scoped roles and must be non-empty.
- Global roles ignore `tenants` (the response reports all tenants).
- Response `201 { "account": Account }`.
- `409 CONFLICT` when the email already exists.

### `PATCH /api/hr/accounts/:id`

Accepts any subset of `{ name, role, tenants, status }`. Changing `tenants`
replaces the tenant-scoped grants atomically. `status` is `active` or
`suspended`; a suspended account is rejected at login and at tenant middleware.

Response `200 { "account": Account }`.

### `DELETE /api/hr/accounts/:id`

Hard-deletes the account and its grants (audit rows remain). `200 { "ok": true }`.

### `POST /api/hr/accounts/:id/transfer`

Moves a tenant-scoped account from one subsidiary to another.

```json
{ "fromTenantId": "passito", "toTenantId": "mariz" }
```

Returns the updated account. `409 CONFLICT` when the source grant is missing or
the target already exists.

### `GET /api/hr/roles`

`200 { "roles": [{ "id": "manager", "label": "Manager", "scope": "tenant", "rank": 40, "permissions": ["leads.read", "…"] }] }`

## 3. Hub — ingestion

### `POST /api/ingest/v1/events`

Headers:

| Header | Value |
| --- | --- |
| `content-type` | `application/json` |
| `x-d12-tenant` | Tenant id, e.g. `passito` |
| `x-d12-timestamp` | Unix seconds of send time |
| `x-d12-signature` | `v1=<hex HMAC-SHA256(timestamp + "." + tenant + "." + rawBody)>` |

The signature is computed over the **raw request body bytes** exactly as sent,
using the tenant's `D12_TENANT_*_SECRET`. Timestamps older or newer than
`D12_INGEST_MAX_SKEW_SECONDS` (default 300) are rejected.

Body:

```json
{
  "schemaVersion": 1,
  "batchId": "bat_01J9Z5V2K4",
  "tenantId": "passito",
  "sentAt": "2026-11-12T08:31:02.000Z",
  "events": [
    {
      "id": "evt_01J9Z5V2K4",
      "tenantId": "passito",
      "type": "sale.created",
      "entity": "sales",
      "entityId": "sal_01J9Z",
      "occurredAt": "2026-11-12T08:30:00.000Z",
      "data": {
        "id": "sal_01J9Z",
        "tenantId": "passito",
        "occurredOn": "2026-11-12",
        "description": "Q4 launch film — 40% deposit",
        "customerId": "cus_01J9Y",
        "customerName": "Kampala Water",
        "amount": 8400000,
        "status": "paid",
        "channel": "Bank transfer",
        "createdAt": "2026-11-12T08:29:12.000Z",
        "updatedAt": "2026-11-12T08:29:12.000Z"
      }
    }
  ]
}
```

Response `202`:

```json
{
  "ok": true,
  "batchId": "bat_01J9Z5V2K4",
  "accepted": 1,
  "duplicates": 0,
  "rejected": 0,
  "totals": { "events": 1, "batchesToday": 7 }
}
```

- `batchId` is required and is the idempotency key for retries.
- `event.id` must be stable across retries; repeat event ids are counted as
  duplicates and skipped.
- The whole batch is rejected on signature failure, tenant mismatch or schema
  failure (`401` / `403` / `400`).
- Batches over 500 events are rejected with `413 PAYLOAD_TOO_LARGE`.
- Accepted batches refresh `d12_wh_daily_sales` and `d12_wh_daily_activity` for
  the affected days before replying.

### Event types

| `type` | `entity` | Counted in facts as |
| --- | --- | --- |
| `lead.created` / `lead.updated` / `lead.deleted` | `leads` | leads created/won per day |
| `customer.created` / `customer.updated` / `customer.deleted` | `customers` | no fact (raw only) |
| `sale.created` / `sale.updated` / `sale.deleted` | `sales` | paid revenue + transaction count |
| `task.created` / `task.updated` / `task.deleted` | `tasks` | tasks completed per day |

Events are *state deltas*: `*.updated` carries the full record after the change
and `*.deleted` carries the record before deletion (`data` is the last known
row). The warehouse recomputes facts from the latest applicable events so
retries and deletes are safe.

### Signing example (Node)

```js
import { createHmac } from "node:crypto";

const rawBody = JSON.stringify(batch);
const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = createHmac("sha256", process.env.D12_TENANT_PASSITO_SECRET)
  .update(`${timestamp}.passito.${rawBody}`)
  .digest("hex");

await fetch("http://localhost:3100/api/ingest/v1/events", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-d12-tenant": "passito",
    "x-d12-timestamp": timestamp,
    "x-d12-signature": `v1=${signature}`,
  },
  body: rawBody,
});
```

## 4. Tenant — operational CRUD

Base: `http://localhost:3001` (Passito). Every route requires a session that
includes the tenant. Entity is one of `leads`, `customers`, `sales`, `tasks`.

| Method | Route | Body | Response |
| --- | --- | --- | --- |
| `GET` | `/api/ops/:entity?search=&status=` | — | `{ "records": [...] }` |
| `POST` | `/api/ops/:entity` | Record input | `201 { "record": {...} }` |
| `GET` | `/api/ops/:entity/:id` | — | `{ "record": {...} }` |
| `PATCH` | `/api/ops/:entity/:id` | Partial input | `{ "record": {...} }` |
| `DELETE` | `/api/ops/:entity/:id` | — | `{ "ok": true }` |

The server injects `tenantId`, `id`, `createdAt` and `updatedAt`; clients cannot
set them. Invalid enum values or overlong strings fail with `VALIDATION_FAILED`.

Record shapes are defined in `packages/contracts/src/schemas.ts`:

- **Lead** — name, company, email, phone, source, stage (`new|contacted|qualified|won|lost`), value, owner, nextStep.
- **Customer** — name, company, email, phone, tier (`key|growth|standard`), status (`active|dormant`), owner, lifetimeValue, lastOrder.
- **Sale** — occurredOn, description, customerId?, customerName, amount, status (`paid|pending|refunded`), channel.
- **Task** — title, assignee, dueOn, priority (`high|medium|low`), status (`open|in_progress|done`), related.

### `POST /api/telemetry/flush`

Drains up to 50 pending outbox events for the tenant and posts a signed batch to
the hub.

```json
{ "ok": true, "mode": "demo", "sent": 4, "accepted": 4, "duplicates": 0, "batchId": "bat_…" }
```

`mode` is `demo` when the app is running on fixtures and `supabase` when it is
sending the real outbox. The hub response is passed through (`accepted`,
`duplicates`). `502 UPSTREAM_FAILED` when the hub is unreachable; the outbox
leaves events pending with an incremented attempt count.

## 5. Tenant — SSO callback

### `GET /auth/callback?token=<jwt>&next=%2Fleads`

Verifies the token, requires its `tenants` claim to include this app's tenant,
sets `d12_session` on this origin (same options as the hub), then redirects to a
sanitised same-origin `next` (default `/`). Invalid or foreign-tenant tokens
redirect to the hub login with an error hint.

## 6. Health

Every app exposes `GET /api/health`:

```json
{ "ok": true, "app": "passito", "mode": "demo", "version": "1.0.0" }
```

Use it for uptime checks and to confirm which app instance is answering.
