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
