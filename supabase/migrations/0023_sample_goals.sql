-- 0023_sample_goals.sql · Sample savings goals for the starter data (2026-10-12)
--
-- A family that still has its sample data also gets two sample savings goals, each in its own
-- sample wallet, with a few sample moves into it from the wallet that holds the most money.
-- Clearing the sample data stops those goals too; restoring it brings them back.

create or replace function public.seed_sample_goals(p_household uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  spec record;
  wid  uuid;
  src  uuid;
  main text;
  i    int;
begin
  -- Never on top of goals the family already has
  if exists (select 1 from public.savings_goals where household_id = p_household) then return; end if;

  select currencies[1] into main from public.households where id = p_household;

  -- The money comes from the wallet with the most in it (same currency as the goals)
  select a.id into src
  from public.accounts a
  where a.household_id = p_household and not a.is_archived and a.currency = main
  order by a.opening_balance + coalesce((
    select sum(case when t.to_account_id = a.id then coalesce(t.to_amount, t.amount)
                    when t.type = 'income' then t.amount
                    else -t.amount end)
    from public.transactions t
    where (t.account_id = a.id or t.to_account_id = a.id) and t.deleted_at is null), 0) desc
  limit 1;
  if src is null then return; end if;

  for spec in
    select * from (values
      ('Fayoum trip', 'رحلة الفيوم',  45000::numeric, 'plane',  2, 4, 3000::numeric, 0),
      ('New car',     'عربية جديدة', 250000::numeric, 'car',   14, 4, 6000::numeric, 1)
    ) as t(name_en, name_ar, target, icon, months_ahead, deposits, step, ord)
  loop
    insert into public.accounts (household_id, name_en, name_ar, type, opening_balance, icon, sort_order, is_sample)
    values (p_household, spec.name_en, spec.name_ar, 'wallet', 0, spec.icon, 90 + spec.ord, true)
    returning id into wid;

    insert into public.savings_goals (household_id, name_en, name_ar, target_amount, target_date, icon, wallet_id)
    values (p_household, spec.name_en, spec.name_ar, spec.target,
            (current_date + make_interval(months => spec.months_ahead))::date, spec.icon, wid);

    for i in 1..spec.deposits loop
      insert into public.transactions (household_id, type, amount, occurred_on, account_id, to_account_id, is_sample)
      values (p_household, 'transfer', spec.step + (i % 3) * 500,
              current_date - ((spec.deposits - i) * 12 + 2 + spec.ord), src, wid, true);
    end loop;
  end loop;
end $$;

revoke all on function public.seed_sample_goals(uuid) from public, anon, authenticated;

-- Clearing the sample data also stops the goals kept in a sample wallet that was put away
create or replace function public.clear_sample_data()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare hid uuid;
begin
  select household_id into hid from public.household_members
  where user_id = auth.uid() and role = 'owner';
  if hid is null then raise exception 'Only the family admin can clear the sample data' using errcode = '42501'; end if;
  update public.transactions set deleted_at = now()
  where household_id = hid and is_sample and deleted_at is null;
  update public.accounts a set is_archived = true
  where a.household_id = hid and a.is_sample and not a.is_archived
    and not exists (select 1 from public.transactions t
                    where (t.account_id = a.id or t.to_account_id = a.id) and t.deleted_at is null);
  update public.savings_goals g set is_archived = true
  where g.household_id = hid and not g.is_archived
    and exists (select 1 from public.accounts a where a.id = g.wallet_id and a.is_sample and a.is_archived);
  update public.households set has_sample_data = false, sample_cleared_at = now() where id = hid;
end $$;

create or replace function public.restore_sample_data()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare hid uuid; cleared timestamptz;
begin
  select m.household_id, h.sample_cleared_at into hid, cleared
  from public.household_members m join public.households h on h.id = m.household_id
  where m.user_id = auth.uid() and m.role = 'owner';
  if hid is null then raise exception 'Only the family admin can restore the sample data' using errcode = '42501'; end if;
  if cleared is null then return; end if;
  update public.transactions set deleted_at = null
  where household_id = hid and is_sample and deleted_at = cleared;
  update public.accounts set is_archived = false
  where household_id = hid and is_sample and is_archived and updated_at = cleared;
  update public.savings_goals set is_archived = false
  where household_id = hid and is_archived and updated_at = cleared;
  update public.households set has_sample_data = true, sample_cleared_at = null where id = hid;
end $$;

-- A new family starts with the sample goals as well
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
  perform public.seed_budgets(hid);
  return hid;
end $$;

-- Families that still show their sample data get the sample goals now
do $$
declare h record;
begin
  for h in select id from public.households where has_sample_data loop
    perform public.seed_sample_goals(h.id);
  end loop;
end $$;
