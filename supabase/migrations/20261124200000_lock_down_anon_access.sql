-- Security lockdown: the anon (publishable) key ships to every browser, so it
-- must never be able to read or write d12_* data. The ecosystem apps reach
-- these tables only through the service role on the server, which bypasses
-- RLS and keeps working after this migration.
--
-- 1. Remove the legacy "d12 access" policies that let anon read and write the
--    legacy ERP tables.
-- 2. Turn on RLS for every d12_* table that is missing it (d12_reports and
--    d12_user_profiles shipped without it). With no policy, non-service roles
--    see nothing.
-- 3. Revoke anon table and sequence privileges on every d12_* object.
-- 4. Stop anon/authenticated from calling the security-definer fact refresh.
--
-- NOTE: the legacy ERP UI (legacy-erp/) talks to Supabase directly from the
-- browser with the anon key and will stop loading data after this runs.

do $$
declare
  legacy text;
  tbl record;
begin
  foreach legacy in array array[
    'd12_companies', 'd12_staff', 'd12_transactions', 'd12_projects', 'd12_contacts',
    'd12_deals', 'd12_activities', 'd12_invoices', 'd12_accounts', 'd12_inventory'
  ] loop
    if to_regclass('public.' || legacy) is not null then
      execute format('drop policy if exists "d12 access" on public.%I', legacy);
      execute format('revoke all on table public.%I from anon, authenticated', legacy);
    end if;
  end loop;

  for tbl in
    select c.relname, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname like 'd12\_%'
  loop
    if not tbl.relrowsecurity then
      execute format('alter table public.%I enable row level security', tbl.relname);
    end if;
    execute format('revoke all on table public.%I from anon', tbl.relname);
  end loop;

  for tbl in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'S' and c.relname like 'd12\_%'
  loop
    execute format('revoke all on sequence public.%I from anon', tbl.relname);
  end loop;
end $$;

-- Reports and profiles are written only by the server; no client role needs them.
do $$
begin
  if to_regclass('public.d12_reports') is not null then
    revoke all on table public.d12_reports from anon, authenticated;
  end if;
  if to_regclass('public.d12_user_profiles') is not null then
    revoke all on table public.d12_user_profiles from anon, authenticated;
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.d12_wh_refresh_facts(text, date)') is not null then
    revoke all on function public.d12_wh_refresh_facts(text, date) from public, anon, authenticated;
    grant execute on function public.d12_wh_refresh_facts(text, date) to service_role;
  end if;
end $$;
