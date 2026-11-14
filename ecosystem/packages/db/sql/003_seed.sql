-- Seed data for the District 12 ecosystem.
-- Safe to re-run: every insert is idempotent and never overwrites edits.

insert into public.d12_tenants
  (id, name, short_name, sector, mark, color, tagline, managing_director, domain, app_url, port, status)
values
  ('passito', 'Passito Marketing', 'Passito', 'Marketing & advertising', 'PM', '#DB2777',
   'Brand campaigns that move markets', 'Sarah Nakato',
   'passito.district12.co.ug', 'http://localhost:3001', 3001, 'active'),
  ('mariz', 'Mariz Outsourcing (U) SMC Ltd', 'Mariz', 'Outsourcing & staffing', 'MZ', '#0F766E',
   'People operations, outsourced with care', 'Joseph Okello',
   'mariz.district12.co.ug', 'http://localhost:3002', 3002, 'active'),
  ('rub-shoots', 'Rub Shoots Photography', 'Rub Shoots', 'Photography & media', 'RS', '#BE185D',
   'Stories framed for the long run', 'Patricia Namusoke',
   'rubshoots.district12.co.ug', 'http://localhost:3003', 3003, 'active'),
  ('shop-for-me', 'Shop For Me', 'Shop For Me', 'Retail & e-commerce', 'SF', '#EA580C',
   'Personal shopping, delivered', 'Andrew Ochieng',
   'shopforme.district12.co.ug', 'http://localhost:3004', 3004, 'active'),
  ('expresso-point', 'Expresso Point', 'Expresso', 'Coffee & hospitality', 'EP', '#92400E',
   'The daily cup, done properly', 'Hadijah Nakimuli',
   'expresso.district12.co.ug', 'http://localhost:3005', 3005, 'active')
on conflict (id) do nothing;

insert into public.d12_iam_roles (id, label, scope, rank, permissions, description)
values
  ('group_admin', 'Group administrator', 'global', 100, '{*}',
   'Full control of every subsidiary and every provisioning action.'),
  ('hr_admin', 'HR administrator', 'global', 90,
   '{hr.provision,iam.read,warehouse.read,reports.read}',
   'Creates and suspends accounts, assigns subsidiaries, reads group reporting.'),
  ('tenant_admin', 'Subsidiary administrator', 'tenant', 60,
   '{leads.read,leads.write,customers.read,customers.write,sales.read,sales.write,tasks.read,tasks.write,telemetry.write,reports.read}',
   'Runs a single subsidiary workspace.'),
  ('manager', 'Manager', 'tenant', 40,
   '{leads.read,leads.write,customers.read,sales.read,tasks.read,tasks.write,reports.read}',
   'Owns pipeline and delivery for a team inside one subsidiary.'),
  ('employee', 'Employee', 'tenant', 10,
   '{leads.read,customers.read,sales.read,tasks.read}',
   'Read access to the subsidiary operating data needed for delivery.')
on conflict (id) do nothing;

insert into public.d12_iam_users (id, name, email, status)
values
  ('usr_marvin', 'Marvin', 'marvin@district12.co.ug', 'active'),
  ('usr_hr', 'HR Desk', 'hr@district12.co.ug', 'active'),
  ('usr_sarah', 'Sarah Nakato', 'sarah@passito.ug', 'active'),
  ('usr_joseph', 'Joseph Okello', 'joseph@mariz.ug', 'active'),
  ('usr_patricia', 'Patricia Namusoke', 'patricia@rubshoots.ug', 'active'),
  ('usr_andrew', 'Andrew Ochieng', 'andrew@shopforme.ug', 'active'),
  ('usr_hadijah', 'Hadijah Nakimuli', 'hadijah@expresso.ug', 'active'),
  ('usr_brian', 'Brian Ssemakula', 'brian@passito.ug', 'active')
on conflict do nothing;

insert into public.d12_iam_grants (id, user_id, role_id, tenant_id, granted_by)
values
  ('grt_marvin_group', 'usr_marvin', 'group_admin', null, 'usr_marvin'),
  ('grt_hr_group', 'usr_hr', 'hr_admin', null, 'usr_marvin'),
  ('grt_sarah_passito', 'usr_sarah', 'tenant_admin', 'passito', 'usr_marvin'),
  ('grt_joseph_mariz', 'usr_joseph', 'tenant_admin', 'mariz', 'usr_marvin'),
  ('grt_patricia_rub', 'usr_patricia', 'tenant_admin', 'rub-shoots', 'usr_marvin'),
  ('grt_andrew_shop', 'usr_andrew', 'tenant_admin', 'shop-for-me', 'usr_marvin'),
  ('grt_hadijah_expresso', 'usr_hadijah', 'tenant_admin', 'expresso-point', 'usr_marvin'),
  ('grt_brian_passito', 'usr_brian', 'manager', 'passito', 'usr_marvin')
on conflict do nothing;

-- After creating matching Supabase Auth users, link them so RLS resolves the
-- current identity. Demo mode (D12_DEMO_MODE=true) does not need this:
--
-- update public.d12_iam_users u
-- set auth_id = a.id
-- from auth.users a
-- where lower(a.email) = lower(u.email)
--   and u.auth_id is null;

notify pgrst, 'reload schema';
