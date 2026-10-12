-- Currency the amounts are shown in. Amounts are never converted.
alter table public.user_settings
  add column if not exists currency text not null default 'JPY'
  check (currency in ('JPY', 'HUF'));
