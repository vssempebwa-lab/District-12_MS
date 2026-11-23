-- District 12 - full Supabase setup.
-- Generated from ecosystem/packages/db/sql/001_schema.sql through 022_mariz_workspace.sql.
-- Run ONCE, in order, in Dashboard -> SQL Editor. Existing non-d12_* tables are not touched.


-- ===== 001_schema.sql =====

-- District 12 ecosystem schema.
-- Adds multi-tenancy, IAM, operational tables, telemetry and warehouse tables.
-- Additive only: existing d12_* tables from the root app are not touched.
-- Apply in the Supabase SQL editor before 002_rls.sql and 003_seed.sql.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------------------
create table if not exists public.d12_tenants (
  id text primary key,
  name text not null,
  short_name text not null,
  sector text not null,
  mark text not null,
  color text not null,
  tagline text,
  managing_director text,
  domain text,
  app_url text,
  port integer,
  status text not null default 'active' check (status in ('active', 'review')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- IAM: accounts, roles, grants, audit
-- ---------------------------------------------------------------------------
create table if not exists public.d12_iam_users (
  id text primary key,
  auth_id uuid unique references auth.users (id) on delete set null,
  name text not null,
  email text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at date not null default current_date,
  last_active date
);
create unique index if not exists d12_iam_users_email_key
  on public.d12_iam_users (lower(email));

create table if not exists public.d12_iam_roles (
  id text primary key,
  label text not null,
  scope text not null check (scope in ('global', 'tenant')),
  rank integer not null default 0,
  permissions text[] not null default '{}',
  description text
);

create table if not exists public.d12_iam_grants (
  id text primary key default ('grt_' || replace(gen_random_uuid()::text, '-', '')),
  user_id text not null references public.d12_iam_users (id) on delete cascade,
  role_id text not null references public.d12_iam_roles (id) on delete restrict,
  -- null = global grant (applies to every tenant)
  tenant_id text references public.d12_tenants (id) on delete cascade,
  granted_by text,
  granted_at timestamptz not null default now()
);
create unique index if not exists d12_iam_grants_unique
  on public.d12_iam_grants (user_id, role_id, coalesce(tenant_id, '*'));
create index if not exists d12_iam_grants_user_idx on public.d12_iam_grants (user_id);
create index if not exists d12_iam_grants_tenant_idx on public.d12_iam_grants (tenant_id);

create table if not exists public.d12_iam_audit (
  id bigserial primary key,
  actor_id text,
  action text not null,
  target_user_id text,
  tenant_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists d12_iam_audit_created_idx on public.d12_iam_audit (created_at desc);

-- A grant must match the role's scope: global roles are unscoped, tenant
-- roles always carry a tenant.
create or replace function public.d12_validate_grant()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_scope text;
begin
  select scope into v_scope from public.d12_iam_roles where id = new.role_id;
  if v_scope is null then
    raise exception 'unknown role %', new.role_id;
  end if;
  if v_scope = 'global' and new.tenant_id is not null then
    raise exception 'global role % cannot be tenant-scoped', new.role_id;
  end if;
  if v_scope = 'tenant' and new.tenant_id is null then
    raise exception 'tenant role % requires a tenant_id', new.role_id;
  end if;
  return new;
end;
$$;

drop trigger if exists d12_iam_grants_validate on public.d12_iam_grants;
create trigger d12_iam_grants_validate
before insert or update on public.d12_iam_grants
for each row execute function public.d12_validate_grant();

-- ---------------------------------------------------------------------------
-- Tenant operational tables
-- Every row is owned by exactly one tenant. RLS policies live in 002_rls.sql.
-- ---------------------------------------------------------------------------
create table if not exists public.d12_ops_leads (
  id text primary key,
  tenant_id text not null references public.d12_tenants (id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  source text,
  stage text not null default 'new' check (stage in ('new', 'contacted', 'qualified', 'won', 'lost')),
  value numeric(16, 2) not null default 0,
  owner text,
  next_step text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists d12_ops_leads_tenant_idx on public.d12_ops_leads (tenant_id, updated_at desc);

create table if not exists public.d12_ops_customers (
  id text primary key,
  tenant_id text not null references public.d12_tenants (id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  tier text not null default 'standard' check (tier in ('key', 'growth', 'standard')),
  status text not null default 'active' check (status in ('active', 'dormant')),
  owner text,
  lifetime_value numeric(16, 2) not null default 0,
  last_order date,
  paid_total numeric(16, 2) not null default 0,
  last_payment_on date,
  last_payment_by text not null default '',
  last_payment_by_email text not null default '',
  registration_number text not null default '',
  clinic text not null default '',
  program_session text not null default '',
  cohort text not null default '',
  start_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists d12_ops_customers_tenant_idx on public.d12_ops_customers (tenant_id, name);

create table if not exists public.d12_ops_sales (
  id text primary key,
  tenant_id text not null references public.d12_tenants (id) on delete cascade,
  occurred_on date not null,
  description text not null,
  customer_id text,
  customer_name text,
  customer_phone text not null default '',
  customer_email text not null default '',
  amount numeric(16, 2) not null default 0,
  status text not null default 'pending' check (status in ('paid', 'pending', 'refunded')),
  channel text,
  owner text not null default '',
  payment_type text not null default 'full' check (payment_type in ('full', 'partial')),
  collected_by text not null default '',
  collected_by_email text not null default '',
  agreed_value numeric(16, 2) not null default 0,
  balance_after numeric(16, 2) not null default 0,
  installment_no integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists d12_ops_sales_tenant_idx on public.d12_ops_sales (tenant_id, occurred_on desc);

create table if not exists public.d12_ops_tasks (
  id text primary key,
  tenant_id text not null references public.d12_tenants (id) on delete cascade,
  title text not null,
  assignee text,
  due_on date,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'done')),
  related text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists d12_ops_tasks_tenant_idx on public.d12_ops_tasks (tenant_id, due_on);

create or replace function public.d12_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists d12_ops_leads_touch on public.d12_ops_leads;
create trigger d12_ops_leads_touch before update on public.d12_ops_leads
for each row execute function public.d12_touch_updated_at();

drop trigger if exists d12_ops_customers_touch on public.d12_ops_customers;
create trigger d12_ops_customers_touch before update on public.d12_ops_customers
for each row execute function public.d12_touch_updated_at();

drop trigger if exists d12_ops_sales_touch on public.d12_ops_sales;
create trigger d12_ops_sales_touch before update on public.d12_ops_sales
for each row execute function public.d12_touch_updated_at();

drop trigger if exists d12_ops_tasks_touch on public.d12_ops_tasks;
create trigger d12_ops_tasks_touch before update on public.d12_ops_tasks
for each row execute function public.d12_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Telemetry outbox
-- Payload records are snake_case copies of the row; the delivery worker
-- camelizes them to match the public event contract before signing.
-- ---------------------------------------------------------------------------
create table if not exists public.d12_telemetry_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.d12_tenants (id) on delete cascade,
  event_id text not null unique,
  event_type text not null,
  entity text not null,
  entity_id text not null,
  payload jsonb not null,
  occurred_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists d12_telemetry_outbox_pending_idx
  on public.d12_telemetry_outbox (tenant_id, created_at)
  where status in ('pending', 'failed');

create or replace function public.d12_enqueue_ops_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_op text := case lower(tg_op)
    when 'insert' then 'created'
    when 'update' then 'updated'
    when 'delete' then 'deleted'
    else lower(tg_op)
  end;
  v_entity text;
  v_type text;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  v_entity := case tg_table_name
    when 'd12_ops_leads' then 'leads'
    when 'd12_ops_customers' then 'customers'
    when 'd12_ops_sales' then 'sales'
    when 'd12_ops_tasks' then 'tasks'
  end;

  v_type := (case v_entity
    when 'leads' then 'lead'
    when 'customers' then 'customer'
    when 'sales' then 'sale'
    when 'tasks' then 'task'
  end) || '.' || v_op;

  insert into public.d12_telemetry_outbox
    (tenant_id, event_id, event_type, entity, entity_id, payload, occurred_at)
  values
    (v_row ->> 'tenant_id',
     'evt_' || replace(gen_random_uuid()::text, '-', ''),
     v_type,
     v_entity,
     v_row ->> 'id',
     jsonb_build_object('op', tg_op, 'record', v_row),
     now());

  return coalesce(new, old);
end;
$$;

drop trigger if exists d12_ops_leads_enqueue on public.d12_ops_leads;
create trigger d12_ops_leads_enqueue after insert or update or delete on public.d12_ops_leads
for each row execute function public.d12_enqueue_ops_event();

drop trigger if exists d12_ops_customers_enqueue on public.d12_ops_customers;
create trigger d12_ops_customers_enqueue after insert or update or delete on public.d12_ops_customers
for each row execute function public.d12_enqueue_ops_event();

drop trigger if exists d12_ops_sales_enqueue on public.d12_ops_sales;
create trigger d12_ops_sales_enqueue after insert or update or delete on public.d12_ops_sales
for each row execute function public.d12_enqueue_ops_event();

drop trigger if exists d12_ops_tasks_enqueue on public.d12_ops_tasks;
create trigger d12_ops_tasks_enqueue after insert or update or delete on public.d12_ops_tasks
for each row execute function public.d12_enqueue_ops_event();

-- ---------------------------------------------------------------------------
-- Central warehouse
-- ---------------------------------------------------------------------------
create table if not exists public.d12_wh_batches (
  id text primary key,
  tenant_id text not null references public.d12_tenants (id) on delete cascade,
  signature_verified boolean not null default true,
  event_count integer not null default 0,
  accepted integer not null default 0,
  duplicates integer not null default 0,
  source_ip inet,
  received_at timestamptz not null default now()
);
create index if not exists d12_wh_batches_tenant_idx on public.d12_wh_batches (tenant_id, received_at desc);

create table if not exists public.d12_wh_events (
  event_id text primary key,
  tenant_id text not null references public.d12_tenants (id) on delete cascade,
  batch_id text not null references public.d12_wh_batches (id) on delete cascade,
  event_type text not null,
  entity text not null,
  entity_id text not null,
  occurred_at timestamptz not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
create index if not exists d12_wh_events_tenant_idx
  on public.d12_wh_events (tenant_id, occurred_at desc);
create index if not exists d12_wh_events_entity_idx
  on public.d12_wh_events (tenant_id, entity, entity_id, occurred_at desc);

create table if not exists public.d12_wh_daily_sales (
  tenant_id text not null references public.d12_tenants (id) on delete cascade,
  day date not null,
  transactions integer not null default 0,
  revenue numeric(16, 2) not null default 0,
  primary key (tenant_id, day)
);

create table if not exists public.d12_wh_daily_activity (
  tenant_id text not null references public.d12_tenants (id) on delete cascade,
  day date not null,
  leads_created integer not null default 0,
  leads_won integer not null default 0,
  tasks_completed integer not null default 0,
  primary key (tenant_id, day)
);

-- Recompute one tenant-day of facts from the latest known state of each row.
-- Raw events stay immutable; facts are derived and safe to rebuild.
create or replace function public.d12_wh_refresh_facts(p_tenant text, p_day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := (p_day::timestamp) at time zone 'Africa/Kampala';
  v_end timestamptz := ((p_day + 1)::timestamp) at time zone 'Africa/Kampala';
begin
  delete from public.d12_wh_daily_sales where tenant_id = p_tenant and day = p_day;
  insert into public.d12_wh_daily_sales (tenant_id, day, transactions, revenue)
  select p_tenant,
         p_day,
         count(*),
         coalesce(sum(coalesce(data ->> 'amount', '0')::numeric), 0)
  from (
    select distinct on (entity_id)
           entity_id,
           event_type,
           payload -> 'data' as data
    from public.d12_wh_events
    where tenant_id = p_tenant
      and entity = 'sales'
      and occurred_at < v_end
    order by entity_id, occurred_at desc
  ) latest
  where latest.event_type <> 'sale.deleted'
    and coalesce(data ->> 'status', '') = 'paid'
    and coalesce(data ->> 'occurredOn', data ->> 'occurred_on')::date = p_day;

  delete from public.d12_wh_daily_activity where tenant_id = p_tenant and day = p_day;
  insert into public.d12_wh_daily_activity (tenant_id, day, leads_created, leads_won, tasks_completed)
  select p_tenant,
         p_day,
         (
           select count(*)
           from public.d12_wh_events e
           where e.tenant_id = p_tenant
             and e.event_type = 'lead.created'
             and e.occurred_at >= v_start and e.occurred_at < v_end
         ),
         (
           select count(*)
           from (
             select distinct on (entity_id) entity_id, event_type, payload -> 'data' as data
             from public.d12_wh_events
             where tenant_id = p_tenant and entity = 'leads' and occurred_at < v_end
             order by entity_id, occurred_at desc
           ) latest
           where latest.event_type <> 'lead.deleted'
             and coalesce(data ->> 'stage', '') = 'won'
             and coalesce(data ->> 'updatedAt', data ->> 'updated_at')::date = p_day
         ),
         (
           select count(*)
           from (
             select distinct on (entity_id) entity_id, event_type, payload -> 'data' as data
             from public.d12_wh_events
             where tenant_id = p_tenant and entity = 'tasks' and occurred_at < v_end
             order by entity_id, occurred_at desc
           ) latest
           where latest.event_type <> 'task.deleted'
             and coalesce(data ->> 'status', '') = 'done'
             and coalesce(data ->> 'updatedAt', data ->> 'updated_at')::date = p_day
         );
end;
$$;

notify pgrst, 'reload schema';

-- ===== 002_rls.sql =====

-- Row level security for the District 12 ecosystem.
-- Depends on 001_schema.sql. Identity comes from Supabase Auth (auth.uid()).
-- The service role bypasses RLS and is the only writer to warehouse tables.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.d12_is_group_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.d12_iam_users u
    join public.d12_iam_grants g on g.user_id = u.id
    join public.d12_iam_roles r on r.id = g.role_id
    where u.auth_id = auth.uid()
      and u.status = 'active'
      and r.scope = 'global'
      and r.rank >= 100
  );
$$;

create or replace function public.d12_has_tenant_access(p_tenant text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.d12_is_group_admin() or exists (
    select 1
    from public.d12_iam_users u
    join public.d12_iam_grants g on g.user_id = u.id
    where u.auth_id = auth.uid()
      and u.status = 'active'
      and (g.tenant_id is null or g.tenant_id = p_tenant)
  );
$$;

-- p_tenant null asks for a global permission; tenant grants never match.
create or replace function public.d12_has_permission(p_permission text, p_tenant text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.d12_iam_users u
    join public.d12_iam_grants g on g.user_id = u.id
    join public.d12_iam_roles r on r.id = g.role_id
    where u.auth_id = auth.uid()
      and u.status = 'active'
      and (
        (g.tenant_id is null and r.scope = 'global')
        or (g.tenant_id = p_tenant)
      )
      and ('*' = any(r.permissions) or p_permission = any(r.permissions))
  );
$$;

create or replace function public.d12_has_global_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.d12_iam_users u
    join public.d12_iam_grants g on g.user_id = u.id
    join public.d12_iam_roles r on r.id = g.role_id
    where u.auth_id = auth.uid()
      and u.status = 'active'
      and g.tenant_id is null
      and ('*' = any(r.permissions) or p_permission = any(r.permissions))
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.d12_tenants enable row level security;
alter table public.d12_iam_users enable row level security;
alter table public.d12_iam_roles enable row level security;
alter table public.d12_iam_grants enable row level security;
alter table public.d12_iam_audit enable row level security;
alter table public.d12_ops_leads enable row level security;
alter table public.d12_ops_customers enable row level security;
alter table public.d12_ops_sales enable row level security;
alter table public.d12_ops_tasks enable row level security;
alter table public.d12_telemetry_outbox enable row level security;
alter table public.d12_wh_batches enable row level security;
alter table public.d12_wh_events enable row level security;
alter table public.d12_wh_daily_sales enable row level security;
alter table public.d12_wh_daily_activity enable row level security;

-- ---------------------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------------------
drop policy if exists "d12 tenants read" on public.d12_tenants;
create policy "d12 tenants read" on public.d12_tenants
  for select to authenticated
  using (public.d12_has_tenant_access(id) or public.d12_has_global_permission('iam.read'));

drop policy if exists "d12 tenants admin" on public.d12_tenants;
create policy "d12 tenants admin" on public.d12_tenants
  for all to authenticated
  using (public.d12_is_group_admin())
  with check (public.d12_is_group_admin());

-- ---------------------------------------------------------------------------
-- IAM
-- ---------------------------------------------------------------------------
drop policy if exists "d12 iam users read" on public.d12_iam_users;
create policy "d12 iam users read" on public.d12_iam_users
  for select to authenticated
  using (
    auth_id = auth.uid()
    or public.d12_has_global_permission('iam.read')
    or public.d12_has_global_permission('hr.provision')
  );

drop policy if exists "d12 iam users provision" on public.d12_iam_users;
create policy "d12 iam users provision" on public.d12_iam_users
  for all to authenticated
  using (public.d12_has_global_permission('hr.provision'))
  with check (public.d12_has_global_permission('hr.provision'));

drop policy if exists "d12 iam roles read" on public.d12_iam_roles;
create policy "d12 iam roles read" on public.d12_iam_roles
  for select to authenticated
  using (true);

drop policy if exists "d12 iam roles admin" on public.d12_iam_roles;
create policy "d12 iam roles admin" on public.d12_iam_roles
  for all to authenticated
  using (public.d12_is_group_admin())
  with check (public.d12_is_group_admin());

drop policy if exists "d12 iam grants read" on public.d12_iam_grants;
create policy "d12 iam grants read" on public.d12_iam_grants
  for select to authenticated
  using (
    user_id in (select id from public.d12_iam_users where auth_id = auth.uid())
    or public.d12_has_global_permission('iam.read')
    or public.d12_has_global_permission('hr.provision')
  );

drop policy if exists "d12 iam grants provision" on public.d12_iam_grants;
create policy "d12 iam grants provision" on public.d12_iam_grants
  for all to authenticated
  using (public.d12_has_global_permission('hr.provision'))
  with check (public.d12_has_global_permission('hr.provision'));

drop policy if exists "d12 iam audit read" on public.d12_iam_audit;
create policy "d12 iam audit read" on public.d12_iam_audit
  for select to authenticated
  using (public.d12_has_global_permission('hr.provision'));

drop policy if exists "d12 iam audit write" on public.d12_iam_audit;
create policy "d12 iam audit write" on public.d12_iam_audit
  for insert to authenticated
  with check (public.d12_has_global_permission('hr.provision'));

-- ---------------------------------------------------------------------------
-- Operational tables — tenant isolation enforced on every verb.
-- ---------------------------------------------------------------------------
drop policy if exists "d12 leads read" on public.d12_ops_leads;
create policy "d12 leads read" on public.d12_ops_leads
  for select to authenticated
  using (public.d12_has_permission('leads.read', tenant_id));

drop policy if exists "d12 leads write" on public.d12_ops_leads;
create policy "d12 leads write" on public.d12_ops_leads
  for insert to authenticated
  with check (public.d12_has_permission('leads.write', tenant_id));

drop policy if exists "d12 leads update" on public.d12_ops_leads;
create policy "d12 leads update" on public.d12_ops_leads
  for update to authenticated
  using (public.d12_has_permission('leads.write', tenant_id))
  with check (public.d12_has_permission('leads.write', tenant_id));

drop policy if exists "d12 leads delete" on public.d12_ops_leads;
create policy "d12 leads delete" on public.d12_ops_leads
  for delete to authenticated
  using (public.d12_has_permission('leads.write', tenant_id));

drop policy if exists "d12 customers read" on public.d12_ops_customers;
create policy "d12 customers read" on public.d12_ops_customers
  for select to authenticated
  using (public.d12_has_permission('customers.read', tenant_id));

drop policy if exists "d12 customers write" on public.d12_ops_customers;
create policy "d12 customers write" on public.d12_ops_customers
  for insert to authenticated
  with check (public.d12_has_permission('customers.write', tenant_id));

drop policy if exists "d12 customers update" on public.d12_ops_customers;
create policy "d12 customers update" on public.d12_ops_customers
  for update to authenticated
  using (public.d12_has_permission('customers.write', tenant_id))
  with check (public.d12_has_permission('customers.write', tenant_id));

drop policy if exists "d12 customers delete" on public.d12_ops_customers;
create policy "d12 customers delete" on public.d12_ops_customers
  for delete to authenticated
  using (public.d12_has_permission('customers.write', tenant_id));

drop policy if exists "d12 sales read" on public.d12_ops_sales;
create policy "d12 sales read" on public.d12_ops_sales
  for select to authenticated
  using (public.d12_has_permission('sales.read', tenant_id));

drop policy if exists "d12 sales write" on public.d12_ops_sales;
create policy "d12 sales write" on public.d12_ops_sales
  for insert to authenticated
  with check (public.d12_has_permission('sales.write', tenant_id));

drop policy if exists "d12 sales update" on public.d12_ops_sales;
create policy "d12 sales update" on public.d12_ops_sales
  for update to authenticated
  using (public.d12_has_permission('sales.write', tenant_id))
  with check (public.d12_has_permission('sales.write', tenant_id));

drop policy if exists "d12 sales delete" on public.d12_ops_sales;
create policy "d12 sales delete" on public.d12_ops_sales
  for delete to authenticated
  using (public.d12_has_permission('sales.write', tenant_id));

drop policy if exists "d12 tasks read" on public.d12_ops_tasks;
create policy "d12 tasks read" on public.d12_ops_tasks
  for select to authenticated
  using (public.d12_has_permission('tasks.read', tenant_id));

drop policy if exists "d12 tasks write" on public.d12_ops_tasks;
create policy "d12 tasks write" on public.d12_ops_tasks
  for insert to authenticated
  with check (public.d12_has_permission('tasks.write', tenant_id));

drop policy if exists "d12 tasks update" on public.d12_ops_tasks;
create policy "d12 tasks update" on public.d12_ops_tasks
  for update to authenticated
  using (public.d12_has_permission('tasks.write', tenant_id))
  with check (public.d12_has_permission('tasks.write', tenant_id));

drop policy if exists "d12 tasks delete" on public.d12_ops_tasks;
create policy "d12 tasks delete" on public.d12_ops_tasks
  for delete to authenticated
  using (public.d12_has_permission('tasks.write', tenant_id));

-- ---------------------------------------------------------------------------
-- Telemetry outbox — readable by tenant operators, written by the definer trigger.
-- ---------------------------------------------------------------------------
drop policy if exists "d12 outbox read" on public.d12_telemetry_outbox;
create policy "d12 outbox read" on public.d12_telemetry_outbox
  for select to authenticated
  using (public.d12_has_permission('telemetry.write', tenant_id));

-- ---------------------------------------------------------------------------
-- Warehouse — group-only reads, service-role writes.
-- ---------------------------------------------------------------------------
drop policy if exists "d12 wh batches read" on public.d12_wh_batches;
create policy "d12 wh batches read" on public.d12_wh_batches
  for select to authenticated
  using (public.d12_has_global_permission('warehouse.read'));

drop policy if exists "d12 wh events read" on public.d12_wh_events;
create policy "d12 wh events read" on public.d12_wh_events
  for select to authenticated
  using (public.d12_has_global_permission('warehouse.read'));

drop policy if exists "d12 wh sales read" on public.d12_wh_daily_sales;
create policy "d12 wh sales read" on public.d12_wh_daily_sales
  for select to authenticated
  using (public.d12_has_global_permission('warehouse.read'));

drop policy if exists "d12 wh activity read" on public.d12_wh_daily_activity;
create policy "d12 wh activity read" on public.d12_wh_daily_activity
  for select to authenticated
  using (public.d12_has_global_permission('warehouse.read'));

create or replace view public.d12_wh_group_summary
with (security_invoker = true)
as
select
  t.id as tenant_id,
  t.name,
  t.short_name,
  t.mark,
  t.color,
  (select coalesce(sum(s.revenue), 0)
     from public.d12_wh_daily_sales s
    where s.tenant_id = t.id and s.day >= current_date - 29) as revenue_30d,
  (select coalesce(sum(s.transactions), 0)
     from public.d12_wh_daily_sales s
    where s.tenant_id = t.id and s.day >= current_date - 29) as transactions_30d,
  (select coalesce(sum(a.leads_created), 0)
     from public.d12_wh_daily_activity a
    where a.tenant_id = t.id and a.day >= current_date - 29) as leads_30d,
  (select coalesce(sum(a.tasks_completed), 0)
     from public.d12_wh_daily_activity a
    where a.tenant_id = t.id and a.day >= current_date - 29) as tasks_30d
from public.d12_tenants t;

-- ---------------------------------------------------------------------------
-- Grants: anon gets nothing; authenticated gets table access (still RLS-limited).
-- ---------------------------------------------------------------------------
revoke all on
  public.d12_tenants,
  public.d12_iam_users,
  public.d12_iam_roles,
  public.d12_iam_grants,
  public.d12_iam_audit,
  public.d12_ops_leads,
  public.d12_ops_customers,
  public.d12_ops_sales,
  public.d12_ops_tasks,
  public.d12_telemetry_outbox,
  public.d12_wh_batches,
  public.d12_wh_events,
  public.d12_wh_daily_sales,
  public.d12_wh_daily_activity
from anon;

grant select, insert, update, delete on
  public.d12_tenants,
  public.d12_iam_users,
  public.d12_iam_roles,
  public.d12_iam_grants,
  public.d12_iam_audit,
  public.d12_ops_leads,
  public.d12_ops_customers,
  public.d12_ops_sales,
  public.d12_ops_tasks
to authenticated;

grant select on
  public.d12_telemetry_outbox,
  public.d12_wh_batches,
  public.d12_wh_events,
  public.d12_wh_daily_sales,
  public.d12_wh_daily_activity,
  public.d12_wh_group_summary
to authenticated;

grant usage, select on sequence public.d12_iam_audit_id_seq to authenticated;

-- Service role (Supabase) drives provisioning, ingestion and warehouse writes.
grant all on
  public.d12_tenants,
  public.d12_iam_users,
  public.d12_iam_roles,
  public.d12_iam_grants,
  public.d12_iam_audit,
  public.d12_ops_leads,
  public.d12_ops_customers,
  public.d12_ops_sales,
  public.d12_ops_tasks,
  public.d12_telemetry_outbox,
  public.d12_wh_batches,
  public.d12_wh_events,
  public.d12_wh_daily_sales,
  public.d12_wh_daily_activity
to service_role;

notify pgrst, 'reload schema';

-- ===== 003_seed.sql =====

-- Seed data for the District 12 ecosystem.
-- Safe to re-run: every insert is idempotent and never overwrites edits.

insert into public.d12_tenants
  (id, name, short_name, sector, mark, color, tagline, managing_director, domain, app_url, port, status)
values
  ('passito', 'Passito Marketing', 'Passito', 'Marketing & advertising', 'PM', '#DB2777',
   'Brand campaigns that move markets', 'Sarah Nakato',
   'passito.district12.co.ug', 'http://localhost:3001', 3001, 'active'),
  ('mariz', 'Mariz Outsourcing (U) SMC Ltd', 'Mariz', 'Outsourcing & staffing', 'MZ', '#0F766E',
   'People operations, outsourced with care', 'Joseph Okello',
   'mariz.district12.co.ug', 'http://localhost:3002', 3002, 'active'),
  ('rub-shoots', 'Rub Shoots Photography', 'Rub Shoots', 'Photography & media', 'RS', '#BE185D',
   'Stories framed for the long run', 'Patricia Namusoke',
   'rubshoots.district12.co.ug', 'http://localhost:3003', 3003, 'active'),
  ('shop-for-me', 'Shop For Me', 'Shop For Me', 'Retail & e-commerce', 'SF', '#EA580C',
   'Personal shopping, delivered', 'Andrew Ochieng',
   'shopforme.district12.co.ug', 'http://localhost:3004', 3004, 'active'),
  ('expresso-point', 'Expresso Point', 'Expresso', 'Coffee & hospitality', 'EP', '#92400E',
   'The daily cup, done properly', 'Hadijah Nakimuli',
   'expresso.district12.co.ug', 'http://localhost:3005', 3005, 'active'),
   ('talent-clinic', 'Talent Clinic', 'Talent Clinic', 'Talent development & training', 'TC', '#7C3AED',
    'Six-week clinics that build real skills', 'Talent Clinic Lead',
    'talentclinic.district12.co.ug', 'http://localhost:3006', 3006, 'active')
on conflict (id) do nothing;

insert into public.d12_iam_roles (id, label, scope, rank, permissions, description)
values
  ('group_admin', 'Group administrator', 'global', 100, '{*}',
   'Full control of every subsidiary and every provisioning action.'),
  ('hr_admin', 'HR administrator', 'global', 90,
   '{hr.provision,iam.read,warehouse.read,reports.read}',
   'Creates and suspends accounts, assigns subsidiaries, reads group reporting.'),
  ('tenant_admin', 'Subsidiary administrator', 'tenant', 60,
   '{leads.read,leads.write,customers.read,customers.write,sales.read,sales.write,tasks.read,tasks.write,telemetry.write,reports.read}',
   'Runs a single subsidiary workspace.'),
  ('manager', 'Manager', 'tenant', 40,
   '{leads.read,leads.write,customers.read,sales.read,tasks.read,tasks.write,reports.read}',
   'Owns pipeline and delivery for a team inside one subsidiary.'),
  ('employee', 'Employee', 'tenant', 10,
   '{leads.read,customers.read,sales.read,tasks.read}',
   'Read access to the subsidiary operating data needed for delivery.')
on conflict (id) do nothing;

insert into public.d12_iam_users (id, name, email, status)
values
  ('usr_marvin', 'Marvin', 'marvin@district12.co.ug', 'active'),
  ('usr_hr', 'HR Desk', 'hr@district12.co.ug', 'active'),
  ('usr_sarah', 'Sarah Nakato', 'sarah@passito.ug', 'active'),
  ('usr_joseph', 'Joseph Okello', 'joseph@mariz.ug', 'active'),
  ('usr_patricia', 'Patricia Namusoke', 'patricia@rubshoots.ug', 'active'),
  ('usr_andrew', 'Andrew Ochieng', 'andrew@shopforme.ug', 'active'),
  ('usr_hadijah', 'Hadijah Nakimuli', 'hadijah@expresso.ug', 'active'),
  ('usr_brian', 'Brian Ssemakula', 'brian@passito.ug', 'active'),
  ('usr_talent_clinic', 'Talent Clinic', 'talentclinic@district12.co.ug', 'active')
on conflict do nothing;

insert into public.d12_iam_grants (id, user_id, role_id, tenant_id, granted_by)
values
  ('grt_marvin_group', 'usr_marvin', 'group_admin', null, 'usr_marvin'),
  ('grt_hr_group', 'usr_hr', 'hr_admin', null, 'usr_marvin'),
  ('grt_sarah_passito', 'usr_sarah', 'tenant_admin', 'passito', 'usr_marvin'),
  ('grt_joseph_mariz', 'usr_joseph', 'tenant_admin', 'mariz', 'usr_marvin'),
  ('grt_patricia_rub', 'usr_patricia', 'tenant_admin', 'rub-shoots', 'usr_marvin'),
  ('grt_andrew_shop', 'usr_andrew', 'tenant_admin', 'shop-for-me', 'usr_marvin'),
  ('grt_hadijah_expresso', 'usr_hadijah', 'tenant_admin', 'expresso-point', 'usr_marvin'),
  ('grt_brian_passito', 'usr_brian', 'manager', 'passito', 'usr_marvin'),
  ('grt_talent_clinic', 'usr_talent_clinic', 'tenant_admin', 'talent-clinic', 'usr_marvin')
on conflict do nothing;

-- After creating matching Supabase Auth users, link them so RLS resolves the
-- current identity. Demo mode (D12_DEMO_MODE=true) does not need this:
--
-- update public.d12_iam_users u
-- set auth_id = a.id
-- from auth.users a
-- where lower(a.email) = lower(u.email)
--   and u.auth_id is null;

notify pgrst, 'reload schema';

-- ===== 004_ops_projects_inventory.sql =====

-- Adds the Projects and Inventory operational entities.
-- Run after 001_schema.sql, 002_rls.sql and 003_seed.sql. Additive only.
-- Re-runs are safe: tables and policies are idempotent.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.d12_ops_projects (
  id text primary key,
  tenant_id text not null references public.d12_tenants (id) on delete cascade,
  name text not null,
  client text,
  status text not null default 'active'
    check (status in ('planned', 'active', 'on_hold', 'completed', 'cancelled')),
  budget numeric(16, 2) not null default 0,
  spent numeric(16, 2) not null default 0,
  progress integer not null default 0 check (progress between 0 and 100),
  due_on date,
  start_date date,
  duration_weeks integer not null default 6,
  program_session text not null default '',
  owner text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists d12_ops_projects_tenant_idx
  on public.d12_ops_projects (tenant_id, status);

create table if not exists public.d12_ops_inventory (
  id text primary key,
  tenant_id text not null references public.d12_tenants (id) on delete cascade,
  sku text not null,
  name text not null,
  category text,
  quantity numeric(12, 2) not null default 0,
  reorder_level numeric(12, 2) not null default 0,
  unit_cost numeric(16, 2) not null default 0,
  supplier text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists d12_ops_inventory_tenant_idx
  on public.d12_ops_inventory (tenant_id, name);

-- ---------------------------------------------------------------------------
-- updated_at + telemetry outbox triggers
-- ---------------------------------------------------------------------------
drop trigger if exists d12_ops_projects_touch on public.d12_ops_projects;
create trigger d12_ops_projects_touch before update on public.d12_ops_projects
for each row execute function public.d12_touch_updated_at();

drop trigger if exists d12_ops_inventory_touch on public.d12_ops_inventory;
create trigger d12_ops_inventory_touch before update on public.d12_ops_inventory
for each row execute function public.d12_touch_updated_at();

-- Same function as 001, extended with the new entity names.
create or replace function public.d12_enqueue_ops_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_op text := case lower(tg_op)
    when 'insert' then 'created'
    when 'update' then 'updated'
    when 'delete' then 'deleted'
    else lower(tg_op)
  end;
  v_entity text;
  v_type text;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  v_entity := case tg_table_name
    when 'd12_ops_leads' then 'leads'
    when 'd12_ops_customers' then 'customers'
    when 'd12_ops_sales' then 'sales'
    when 'd12_ops_tasks' then 'tasks'
    when 'd12_ops_projects' then 'projects'
    when 'd12_ops_inventory' then 'inventory'
  end;

  v_type := (case v_entity
    when 'leads' then 'lead'
    when 'customers' then 'customer'
    when 'sales' then 'sale'
    when 'tasks' then 'task'
    when 'projects' then 'project'
    when 'inventory' then 'inventory'
  end) || '.' || v_op;

  insert into public.d12_telemetry_outbox
    (tenant_id, event_id, event_type, entity, entity_id, payload, occurred_at)
  values
    (v_row ->> 'tenant_id',
     'evt_' || replace(gen_random_uuid()::text, '-', ''),
     v_type,
     v_entity,
     v_row ->> 'id',
     jsonb_build_object('op', tg_op, 'record', v_row),
     now());

  return coalesce(new, old);
end;
$$;

drop trigger if exists d12_ops_projects_enqueue on public.d12_ops_projects;
create trigger d12_ops_projects_enqueue after insert or update or delete on public.d12_ops_projects
for each row execute function public.d12_enqueue_ops_event();

drop trigger if exists d12_ops_inventory_enqueue on public.d12_ops_inventory;
create trigger d12_ops_inventory_enqueue after insert or update or delete on public.d12_ops_inventory
for each row execute function public.d12_enqueue_ops_event();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.d12_ops_projects enable row level security;
alter table public.d12_ops_inventory enable row level security;

drop policy if exists "d12 projects read" on public.d12_ops_projects;
create policy "d12 projects read" on public.d12_ops_projects
  for select to authenticated
  using (public.d12_has_permission('projects.read', tenant_id));

drop policy if exists "d12 projects write" on public.d12_ops_projects;
create policy "d12 projects write" on public.d12_ops_projects
  for insert to authenticated
  with check (public.d12_has_permission('projects.write', tenant_id));

drop policy if exists "d12 projects update" on public.d12_ops_projects;
create policy "d12 projects update" on public.d12_ops_projects
  for update to authenticated
  using (public.d12_has_permission('projects.write', tenant_id))
  with check (public.d12_has_permission('projects.write', tenant_id));

drop policy if exists "d12 projects delete" on public.d12_ops_projects;
create policy "d12 projects delete" on public.d12_ops_projects
  for delete to authenticated
  using (public.d12_has_permission('projects.write', tenant_id));

drop policy if exists "d12 inventory read" on public.d12_ops_inventory;
create policy "d12 inventory read" on public.d12_ops_inventory
  for select to authenticated
  using (public.d12_has_permission('inventory.read', tenant_id));

drop policy if exists "d12 inventory write" on public.d12_ops_inventory;
create policy "d12 inventory write" on public.d12_ops_inventory
  for insert to authenticated
  with check (public.d12_has_permission('inventory.write', tenant_id));

drop policy if exists "d12 inventory update" on public.d12_ops_inventory;
create policy "d12 inventory update" on public.d12_ops_inventory
  for update to authenticated
  using (public.d12_has_permission('inventory.write', tenant_id))
  with check (public.d12_has_permission('inventory.write', tenant_id));

drop policy if exists "d12 inventory delete" on public.d12_ops_inventory;
create policy "d12 inventory delete" on public.d12_ops_inventory
  for delete to authenticated
  using (public.d12_has_permission('inventory.write', tenant_id));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on
  public.d12_ops_projects,
  public.d12_ops_inventory
from anon;

grant select, insert, update, delete on
  public.d12_ops_projects,
  public.d12_ops_inventory
to authenticated;

grant all on
  public.d12_ops_projects,
  public.d12_ops_inventory
to service_role;

-- ---------------------------------------------------------------------------
-- Role permissions (no-ops when already present)
-- ---------------------------------------------------------------------------
update public.d12_iam_roles
set permissions = permissions || array['projects.read', 'projects.write', 'inventory.read', 'inventory.write']
where id = 'tenant_admin'
  and not permissions @> array['projects.read', 'projects.write', 'inventory.read', 'inventory.write'];

update public.d12_iam_roles
set permissions = permissions || array['projects.read', 'projects.write', 'inventory.read']
where id = 'manager'
  and not permissions @> array['projects.read', 'projects.write', 'inventory.read'];

update public.d12_iam_roles
set permissions = permissions || array['projects.read', 'inventory.read']
where id = 'employee'
  and not permissions @> array['projects.read', 'inventory.read'];

notify pgrst, 'reload schema';

-- ===== 005_ops_finance.sql =====

-- Adds the Finance (transactions) and Invoices operational entities and
-- extends the warehouse with daily cost facts for group profit reporting.
-- Run after 001_schema.sql, 002_rls.sql, 003_seed.sql and 004_ops_projects_inventory.sql.
-- Additive only; safe to re-run.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.d12_ops_transactions (
  id text primary key,
  tenant_id text not null references public.d12_tenants (id) on delete cascade,
  occurred_on date not null,
  kind text not null default 'expense' check (kind in ('income', 'expense')),
  description text not null,
  category text,
  amount numeric(16, 2) not null default 0,
  reference text,
  counterparty text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists d12_ops_transactions_tenant_idx
  on public.d12_ops_transactions (tenant_id, occurred_on desc);
create index if not exists d12_ops_transactions_kind_idx
  on public.d12_ops_transactions (tenant_id, kind, occurred_on desc);

create table if not exists public.d12_ops_invoices (
  id text primary key,
  tenant_id text not null references public.d12_tenants (id) on delete cascade,
  number text not null,
  customer_name text not null,
  customer_id text,
  issue_on date not null,
  due_on date,
  amount numeric(16, 2) not null default 0,
  status text not null default 'pending'
    check (status in ('draft', 'pending', 'paid', 'void')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, number)
);
create index if not exists d12_ops_invoices_tenant_idx
  on public.d12_ops_invoices (tenant_id, status, due_on);

-- ---------------------------------------------------------------------------
-- updated_at + telemetry outbox triggers
-- ---------------------------------------------------------------------------
drop trigger if exists d12_ops_transactions_touch on public.d12_ops_transactions;
create trigger d12_ops_transactions_touch before update on public.d12_ops_transactions
for each row execute function public.d12_touch_updated_at();

drop trigger if exists d12_ops_invoices_touch on public.d12_ops_invoices;
create trigger d12_ops_invoices_touch before update on public.d12_ops_invoices
for each row execute function public.d12_touch_updated_at();

-- Same function as 004, extended with finance and invoice entity names.
create or replace function public.d12_enqueue_ops_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_op text := case lower(tg_op)
    when 'insert' then 'created'
    when 'update' then 'updated'
    when 'delete' then 'deleted'
    else lower(tg_op)
  end;
  v_entity text;
  v_type text;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  v_entity := case tg_table_name
    when 'd12_ops_leads' then 'leads'
    when 'd12_ops_customers' then 'customers'
    when 'd12_ops_sales' then 'sales'
    when 'd12_ops_tasks' then 'tasks'
    when 'd12_ops_projects' then 'projects'
    when 'd12_ops_inventory' then 'inventory'
    when 'd12_ops_transactions' then 'transactions'
    when 'd12_ops_invoices' then 'invoices'
  end;

  v_type := (case v_entity
    when 'leads' then 'lead'
    when 'customers' then 'customer'
    when 'sales' then 'sale'
    when 'tasks' then 'task'
    when 'projects' then 'project'
    when 'inventory' then 'inventory'
    when 'transactions' then 'transaction'
    when 'invoices' then 'invoice'
  end) || '.' || v_op;

  insert into public.d12_telemetry_outbox
    (tenant_id, event_id, event_type, entity, entity_id, payload, occurred_at)
  values
    (v_row ->> 'tenant_id',
     'evt_' || replace(gen_random_uuid()::text, '-', ''),
     v_type,
     v_entity,
     v_row ->> 'id',
     jsonb_build_object('op', tg_op, 'record', v_row),
     now());

  return coalesce(new, old);
end;
$$;

drop trigger if exists d12_ops_transactions_enqueue on public.d12_ops_transactions;
create trigger d12_ops_transactions_enqueue after insert or update or delete on public.d12_ops_transactions
for each row execute function public.d12_enqueue_ops_event();

drop trigger if exists d12_ops_invoices_enqueue on public.d12_ops_invoices;
create trigger d12_ops_invoices_enqueue after insert or update or delete on public.d12_ops_invoices
for each row execute function public.d12_enqueue_ops_event();

-- ---------------------------------------------------------------------------
-- Warehouse cost facts
-- ---------------------------------------------------------------------------
create table if not exists public.d12_wh_daily_costs (
  tenant_id text not null references public.d12_tenants (id) on delete cascade,
  day date not null,
  entries integer not null default 0,
  expenses numeric(16, 2) not null default 0,
  primary key (tenant_id, day)
);

-- Recompute one tenant-day of facts, now including expense ledger entries.
create or replace function public.d12_wh_refresh_facts(p_tenant text, p_day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := (p_day::timestamp) at time zone 'Africa/Kampala';
  v_end timestamptz := ((p_day + 1)::timestamp) at time zone 'Africa/Kampala';
begin
  delete from public.d12_wh_daily_sales where tenant_id = p_tenant and day = p_day;
  insert into public.d12_wh_daily_sales (tenant_id, day, transactions, revenue)
  select p_tenant,
         p_day,
         count(*),
         coalesce(sum(coalesce(data ->> 'amount', '0')::numeric), 0)
  from (
    select distinct on (entity_id)
           entity_id,
           event_type,
           payload -> 'data' as data
    from public.d12_wh_events
    where tenant_id = p_tenant
      and entity = 'sales'
      and occurred_at < v_end
    order by entity_id, occurred_at desc
  ) latest
  where latest.event_type <> 'sale.deleted'
    and coalesce(data ->> 'status', '') = 'paid'
    and coalesce(data ->> 'occurredOn', data ->> 'occurred_on')::date = p_day;

  delete from public.d12_wh_daily_costs where tenant_id = p_tenant and day = p_day;
  insert into public.d12_wh_daily_costs (tenant_id, day, entries, expenses)
  select p_tenant,
         p_day,
         count(*),
         coalesce(sum(coalesce(data ->> 'amount', '0')::numeric), 0)
  from (
    select distinct on (entity_id)
           entity_id,
           event_type,
           payload -> 'data' as data
    from public.d12_wh_events
    where tenant_id = p_tenant
      and entity = 'transactions'
      and occurred_at < v_end
    order by entity_id, occurred_at desc
  ) latest
  where latest.event_type <> 'transaction.deleted'
    and coalesce(data ->> 'kind', '') = 'expense'
    and coalesce(data ->> 'occurredOn', data ->> 'occurred_on')::date = p_day;

  delete from public.d12_wh_daily_activity where tenant_id = p_tenant and day = p_day;
  insert into public.d12_wh_daily_activity (tenant_id, day, leads_created, leads_won, tasks_completed)
  select p_tenant,
         p_day,
         (
           select count(*)
           from public.d12_wh_events e
           where e.tenant_id = p_tenant
             and e.event_type = 'lead.created'
             and e.occurred_at >= v_start and e.occurred_at < v_end
         ),
         (
           select count(*)
           from (
             select distinct on (entity_id) entity_id, event_type, payload -> 'data' as data
             from public.d12_wh_events
             where tenant_id = p_tenant and entity = 'leads' and occurred_at < v_end
             order by entity_id, occurred_at desc
           ) latest
           where latest.event_type <> 'lead.deleted'
             and coalesce(data ->> 'stage', '') = 'won'
             and coalesce(data ->> 'updatedAt', data ->> 'updated_at')::date = p_day
         ),
         (
           select count(*)
           from (
             select distinct on (entity_id) entity_id, event_type, payload -> 'data' as data
             from public.d12_wh_events
             where tenant_id = p_tenant and entity = 'tasks' and occurred_at < v_end
             order by entity_id, occurred_at desc
           ) latest
           where latest.event_type <> 'task.deleted'
             and coalesce(data ->> 'status', '') = 'done'
             and coalesce(data ->> 'updatedAt', data ->> 'updated_at')::date = p_day
         );
end;
$$;

-- Group summary now exposes expenses and net profit for the last 30 days.
create or replace view public.d12_wh_group_summary
with (security_invoker = true)
as
select
  t.id as tenant_id,
  t.name,
  t.short_name,
  t.mark,
  t.color,
  (select coalesce(sum(s.revenue), 0)
     from public.d12_wh_daily_sales s
    where s.tenant_id = t.id and s.day >= current_date - 29) as revenue_30d,
  (select coalesce(sum(s.transactions), 0)
     from public.d12_wh_daily_sales s
    where s.tenant_id = t.id and s.day >= current_date - 29) as transactions_30d,
  (select coalesce(sum(a.leads_created), 0)
     from public.d12_wh_daily_activity a
    where a.tenant_id = t.id and a.day >= current_date - 29) as leads_30d,
  (select coalesce(sum(a.tasks_completed), 0)
     from public.d12_wh_daily_activity a
    where a.tenant_id = t.id and a.day >= current_date - 29) as tasks_30d,
  (select coalesce(sum(c.expenses), 0)
     from public.d12_wh_daily_costs c
    where c.tenant_id = t.id and c.day >= current_date - 29) as expenses_30d,
  (select coalesce(sum(s.revenue), 0)
     from public.d12_wh_daily_sales s
    where s.tenant_id = t.id and s.day >= current_date - 29)
  - (select coalesce(sum(c.expenses), 0)
     from public.d12_wh_daily_costs c
    where c.tenant_id = t.id and c.day >= current_date - 29) as net_30d
from public.d12_tenants t;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.d12_ops_transactions enable row level security;
alter table public.d12_ops_invoices enable row level security;
alter table public.d12_wh_daily_costs enable row level security;

drop policy if exists "d12 transactions read" on public.d12_ops_transactions;
create policy "d12 transactions read" on public.d12_ops_transactions
  for select to authenticated
  using (public.d12_has_permission('transactions.read', tenant_id));

drop policy if exists "d12 transactions write" on public.d12_ops_transactions;
create policy "d12 transactions write" on public.d12_ops_transactions
  for insert to authenticated
  with check (public.d12_has_permission('transactions.write', tenant_id));

drop policy if exists "d12 transactions update" on public.d12_ops_transactions;
create policy "d12 transactions update" on public.d12_ops_transactions
  for update to authenticated
  using (public.d12_has_permission('transactions.write', tenant_id))
  with check (public.d12_has_permission('transactions.write', tenant_id));

drop policy if exists "d12 transactions delete" on public.d12_ops_transactions;
create policy "d12 transactions delete" on public.d12_ops_transactions
  for delete to authenticated
  using (public.d12_has_permission('transactions.write', tenant_id));

drop policy if exists "d12 invoices read" on public.d12_ops_invoices;
create policy "d12 invoices read" on public.d12_ops_invoices
  for select to authenticated
  using (public.d12_has_permission('invoices.read', tenant_id));

drop policy if exists "d12 invoices write" on public.d12_ops_invoices;
create policy "d12 invoices write" on public.d12_ops_invoices
  for insert to authenticated
  with check (public.d12_has_permission('invoices.write', tenant_id));

drop policy if exists "d12 invoices update" on public.d12_ops_invoices;
create policy "d12 invoices update" on public.d12_ops_invoices
  for update to authenticated
  using (public.d12_has_permission('invoices.write', tenant_id))
  with check (public.d12_has_permission('invoices.write', tenant_id));

drop policy if exists "d12 invoices delete" on public.d12_ops_invoices;
create policy "d12 invoices delete" on public.d12_ops_invoices
  for delete to authenticated
  using (public.d12_has_permission('invoices.write', tenant_id));

drop policy if exists "d12 wh costs read" on public.d12_wh_daily_costs;
create policy "d12 wh costs read" on public.d12_wh_daily_costs
  for select to authenticated
  using (public.d12_has_global_permission('warehouse.read'));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on
  public.d12_ops_transactions,
  public.d12_ops_invoices,
  public.d12_wh_daily_costs
from anon;

grant select, insert, update, delete on
  public.d12_ops_transactions,
  public.d12_ops_invoices
to authenticated;

grant select on public.d12_wh_daily_costs to authenticated;

grant all on
  public.d12_ops_transactions,
  public.d12_ops_invoices,
  public.d12_wh_daily_costs
to service_role;

-- ---------------------------------------------------------------------------
-- Role permissions (no-ops when already present)
-- ---------------------------------------------------------------------------
update public.d12_iam_roles
set permissions = permissions || array['transactions.read', 'transactions.write', 'invoices.read', 'invoices.write']
where id = 'tenant_admin'
  and not permissions @> array['transactions.read', 'transactions.write', 'invoices.read', 'invoices.write'];

update public.d12_iam_roles
set permissions = permissions || array['transactions.read', 'invoices.read']
where id = 'manager'
  and not permissions @> array['transactions.read', 'invoices.read'];

update public.d12_iam_roles
set permissions = permissions || array['transactions.read', 'invoices.read']
where id = 'employee'
  and not permissions @> array['transactions.read', 'invoices.read'];

notify pgrst, 'reload schema';

-- ===== 006_ops_staff.sql =====

-- Adds the Staff operational entity to each subsidiary workspace.
-- Run after 001_schema.sql, 002_rls.sql, 003_seed.sql, 004_ops_projects_inventory.sql
-- and 005_ops_finance.sql. Additive only; safe to re-run.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.d12_ops_staff (
  id text primary key,
  tenant_id text not null references public.d12_tenants (id) on delete cascade,
  name text not null,
  role text,
  department text,
  email text,
  phone text,
  status text not null default 'active'
    check (status in ('active', 'on_leave', 'contract')),
  joined_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists d12_ops_staff_tenant_idx
  on public.d12_ops_staff (tenant_id, status);
create index if not exists d12_ops_staff_name_idx
  on public.d12_ops_staff (tenant_id, name);

-- ---------------------------------------------------------------------------
-- updated_at + telemetry outbox triggers
-- ---------------------------------------------------------------------------
drop trigger if exists d12_ops_staff_touch on public.d12_ops_staff;
create trigger d12_ops_staff_touch before update on public.d12_ops_staff
for each row execute function public.d12_touch_updated_at();

-- Same function as 005, extended with the staff entity name.
create or replace function public.d12_enqueue_ops_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_op text := case lower(tg_op)
    when 'insert' then 'created'
    when 'update' then 'updated'
    when 'delete' then 'deleted'
    else lower(tg_op)
  end;
  v_entity text;
  v_type text;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  v_entity := case tg_table_name
    when 'd12_ops_leads' then 'leads'
    when 'd12_ops_customers' then 'customers'
    when 'd12_ops_sales' then 'sales'
    when 'd12_ops_tasks' then 'tasks'
    when 'd12_ops_projects' then 'projects'
    when 'd12_ops_inventory' then 'inventory'
    when 'd12_ops_transactions' then 'transactions'
    when 'd12_ops_invoices' then 'invoices'
    when 'd12_ops_staff' then 'staff'
  end;

  v_type := (case v_entity
    when 'leads' then 'lead'
    when 'customers' then 'customer'
    when 'sales' then 'sale'
    when 'tasks' then 'task'
    when 'projects' then 'project'
    when 'inventory' then 'inventory'
    when 'transactions' then 'transaction'
    when 'invoices' then 'invoice'
    when 'staff' then 'staff'
  end) || '.' || v_op;

  insert into public.d12_telemetry_outbox
    (tenant_id, event_id, event_type, entity, entity_id, payload, occurred_at)
  values
    (v_row ->> 'tenant_id',
     'evt_' || replace(gen_random_uuid()::text, '-', ''),
     v_type,
     v_entity,
     v_row ->> 'id',
     jsonb_build_object('op', tg_op, 'record', v_row),
     now());

  return coalesce(new, old);
end;
$$;

drop trigger if exists d12_ops_staff_enqueue on public.d12_ops_staff;
create trigger d12_ops_staff_enqueue after insert or update or delete on public.d12_ops_staff
for each row execute function public.d12_enqueue_ops_event();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.d12_ops_staff enable row level security;

drop policy if exists "d12 staff read" on public.d12_ops_staff;
create policy "d12 staff read" on public.d12_ops_staff
  for select to authenticated
  using (public.d12_has_permission('staff.read', tenant_id));

drop policy if exists "d12 staff write" on public.d12_ops_staff;
create policy "d12 staff write" on public.d12_ops_staff
  for insert to authenticated
  with check (public.d12_has_permission('staff.write', tenant_id));

drop policy if exists "d12 staff update" on public.d12_ops_staff;
create policy "d12 staff update" on public.d12_ops_staff
  for update to authenticated
  using (public.d12_has_permission('staff.write', tenant_id))
  with check (public.d12_has_permission('staff.write', tenant_id));

drop policy if exists "d12 staff delete" on public.d12_ops_staff;
create policy "d12 staff delete" on public.d12_ops_staff
  for delete to authenticated
  using (public.d12_has_permission('staff.write', tenant_id));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on public.d12_ops_staff from anon;

grant select, insert, update, delete on public.d12_ops_staff to authenticated;
grant all on public.d12_ops_staff to service_role;

-- ---------------------------------------------------------------------------
-- Role permissions (no-ops when already present)
-- ---------------------------------------------------------------------------
update public.d12_iam_roles
set permissions = permissions || array['staff.read', 'staff.write']
where id = 'tenant_admin'
  and not permissions @> array['staff.read', 'staff.write'];

update public.d12_iam_roles
set permissions = permissions || array['staff.read', 'staff.write']
where id = 'manager'
  and not permissions @> array['staff.read', 'staff.write'];

update public.d12_iam_roles
set permissions = permissions || array['staff.read']
where id = 'employee'
  and not permissions @> array['staff.read'];

notify pgrst, 'reload schema';

-- ===== 007_accountant.sql =====

insert into public.d12_iam_roles (id, label, scope, rank, permissions, description)
values (
  'accountant', 'Group accountant', 'global', 90,
  '{finance.read,warehouse.read,reports.read}',
  'Monitors revenue, operating expenses and financial performance across the group. Read-only access.'
)
on conflict (id) do nothing;

insert into public.d12_iam_users (id, name, email, status)
values ('usr_accountant', 'Finance Desk', 'accountant@district12.co.ug', 'active')
on conflict do nothing;

insert into public.d12_iam_grants (id, user_id, role_id, tenant_id, granted_by)
select 'grt_accountant_group', id, 'accountant', null, 'usr_marvin'
from public.d12_iam_users
where email = 'accountant@district12.co.ug'
on conflict do nothing;

notify pgrst, 'reload schema';

-- ===== 008_hub_workflows.sql =====

-- Additive Hub-only migration. Apply manually after 001–007; no operational ERP tables are changed.
-- No employment, attendance, leave, payroll or training facts are seeded.
begin;

update public.d12_iam_roles
set permissions = array(select distinct p from unnest(permissions ||
  array['hr.manage','hr.payroll','hr.reports','team.manage','notifications.read']) p order by p)
where id = 'hr_admin';

create table if not exists public.d12_hub_records (
  id text primary key,
  kind text not null check (kind in ('employees','tasks','attendance','leave','payroll','performance',
    'vacancies','applications','training','enrolments','group_settings','hr_settings')),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  version bigint not null default 1 check (version between 1 and 9007199254740991),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text not null references public.d12_iam_users(id) on delete restrict
);
create index if not exists d12_hub_kind_created on public.d12_hub_records(kind, created_at desc, id);
create unique index if not exists d12_hub_employee_account on public.d12_hub_records ((data->>'accountId'))
  where kind = 'employees' and coalesce(data->>'accountId','') <> '';
create unique index if not exists d12_hub_attendance_day on public.d12_hub_records ((data->>'employeeId'), (data->>'workOn')) where kind = 'attendance';
create unique index if not exists d12_hub_payroll_period on public.d12_hub_records ((data->>'employeeId'), (data->>'period')) where kind = 'payroll' and data->>'status' <> 'void';
create unique index if not exists d12_hub_review_period on public.d12_hub_records ((data->>'employeeId'), (data->>'period')) where kind = 'performance';
create unique index if not exists d12_hub_enrolment_session on public.d12_hub_records ((data->>'employeeId'), (data->>'trainingId')) where kind = 'enrolments';
create unique index if not exists d12_hub_settings_singleton on public.d12_hub_records(kind) where kind in ('group_settings','hr_settings');
create unique index if not exists d12_hub_hired_employee on public.d12_hub_records ((data->>'employeeId')) where kind = 'applications' and data->>'status' = 'hired';

create table if not exists public.d12_hub_notifications (
  id text primary key default ('hnt_' || replace(gen_random_uuid()::text,'-','')),
  recipient_id text not null references public.d12_iam_users(id) on delete cascade,
  title text not null check (length(title) between 1 and 180),
  href text not null check (href in ('/team','/tasks','/hr/attendance','/hr/leave','/hr/payroll',
    '/hr/performance','/hr/recruitment','/hr/training','/settings','/hr/settings')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  archived_at timestamptz
);
create index if not exists d12_hub_notification_recipient on public.d12_hub_notifications(recipient_id, created_at desc, id);

-- Metadata is local to this migration: exact permissions, initial states, transitions and safe notification labels.
create or replace function public.d12_hub_meta(p_kind text)
returns jsonb language sql immutable set search_path = public as $$
  select case p_kind
    when 'employees' then '{"permission":"team.manage","initial":"active","label":"Employee profile","href":"/team","edges":["active:inactive","inactive:active"]}'::jsonb
    when 'tasks' then '{"permission":"group.tasks","initial":"open","label":"Task","href":"/tasks","edges":["open:in_progress","open:done","in_progress:done","done:open","cancelled:open","open:cancelled","in_progress:cancelled"]}'::jsonb
    when 'attendance' then '{"permission":"hr.manage","label":"Attendance record","href":"/hr/attendance"}'::jsonb
    when 'leave' then '{"permission":"hr.manage","initial":"requested","label":"Leave request","href":"/hr/leave","edges":["requested:approved","requested:rejected","requested:cancelled","approved:cancelled"],"terminal":["rejected","cancelled"]}'::jsonb
    when 'payroll' then '{"permission":"hr.payroll","initial":"draft","label":"Payroll entry","href":"/hr/payroll","edges":["draft:approved","approved:paid","draft:void","approved:void"],"terminal":["paid","void"]}'::jsonb
    when 'performance' then '{"permission":"hr.manage","initial":"draft","label":"Performance review","href":"/hr/performance","edges":["draft:submitted","submitted:finalized","submitted:draft"],"terminal":["finalized"]}'::jsonb
    when 'vacancies' then '{"permission":"hr.manage","initial":"open","label":"Vacancy","href":"/hr/recruitment","edges":["open:closed","closed:open"]}'::jsonb
    when 'applications' then '{"permission":"hr.manage","initial":"applied","label":"Application","href":"/hr/recruitment","edges":["applied:shortlisted","shortlisted:interview","interview:offered","offered:hired","applied:rejected","shortlisted:rejected","interview:rejected","offered:rejected"],"terminal":["hired","rejected"]}'::jsonb
    when 'training' then '{"permission":"hr.manage","initial":"scheduled","label":"Training session","href":"/hr/training","edges":["scheduled:completed","scheduled:cancelled"],"terminal":["completed","cancelled"]}'::jsonb
    when 'enrolments' then '{"permission":"hr.manage","initial":"enrolled","label":"Enrolment","href":"/hr/training","edges":["enrolled:attended","attended:completed","enrolled:withdrawn","attended:withdrawn"],"terminal":["completed","withdrawn"]}'::jsonb
    when 'group_settings' then '{"permission":"group.settings","label":"Group settings","href":"/settings"}'::jsonb
    when 'hr_settings' then '{"permission":"hr.manage","label":"HR settings","href":"/hr/settings"}'::jsonb
  end;
$$;

-- Only named global roles may access Hub records. Accountant permissions never imply personnel/payroll access.
create or replace function public.d12_hub_can(p_kind text, p_user text default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.d12_iam_users u
    join public.d12_iam_grants g on g.user_id = u.id and g.tenant_id is null
    join public.d12_iam_roles r on r.id = g.role_id and r.scope = 'global'
    where u.status = 'active' and (case when p_user is null then u.auth_id = auth.uid() else u.id = p_user end)
    and ((r.id = 'group_admin' and '*' = any(r.permissions))
      or (r.id = 'hr_admin' and p_kind not in ('tasks','group_settings') and
        ((p_kind = 'employees' and ('team.manage' = any(r.permissions) or 'hr.manage' = any(r.permissions)))
         or (p_kind <> 'employees' and public.d12_hub_meta(p_kind)->>'permission' = any(r.permissions)))))
  );
$$;

create or replace function public.d12_hub_date(p_value text)
returns date language plpgsql immutable set search_path = public as $$
declare v date;
begin
  if p_value is null or p_value !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception using errcode = '23514', message = 'Use a valid YYYY-MM-DD date';
  end if;
  v := p_value::date;
  if to_char(v,'YYYY-MM-DD') <> p_value then
    raise exception using errcode = '23514', message = 'Invalid calendar date';
  end if;
  return v;
exception when datetime_field_overflow or invalid_datetime_format then
  raise exception using errcode = '23514', message = 'Invalid calendar date';
end;
$$;

create or replace function public.d12_hub_account(p_id text, p_tenant text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_id,'') = '' then return; end if;
  if not exists (select 1 from public.d12_iam_users where id = p_id and status = 'active') then
    raise exception using errcode = '23514', message = 'An active directory account is required';
  end if;
  if p_tenant <> 'group' and not exists (
    select 1 from public.d12_iam_grants g join public.d12_iam_roles r on r.id = g.role_id
    where g.user_id = p_id and (g.tenant_id = p_tenant or (g.tenant_id is null and r.scope = 'global'))
  ) then raise exception using errcode = '23514', message = 'Account subsidiary membership is required'; end if;
end;
$$;

create or replace function public.d12_hub_employment(p_kind text, p_data jsonb, p_employee jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_start date; v_end date; v_session jsonb;
begin
  if p_kind = 'attendance' then
    v_start := public.d12_hub_date(p_data->>'workOn'); v_end := v_start;
  elsif p_kind = 'leave' then
    v_start := public.d12_hub_date(p_data->>'startOn'); v_end := public.d12_hub_date(p_data->>'endOn');
  elsif p_kind in ('payroll','performance') then
    v_start := public.d12_hub_date((p_data->>'period') || '-01');
    v_end := (v_start + interval '1 month' - interval '1 day')::date;
    if v_end < public.d12_hub_date(p_employee->>'startOn') or
       (coalesce(p_employee->>'endOn','') <> '' and v_start > public.d12_hub_date(p_employee->>'endOn')) then
      raise exception using errcode = '23514', message = 'Period must overlap employment';
    end if;
    return;
  elsif p_kind = 'enrolments' then
    select data into v_session from public.d12_hub_records where kind = 'training' and id = p_data->>'trainingId';
    if v_session is null then raise exception using errcode = '23514', message = 'Training session not found'; end if;
    v_start := public.d12_hub_date(v_session->>'startsOn'); v_end := public.d12_hub_date(v_session->>'endsOn');
  else return;
  end if;
  if v_start < public.d12_hub_date(p_employee->>'startOn') or
     (coalesce(p_employee->>'endOn','') <> '' and v_end > public.d12_hub_date(p_employee->>'endOn')) then
    raise exception using errcode = '23514', message = 'Dates must fall within employment';
  end if;
end;
$$;

-- Both the RPC and direct table DML acquire this lock before inspecting related records.
-- Statement trigger also serializes multi-row service-role writes. Volatile trigger queries get fresh
-- READ COMMITTED snapshots after waiting; unique expression indexes are the final duplicate guard.
create or replace function public.d12_hub_lock()
returns trigger language plpgsql set search_path = public as $$
begin
  -- A pre-lock REPEATABLE READ snapshot could miss another employee's leave write.
  -- Service-role callers must use the default READ COMMITTED transaction isolation.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = '40001', message = 'Hub writes require READ COMMITTED isolation';
  end if;
  perform pg_advisory_xact_lock(1200812::bigint);
  return null;
end;
$$;
drop trigger if exists d12_hub_write_lock on public.d12_hub_records;
create trigger d12_hub_write_lock before insert or update or delete on public.d12_hub_records
  for each statement execute function public.d12_hub_lock();

create or replace function public.d12_hub_validate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_meta jsonb; v_keys text[]; v_numbers text[] := '{}'; v_required text[] := '{}';
  v_key text; v_value jsonb; v_text text; v_limit integer; v_number numeric;
  v_employee jsonb; v_link jsonb; v_settings jsonb; v_record record;
  v_start date; v_end date; v_today date := (now() at time zone 'Africa/Kampala')::date;
  v_status text; v_old_status text; v_days integer; v_used integer;
  v_weekdays text[]; v_holidays text[]; v_actor text;
begin
  perform pg_advisory_xact_lock(1200812::bigint);
  if tg_op = 'DELETE' then
    v_meta := public.d12_hub_meta(old.kind);
    if old.kind in ('employees','attendance','group_settings','hr_settings') or
       coalesce(v_meta->'terminal','[]'::jsonb) ? (old.data->>'status') or
       (old.kind <> 'tasks' and old.data->>'status' in ('approved','submitted','offered','attended')) then
      raise exception using errcode = '40001', message = 'Profiles, approvals and historical records must be retained';
    end if;
    if exists (select 1 from public.d12_hub_records r where r.id <> old.id and
      ((old.kind = 'employees' and r.data->>'employeeId' = old.id) or
       (old.kind = 'vacancies' and r.data->>'vacancyId' = old.id) or
       (old.kind = 'training' and r.data->>'trainingId' = old.id))) then
      raise exception using errcode = '40001', message = 'Referenced workflow records must be retained';
    end if;
    -- Deletion is only exposed via version-checked RPC, not direct authenticated/service DML.
    if current_setting('d12.hub_delete_id',true) is distinct from old.id then
      raise exception using errcode = '40001', message = 'Delete through the version-checked Hub RPC';
    end if;
    return old;
  end if;
  v_meta := public.d12_hub_meta(new.kind);
  if v_meta is null or jsonb_typeof(new.data) is distinct from 'object' then
    raise exception using errcode = '23514', message = 'Unknown workflow kind or invalid payload';
  end if;
  v_status := new.data->>'status';
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.kind <> old.kind or new.created_by <> old.created_by or
       new.created_at <> old.created_at or new.version <> old.version + 1 then
      raise exception using errcode = '40001', message = 'Identity is immutable and version must advance by one';
    end if;
    v_old_status := old.data->>'status';
    if coalesce(v_meta->'terminal','[]'::jsonb) ? v_old_status then
      raise exception using errcode = '40001', message = 'Terminal workflow records are read-only';
    end if;
    if v_status is distinct from v_old_status and new.kind <> 'attendance' and
       not coalesce(v_meta->'edges','[]'::jsonb) ? (v_old_status || ':' || v_status) then
      raise exception using errcode = '23514', message = 'Workflow transition is not allowed';
    end if;
  elsif new.version <> 1 or (v_meta ? 'initial' and v_status is distinct from v_meta->>'initial') then
    raise exception using errcode = '23514', message = 'Create workflows in their initial state at version one';
  end if;

  -- Full, strict, normalized JSON payloads only (API Zod schemas supply defaults).
  case new.kind
    when 'employees' then
      v_keys := array['name','email','phone','accountId','tenantId','department','title','employmentType','status','startOn','endOn','annualLeaveDays','notes'];
      v_numbers := array['annualLeaveDays']; v_required := array['name','tenantId','startOn'];
    when 'tasks' then
      v_keys := array['title','tenantId','assigneeId','dueOn','priority','status','notes']; v_required := array['title','tenantId'];
    when 'attendance' then
      v_keys := array['employeeId','workOn','status','checkIn','checkOut','notes']; v_required := array['employeeId','workOn','status'];
    when 'leave' then
      v_keys := array['employeeId','type','startOn','endOn','status','workingDays','decisionReason','notes'];
      v_numbers := array['workingDays']; v_required := array['employeeId','type','startOn','endOn'];
    when 'payroll' then
      v_keys := array['employeeId','period','basic','allowances','deductions','gross','net','employeeName','tenantId','status','paymentReference','paidOn','notes'];
      v_numbers := array['basic','allowances','deductions','gross','net']; v_required := array['employeeId','period'];
    when 'performance' then
      v_keys := array['employeeId','reviewerId','period','objectives','rating','notes','status'];
      v_numbers := array['rating']; v_required := array['employeeId','reviewerId','period','objectives'];
    when 'vacancies' then
      v_keys := array['title','tenantId','department','openings','closesOn','status','notes'];
      v_numbers := array['openings']; v_required := array['title','tenantId'];
    when 'applications' then
      v_keys := array['name','email','vacancyId','interviewOn','employeeId','status','notes']; v_required := array['name','vacancyId'];
    when 'training' then
      v_keys := array['title','tenantId','startsOn','endsOn','trainer','status','notes']; v_required := array['title','tenantId','startsOn','endsOn'];
    when 'enrolments' then
      v_keys := array['employeeId','trainingId','status','notes']; v_required := array['employeeId','trainingId'];
    when 'group_settings' then
      v_keys := array['organizationName','contactEmail','contactPhone','reportingDays']; v_required := array['organizationName'];
    when 'hr_settings' then
      v_keys := array['departments','workingWeekdays','holidays','defaultAnnualLeaveDays'];
      v_numbers := array['defaultAnnualLeaveDays']; v_required := array['workingWeekdays'];
    else raise exception using errcode = '23514', message = 'Unsupported workflow';
  end case;
  if not new.data ?& v_keys or exists (select 1 from jsonb_object_keys(new.data) k where not k = any(v_keys)) then
    raise exception using errcode = '23514', message = 'Submit the full allowlisted payload';
  end if;
  for v_key, v_value in select key, value from jsonb_each(new.data) loop
    v_text := new.data->>v_key;
    if v_key = any(v_numbers) then
      if jsonb_typeof(v_value) is distinct from 'number' then raise exception using errcode = '23514', message = 'Numeric field required'; end if;
      v_number := v_text::numeric;
      if v_number <> trunc(v_number) or v_number < 0 or v_number > 1000000000000 then
        raise exception using errcode = '23514', message = 'Nonnegative bounded integer required';
      end if;
      if (v_key in ('annualLeaveDays','defaultAnnualLeaveDays','workingDays') and v_number > 366) or
         (v_key = 'rating' and v_number not between 1 and 5) or
         (v_key = 'openings' and v_number not between 1 and 1000) then
        raise exception using errcode = '23514', message = 'Numeric value out of range';
      end if;
    else
      if jsonb_typeof(v_value) is distinct from 'string' then raise exception using errcode = '23514', message = 'Text field required'; end if;
      if v_key = any(v_required) and btrim(v_text) = '' then raise exception using errcode = '23514', message = 'Required field is empty'; end if;
      v_limit := case
        when v_key in ('notes','objectives') then 2000 when v_key = 'decisionReason' then 500
        when v_key = 'departments' then 1000 when v_key = 'holidays' then 4000
        when v_key in ('phone','contactPhone') then 40 when v_key = 'department' then 80
        when v_key in ('employeeId','accountId','assigneeId','reviewerId','vacancyId','trainingId') then 100
        when v_key in ('email','contactEmail') then 320 else 120 end;
      if length(v_text) > v_limit then raise exception using errcode = '23514', message = 'Text value is too long'; end if;
      if v_key like '%On' and v_text <> '' then perform public.d12_hub_date(v_text); end if;
      if v_key in ('email','contactEmail') and v_text <> '' and v_text !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
        raise exception using errcode = '23514', message = 'Invalid email address';
      end if;
    end if;
  end loop;
  if new.data ? 'tenantId' and (new.data->>'tenantId' not in
    ('group','passito','mariz','rub-shoots','shop-for-me','expresso-point') or
    (new.data->>'tenantId' <> 'group' and not exists (
      select 1 from public.d12_tenants where id = new.data->>'tenantId'
    ))) then raise exception using errcode = '23514', message = 'Unknown subsidiary'; end if;
  if new.data ? 'period' and new.data->>'period' !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception using errcode = '23514', message = 'Use YYYY-MM period';
  end if;
  if new.data ? 'period' then perform public.d12_hub_date((new.data->>'period') || '-01'); end if;
  if (new.kind = 'attendance' and v_status not in ('present','late','absent')) or
     (new.kind = 'employees' and new.data->>'employmentType' not in ('permanent','contract','intern','other','unknown')) or
     (new.kind = 'tasks' and new.data->>'priority' not in ('low','normal','high')) or
     (new.kind = 'leave' and new.data->>'type' not in ('annual','sick','other')) or
     (new.kind = 'group_settings' and new.data->>'reportingDays' not in ('14','30','90')) then
    raise exception using errcode = '23514', message = 'Invalid workflow option';
  end if;
  -- Initial states and valid edges together allow only the finite configured status set.
  if v_meta ? 'initial' and v_status is distinct from v_meta->>'initial' and not exists (
    select 1 from jsonb_array_elements_text(v_meta->'edges') e where split_part(e,':',2) = v_status
  ) then raise exception using errcode = '23514', message = 'Invalid workflow status'; end if;

  if coalesce(new.data->>'employeeId','') <> '' then
    select data into v_employee from public.d12_hub_records where kind = 'employees' and id = new.data->>'employeeId';
    if v_employee is null then raise exception using errcode = '23514', message = 'Employee profile not found'; end if;
    if (tg_op = 'INSERT' or old.data->>'employeeId' is distinct from new.data->>'employeeId') and v_employee->>'status' <> 'active' then
      raise exception using errcode = '23514', message = 'An active employee is required for new references';
    end if;
    perform public.d12_hub_employment(new.kind,new.data,v_employee);
  end if;

  if new.kind = 'employees' then
    v_start := public.d12_hub_date(new.data->>'startOn');
    if new.data->>'endOn' <> '' and public.d12_hub_date(new.data->>'endOn') < v_start then
      raise exception using errcode = '23514', message = 'Employment dates are reversed';
    end if;
    perform public.d12_hub_account(new.data->>'accountId',new.data->>'tenantId');
    if tg_op = 'UPDATE' then
      for v_record in select * from public.d12_hub_records where data->>'employeeId' = new.id and id <> new.id loop
        perform public.d12_hub_employment(v_record.kind,v_record.data,new.data);
        if v_record.kind = 'enrolments' then
          select data into v_link from public.d12_hub_records where kind = 'training' and id = v_record.data->>'trainingId';
          if v_link->>'tenantId' <> 'group' and v_link->>'tenantId' <> new.data->>'tenantId' then
            raise exception using errcode = '23514', message = 'Existing enrolment subsidiary would be invalid';
          end if;
        elsif v_record.kind = 'applications' then
          select data into v_link from public.d12_hub_records where kind = 'vacancies' and id = v_record.data->>'vacancyId';
          if v_link->>'tenantId' <> new.data->>'tenantId' then raise exception using errcode = '23514', message = 'Existing hire subsidiary would be invalid'; end if;
        end if;
      end loop;
      if exists (select 1 from public.d12_hub_records where kind = 'leave' and data->>'employeeId' = new.id
        and data->>'type' = 'annual' and data->>'status' = 'approved'
        group by left(data->>'startOn',4) having sum((data->>'workingDays')::integer) > (new.data->>'annualLeaveDays')::integer) then
        raise exception using errcode = '40001', message = 'Entitlement cannot be below approved annual leave';
      end if;
    end if;
  elsif new.kind = 'tasks' then
    perform public.d12_hub_account(new.data->>'assigneeId',new.data->>'tenantId');
  elsif new.kind = 'attendance' then
    if public.d12_hub_date(new.data->>'workOn') > v_today then raise exception using errcode = '23514', message = 'Attendance date cannot be future'; end if;
    if (new.data->>'checkIn' <> '' and new.data->>'checkIn' !~ '^([01]\d|2[0-3]):[0-5]\d$') or
       (new.data->>'checkOut' <> '' and new.data->>'checkOut' !~ '^([01]\d|2[0-3]):[0-5]\d$') or
       (new.data->>'checkIn' <> '' and new.data->>'checkOut' <> '' and new.data->>'checkOut' < new.data->>'checkIn') or
       (v_status = 'absent' and (new.data->>'checkIn' <> '' or new.data->>'checkOut' <> '')) then
      raise exception using errcode = '23514', message = 'Invalid attendance times';
    end if;
    if tg_op = 'UPDATE' and btrim(new.data->>'notes') = '' then raise exception using errcode = '23514', message = 'Corrections require notes'; end if;
  elsif new.kind = 'leave' then
    v_start := public.d12_hub_date(new.data->>'startOn'); v_end := public.d12_hub_date(new.data->>'endOn');
    if v_start > v_end or v_end - v_start + 1 > 366 or extract(year from v_start) <> extract(year from v_end) then
      raise exception using errcode = '23514', message = 'Leave must fit an ordered interval within one calendar year';
    end if;
    if tg_op = 'UPDATE' and v_old_status = 'approved' then
      -- Freeze approval snapshots, including notes and workingDays, on cancellation.
      new.data := jsonb_set(new.data,'{workingDays}',old.data->'workingDays');
      if v_status <> 'cancelled' or (new.data - array['status','decisionReason']) <> (old.data - array['status','decisionReason']) then
        raise exception using errcode = '40001', message = 'Approved leave can only be cancelled with a reason';
      end if;
      v_days := (old.data->>'workingDays')::integer;
    else
      select data into v_settings from public.d12_hub_records where kind = 'hr_settings';
      v_weekdays := string_to_array(coalesce(v_settings->>'workingWeekdays','1,2,3,4,5'),',');
      v_holidays := string_to_array(coalesce(v_settings->>'holidays',''),',');
      select count(*) into v_days from generate_series(0,v_end-v_start) n
      where extract(dow from (v_start+n))::integer::text = any(v_weekdays)
        and not exists (select 1 from unnest(v_holidays) h where btrim(h) = to_char(v_start+n,'YYYY-MM-DD'));
      new.data := jsonb_set(new.data,'{workingDays}',to_jsonb(v_days));
    end if;
    if v_days < 1 then raise exception using errcode = '23514', message = 'Leave must contain a working day'; end if;
    if v_status in ('rejected','cancelled') and btrim(new.data->>'decisionReason') = '' then
      raise exception using errcode = '23514', message = 'Rejection or cancellation requires a reason';
    end if;
    if v_status in ('requested','approved') and exists (
      select 1 from public.d12_hub_records r where r.kind = 'leave' and r.id <> new.id
      and r.data->>'employeeId' = new.data->>'employeeId' and r.data->>'status' in ('requested','approved')
      and public.d12_hub_date(r.data->>'startOn') <= v_end and public.d12_hub_date(r.data->>'endOn') >= v_start
    ) then raise exception using errcode = '23505', message = 'Overlapping employee leave intervals'; end if;
    if v_status = 'approved' and new.data->>'type' = 'annual' then
      select coalesce(sum((r.data->>'workingDays')::integer),0) into v_used from public.d12_hub_records r
      where r.kind = 'leave' and r.id <> new.id and r.data->>'employeeId' = new.data->>'employeeId'
      and r.data->>'status' = 'approved' and r.data->>'type' = 'annual'
      and left(r.data->>'startOn',4) = left(new.data->>'startOn',4);
      if v_used + v_days > (v_employee->>'annualLeaveDays')::integer then
        raise exception using errcode = '23505', message = 'Annual leave approval exceeds entitlement';
      end if;
    end if;
  elsif new.kind = 'payroll' then
    if tg_op = 'UPDATE' and v_old_status = 'approved' then
      if (new.data - array['status','paymentReference','paidOn','notes']) <> (old.data - array['status','paymentReference','paidOn','notes']) then
        raise exception using errcode = '40001', message = 'Approved payroll amounts and snapshots are frozen';
      end if;
    else
      new.data := new.data || jsonb_build_object('gross',(new.data->>'basic')::bigint + (new.data->>'allowances')::bigint,
        'net',(new.data->>'basic')::bigint + (new.data->>'allowances')::bigint - (new.data->>'deductions')::bigint,
        'employeeName',v_employee->>'name','tenantId',v_employee->>'tenantId');
    end if;
    if (new.data->>'gross')::bigint not between 0 and 1000000000000 or
       (new.data->>'net')::bigint not between 0 and 1000000000000 then
      raise exception using errcode = '23514', message = 'Payroll totals must be nonnegative safe integers';
    end if;
    if (v_status = 'draft' or tg_op = 'INSERT' or v_old_status = 'draft') and
       (new.data->>'paymentReference' <> '' or new.data->>'paidOn' <> '') then
      raise exception using errcode = '23514', message = 'Draft payroll cannot claim payment';
    end if;
    if v_status = 'approved' and (new.data->>'gross')::bigint <= 0 then raise exception using errcode = '23514', message = 'Positive gross is required before approval'; end if;
    if v_status = 'paid' and (btrim(new.data->>'paymentReference') = '' or new.data->>'paidOn' = '' or public.d12_hub_date(new.data->>'paidOn') > v_today) then
      raise exception using errcode = '23514', message = 'Payment requires a reference and nonfuture date';
    end if;
  elsif new.kind = 'performance' then
    perform public.d12_hub_account(new.data->>'reviewerId',v_employee->>'tenantId');
  elsif new.kind = 'vacancies' then
    if tg_op = 'UPDATE' and exists (
      select 1 from public.d12_hub_records a join public.d12_hub_records e on e.kind = 'employees' and e.id = a.data->>'employeeId'
      where a.kind = 'applications' and a.data->>'vacancyId' = new.id and e.data->>'tenantId' <> new.data->>'tenantId'
    ) then raise exception using errcode = '23514', message = 'Vacancy subsidiary conflicts with linked employee'; end if;
  elsif new.kind = 'applications' then
    select data into v_link from public.d12_hub_records where kind = 'vacancies' and id = new.data->>'vacancyId';
    if v_link is null then raise exception using errcode = '23514', message = 'Vacancy not found'; end if;
    if (tg_op = 'INSERT' or old.data->>'vacancyId' is distinct from new.data->>'vacancyId') and
       (v_link->>'status' <> 'open' or (v_link->>'closesOn' <> '' and public.d12_hub_date(v_link->>'closesOn') < v_today)) then
      raise exception using errcode = '23514', message = 'New applicants require an open vacancy';
    end if;
    if v_status = 'interview' and new.data->>'interviewOn' = '' then raise exception using errcode = '23514', message = 'Interview date required'; end if;
    if v_employee is not null and v_employee->>'tenantId' <> v_link->>'tenantId' then raise exception using errcode = '23514', message = 'Employee must match vacancy subsidiary'; end if;
    if v_status = 'hired' and v_employee is null then raise exception using errcode = '23514', message = 'Link an existing employee before recording a hire'; end if;
  elsif new.kind = 'training' then
    v_start := public.d12_hub_date(new.data->>'startsOn'); v_end := public.d12_hub_date(new.data->>'endsOn');
    if v_start > v_end then raise exception using errcode = '23514', message = 'Training dates are reversed'; end if;
    if tg_op = 'UPDATE' then
      for v_record in select e.data from public.d12_hub_records n join public.d12_hub_records e on e.kind = 'employees' and e.id = n.data->>'employeeId'
        where n.kind = 'enrolments' and n.data->>'trainingId' = new.id loop
        if (new.data->>'tenantId' <> 'group' and new.data->>'tenantId' <> v_record.data->>'tenantId') or
           v_start < public.d12_hub_date(v_record.data->>'startOn') or
           (v_record.data->>'endOn' <> '' and v_end > public.d12_hub_date(v_record.data->>'endOn')) then
          raise exception using errcode = '23514', message = 'Training edit conflicts with existing enrolment';
        end if;
      end loop;
    end if;
  elsif new.kind = 'enrolments' then
    select data into v_link from public.d12_hub_records where kind = 'training' and id = new.data->>'trainingId';
    if v_link is null then raise exception using errcode = '23514', message = 'Training session not found'; end if;
    if v_link->>'tenantId' <> 'group' and v_link->>'tenantId' <> v_employee->>'tenantId' then raise exception using errcode = '23514', message = 'Employee must match training subsidiary'; end if;
    if (tg_op = 'INSERT' or old.data->>'trainingId' is distinct from new.data->>'trainingId') and v_link->>'status' <> 'scheduled' then
      raise exception using errcode = '23514', message = 'New enrolment requires scheduled training';
    end if;
    if v_link->>'status' = 'cancelled' and v_status in ('attended','completed') then raise exception using errcode = '23514', message = 'Cancelled training cannot record attendance/completion'; end if;
  elsif new.kind = 'hr_settings' then
    if new.data->>'workingWeekdays' !~ '^[0-6](,[0-6])*$' then raise exception using errcode = '23514', message = 'Invalid working weekday list'; end if;
    v_weekdays := string_to_array(new.data->>'workingWeekdays',',');
    if cardinality(v_weekdays) <> (select count(distinct d) from unnest(v_weekdays) d) then raise exception using errcode = '23514', message = 'Working weekdays must be unique'; end if;
    if btrim(new.data->>'holidays') <> '' then
      foreach v_text in array string_to_array(new.data->>'holidays',',') loop perform public.d12_hub_date(btrim(v_text)); end loop;
    end if;
  end if;
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_at := now(); end if;
  return new;
end;
$$;
drop trigger if exists d12_hub_records_validate on public.d12_hub_records;
create trigger d12_hub_records_validate before insert or update or delete on public.d12_hub_records
  for each row execute function public.d12_hub_validate();

-- Persist safe audit and per-recipient notifications in the same transaction as the record write.
-- Existing audit table is d12_iam_audit (not d12_iam_audit_log); no applicant names, salaries or notes are copied.
create or replace function public.d12_hub_effects()
returns trigger language plpgsql security definer set search_path = public as $$
declare v public.d12_hub_records; v_meta jsonb; v_action text; v_actor text; v_tenant text;
begin
  if tg_op = 'DELETE' then v := old; else v := new; end if;
  v_meta := public.d12_hub_meta(v.kind);
  v_action := case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end;
  v_actor := nullif(current_setting('d12.hub_actor',true),'');
  if v_actor is null then select id into v_actor from public.d12_iam_users where auth_id = auth.uid(); end if;
  v_tenant := nullif(v.data->>'tenantId','group');
  insert into public.d12_iam_audit(actor_id,action,target_user_id,tenant_id,detail)
  values(v_actor,'hub.' || v.kind || '.' || v_action,v.id,v_tenant,
    jsonb_build_object('message',v.kind || ' ' || v.id || ' v' || v.version,'recordId',v.id,'kind',v.kind,'version',v.version));
  insert into public.d12_hub_notifications(recipient_id,title,href)
  select u.id,(v_meta->>'label') || ' ' || v_action,v_meta->>'href'
  from public.d12_iam_users u where u.status = 'active' and (
    public.d12_hub_can(v.kind,u.id) or (v.kind = 'tasks' and u.id = v.data->>'assigneeId' and exists (
      select 1 from public.d12_iam_grants g join public.d12_iam_roles r on r.id = g.role_id
      where g.user_id = u.id and g.tenant_id is null and r.scope = 'global'
        and ('*' = any(r.permissions) or 'group.tasks' = any(r.permissions))
    ))
  );
  return coalesce(new,old);
end;
$$;
drop trigger if exists d12_hub_records_effects on public.d12_hub_records;
create trigger d12_hub_records_effects after insert or update or delete on public.d12_hub_records
  for each row execute function public.d12_hub_effects();

create or replace function public.d12_hub_write(
  p_operation text, p_kind text, p_id text, p_version bigint, p_data jsonb, p_actor text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.d12_hub_records;
begin
  perform pg_advisory_xact_lock(1200812::bigint);
  if not public.d12_hub_can(p_kind,p_actor) then
    raise exception using errcode = '23514', message = 'Actor does not have the exact Hub workflow permission';
  end if;
  if p_id is null or btrim(p_id) = '' or length(p_id) > 100 or p_operation is null or p_operation not in ('create','update','delete') then
    raise exception using errcode = '23514', message = 'Invalid write operation or identifier';
  end if;
  perform set_config('d12.hub_actor',p_actor,true);
  if p_operation = 'create' then
    if p_version is not null then raise exception using errcode = '23514', message = 'New records do not have an expected version'; end if;
    insert into public.d12_hub_records(id,kind,data,version,created_by) values(p_id,p_kind,p_data,1,p_actor) returning * into v;
  else
    if p_version is null or p_version < 1 then raise exception using errcode = '23514', message = 'Expected version required'; end if;
    select * into v from public.d12_hub_records where id = p_id and kind = p_kind for update;
    if not found then raise exception using errcode = 'P0002', message = 'Workflow record not found'; end if;
    if v.version <> p_version then raise exception using errcode = '40001', message = 'Workflow version conflict'; end if;
    if p_operation = 'update' then
      update public.d12_hub_records set data = p_data, version = version + 1 where id = p_id and kind = p_kind and version = p_version returning * into v;
    else
      perform set_config('d12.hub_delete_id',p_id,true);
      delete from public.d12_hub_records where id = p_id and kind = p_kind and version = p_version;
      perform set_config('d12.hub_delete_id','',true);
    end if;
  end if;
  perform set_config('d12.hub_actor','',true);
  return to_jsonb(v);
end;
$$;

alter table public.d12_hub_records enable row level security;
alter table public.d12_hub_notifications enable row level security;
drop policy if exists "d12 hub records read" on public.d12_hub_records;
create policy "d12 hub records read" on public.d12_hub_records for select to authenticated using (public.d12_hub_can(kind));
drop policy if exists "d12 hub records insert" on public.d12_hub_records;
create policy "d12 hub records insert" on public.d12_hub_records for insert to authenticated with check (
  public.d12_hub_can(kind) and created_by in (select id from public.d12_iam_users where auth_id = auth.uid() and status = 'active')
);
drop policy if exists "d12 hub records update" on public.d12_hub_records;
create policy "d12 hub records update" on public.d12_hub_records for update to authenticated using (public.d12_hub_can(kind)) with check (public.d12_hub_can(kind));
-- No direct DELETE policy: the API uses the service-only CAS RPC.
drop policy if exists "d12 hub notifications read" on public.d12_hub_notifications;
create policy "d12 hub notifications read" on public.d12_hub_notifications for select to authenticated using (
  recipient_id in (select id from public.d12_iam_users where auth_id = auth.uid() and status = 'active')
);
drop policy if exists "d12 hub notifications update" on public.d12_hub_notifications;
create policy "d12 hub notifications update" on public.d12_hub_notifications for update to authenticated using (
  recipient_id in (select id from public.d12_iam_users where auth_id = auth.uid() and status = 'active')
) with check (recipient_id in (select id from public.d12_iam_users where auth_id = auth.uid() and status = 'active'));

revoke all on public.d12_hub_records, public.d12_hub_notifications from public, anon, authenticated;
grant select, insert on public.d12_hub_records to authenticated;
grant update(data,version) on public.d12_hub_records to authenticated;
grant select on public.d12_hub_notifications to authenticated;
grant update(read_at,archived_at) on public.d12_hub_notifications to authenticated;
grant select, insert, update on public.d12_hub_records to service_role;
grant select, insert, update, delete on public.d12_hub_notifications to service_role;
revoke delete on public.d12_hub_records from service_role;
revoke all on function public.d12_hub_write(text,text,text,bigint,jsonb,text) from public,anon,authenticated;
grant execute on function public.d12_hub_write(text,text,text,bigint,jsonb,text) to service_role;
revoke all on function public.d12_hub_can(text,text), public.d12_hub_account(text,text), public.d12_hub_employment(text,jsonb,jsonb),
  public.d12_hub_lock(), public.d12_hub_validate(), public.d12_hub_effects() from public,anon,authenticated;
grant execute on function public.d12_hub_can(text,text) to authenticated,service_role;
revoke all on function public.d12_hub_meta(text), public.d12_hub_date(text) from public,anon;
grant execute on function public.d12_hub_meta(text), public.d12_hub_date(text) to authenticated,service_role;

notify pgrst, 'reload schema';
commit;

-- ===== 009_subsidiary_roles.sql =====

-- Subsidiary role seats.
-- "accountant" now means the accountant inside one subsidiary; the group seat is
-- "group_accountant". Scope is read from the role row, never inferred from rank.

insert into public.d12_iam_roles (id, label, scope, rank, permissions, description)
values (
  'group_accountant', 'Group accountant', 'global', 90,
  '{finance.read,warehouse.read,reports.read}',
  'Monitors revenue, operating expenses and financial performance across the group. Read-only access.'
)
on conflict (id) do update set
  label = excluded.label,
  scope = excluded.scope,
  rank = excluded.rank,
  permissions = excluded.permissions,
  description = excluded.description;

do $$
begin
  if exists (select 1 from public.d12_iam_roles where id = 'accountant' and scope = 'global') then
    update public.d12_iam_grants set role_id = 'group_accountant' where role_id = 'accountant';
    delete from public.d12_iam_roles where id = 'accountant';
  end if;
end $$;

insert into public.d12_iam_roles (id, label, scope, rank, permissions, description)
values
  ('group_admin', 'Group administrator', 'global', 100, '{*}',
   'Full control of every subsidiary and every provisioning action.'),
  ('hr_admin', 'HR administrator', 'global', 90,
   '{hr.provision,hr.manage,hr.payroll,hr.reports,team.manage,notifications.read,iam.read,warehouse.read,reports.read,shifts.read}',
   'Provisions accounts, assigns subsidiaries and reads group reporting.'),
  ('tenant_admin', 'Subsidiary administrator', 'tenant', 60,
   '{leads.read,leads.write,customers.read,customers.write,sales.read,sales.write,tasks.read,tasks.write,projects.read,projects.write,inventory.read,inventory.write,transactions.read,transactions.write,invoices.read,invoices.write,staff.read,staff.write,telemetry.write,reports.read,shifts.read}',
   'Runs a single subsidiary workspace.'),
  ('manager', 'Manager', 'tenant', 50,
   '{leads.read,leads.write,customers.read,customers.write,sales.read,tasks.read,tasks.write,projects.read,projects.write,inventory.read,transactions.read,invoices.read,staff.read,reports.read,shifts.read}',
   'Owns pipeline, delivery and commercial performance for a team inside one subsidiary.'),
  ('hr_officer', 'HR officer', 'tenant', 45,
   '{staff.read,staff.write,tasks.read,hr.manage,hr.payroll,hr.reports,reports.read,shifts.read}',
   'Runs people operations inside one subsidiary: directory, attendance, leave, recruitment, training, performance and payroll preparation.'),
  ('accountant', 'Accountant', 'tenant', 45,
   '{transactions.read,transactions.write,invoices.read,invoices.write,sales.read,inventory.read,staff.read,reports.read}',
   'Keeps the books for one subsidiary: expenses, invoices, revenue records and finance reports.'),
  ('account_executive', 'Account executive', 'tenant', 35,
   '{leads.read,leads.write,customers.read,customers.write,sales.read,sales.write,invoices.read,tasks.read,tasks.write,projects.read,reports.read}',
   'Owns the sales pipeline and customer relationships inside one subsidiary.'),
  ('employee', 'Employee', 'tenant', 10,
   '{leads.read,customers.read,sales.read,tasks.read,projects.read,inventory.read,transactions.read,invoices.read,staff.read}',
   'Read access to delivery data inside one subsidiary.')
on conflict (id) do update set
  label = excluded.label,
  scope = excluded.scope,
  rank = excluded.rank,
  permissions = excluded.permissions,
  description = excluded.description;

notify pgrst, 'reload schema';

-- ===== 010_shift_records.sql =====

-- Shift sign-out records.
-- Each row is one completed working shift: start comes from the signed-in
-- session, end from the moment the person ends their shift or signs out.
-- The hub is the only writer; subsidiary apps forward their session cookie.

create table if not exists public.d12_shift_records (
  id text primary key,
  user_id text not null,
  tenant_id text not null,
  name text not null,
  email text not null default '',
  role text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  minutes integer not null check (minutes >= 0),
  ended_via text not null default 'shift' check (ended_via in ('shift', 'signout')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists d12_shift_records_tenant_day_idx
  on public.d12_shift_records (tenant_id, ended_at desc);

create index if not exists d12_shift_records_user_day_idx
  on public.d12_shift_records (user_id, ended_at desc);

alter table public.d12_shift_records enable row level security;

revoke all on public.d12_shift_records from anon, authenticated;
grant select, insert, update, delete on public.d12_shift_records to service_role;

notify pgrst, 'reload schema';

-- ===== 011_account_executives.sql =====

-- One account executive per subsidiary.
-- Safe to re-run: inserts never overwrite existing rows or grants.

insert into public.d12_iam_users (id, name, email, status)
values
  ('usr_passito_sales', 'Moses Kiggundu', 'sales@passito.ug', 'active'),
  ('usr_mariz_sales', 'Diana Akello', 'sales@mariz.ug', 'active'),
  ('usr_rub_sales', 'Ritah Nabirye', 'sales@rubshoots.ug', 'active'),
  ('usr_shop_sales', 'Kevin Wanyama', 'sales@shopforme.ug', 'active'),
  ('usr_expresso_sales', 'Sylvia Nassuna', 'sales@expresso.ug', 'active')
on conflict (id) do nothing;

insert into public.d12_iam_grants (id, user_id, role_id, tenant_id, granted_by)
values
  ('grt_passito_sales', 'usr_passito_sales', 'account_executive', 'passito', 'usr_marvin'),
  ('grt_mariz_sales', 'usr_mariz_sales', 'account_executive', 'mariz', 'usr_marvin'),
  ('grt_rub_sales', 'usr_rub_sales', 'account_executive', 'rub-shoots', 'usr_marvin'),
  ('grt_shop_sales', 'usr_shop_sales', 'account_executive', 'shop-for-me', 'usr_marvin'),
  ('grt_expresso_sales', 'usr_expresso_sales', 'account_executive', 'expresso-point', 'usr_marvin')
on conflict do nothing;

notify pgrst, 'reload schema';

-- ===== 012_employees.sql =====

-- Two staff-level employees per subsidiary.
-- Safe to re-run: inserts never overwrite existing rows or grants.

insert into public.d12_iam_users (id, name, email, status)
values
  ('usr_passito_staff1', 'Grace Nalwoga', 'staff1@passito.ug', 'active'),
  ('usr_passito_staff2', 'Ivan Kato', 'staff2@passito.ug', 'active'),
  ('usr_mariz_staff1', 'Milly Adongo', 'staff1@mariz.ug', 'active'),
  ('usr_mariz_staff2', 'Patrick Ojok', 'staff2@mariz.ug', 'active'),
  ('usr_rub_staff1', 'Joan Nakabuye', 'staff1@rubshoots.ug', 'active'),
  ('usr_rub_staff2', 'Emmanuel Mwesigwa', 'staff2@rubshoots.ug', 'active'),
  ('usr_shop_staff1', 'Fiona Namutebi', 'staff1@shopforme.ug', 'active'),
  ('usr_shop_staff2', 'Samuel Bwire', 'staff2@shopforme.ug', 'active'),
  ('usr_expresso_staff1', 'Aisha Nabukeera', 'staff1@expresso.ug', 'active'),
  ('usr_expresso_staff2', 'Martin Ssekandi', 'staff2@expresso.ug', 'active')
on conflict (id) do nothing;

insert into public.d12_iam_grants (id, user_id, role_id, tenant_id, granted_by)
values
  ('grt_passito_staff1', 'usr_passito_staff1', 'employee', 'passito', 'usr_marvin'),
  ('grt_passito_staff2', 'usr_passito_staff2', 'employee', 'passito', 'usr_marvin'),
  ('grt_mariz_staff1', 'usr_mariz_staff1', 'employee', 'mariz', 'usr_marvin'),
  ('grt_mariz_staff2', 'usr_mariz_staff2', 'employee', 'mariz', 'usr_marvin'),
  ('grt_rub_staff1', 'usr_rub_staff1', 'employee', 'rub-shoots', 'usr_marvin'),
  ('grt_rub_staff2', 'usr_rub_staff2', 'employee', 'rub-shoots', 'usr_marvin'),
  ('grt_shop_staff1', 'usr_shop_staff1', 'employee', 'shop-for-me', 'usr_marvin'),
  ('grt_shop_staff2', 'usr_shop_staff2', 'employee', 'shop-for-me', 'usr_marvin'),
  ('grt_expresso_staff1', 'usr_expresso_staff1', 'employee', 'expresso-point', 'usr_marvin'),
  ('grt_expresso_staff2', 'usr_expresso_staff2', 'employee', 'expresso-point', 'usr_marvin')
on conflict do nothing;

notify pgrst, 'reload schema';

-- ===== 013_delete_account_executives.sql =====

-- Remove the account executive accounts seeded in 011_account_executives.sql.
-- The account_executive role itself stays provisionable from the hub.

delete from public.d12_iam_grants
where user_id in (
  'usr_passito_sales',
  'usr_mariz_sales',
  'usr_rub_sales',
  'usr_shop_sales',
  'usr_expresso_sales'
);

delete from public.d12_iam_users
where id in (
  'usr_passito_sales',
  'usr_mariz_sales',
  'usr_rub_sales',
  'usr_shop_sales',
  'usr_expresso_sales'
);

notify pgrst, 'reload schema';

-- ===== 014_employee_scope.sql =====

-- Employees do not get Finance, Inventory or Staff access.

update public.d12_iam_roles
set permissions = '{leads.read,customers.read,sales.read,tasks.read,projects.read,invoices.read}'
where id = 'employee';

notify pgrst, 'reload schema';

-- ===== 015_sales_invoice_owner.sql =====

-- Sales and invoices gain an owner, backfilled from the linked customer's owner.

alter table public.d12_ops_sales add column if not exists owner text not null default '';
alter table public.d12_ops_invoices add column if not exists owner text not null default '';

-- Mariz partial payments: capture customer contact details and who collected each payment.
alter table public.d12_ops_sales add column if not exists customer_phone text not null default '';
alter table public.d12_ops_sales add column if not exists customer_email text not null default '';
alter table public.d12_ops_sales add column if not exists payment_type text not null default 'full';
alter table public.d12_ops_sales add column if not exists collected_by text not null default '';
alter table public.d12_ops_sales add column if not exists collected_by_email text not null default '';
alter table public.d12_ops_sales add column if not exists agreed_value numeric(16, 2) not null default 0;
alter table public.d12_ops_sales add column if not exists balance_after numeric(16, 2) not null default 0;
alter table public.d12_ops_sales add column if not exists installment_no integer not null default 0;

alter table public.d12_ops_customers add column if not exists paid_total numeric(16, 2) not null default 0;
alter table public.d12_ops_customers add column if not exists last_payment_on date;
alter table public.d12_ops_customers add column if not exists last_payment_by text not null default '';
alter table public.d12_ops_customers add column if not exists last_payment_by_email text not null default '';

update public.d12_ops_sales s
set owner = c.owner
from public.d12_ops_customers c
where s.owner = ''
  and c.tenant_id = s.tenant_id
  and (
    c.id = s.customer_id
    or (
      not exists (
        select 1 from public.d12_ops_customers x
        where x.id = s.customer_id and x.tenant_id = s.tenant_id
      )
      and coalesce(s.customer_name, '') <> ''
      and c.name = s.customer_name
    )
  );

update public.d12_ops_invoices i
set owner = c.owner
from public.d12_ops_customers c
where i.owner = ''
  and c.tenant_id = i.tenant_id
  and (
    c.id = i.customer_id
    or (
      not exists (
        select 1 from public.d12_ops_customers x
        where x.id = i.customer_id and x.tenant_id = i.tenant_id
      )
      and coalesce(i.customer_name, '') <> ''
      and c.name = i.customer_name
    )
  );

notify pgrst, 'reload schema';

-- ===== 016_employee_create.sql =====

-- Employees can create leads and customers, but keep read-only access elsewhere.

update public.d12_iam_roles
set permissions = '{leads.read,leads.write,customers.read,customers.write,sales.read,tasks.read,projects.read,invoices.read}'
where id = 'employee';

notify pgrst, 'reload schema';

-- ===== 017_employee_sales_invoices.sql =====

-- Employees can also record sales and invoices.

update public.d12_iam_roles
set permissions = '{leads.read,leads.write,customers.read,customers.write,sales.read,sales.write,tasks.read,projects.read,invoices.read,invoices.write}'
where id = 'employee';

notify pgrst, 'reload schema';

-- ===== 018_employee_tasks_projects.sql =====

-- Employees can also create tasks and projects.

update public.d12_iam_roles
set permissions = '{leads.read,leads.write,customers.read,customers.write,sales.read,sales.write,tasks.read,tasks.write,projects.read,projects.write,invoices.read,invoices.write}'
where id = 'employee';

notify pgrst, 'reload schema';

-- ===== 019_reporting_flow.sql =====

-- Reporting flow: subsidiary desks report upward, group desks receive.
-- Adds the reporting, team, notification and workstation permissions, the
-- report ledger and per-user workstation profiles.

update public.d12_iam_roles
set permissions = '{customers.read,customers.write,invoices.read,invoices.write,leads.read,leads.write,projects.read,projects.write,reports.submit,sales.read,sales.write,tasks.read,tasks.write}'
where id = 'employee';

update public.d12_iam_roles
set permissions = '{customers.read,customers.write,inventory.read,invoices.read,leads.read,leads.write,notifications.read,projects.read,projects.write,reports.read,reports.submit,sales.read,shifts.read,staff.read,staff.write,tasks.read,tasks.write,team.manage,transactions.read}'
where id = 'manager';

update public.d12_iam_roles
set permissions = '{customers.read,customers.write,inventory.read,inventory.write,invoices.read,invoices.write,leads.read,leads.write,notifications.read,projects.read,projects.write,reports.read,reports.submit,sales.read,sales.write,shifts.read,staff.read,staff.write,tasks.read,tasks.write,team.manage,telemetry.write,transactions.read,transactions.write}'
where id = 'tenant_admin';

update public.d12_iam_roles
set permissions = '{hr.manage,hr.payroll,hr.reports,notifications.read,reports.read,reports.submit,shifts.read,staff.read,staff.write,tasks.read}'
where id = 'hr_officer';

update public.d12_iam_roles
set permissions = '{inventory.read,invoices.read,invoices.write,notifications.read,reports.read,reports.submit,sales.read,staff.read,transactions.read,transactions.write}'
where id = 'accountant';

update public.d12_iam_roles
set permissions = '{customers.read,customers.write,invoices.read,leads.read,leads.write,projects.read,reports.read,reports.submit,sales.read,sales.write,tasks.read,tasks.write}'
where id = 'account_executive';

create table if not exists public.d12_reports (
  id text primary key,
  tenant_id text not null references public.d12_tenants (id) on delete cascade,
  author_id text not null,
  author_name text not null,
  author_role text not null,
  audience text not null check (audience in ('accountant', 'group_accountant', 'group_hr', 'group_admin')),
  kind text not null check (kind in ('sales', 'invoices', 'finance', 'operations', 'hr', 'general')),
  title text not null,
  summary text not null default '',
  period_start date not null,
  period_end date not null,
  metrics jsonb not null default '{}'::jsonb,
  status text not null default 'submitted' check (status in ('submitted', 'acknowledged')),
  acknowledged_by text,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists d12_reports_tenant_idx on public.d12_reports (tenant_id, created_at desc);
create index if not exists d12_reports_audience_idx on public.d12_reports (audience, created_at desc);

create table if not exists public.d12_user_profiles (
  user_id text primary key,
  tenant_id text,
  display_name text not null default '',
  title text not null default '',
  phone text not null default '',
  bio text not null default '',
  accent text not null default '',
  density text not null default 'comfortable' check (density in ('compact', 'comfortable')),
  notify_reports boolean not null default true,
  notify_shifts boolean not null default true,
  notify_weekly boolean not null default true,
  updated_at timestamptz not null default now()
);

notify pgrst, 'reload schema';

-- ===== 020_report_sections.sql =====

-- Structured report sections filed alongside the narrative summary.
-- Additive and backwards compatible: existing reports read as empty sections.
alter table public.d12_reports
  add column if not exists highlights text not null default '',
  add column if not exists risks text not null default '',
  add column if not exists next_steps text not null default '';

notify pgrst, 'reload schema';

-- ===== 021_link_seed_auth_users.sql =====

-- Link pre-seeded IAM rows to Supabase Auth users.
-- Run this after the auth users exist (invited or created through
-- scripts/link-seed-users.mjs). Idempotent: only fills a missing auth_id and
-- matches on the case-insensitive email that d12_iam_users already enforces.
update public.d12_iam_users u
set auth_id = a.id
from auth.users a
where u.auth_id is null
  and lower(a.email) = lower(u.email);

notify pgrst, 'reload schema';

-- ===== 022_mariz_workspace.sql =====

-- Mariz workspace enhancements: lead briefs, agreed customer services, issue dates,
-- task briefs with due times, and the Meetings and Calls sections.
-- Additive only; safe to re-run. Run after 021_link_seed_auth_users.sql.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.d12_ops_leads add column if not exists description text not null default '';
alter table public.d12_ops_customers add column if not exists issue_on date;
alter table public.d12_ops_customers add column if not exists services jsonb not null default '[]'::jsonb;
alter table public.d12_ops_tasks add column if not exists due_time text not null default '';
alter table public.d12_ops_tasks add column if not exists description text not null default '';

-- Customers can now be marked paid, which records a sale in the Mariz workspace.
alter table public.d12_ops_customers drop constraint if exists d12_ops_customers_status_check;
alter table public.d12_ops_customers
  add constraint d12_ops_customers_status_check
  check (status in ('active', 'dormant', 'paid'));

create index if not exists d12_ops_customers_issue_idx
  on public.d12_ops_customers (tenant_id, issue_on desc);

-- ---------------------------------------------------------------------------
-- Meetings
-- ---------------------------------------------------------------------------
create table if not exists public.d12_ops_meetings (
  id text primary key,
  tenant_id text not null references public.d12_tenants (id) on delete cascade,
  title text not null,
  meeting_on date not null,
  start_time text not null default '',
  end_time text not null default '',
  location text,
  attendees text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'held', 'cancelled')),
  owner text,
  follow_up_on date,
  agenda text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists d12_ops_meetings_tenant_idx
  on public.d12_ops_meetings (tenant_id, meeting_on desc);

-- ---------------------------------------------------------------------------
-- Calls
-- ---------------------------------------------------------------------------
create table if not exists public.d12_ops_calls (
  id text primary key,
  tenant_id text not null references public.d12_tenants (id) on delete cascade,
  contact_name text not null,
  company text,
  phone text,
  direction text not null default 'outbound'
    check (direction in ('inbound', 'outbound')),
  call_on date not null,
  call_time text not null default '',
  duration_min numeric(8, 2) not null default 0,
  purpose text,
  outcome text not null default 'connected'
    check (outcome in ('connected', 'missed', 'follow_up', 'closed')),
  owner text,
  follow_up_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists d12_ops_calls_tenant_idx
  on public.d12_ops_calls (tenant_id, call_on desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists d12_ops_meetings_touch on public.d12_ops_meetings;
create trigger d12_ops_meetings_touch before update on public.d12_ops_meetings
for each row execute function public.d12_touch_updated_at();

drop trigger if exists d12_ops_calls_touch on public.d12_ops_calls;
create trigger d12_ops_calls_touch before update on public.d12_ops_calls
for each row execute function public.d12_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Telemetry outbox: extend the entity mapping with meetings and calls
-- ---------------------------------------------------------------------------
create or replace function public.d12_enqueue_ops_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_op text := case lower(tg_op)
    when 'insert' then 'created'
    when 'update' then 'updated'
    when 'delete' then 'deleted'
    else lower(tg_op)
  end;
  v_entity text;
  v_type text;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  v_entity := case tg_table_name
    when 'd12_ops_leads' then 'leads'
    when 'd12_ops_customers' then 'customers'
    when 'd12_ops_sales' then 'sales'
    when 'd12_ops_tasks' then 'tasks'
    when 'd12_ops_meetings' then 'meetings'
    when 'd12_ops_calls' then 'calls'
    when 'd12_ops_projects' then 'projects'
    when 'd12_ops_inventory' then 'inventory'
    when 'd12_ops_transactions' then 'transactions'
    when 'd12_ops_invoices' then 'invoices'
    when 'd12_ops_staff' then 'staff'
  end;

  v_type := (case v_entity
    when 'leads' then 'lead'
    when 'customers' then 'customer'
    when 'sales' then 'sale'
    when 'tasks' then 'task'
    when 'meetings' then 'meeting'
    when 'calls' then 'call'
    when 'projects' then 'project'
    when 'inventory' then 'inventory'
    when 'transactions' then 'transaction'
    when 'invoices' then 'invoice'
    when 'staff' then 'staff'
  end) || '.' || v_op;

  insert into public.d12_telemetry_outbox
    (tenant_id, event_id, event_type, entity, entity_id, payload, occurred_at)
  values
    (v_row ->> 'tenant_id',
     'evt_' || replace(gen_random_uuid()::text, '-', ''),
     v_type,
     v_entity,
     v_row ->> 'id',
     jsonb_build_object('op', tg_op, 'record', v_row),
     now());

  return coalesce(new, old);
end;
$$;

drop trigger if exists d12_ops_meetings_enqueue on public.d12_ops_meetings;
create trigger d12_ops_meetings_enqueue after insert or update or delete on public.d12_ops_meetings
for each row execute function public.d12_enqueue_ops_event();

drop trigger if exists d12_ops_calls_enqueue on public.d12_ops_calls;
create trigger d12_ops_calls_enqueue after insert or update or delete on public.d12_ops_calls
for each row execute function public.d12_enqueue_ops_event();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.d12_ops_meetings enable row level security;
alter table public.d12_ops_calls enable row level security;

drop policy if exists "d12 meetings read" on public.d12_ops_meetings;
create policy "d12 meetings read" on public.d12_ops_meetings
  for select to authenticated
  using (public.d12_has_permission('meetings.read', tenant_id));

drop policy if exists "d12 meetings insert" on public.d12_ops_meetings;
create policy "d12 meetings insert" on public.d12_ops_meetings
  for insert to authenticated
  with check (public.d12_has_permission('meetings.write', tenant_id));

drop policy if exists "d12 meetings update" on public.d12_ops_meetings;
create policy "d12 meetings update" on public.d12_ops_meetings
  for update to authenticated
  using (public.d12_has_permission('meetings.write', tenant_id))
  with check (public.d12_has_permission('meetings.write', tenant_id));

drop policy if exists "d12 meetings delete" on public.d12_ops_meetings;
create policy "d12 meetings delete" on public.d12_ops_meetings
  for delete to authenticated
  using (public.d12_has_permission('meetings.write', tenant_id));

drop policy if exists "d12 calls read" on public.d12_ops_calls;
create policy "d12 calls read" on public.d12_ops_calls
  for select to authenticated
  using (public.d12_has_permission('calls.read', tenant_id));

drop policy if exists "d12 calls insert" on public.d12_ops_calls;
create policy "d12 calls insert" on public.d12_ops_calls
  for insert to authenticated
  with check (public.d12_has_permission('calls.write', tenant_id));

drop policy if exists "d12 calls update" on public.d12_ops_calls;
create policy "d12 calls update" on public.d12_ops_calls
  for update to authenticated
  using (public.d12_has_permission('calls.write', tenant_id))
  with check (public.d12_has_permission('calls.write', tenant_id));

drop policy if exists "d12 calls delete" on public.d12_ops_calls;
create policy "d12 calls delete" on public.d12_ops_calls
  for delete to authenticated
  using (public.d12_has_permission('calls.write', tenant_id));

-- ---------------------------------------------------------------------------
-- Role permissions
-- ---------------------------------------------------------------------------
update public.d12_iam_roles
set permissions = (
  select array_agg(distinct permission order by permission)
  from unnest(
    permissions || array['meetings.read', 'meetings.write', 'calls.read', 'calls.write']
  ) as permission
)
where id in ('tenant_admin', 'manager', 'account_executive', 'employee');

-- The Mariz HR desk runs the same workspace sections for its subsidiary.
update public.d12_iam_roles
set permissions = (
  select array_agg(distinct permission order by permission)
  from unnest(
    permissions || array[
      'leads.read', 'leads.write',
      'customers.read', 'customers.write',
      'sales.read', 'tasks.write',
      'meetings.read', 'meetings.write',
      'calls.read', 'calls.write'
    ]
  ) as permission
)
where id = 'hr_officer';

notify pgrst, 'reload schema';
