-- Display language. Null means never picked: the app then follows the browser's language.
alter table public.user_settings
  add column if not exists language text
  check (language in ('ja', 'en'));
