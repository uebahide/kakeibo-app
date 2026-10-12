-- Expenses paid from the month's spare money (trips, events…) instead of the budget
alter table public.transactions
  add column if not exists outside_budget boolean not null default false;
