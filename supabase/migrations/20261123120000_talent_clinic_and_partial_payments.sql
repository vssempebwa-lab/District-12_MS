-- Talent Clinic subsidiary + Mariz partial-payment columns.
-- Safe to re-run (uses if not exists / on conflict).

-- Tenant
insert into public.d12_tenants (id, name, short_name, sector, mark, color, tagline, managing_director, domain, app_url, port, status)
values ('talent-clinic', 'Talent Clinic', 'Talent Clinic', 'Talent development & training', 'TC', '#7C3AED',
        'Six-week clinics that build real skills', 'Talent Clinic Lead',
        'talentclinic.district12.co.ug', 'http://localhost:3006', 3006, 'active')
on conflict (id) do nothing;

-- Admin user + grant
insert into public.d12_iam_users (id, name, email, status)
values ('usr_talent_clinic', 'Talent Clinic', 'talentclinic@district12.co.ug', 'active')
on conflict (id) do nothing;

insert into public.d12_iam_grants (id, user_id, role_id, tenant_id, granted_by)
values ('grt_talent_clinic', 'usr_talent_clinic', 'tenant_admin', 'talent-clinic', 'usr_marvin')
on conflict (id) do nothing;

-- Partial-payment columns on sales
alter table public.d12_ops_sales add column if not exists customer_phone text not null default '';
alter table public.d12_ops_sales add column if not exists customer_email text not null default '';
alter table public.d12_ops_sales add column if not exists payment_type text not null default 'full'
  check (payment_type in ('full', 'partial'));
alter table public.d12_ops_sales add column if not exists collected_by text not null default '';
alter table public.d12_ops_sales add column if not exists collected_by_email text not null default '';
alter table public.d12_ops_sales add column if not exists agreed_value numeric(16, 2) not null default 0;
alter table public.d12_ops_sales add column if not exists balance_after numeric(16, 2) not null default 0;
alter table public.d12_ops_sales add column if not exists installment_no integer not null default 0;

-- Partial-payment tracking on customers
alter table public.d12_ops_customers add column if not exists paid_total numeric(16, 2) not null default 0;
alter table public.d12_ops_customers add column if not exists last_payment_on date;
alter table public.d12_ops_customers add column if not exists last_payment_by text not null default '';
alter table public.d12_ops_customers add column if not exists last_payment_by_email text not null default '';

-- Talent Clinic participant + cohort columns
alter table public.d12_ops_customers add column if not exists registration_number text not null default '';
alter table public.d12_ops_customers add column if not exists clinic text not null default '';
alter table public.d12_ops_customers add column if not exists program_session text not null default '';
alter table public.d12_ops_customers add column if not exists cohort text not null default '';
alter table public.d12_ops_customers add column if not exists start_date date;

alter table public.d12_ops_projects add column if not exists start_date date;
alter table public.d12_ops_projects add column if not exists duration_weeks integer not null default 6;
alter table public.d12_ops_projects add column if not exists program_session text not null default '';

notify pgrst, 'reload schema';