-- Day of the month (1-28) each month starts on, e.g. payday
alter table public.user_settings
  add column if not exists month_start_day smallint not null default 1
  check (month_start_day between 1 and 28);
