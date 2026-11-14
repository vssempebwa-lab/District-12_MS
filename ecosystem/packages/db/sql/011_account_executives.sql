-- One account executive per subsidiary.
-- Safe to re-run: inserts never overwrite existing rows or grants.

insert into public.d12_iam_users (id, name, email, status)
values
  ('usr_passito_sales', 'Moses Kiggundu', 'sales@passito.ug', 'active'),
  ('usr_mariz_sales', 'Diana Akello', 'sales@mariz.ug', 'active'),
  ('usr_rub_sales', 'Ritah Nabirye', 'sales@rubshoots.ug', 'active'),
  ('usr_shop_sales', 'Kevin Wanyama', 'sales@shopforme.ug', 'active'),
  ('usr_expresso_sales', 'Sylvia Nassuna', 'sales@expresso.ug', 'active')
on conflict (id) do nothing;

insert into public.d12_iam_grants (id, user_id, role_id, tenant_id, granted_by)
values
  ('grt_passito_sales', 'usr_passito_sales', 'account_executive', 'passito', 'usr_marvin'),
  ('grt_mariz_sales', 'usr_mariz_sales', 'account_executive', 'mariz', 'usr_marvin'),
  ('grt_rub_sales', 'usr_rub_sales', 'account_executive', 'rub-shoots', 'usr_marvin'),
  ('grt_shop_sales', 'usr_shop_sales', 'account_executive', 'shop-for-me', 'usr_marvin'),
  ('grt_expresso_sales', 'usr_expresso_sales', 'account_executive', 'expresso-point', 'usr_marvin')
on conflict do nothing;

notify pgrst, 'reload schema';
