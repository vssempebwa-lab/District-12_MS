-- Two-factor sign-in: after the password checks out, the hub emails a
-- one-time 6-digit code. Only an HMAC of the code is stored. Rows are reached
-- through the service role only (RLS on, no policies).

create table if not exists public.d12_two_factor_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.d12_iam_users(id) on delete cascade,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists d12_two_factor_challenges_user_created_idx
  on public.d12_two_factor_challenges (user_id, created_at desc);

alter table public.d12_two_factor_challenges enable row level security;
revoke all on table public.d12_two_factor_challenges from anon, authenticated;
