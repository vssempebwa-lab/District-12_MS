-- Employees can also record sales and invoices.

update public.d12_iam_roles
set permissions = '{leads.read,leads.write,customers.read,customers.write,sales.read,sales.write,tasks.read,projects.read,invoices.read,invoices.write}'
where id = 'employee';

notify pgrst, 'reload schema';
