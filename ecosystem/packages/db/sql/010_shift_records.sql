-- Shift sign-out records.
-- Each row is one completed working shift: start comes from the signed-in
-- session, end from the moment the person ends their shift or signs out.
-- The hub is the only writer; subsidiary apps forward their session cookie.

create table if not exists public.d12_shift_records (
  id text primary key,
  user_id text not null,
  tenant_id text not null,
  name text not null,
  email text not null default '',
  role text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  minutes integer not null check (minutes >= 0),
  ended_via text not null default 'shift' check (ended_via in ('shift', 'signout')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists d12_shift_records_tenant_day_idx
  on public.d12_shift_records (tenant_id, ended_at desc);

create index if not exists d12_shift_records_user_day_idx
  on public.d12_shift_records (user_id, ended_at desc);

alter table public.d12_shift_records enable row level security;

revoke all on public.d12_shift_records from anon, authenticated;
grant select, insert, update, delete on public.d12_shift_records to service_role;

notify pgrst, 'reload schema';
