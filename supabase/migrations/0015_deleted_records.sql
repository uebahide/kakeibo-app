-- Recently deleted records: deleting a record moves it (with the other parts of its payment) here,
-- where it can be put back for 30 days. The app removes older entries, and their receipt photos,
-- when it loads. Until this migration is run, records are deleted for good as before.

create table if not exists public.deleted_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  records jsonb not null,
  deleted_at timestamptz not null default now()
);

create index if not exists deleted_records_user_idx on public.deleted_records (user_id, deleted_at desc);

alter table public.deleted_records enable row level security;

create policy "own deleted records" on public.deleted_records
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
