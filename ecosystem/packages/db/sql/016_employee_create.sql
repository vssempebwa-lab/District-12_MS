-- Employees can create leads and customers, but keep read-only access elsewhere.

update public.d12_iam_roles
set permissions = '{leads.read,leads.write,customers.read,customers.write,sales.read,tasks.read,projects.read,invoices.read}'
where id = 'employee';

notify pgrst, 'reload schema';
