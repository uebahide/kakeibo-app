-- Claude's weekly reviews: once a week Claude reads the last week's totals over the connector (MCP),
-- writes a short review and saves it here (save_weekly_review). One row per week; saving the same
-- week again replaces it. The app shows the latest on the home screen and the rest on the AI screen.

create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  review jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.weekly_reviews enable row level security;

create policy "own weekly reviews" on public.weekly_reviews
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
