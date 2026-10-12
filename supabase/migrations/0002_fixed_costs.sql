-- Fixed costs per month: { "YYYY-MM": [{ id, name, category, amount, paid }] }
alter table public.user_settings
  add column if not exists fixed_costs jsonb not null default '{}'::jsonb;
