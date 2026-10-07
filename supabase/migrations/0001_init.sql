-- 家計簿ノート: tables and row level security.
-- Every row belongs to one signed-in user; nobody else can read or change it.

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  amount integer not null check (amount > 0),
  type text not null check (type in ('expense', 'income')),
  category text not null,
  memo text not null default '',
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);

create index transactions_user_date_idx on public.transactions (user_id, date desc);

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  budgets jsonb not null default '{}'::jsonb,
  goal jsonb not null default '{}'::jsonb,
  no_spend_days text[] not null default '{}',
  last_ai jsonb,
  updated_at timestamptz not null default now()
);

alter table public.transactions enable row level security;
alter table public.user_settings enable row level security;

create policy "own transactions" on public.transactions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own settings" on public.user_settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
