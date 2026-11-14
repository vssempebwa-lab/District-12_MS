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
