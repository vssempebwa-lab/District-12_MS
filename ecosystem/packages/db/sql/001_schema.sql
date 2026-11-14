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
  amount numeric(16, 2) not null default 0,
  status text not null default 'pending' check (status in ('paid', 'pending', 'refunded')),
  channel text,
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
