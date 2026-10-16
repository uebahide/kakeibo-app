-- Read a receipt photo with Claude as soon as it is attached (off: only when the button is tapped).
alter table public.user_settings
  add column if not exists auto_read_receipts boolean not null default false;
