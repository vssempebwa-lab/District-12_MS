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
