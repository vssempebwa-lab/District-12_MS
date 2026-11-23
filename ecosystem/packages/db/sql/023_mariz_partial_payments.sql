-- Mariz partial payments: capture customer contact details, who collected each
-- payment, and how the payment relates to the customer's agreed value.
-- Additive only; safe to re-run. Run after 022_mariz_workspace.sql.

alter table public.d12_ops_sales add column if not exists customer_phone text not null default '';
alter table public.d12_ops_sales add column if not exists customer_email text not null default '';
alter table public.d12_ops_sales add column if not exists payment_type text not null default 'full'
  check (payment_type in ('full', 'partial'));
alter table public.d12_ops_sales add column if not exists collected_by text not null default '';
alter table public.d12_ops_sales add column if not exists collected_by_email text not null default '';
alter table public.d12_ops_sales add column if not exists agreed_value numeric(16, 2) not null default 0;
alter table public.d12_ops_sales add column if not exists balance_after numeric(16, 2) not null default 0;
alter table public.d12_ops_sales add column if not exists installment_no integer not null default 0;

-- Mirror the latest payment on the customer so payment data shows in both tables.
alter table public.d12_ops_customers add column if not exists paid_total numeric(16, 2) not null default 0;
alter table public.d12_ops_customers add column if not exists last_payment_on date;
alter table public.d12_ops_customers add column if not exists last_payment_by text not null default '';
alter table public.d12_ops_customers add column if not exists last_payment_by_email text not null default '';

notify pgrst, 'reload schema';