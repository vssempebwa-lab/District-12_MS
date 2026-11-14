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
