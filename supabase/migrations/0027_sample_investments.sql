-- 0027_sample_investments.sql · Sample investments for the starter data (2026-10-13)
--
-- A family that still has its sample data also gets two sample investments (Gold and a Bank
-- certificate), each with one value update, so the Saving side of Our money is not empty.
-- They are sample wallets with no entries, so clearing the sample data puts them away and
-- restoring it brings them back (clear_sample_data / restore_sample_data, unchanged).
-- New families: the sample goal pockets are now marked purpose 'goal' as well.

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
      ('Gold',             'ذهب',          'gold',         80000::numeric,  96000::numeric, null::date, 0),
      ('Bank certificate', 'شهادة بنكية',  'certificate', 150000::numeric, 154000::numeric,
        make_date(extract(year from current_date)::int + 2, 3, 1), 1)
    ) as t(name_en, name_ar, kind, put_in, worth, matures, ord)
  loop
    insert into public.accounts (household_id, name_en, name_ar, type, opening_balance, currency, sort_order,
                                 is_sample, purpose, investment_kind, matures_on)
    values (p_household, spec.name_en, spec.name_ar, 'wallet', spec.put_in, main, 95 + spec.ord,
            true, 'investment', spec.kind, spec.matures)
    returning id into wid;

    insert into public.investment_values (household_id, account_id, value, valued_on, created_by)
    values (p_household, wid, spec.worth, current_date - 3, null);
  end loop;
end $$;

revoke all on function public.seed_sample_investments(uuid) from public, anon, authenticated;

-- A new family starts with the sample investments too, and its sample goal pockets count as saving
create or replace function public.create_family(p_name text, p_display_name text, p_locale text default 'en', p_currencies text[] default '{EGP}')
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare hid uuid; clean text[];
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not coalesce((select (u.raw_app_meta_data ->> 'family_admin')::boolean
                   from auth.users u where u.id = auth.uid()), false) then
    raise exception 'Only an invited family admin can create a family' using errcode = '42501';
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'Already in a household';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'The family needs a name' using errcode = '23514'; end if;
  clean := array(select upper(trim(x)) from unnest(p_currencies) with ordinality as u(x, n) order by n);
  if not public.valid_currencies(clean) then
    raise exception 'Choose one or two currencies' using errcode = '23514';
  end if;
  insert into public.households (name, currencies) values (trim(p_name), clean) returning id into hid;
  insert into public.household_members (household_id, user_id, display_name, role, locale)
  values (hid, auth.uid(), trim(p_display_name), 'owner', p_locale);
  insert into public.accounts (household_id, name_en, name_ar, type, icon, currency)
  values (hid, 'Cash', 'كاش', 'cash', 'banknote', clean[1]);
  perform public.seed_defaults(hid);
  perform public.seed_corrections(hid);
  perform public.seed_sample_entries(hid);
  perform public.seed_sample_goals(hid);
  update public.accounts a set purpose = 'goal'
  where a.household_id = hid and a.is_sample and a.purpose = 'spending'
    and exists (select 1 from public.savings_goals g where g.wallet_id = a.id);
  perform public.seed_sample_investments(hid);
  perform public.seed_budgets(hid);
  return hid;
end $$;

-- Families that still show their sample data get the sample investments now
do $$
declare h record;
begin
  for h in select id from public.households where has_sample_data loop
    perform public.seed_sample_investments(h.id);
  end loop;
end $$;
