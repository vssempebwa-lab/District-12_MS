-- Remove the account executive accounts seeded in 011_account_executives.sql.
-- The account_executive role itself stays provisionable from the hub.

delete from public.d12_iam_grants
where user_id in (
  'usr_passito_sales',
  'usr_mariz_sales',
  'usr_rub_sales',
  'usr_shop_sales',
  'usr_expresso_sales'
);

delete from public.d12_iam_users
where id in (
  'usr_passito_sales',
  'usr_mariz_sales',
  'usr_rub_sales',
  'usr_shop_sales',
  'usr_expresso_sales'
);

notify pgrst, 'reload schema';
