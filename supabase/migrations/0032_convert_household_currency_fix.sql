-- 0032_convert_household_currency_fix.sql · Fix convert_household_currency RPC (2026-11-03)
--
-- Fixes column name in investment_values (value and unit_price, not amount)
-- and ensures atomic currency conversion across all household data.

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

  -- Allow account currency change by bypassing the trigger
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

  -- 6. Investment values (value & unit_price)
  update public.investment_values
  set
    value = round(value * p_rate, 2),
    unit_price = case when unit_price is not null then round(unit_price * p_rate, 2) else null end,
    updated_at = now()
  where household_id = hid;

  -- 7. Household currency & currencies
  update public.households
  set
    currency = target,
    currencies = array[target]
  where id = hid;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.convert_household_currency(text, numeric) to authenticated;
