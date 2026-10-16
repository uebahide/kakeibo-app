-- The period (YYYY-MM) whose suggested budget was last used or turned down, so the suggestion isn't offered again that period.
alter table public.user_settings
  add column if not exists budget_reviewed text;
