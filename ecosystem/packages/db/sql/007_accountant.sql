insert into public.d12_iam_roles (id, label, scope, rank, permissions, description)
values (
  'accountant', 'Group accountant', 'global', 90,
  '{finance.read,warehouse.read,reports.read}',
  'Monitors revenue, operating expenses and financial performance across the group. Read-only access.'
)
on conflict (id) do nothing;

insert into public.d12_iam_users (id, name, email, status)
values ('usr_accountant', 'Finance Desk', 'accountant@district12.co.ug', 'active')
on conflict do nothing;

insert into public.d12_iam_grants (id, user_id, role_id, tenant_id, granted_by)
select 'grt_accountant_group', id, 'accountant', null, 'usr_marvin'
from public.d12_iam_users
where email = 'accountant@district12.co.ug'
on conflict do nothing;

notify pgrst, 'reload schema';
