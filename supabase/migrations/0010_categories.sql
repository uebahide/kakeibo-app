-- The user's own categories: changes to the app's categories (name, mark, color, fixed cost,
-- hidden) by id, categories the user added, and the order they are listed in.
-- Records keep pointing at category ids, so nothing else changes.
alter table public.user_settings
  add column if not exists categories jsonb not null default '{"edits": {}, "custom": [], "order": {}}'::jsonb;

-- The categories of an import key's owner, so a Wallet payment's notification can name a category
-- the user renamed or added. Called by /api/import/wallet without a login, like import_wallet_payment.
create or replace function public.wallet_categories(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select s.categories
  from public.import_keys k
  join public.user_settings s on s.user_id = k.user_id
  where k.key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex');
$$;

revoke all on function public.wallet_categories(text) from public;
grant execute on function public.wallet_categories(text) to anon, authenticated;
