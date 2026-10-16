-- Receipt photos. A photo is kept in the private "receipts" storage bucket under the owner's id
-- (<user id>/<receipt id>.jpg); the records of one payment (all parts of a split) point at it.
-- read_result keeps what Claude read from the photo, so opening it again doesn't read (and pay) twice.

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path text not null,
  read_result jsonb,
  created_at timestamptz not null default now()
);

alter table public.receipts enable row level security;

create policy "own receipts" on public.receipts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and path like (select auth.uid())::text || '/%');

alter table public.transactions
  add column if not exists receipt_id uuid references public.receipts (id) on delete set null;

create index if not exists transactions_receipt_idx on public.transactions (receipt_id) where receipt_id is not null;

-- Private bucket: photos are shown through short-lived signed URLs. Photos are shrunk in the browser
-- to about 300 KB, so 5 MB is only a safety limit.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- Each user reads, adds and deletes only the files in their own folder.
create policy "own receipt photos: read" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own receipt photos: add" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own receipt photos: delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
