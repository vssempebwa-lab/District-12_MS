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
