-- Employees do not get Finance, Inventory or Staff access.

update public.d12_iam_roles
set permissions = '{leads.read,customers.read,sales.read,tasks.read,projects.read,invoices.read}'
where id = 'employee';

notify pgrst, 'reload schema';
