-- Structured report sections filed alongside the narrative summary.
-- Additive and backwards compatible: existing reports read as empty sections.
alter table public.d12_reports
  add column if not exists highlights text not null default '',
  add column if not exists risks text not null default '',
  add column if not exists next_steps text not null default '';

notify pgrst, 'reload schema';
