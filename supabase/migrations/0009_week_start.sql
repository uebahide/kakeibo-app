-- Day each week starts on for the weekly budget: 1 Monday, 0 Sunday.
alter table public.user_settings
  add column if not exists week_start_day smallint not null default 1
  check (week_start_day in (0, 1));
