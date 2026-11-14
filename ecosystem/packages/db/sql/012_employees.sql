-- Two staff-level employees per subsidiary.
-- Safe to re-run: inserts never overwrite existing rows or grants.

insert into public.d12_iam_users (id, name, email, status)
values
  ('usr_passito_staff1', 'Grace Nalwoga', 'staff1@passito.ug', 'active'),
  ('usr_passito_staff2', 'Ivan Kato', 'staff2@passito.ug', 'active'),
  ('usr_mariz_staff1', 'Milly Adongo', 'staff1@mariz.ug', 'active'),
  ('usr_mariz_staff2', 'Patrick Ojok', 'staff2@mariz.ug', 'active'),
  ('usr_rub_staff1', 'Joan Nakabuye', 'staff1@rubshoots.ug', 'active'),
  ('usr_rub_staff2', 'Emmanuel Mwesigwa', 'staff2@rubshoots.ug', 'active'),
  ('usr_shop_staff1', 'Fiona Namutebi', 'staff1@shopforme.ug', 'active'),
  ('usr_shop_staff2', 'Samuel Bwire', 'staff2@shopforme.ug', 'active'),
  ('usr_expresso_staff1', 'Aisha Nabukeera', 'staff1@expresso.ug', 'active'),
  ('usr_expresso_staff2', 'Martin Ssekandi', 'staff2@expresso.ug', 'active')
on conflict (id) do nothing;

insert into public.d12_iam_grants (id, user_id, role_id, tenant_id, granted_by)
values
  ('grt_passito_staff1', 'usr_passito_staff1', 'employee', 'passito', 'usr_marvin'),
  ('grt_passito_staff2', 'usr_passito_staff2', 'employee', 'passito', 'usr_marvin'),
  ('grt_mariz_staff1', 'usr_mariz_staff1', 'employee', 'mariz', 'usr_marvin'),
  ('grt_mariz_staff2', 'usr_mariz_staff2', 'employee', 'mariz', 'usr_marvin'),
  ('grt_rub_staff1', 'usr_rub_staff1', 'employee', 'rub-shoots', 'usr_marvin'),
  ('grt_rub_staff2', 'usr_rub_staff2', 'employee', 'rub-shoots', 'usr_marvin'),
  ('grt_shop_staff1', 'usr_shop_staff1', 'employee', 'shop-for-me', 'usr_marvin'),
  ('grt_shop_staff2', 'usr_shop_staff2', 'employee', 'shop-for-me', 'usr_marvin'),
  ('grt_expresso_staff1', 'usr_expresso_staff1', 'employee', 'expresso-point', 'usr_marvin'),
  ('grt_expresso_staff2', 'usr_expresso_staff2', 'employee', 'expresso-point', 'usr_marvin')
on conflict do nothing;

notify pgrst, 'reload schema';
