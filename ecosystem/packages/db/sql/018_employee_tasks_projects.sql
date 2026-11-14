-- Employees can also create tasks and projects.

update public.d12_iam_roles
set permissions = '{leads.read,leads.write,customers.read,customers.write,sales.read,sales.write,tasks.read,tasks.write,projects.read,projects.write,invoices.read,invoices.write}'
where id = 'employee';

notify pgrst, 'reload schema';
