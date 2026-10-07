-- 0014_sample_data.sql · every new family starts with sample entries; the family admin clears them (2026-10-07)
--
-- New people open the app to three months of made-up entries on their Cash wallet, so Home, History
-- and Reports show what the app does. The entries are marked is_sample. The family admin taps
-- "Clear sample data and start": clear_sample_data() moves them to the bin (deleted_at), the same way
-- any entry is deleted, so every phone drops them on its next pull and the 30-day purge removes them.
-- restore_sample_data() is the 6-second Undo: it brings back exactly the entries that clear removed.
-- Families that have no entries yet when this runs get the samples too.

alter table public.transactions add column is_sample boolean not null default false;
alter table public.households
  add column has_sample_data boolean not null default false,
  add column sample_cleared_at timestamptz;

-- Sample entries for one family, on its first Cash wallet, from 3 months ago up to today.
-- Items are found by their English starter names (seed_defaults); a renamed or missing item is skipped.
create or replace function public.seed_sample_entries(p_household uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  wallet uuid;
  first_month date := (date_trunc('month', current_date) - interval '3 months')::date;
  m date;
  spec record;
  n int;
  d date;
begin
  select a.id into wallet from public.accounts a
  where a.household_id = p_household and a.type = 'cash' and not a.is_archived
  order by a.sort_order, a.created_at limit 1;
  if wallet is null then return; end if;

  for m in select generate_series(first_month, date_trunc('month', current_date)::date, interval '1 month')::date loop
    for spec in
      select * from (values
        -- item,                type,      per month, min,   max,   fixed day (null = random)
        ('Salary',              'income',  1,  18000, 18000, 1),
        ('Pension',             'income',  1,   6500,  6500, 1),
        ('Rent',                'expense', 1,   6000,  6000, 3),
        ('Electricity',         'expense', 1,    450,   800, 10),
        ('Water',               'expense', 1,    120,   220, 12),
        ('Internet',            'expense', 1,    450,   450, 5),
        ('Mobile',              'expense', 1,    250,   350, 7),
        ('Supermarket',         'expense', 4,    600,  1500, null),
        ('Vegetables & fruit',  'expense', 6,    120,   350, null),
        ('Bread',               'expense', 6,     20,    40, null),
        ('Meat & poultry',      'expense', 3,    600,  1200, null),
        ('Delivery',            'expense', 2,    250,   450, null),
        ('Restaurants',         'expense', 1,    600,  1000, null),
        ('Fuel',                'expense', 3,    500,   800, null),
        ('Taxi & ride apps',    'expense', 3,     60,   180, null),
        ('Pharmacy',            'expense', 2,    100,   400, null),
        ('Doctor',              'expense', 1,    400,   700, null),
        ('Gifts',               'expense', 1,    300,   800, null),
        ('Charity',             'expense', 1,    100,   300, null)
      ) as s(item_name, kind, per_month, lo, hi, fixed_day)
    loop
      for n in 1..spec.per_month loop
        d := m + coalesce(spec.fixed_day - 1, floor(random() * 28)::int);
        continue when d > current_date;
        insert into public.transactions (household_id, type, amount, occurred_on, account_id, item_id, is_sample)
        select p_household, spec.kind::public.txn_type,
               round((spec.lo + random() * (spec.hi - spec.lo)) / 5) * 5, d, wallet, i.id, true
        from public.items i
        join public.subcategories s on s.id = i.subcategory_id
        join public.categories c on c.id = s.category_id
        where i.household_id = p_household and i.name_en = spec.item_name
          and c.kind::text = spec.kind and not i.is_archived
        order by i.sort_order limit 1;
      end loop;
    end loop;
  end loop;

  update public.households set has_sample_data = true, sample_cleared_at = null where id = p_household;
end $$;

revoke execute on function public.seed_sample_entries(uuid) from public, anon, authenticated;

-- The family admin removes the samples: they go to the bin like any deleted entry.
create or replace function public.clear_sample_data()
returns void language plpgsql security definer set search_path = ''
as $$
declare hid uuid;
begin
  select household_id into hid from public.household_members
  where user_id = auth.uid() and role = 'owner';
  if hid is null then raise exception 'Only the family admin can clear the sample data' using errcode = '42501'; end if;
  update public.transactions set deleted_at = now()
  where household_id = hid and is_sample and deleted_at is null;
  update public.households set has_sample_data = false, sample_cleared_at = now() where id = hid;
end $$;

-- Undo: brings back exactly the sample entries the last clear removed.
create or replace function public.restore_sample_data()
returns void language plpgsql security definer set search_path = ''
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
  update public.households set has_sample_data = true, sample_cleared_at = null where id = hid;
end $$;

revoke execute on function public.clear_sample_data() from public, anon;
revoke execute on function public.restore_sample_data() from public, anon;
grant execute on function public.clear_sample_data() to authenticated;
grant execute on function public.restore_sample_data() to authenticated;

-- New families get the samples (create_family as in 0010, plus seed_sample_entries before the budgets)
create or replace function public.create_family(
  p_name text, p_display_name text, p_locale text default 'en', p_currencies text[] default '{EGP}')
returns uuid language plpgsql security definer set search_path = ''
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
  perform public.seed_budgets(hid);
  return hid;
end $$;

-- Families with no entries yet get the samples too
do $$
declare h uuid;
begin
  for h in select id from public.households hh
           where not exists (select 1 from public.transactions t where t.household_id = hh.id) loop
    perform public.seed_sample_entries(h);
  end loop;
end $$;
