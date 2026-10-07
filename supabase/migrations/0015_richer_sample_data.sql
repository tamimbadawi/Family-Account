-- 0015_richer_sample_data.sql · fuller sample data: 3 sample banks and 6 months of entries (2026-10-07)
--
-- 0014's samples were thin (one wallet, about 135 entries). This matches the sample data families
-- saw before real data: Cash plus three sample banks (NBE, CIB, Banque Misr) with opening
-- balances, salary and pension into the banks, ATM withdrawals into Cash, and about 300 everyday
-- entries with short notes over the last 6 months. The sample banks are marked is_sample.
--
-- Clearing (family admin) now also hides the sample banks, unless the family already put their own
-- entries in one. Undo shows them again. Families that still have 0014's samples get the new set
-- (the old sample entries go to the bin, never shown in Recently deleted).

alter table public.accounts add column is_sample boolean not null default false;

create or replace function public.seed_sample_entries(p_household uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  w jsonb := '{}';
  wid uuid;
  first_month date := (date_trunc('month', current_date) - interval '5 months')::date;
  m date;
  month_no int := 0;
  spec record;
  n int;
  d date;
  amt numeric;
begin
  select a.id into wid from public.accounts a
  where a.household_id = p_household and a.type = 'cash' and not a.is_archived and not a.is_sample
  order by a.sort_order, a.created_at limit 1;
  if wid is null then return; end if;
  w := jsonb_build_object('cash', wid);

  -- The three sample banks (made once per family)
  for spec in select * from (values
      ('nbe', 'NBE',         'البنك الأهلي', 45000, '#15803D', 1),
      ('cib', 'CIB',         'بنك CIB',      30000, '#1D4ED8', 2),
      ('bm',  'Banque Misr', 'بنك مصر',      12000, '#B91C1C', 3)
    ) as b(key, name_en, name_ar, opening, color, sort_order)
  loop
    select a.id into wid from public.accounts a
    where a.household_id = p_household and a.is_sample and a.name_en = spec.name_en limit 1;
    if wid is null then
      insert into public.accounts (household_id, name_en, name_ar, type, opening_balance, icon, color, sort_order, is_sample)
      values (p_household, spec.name_en, spec.name_ar, 'bank', spec.opening, 'building-2', spec.color, spec.sort_order, true)
      returning id into wid;
    else
      update public.accounts set is_archived = false where id = wid and is_archived;
    end if;
    w := w || jsonb_build_object(spec.key, wid);
  end loop;

  for m in select generate_series(first_month, date_trunc('month', current_date)::date, interval '1 month')::date loop
    month_no := month_no + 1;
    for spec in
      select * from (values
        -- item (null = transfer), type, wallet, to wallet, per month, every n months, min, max, fixed day, note
        ('Salary',             'income',   'nbe',  null,   1, 1, 18000, 18000, 1,    'مرتب الشهر'),
        ('Pension',            'income',   'bm',   null,   1, 1,  6500,  6500, 1,    'معاش الشهر'),
        ('Rent received',      'income',   'cib',  null,   1, 1,  4000,  4000, 5,    'إيجار الشقة الصغيرة'),
        ('Gifts received',     'income',   'cash', null,   1, 3,   500,  1500, null, 'عيدية'),
        (null,                 'transfer', 'nbe',  'cash', 1, 1,  7000,  7000, 1,    'سحب من الـ ATM'),
        (null,                 'transfer', 'bm',   'cash', 1, 1,  4000,  4000, 15,   'سحب نص الشهر'),
        ('Rent',               'expense',  'cib',  null,   1, 1,  6000,  6000, 3,    'إيجار الشقة'),
        ('Building fees',      'expense',  'cash', null,   1, 1,   300,   300, 4,    'البواب والأسانسير'),
        ('Electricity',        'expense',  'cash', null,   1, 1,   450,   850, 10,   'فاتورة الكهرباء'),
        ('Water',              'expense',  'cash', null,   1, 1,   120,   220, 12,   null),
        ('Gas',                'expense',  'cash', null,   1, 1,   100,   200, 18,   'شحن كارت الغاز'),
        ('Internet',           'expense',  'nbe',  null,   1, 1,   450,   450, 5,    'باقة الإنترنت'),
        ('Mobile',             'expense',  'nbe',  null,   2, 1,   200,   350, 7,    'باقة الموبايل'),
        ('Supermarket',        'expense',  'nbe',  null,   2, 1,   700,  1600, null, 'طلبات البيت'),
        ('Supermarket',        'expense',  'cash', null,   2, 1,   300,   900, null, null),
        ('Vegetables & fruit', 'expense',  'cash', null,   6, 1,   100,   350, null, null),
        ('Bread',              'expense',  'cash', null,   8, 1,    20,    45, null, null),
        ('Meat & poultry',     'expense',  'cash', null,   3, 1,   600,  1200, null, null),
        ('Delivery',           'expense',  'cib',  null,   3, 1,   220,   480, null, 'طلبات أكل'),
        ('Restaurants',        'expense',  'cib',  null,   1, 1,   600,  1200, null, 'عشا برا'),
        ('Fuel',               'expense',  'nbe',  null,   3, 1,   500,   800, null, 'بنزين'),
        ('Parking',            'expense',  'cash', null,   2, 1,    20,    60, null, null),
        ('Maintenance',        'expense',  'nbe',  null,   1, 3,   800,  2500, null, 'صيانة العربية'),
        ('Taxi & ride apps',   'expense',  'cash', null,   4, 1,    60,   180, null, null),
        ('Pharmacy',           'expense',  'cash', null,   2, 1,   100,   450, null, 'أدوية'),
        ('Doctor',             'expense',  'cash', null,   1, 1,   400,   700, null, 'كشف'),
        ('Lab tests',          'expense',  'cash', null,   1, 2,   300,   900, null, 'تحاليل'),
        ('Gifts',              'expense',  'cash', null,   1, 1,   300,   900, null, 'هدية'),
        ('Charity',            'expense',  'cash', null,   2, 1,   100,   300, null, 'صدقة'),
        ('Repairs',            'expense',  'cash', null,   1, 2,   200,  1200, null, 'تصليح في البيت')
      ) as s(item_name, kind, wallet, to_wallet, per_month, every_n, lo, hi, fixed_day, note)
    loop
      continue when month_no % spec.every_n <> 0;
      for n in 1..spec.per_month loop
        d := m + coalesce(spec.fixed_day - 1, floor(random() * 28)::int);
        continue when d > current_date;
        amt := round((spec.lo + random() * (spec.hi - spec.lo)) / 5) * 5;
        if spec.kind = 'transfer' then
          insert into public.transactions (household_id, type, amount, occurred_on, account_id, to_account_id, note, is_sample)
          values (p_household, 'transfer', amt, d, (w ->> spec.wallet)::uuid, (w ->> spec.to_wallet)::uuid, spec.note, true);
        else
          insert into public.transactions (household_id, type, amount, occurred_on, account_id, item_id, note, is_sample)
          select p_household, spec.kind::public.txn_type, amt, d, (w ->> spec.wallet)::uuid, i.id,
                 case when random() < 0.6 then spec.note end, true
          from public.items i
          join public.subcategories s on s.id = i.subcategory_id
          join public.categories c on c.id = s.category_id
          where i.household_id = p_household and i.name_en = spec.item_name
            and c.kind::text = spec.kind and not i.is_archived
          order by i.sort_order limit 1;
        end if;
      end loop;
    end loop;
  end loop;

  update public.households set has_sample_data = true, sample_cleared_at = null where id = p_household;
end $$;

revoke execute on function public.seed_sample_entries(uuid) from public, anon, authenticated;

-- Clear: sample entries to the bin, sample banks hidden (unless the family has its own entries in one)
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
  update public.accounts a set is_archived = true
  where a.household_id = hid and a.is_sample and not a.is_archived
    and not exists (select 1 from public.transactions t
                    where (t.account_id = a.id or t.to_account_id = a.id) and t.deleted_at is null);
  update public.households set has_sample_data = false, sample_cleared_at = now() where id = hid;
end $$;

-- Undo: exactly the entries and banks the last clear removed come back
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
  update public.accounts set is_archived = false
  where household_id = hid and is_sample and is_archived and updated_at = cleared;
  update public.households set has_sample_data = true, sample_cleared_at = null where id = hid;
end $$;

-- Families that still show 0014's samples get the fuller set
do $$
declare h uuid;
begin
  for h in select id from public.households where has_sample_data loop
    update public.transactions set deleted_at = now() where household_id = h and is_sample and deleted_at is null;
    perform public.seed_sample_entries(h);
  end loop;
end $$;
