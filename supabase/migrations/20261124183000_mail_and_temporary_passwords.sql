-- SMTP settings for the group administrator, and a flag that forces a
-- generated password to be replaced at the next sign-in.

alter table public.d12_iam_users
  add column if not exists must_change_password boolean not null default false;

create table if not exists public.d12_mail_settings (
  id text primary key,
  host text not null default '',
  port integer not null default 587,
  username text not null default '',
  password text not null default '',
  from_address text not null default '',
  updated_at timestamptz not null default now(),
  constraint d12_mail_settings_id_check check (id = 'default'),
  constraint d12_mail_settings_port_check check (port between 1 and 65535)
);

insert into public.d12_mail_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.d12_mail_settings enable row level security;
