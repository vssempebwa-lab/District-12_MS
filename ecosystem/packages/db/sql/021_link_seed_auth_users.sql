-- Link pre-seeded IAM rows to Supabase Auth users.
-- Run this after the auth users exist (invited or created through
-- scripts/link-seed-users.mjs). Idempotent: only fills a missing auth_id and
-- matches on the case-insensitive email that d12_iam_users already enforces.
update public.d12_iam_users u
set auth_id = a.id
from auth.users a
where u.auth_id is null
  and lower(a.email) = lower(u.email);

notify pgrst, 'reload schema';
