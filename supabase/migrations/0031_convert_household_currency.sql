-- 0031_convert_household_currency.sql · Atomic single household currency conversion (2026-10-27)

-- Update check_account_currency trigger to allow updates during currency conversion
create or replace function public.check_account_currency()
returns trigger as $$
begin
  if current_setting('app.converting_currency', true) = 'true' then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.currency is distinct from old.currency and exists (
    select 1 from public.transactions where account_id = old.id or to_account_id = old.id
  ) then
    raise exception 'A wallet''s currency cannot change once it has entries';
  end if;
  return new;
end;
$$ language plpgsql;

-- Atomic RPC function to convert all household wallets, entries, goals, and rules to single target currency
create or replace function public.convert_household_currency(p_target_currency text, p_rate numeric)
returns void as $$
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

  -- Allow account currency change
  perform set_config('app.converting_currency', 'true', true);

  -- 1. Accounts
  update public.accounts
  set
    currency = target,
    opening_balance = round(opening_balance * (case when currency = target then 1 else p_rate end), 2),
    updated_at = now()
  where household_id = hid;

  -- 2. Transactions
  update public.transactions
  set
    amount = round(amount * p_rate, 2),
    to_amount = null,
    updated_at = now()
  where household_id = hid;

  -- 3. Savings goals
  update public.savings_goals
  set
    target_amount = round(target_amount * p_rate, 2),
    updated_at = now()
  where household_id = hid;

  -- 4. Recurring rules
  update public.recurring_rules
  set
    amount = round(amount * p_rate, 2),
    updated_at = now()
  where household_id = hid;

  -- 5. Budgets
  update public.budgets
  set
    amount = round(amount * p_rate, 2),
    updated_at = now()
  where household_id = hid;

  -- 6. Investment values
  update public.investment_values
  set
    amount = round(amount * p_rate, 2),
    updated_at = now()
  where account_id in (select id from public.accounts where household_id = hid);

  -- 7. Household currency & currencies
  update public.households
  set
    currency = target,
    currencies = array[target]
  where id = hid;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.convert_household_currency(text, numeric) to authenticated;
