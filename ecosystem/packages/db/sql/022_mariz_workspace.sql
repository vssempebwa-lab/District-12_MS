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
