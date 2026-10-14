-- Time zone "today" is counted in, so the app and Claude (over MCP) agree on the date.
-- Null means never picked: the app then follows the currency (JPY: Tokyo, HUF: Budapest).
alter table public.user_settings
  add column if not exists time_zone text
  check (time_zone in ('Asia/Tokyo', 'Europe/Budapest'));
