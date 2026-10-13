-- 0029_sample_gold_units.sql · Sample Gold is tracked by weight (2026-10-13)
--
-- After 0028 gold can be tracked in grams. The sample Gold becomes 20 g of 21k at 4,800 per gram
-- (still put in 80,000, worth 96,000), for new families and for sample Gold nobody has touched.
-- The Bank certificate is unchanged.

create or replace function public.seed_sample_investments(p_household uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  spec record;
  wid  uuid;
  main text;
begin
  -- Never on top of investments the family already has
  if exists (select 1 from public.accounts where household_id = p_household and purpose = 'investment') then return; end if;

  select currencies[1] into main from public.households where id = p_household;
  if main is null then return; end if;

  for spec in
    select * from (values
      ('Gold',             'ذهب',          'gold',         80000::numeric,  96000::numeric, null::date, 0,
        'gram', 21::smallint, 20::numeric, 4800::numeric),
      ('Bank certificate', 'شهادة بنكية',  'certificate', 150000::numeric, 154000::numeric,
        make_date(extract(year from current_date)::int + 2, 3, 1), 1,
        null, null::smallint, null::numeric, null::numeric)
    ) as t(name_en, name_ar, kind, put_in, worth, matures, ord, unit, karat, qty, unit_price)
  loop
    insert into public.accounts (household_id, name_en, name_ar, type, opening_balance, currency, sort_order,
                                 is_sample, purpose, investment_kind, matures_on, unit, karat, opening_quantity)
    values (p_household, spec.name_en, spec.name_ar, 'wallet', spec.put_in, main, 95 + spec.ord,
            true, 'investment', spec.kind, spec.matures, spec.unit, spec.karat, spec.qty)
    returning id into wid;

    insert into public.investment_values (household_id, account_id, value, unit_price, valued_on, created_by)
    values (p_household, wid, spec.worth, spec.unit_price, current_date - 3, null);
  end loop;
end $$;

revoke all on function public.seed_sample_investments(uuid) from public, anon, authenticated;

-- Sample Gold that is exactly as it was seeded: no money moved, one value of 96,000
with untouched as (
  select a.id
  from public.accounts a
  where a.is_sample and a.purpose = 'investment' and a.investment_kind = 'gold'
    and a.unit is null and a.opening_balance = 80000
    and not exists (select 1 from public.transactions t where t.account_id = a.id or t.to_account_id = a.id)
    and (select count(*) from public.investment_values v where v.account_id = a.id) = 1
    and exists (select 1 from public.investment_values v
                where v.account_id = a.id and v.deleted_at is null and v.value = 96000)
), priced as (
  update public.investment_values v
  set unit_price = 4800
  from untouched u
  where v.account_id = u.id
  returning v.account_id
)
update public.accounts a
set unit = 'gram', karat = 21, opening_quantity = 20
from untouched u
where a.id = u.id;
