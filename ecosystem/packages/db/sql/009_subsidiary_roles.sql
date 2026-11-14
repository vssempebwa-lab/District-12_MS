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
