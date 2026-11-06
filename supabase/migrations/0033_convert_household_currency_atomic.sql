-- 0033_convert_household_currency_atomic.sql · Atomic single household currency conversion (2026-11-06)
--
-- Fixes:
-- 1. Updates check_account_currency() trigger to safely allow currency conversions when app.converting_currency is set.
-- 2. Updates households currency and currencies array before accounts to satisfy constraints.
-- 3. Correctly converts investment_values (value & unit_price) without column errors.
-- 4. Guarantees single-transaction atomic conversion across all 7 tables in Postgres.

-- 1. Trigger function with conversion bypass and safe search_path
create or replace function public.check_account_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare allowed text[];
begin
  -- Bypass trigger during atomic household currency conversion
  if current_setting('app.converting_currency', true) = 'true' then
    return new;
  end if;

  select h.currencies into allowed from public.households h where h.id = new.household_id;
  if new.currency is null then new.currency := allowed[1]; end if;

  if tg_op = 'INSERT' or new.currency is distinct from old.currency then
    if not (new.currency = any (allowed)) then
      raise exception 'Currency % is not one of this family''s currencies', new.currency
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.currency is distinct from old.currency and exists (
    select 1 from public.transactions t
    where t.household_id = new.household_id and (t.account_id = new.id or t.to_account_id = new.id)
  ) then
    raise exception 'A wallet''s currency cannot change once it has entries' using errcode = '23514';
  end if;

  return new;
end $$;

-- 2. Keep set_household_currencies in sync with both currencies array and currency column
create or replace function public.set_household_currencies(p_currencies text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare hid uuid; clean text[];
begin
  select household_id into hid from public.household_members
  where user_id = auth.uid() and role = 'owner';
  if hid is null or not public.is_member(hid) then
    raise exception 'Only the family admin can change currencies' using errcode = '42501';
  end if;
  clean := array(select upper(trim(x)) from unnest(p_currencies) with ordinality as u(x, n) order by n);
  if not public.valid_currencies(clean) then
    raise exception 'Choose one or two currencies' using errcode = '23514';
  end if;
  if exists (select 1 from public.accounts where household_id = hid and not (currency = any (clean))) then
    raise exception 'A wallet still uses a currency you removed' using errcode = '23514';
  end if;
  update public.households set currencies = clean, currency = clean[1] where id = hid;
end $$;

-- 3. Atomic RPC function to convert all household wallets, entries, goals, and rules to single target currency
create or replace function public.convert_household_currency(p_target_currency text, p_rate numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid;
  target text;
begin
  select household_id into hid from public.household_members
    where user_id = auth.uid()
    limit 1;

  if hid is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  target := upper(trim(p_target_currency));
  if length(target) != 3 then
    raise exception 'Choose a valid 3-letter currency code' using errcode = '23514';
  end if;

  if p_rate <= 0 then
    raise exception 'Exchange rate must be positive' using errcode = '23514';
  end if;

  -- Allow account currency change by bypassing trigger in this transaction
  perform set_config('app.converting_currency', 'true', true);

  -- 1. Household currency & currencies (updated first)
  update public.households
  set
    currency = target,
    currencies = array[target]
  where id = hid;

  -- 2. Accounts
  update public.accounts
  set
    currency = target,
    opening_balance = round(opening_balance * (case when currency = target then 1 else p_rate end), 2),
    updated_at = now()
  where household_id = hid;

  -- 3. Transactions
  update public.transactions
  set
    amount = round(amount * p_rate, 2),
    to_amount = null,
    updated_at = now()
  where household_id = hid;

  -- 4. Savings goals
  update public.savings_goals
  set
    target_amount = round(target_amount * p_rate, 2),
    updated_at = now()
  where household_id = hid;

  -- 5. Recurring rules
  update public.recurring_rules
  set
    amount = round(amount * p_rate, 2),
    updated_at = now()
  where household_id = hid;

  -- 6. Budgets
  update public.budgets
  set
    amount = round(amount * p_rate, 2),
    updated_at = now()
  where household_id = hid;

  -- 7. Investment values (value & unit_price)
  update public.investment_values
  set
    value = round(value * p_rate, 2),
    unit_price = case when unit_price is not null then round(unit_price * p_rate, 2) else null end,
    updated_at = now()
  where household_id = hid;
end;
$$;

grant execute on function public.convert_household_currency(text, numeric) to authenticated;
revoke execute on function public.check_account_currency() from public, anon, authenticated;
