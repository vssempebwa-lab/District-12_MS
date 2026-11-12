-- District 12 group management schema.
-- All tables use a d12_ prefix so they never collide with the existing
-- entities/clients/projects schema in this project.
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).

create table if not exists public.d12_companies (
  id text primary key,
  name text not null,
  short_name text not null,
  sector text not null,
  mark text not null,
  color text not null,
  md text not null,
  staff_count integer not null default 0,
  founded integer,
  status text not null default 'active' check (status in ('active', 'review')),
  revenue numeric(16, 2) not null default 0,
  expenses numeric(16, 2) not null default 0,
  profit numeric(16, 2) not null default 0,
  growth numeric(7, 2) not null default 0,
  location text,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.d12_staff (
  id text primary key,
  name text not null,
  role text not null,
  department text not null,
  company_id text not null references public.d12_companies (id) on delete cascade,
  email text,
  phone text,
  status text not null default 'active' check (status in ('active', 'on-leave', 'contract')),
  joined date,
  created_at timestamptz not null default now()
);

create table if not exists public.d12_transactions (
  id text primary key,
  date date not null,
  description text not null,
  company_id text not null references public.d12_companies (id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  category text not null,
  amount numeric(16, 2) not null default 0,
  status text not null default 'cleared' check (status in ('cleared', 'pending')),
  created_at timestamptz not null default now()
);

create table if not exists public.d12_projects (
  id text primary key,
  name text not null,
  company_id text not null references public.d12_companies (id) on delete cascade,
  client text,
  budget numeric(16, 2) not null default 0,
  spent numeric(16, 2) not null default 0,
  progress integer not null default 0 check (progress between 0 and 100),
  status text not null default 'active' check (status in ('active', 'on-hold', 'completed')),
  due date,
  created_at timestamptz not null default now()
);

create table if not exists public.d12_contacts (
  id text primary key,
  name text not null,
  organization text not null,
  role text,
  email text,
  phone text,
  company_id text not null references public.d12_companies (id) on delete cascade,
  type text not null default 'customer' check (type in ('customer', 'prospect', 'partner')),
  status text not null default 'active' check (status in ('active', 'dormant')),
  owner text,
  last_contact date,
  value numeric(16, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.d12_deals (
  id text primary key,
  title text not null,
  contact_id text references public.d12_contacts (id) on delete set null,
  company_id text not null references public.d12_companies (id) on delete cascade,
  stage text not null default 'lead' check (stage in ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  value numeric(16, 2) not null default 0,
  probability integer not null default 0 check (probability between 0 and 100),
  owner text,
  expected_close date,
  updated date,
  created_at timestamptz not null default now()
);

create table if not exists public.d12_activities (
  id text primary key,
  contact_id text references public.d12_contacts (id) on delete set null,
  company_id text not null references public.d12_companies (id) on delete cascade,
  type text not null check (type in ('call', 'email', 'meeting', 'note')),
  title text not null,
  notes text,
  date date not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.d12_invoices (
  id text primary key,
  number text not null,
  client text not null,
  company_id text not null references public.d12_companies (id) on delete cascade,
  contact_id text references public.d12_contacts (id) on delete set null,
  amount numeric(16, 2) not null default 0,
  issued date not null,
  due date not null,
  status text not null default 'pending' check (status in ('paid', 'pending', 'overdue')),
  created_at timestamptz not null default now()
);

-- Application accounts provisioned by the group administrator.
-- company_id is null for group-level administrators.
create table if not exists public.d12_accounts (
  id text primary key,
  name text not null,
  email text not null,
  role text not null default 'staff' check (role in ('admin', 'manager', 'staff')),
  company_id text references public.d12_companies (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at date not null default current_date,
  last_active date
);

create table if not exists public.d12_inventory (
  id text primary key,
  sku text not null,
  name text not null,
  category text not null,
  company_id text not null references public.d12_companies (id) on delete cascade,
  quantity numeric(14, 2) not null default 0,
  reorder_level numeric(14, 2) not null default 0,
  unit_cost numeric(16, 2) not null default 0,
  supplier text,
  updated date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists d12_staff_company_idx on public.d12_staff (company_id);
create index if not exists d12_transactions_company_idx on public.d12_transactions (company_id);
create index if not exists d12_transactions_date_idx on public.d12_transactions (date desc);
create index if not exists d12_projects_company_idx on public.d12_projects (company_id);
create index if not exists d12_contacts_company_idx on public.d12_contacts (company_id);
create index if not exists d12_deals_company_idx on public.d12_deals (company_id);
create index if not exists d12_deals_stage_idx on public.d12_deals (stage);
create index if not exists d12_activities_contact_idx on public.d12_activities (contact_id);
create index if not exists d12_activities_company_idx on public.d12_activities (company_id);
create index if not exists d12_invoices_company_idx on public.d12_invoices (company_id);
create index if not exists d12_invoices_status_idx on public.d12_invoices (status);
create index if not exists d12_accounts_company_idx on public.d12_accounts (company_id);
create index if not exists d12_accounts_email_idx on public.d12_accounts (email);
create index if not exists d12_inventory_company_idx on public.d12_inventory (company_id);
create index if not exists d12_inventory_sku_idx on public.d12_inventory (sku);

alter table public.d12_companies enable row level security;
alter table public.d12_staff enable row level security;
alter table public.d12_transactions enable row level security;
alter table public.d12_projects enable row level security;
alter table public.d12_contacts enable row level security;
alter table public.d12_deals enable row level security;
alter table public.d12_activities enable row level security;
alter table public.d12_invoices enable row level security;
alter table public.d12_accounts enable row level security;
alter table public.d12_inventory enable row level security;

-- The app is a single-tenant internal tool authenticated only by the project's
-- publishable key, so all d12_ tables allow the anon role to read and write.
drop policy if exists "d12 access" on public.d12_companies;
create policy "d12 access" on public.d12_companies for all to anon, authenticated using (true) with check (true);

drop policy if exists "d12 access" on public.d12_staff;
create policy "d12 access" on public.d12_staff for all to anon, authenticated using (true) with check (true);

drop policy if exists "d12 access" on public.d12_transactions;
create policy "d12 access" on public.d12_transactions for all to anon, authenticated using (true) with check (true);

drop policy if exists "d12 access" on public.d12_projects;
create policy "d12 access" on public.d12_projects for all to anon, authenticated using (true) with check (true);

drop policy if exists "d12 access" on public.d12_contacts;
create policy "d12 access" on public.d12_contacts for all to anon, authenticated using (true) with check (true);

drop policy if exists "d12 access" on public.d12_deals;
create policy "d12 access" on public.d12_deals for all to anon, authenticated using (true) with check (true);

drop policy if exists "d12 access" on public.d12_activities;
create policy "d12 access" on public.d12_activities for all to anon, authenticated using (true) with check (true);

drop policy if exists "d12 access" on public.d12_invoices;
create policy "d12 access" on public.d12_invoices for all to anon, authenticated using (true) with check (true);

drop policy if exists "d12 access" on public.d12_accounts;
create policy "d12 access" on public.d12_accounts for all to anon, authenticated using (true) with check (true);

drop policy if exists "d12 access" on public.d12_inventory;
create policy "d12 access" on public.d12_inventory for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on
  public.d12_companies,
  public.d12_staff,
  public.d12_transactions,
  public.d12_projects,
  public.d12_contacts,
  public.d12_deals,
  public.d12_activities,
  public.d12_invoices,
  public.d12_accounts,
  public.d12_inventory
to anon, authenticated;

notify pgrst, 'reload schema';
