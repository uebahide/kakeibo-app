-- One payment split over several categories (a supermarket bill with food and household goods)
-- is saved as one record per category; the records share a split_id.
alter table public.transactions
  add column if not exists split_id uuid;

create index if not exists transactions_split_idx on public.transactions (split_id) where split_id is not null;
