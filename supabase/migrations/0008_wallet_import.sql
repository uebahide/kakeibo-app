-- Payments recorded automatically from the iPhone Wallet: the Shortcuts "Transaction"
-- automation posts each tap-to-pay payment to /api/import/wallet with the user's import key.

create extension if not exists pgcrypto with schema extensions;

-- source: where an automatic record came from (null for records typed in the app).
-- needs_review: an automatic record whose category (or amount, for another currency) was guessed.
alter table public.transactions
  add column if not exists source text check (source in ('wallet')),
  add column if not exists needs_review boolean not null default false;

-- One import key per user. Only its SHA-256 hash is kept; the key itself is shown once when issued.
create table if not exists public.import_keys (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.import_keys enable row level security;

create policy "own import key: read" on public.import_keys
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "own import key: delete" on public.import_keys
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Issues a new key for the signed-in user (replacing any earlier one) and returns it.
create or replace function public.create_import_key()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_key text;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  new_key := 'kk_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.import_keys (user_id, key_hash)
  values (uid, encode(extensions.digest(new_key, 'sha256'), 'hex'))
  on conflict (user_id) do update
    set key_hash = excluded.key_hash, created_at = now(), last_used_at = null;
  return new_key;
end;
$$;

revoke all on function public.create_import_key() from public, anon;
grant execute on function public.create_import_key() to authenticated;

-- Records one Wallet payment for the key's owner. Called by /api/import/wallet without a login,
-- so the key is the only proof of who it is for.
--   p_amount    amount in p_currency
--   p_currency  ISO code of the payment, or null when unknown (taken as the user's currency)
--   p_merchant  merchant name, saved as the memo
--   p_hint      category guessed from the merchant name, or null
create or replace function public.import_wallet_payment(
  p_key text,
  p_amount numeric,
  p_currency text,
  p_merchant text,
  p_hint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_user_currency text := 'JPY';
  v_user_tz text;
  v_user_language text;
  v_pay_currency text := upper(nullif(trim(coalesce(p_currency, '')), ''));
  v_foreign_currency boolean;
  v_merchant text := left(trim(coalesce(p_merchant, '')), 60);
  v_amount integer;
  v_memo text;
  v_tx_date date;
  v_known_category text;
  v_category text;
  v_review boolean;
  v_existing uuid;
  v_new_id uuid;
begin
  select k.user_id into v_uid
  from public.import_keys k
  where k.key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex');
  if v_uid is null then
    raise exception 'invalid import key' using errcode = '28000';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid amount' using errcode = '22023';
  end if;

  select coalesce(s.currency, 'JPY'), s.time_zone, s.language
    into v_user_currency, v_user_tz, v_user_language
  from public.user_settings s
  where s.user_id = v_uid;
  v_user_currency := coalesce(v_user_currency, 'JPY');
  v_user_tz := coalesce(v_user_tz, case when v_user_currency = 'HUF' then 'Europe/Budapest' else 'Asia/Tokyo' end);

  v_foreign_currency := v_pay_currency is not null and v_pay_currency <> v_user_currency;
  -- Amounts are whole numbers; another currency's amount is kept as is (never converted) and checked by hand.
  v_amount := greatest(1, round(p_amount))::integer;
  v_memo := case
    when v_foreign_currency then left(v_merchant || case when v_merchant = '' then '' else ' ' end
      || '(' || v_pay_currency || ' ' || trim_scale(round(p_amount, 2))::text || ')', 60)
    else v_merchant
  end;
  v_tx_date := (now() at time zone v_user_tz)::date;

  -- The same payment sent twice (the automation fired again right away) is recorded once. The window is
  -- kept short so a real second purchase of the same amount at the same shop is still recorded.
  select t.id into v_existing
  from public.transactions t
  where t.user_id = v_uid and t.source = 'wallet' and t.amount = v_amount and t.memo = v_memo
    and t.created_at > now() - interval '15 seconds'
  limit 1;
  if v_existing is not null then
    select t.category, t.needs_review into v_category, v_review from public.transactions t where t.id = v_existing;
    return jsonb_build_object('id', v_existing, 'duplicate', true, 'amount', v_amount, 'category', v_category,
      'needs_review', v_review, 'currency', v_user_currency, 'language', v_user_language);
  end if;

  -- A merchant seen before gets the category it was last confirmed with.
  if v_merchant <> '' then
    select t.category into v_known_category
    from public.transactions t
    where t.user_id = v_uid and t.type = 'expense' and not t.is_sample and not t.needs_review
      and lower(t.memo) = lower(v_merchant)
    order by t.created_at desc
    limit 1;
  end if;
  v_category := coalesce(v_known_category, nullif(p_hint, ''), 'other');
  v_review := v_known_category is null or v_foreign_currency;

  insert into public.transactions (user_id, date, amount, type, category, memo, source, needs_review)
  values (v_uid, v_tx_date, v_amount, 'expense', v_category, v_memo, 'wallet', v_review)
  returning id into v_new_id;

  update public.import_keys set last_used_at = now() where user_id = v_uid;

  return jsonb_build_object('id', v_new_id, 'duplicate', false, 'amount', v_amount, 'category', v_category,
    'needs_review', v_review, 'currency', v_user_currency, 'language', v_user_language);
end;
$$;

revoke all on function public.import_wallet_payment(text, numeric, text, text, text) from public;
grant execute on function public.import_wallet_payment(text, numeric, text, text, text) to anon, authenticated;
