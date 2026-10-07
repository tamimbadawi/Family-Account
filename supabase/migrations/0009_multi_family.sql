-- 0009_multi_family.sql · many families in one database, each with 1–2 currencies (2026-10-07)
-- Plan: docs/MULTI-FAMILY.md. Test: supabase/tests/multi_family_smoke_test.sql.
--
-- * A family is created only by a family admin that the operator invited
--   (auth.users.raw_app_meta_data.family_admin = true, set by the `operator` Edge Function).
-- * Each family chooses its own currencies (any ISO 4217 code, 1 or 2, first = main).
--   Every wallet holds one of them; an entry uses its wallet's currency. Amounts are never
--   added across currencies, and a transfer between two currencies stores what arrived (to_amount).
-- * The operator can suspend a family: is_member() then answers false for everyone in it.
-- * add_member(email) is dropped: with real email logins it would let any admin pull any
--   registered person into their family. Members are added by the family-admin function.

-- ---------- Currencies ----------
create or replace function public.valid_currencies(c text[])
returns boolean language sql immutable set search_path = ''
as $$
  select c is not null
     and cardinality(c) between 1 and 2
     and array_position(c, null) is null
     and (select bool_and(x ~ '^[A-Z]{3}$') from unnest(c) as x)
     and (cardinality(c) = 1 or c[1] <> c[2]);
$$;

alter table public.households
  add column currencies text[] not null default '{EGP}',
  add column status text not null default 'active';
update public.households set currencies = array[currency::text];
alter table public.households
  add constraint households_currencies_valid check (public.valid_currencies(currencies)),
  add constraint households_status_valid check (status in ('active', 'suspended'));

-- households.currency (0001) stays for older code and always equals the main currency
create or replace function public.sync_main_currency()
returns trigger language plpgsql set search_path = ''
as $$ begin new.currency := new.currencies[1]; return new; end $$;

create trigger households_main_currency before insert or update of currencies on public.households
  for each row execute function public.sync_main_currency();

-- Every wallet holds one of its family's currencies
alter table public.accounts add column currency text;
update public.accounts a set currency = h.currencies[1]
from public.households h where h.id = a.household_id;
alter table public.accounts
  alter column currency set not null,
  add constraint accounts_currency_code check (currency ~ '^[A-Z]{3}$');

create or replace function public.check_account_currency()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare allowed text[];
begin
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

create trigger accounts_currency before insert or update of currency on public.accounts
  for each row execute function public.check_account_currency();

-- A transfer between two currencies records the amount that arrived
alter table public.transactions
  add column to_amount numeric(14,2) check (to_amount > 0);

create or replace function public.check_txn_currency()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare from_cur text; to_cur text;
begin
  if new.type <> 'transfer' then
    new.to_amount := null;
    return new;
  end if;
  select currency into from_cur from public.accounts where id = new.account_id;
  select currency into to_cur   from public.accounts where id = new.to_account_id;
  if from_cur = to_cur then
    new.to_amount := null;
  elsif new.to_amount is null then
    raise exception 'A transfer from % to % needs the amount received', from_cur, to_cur
      using errcode = '23514';
  end if;
  return new;
end $$;

create trigger transactions_currency before insert or update on public.transactions
  for each row execute function public.check_txn_currency();

-- The family admin changes the currencies (add a second one, swap the main one).
-- A currency still used by a wallet cannot be removed.
create or replace function public.set_household_currencies(p_currencies text[])
returns void language plpgsql security definer set search_path = ''
as $$
declare hid uuid; clean text[];
begin
  select household_id into hid from public.household_members
  where user_id = auth.uid() and role = 'owner';
  if hid is null then raise exception 'Only the family admin can change currencies' using errcode = '42501'; end if;
  clean := array(select upper(trim(x)) from unnest(p_currencies) with ordinality as u(x, n) order by n);
  if not public.valid_currencies(clean) then
    raise exception 'Choose one or two currencies' using errcode = '23514';
  end if;
  if exists (select 1 from public.accounts where household_id = hid and not (currency = any (clean))) then
    raise exception 'A wallet still uses a currency you removed' using errcode = '23514';
  end if;
  update public.households set currencies = clean where id = hid;
end $$;

-- ---------- Suspended families lose access ----------
create or replace function public.is_member(hid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    join public.households h on h.id = m.household_id
    where m.household_id = hid and m.user_id = (select auth.uid()) and h.status = 'active'
  );
$$;

-- ---------- Only the family admin renames the family (0001 let every member) ----------
drop policy "members rename household" on public.households;
create policy "admin renames household" on public.households
  for update to authenticated
  using (public.is_member(id) and exists (
    select 1 from public.household_members m
    where m.household_id = id and m.user_id = (select auth.uid()) and m.role = 'owner'))
  with check (public.is_member(id));

-- ---------- Creating a family: invited family admins only ----------
drop function public.create_household(text, text, text);
drop function public.add_member(text, text);

create or replace function public.create_household(
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
  return hid;
end $$;

-- ---------- Views: currency on every amount, never summed across currencies ----------
create or replace view public.v_transactions with (security_invoker = true) as
select
  t.id, t.household_id, t.type, t.amount, t.occurred_on, t.note,
  t.account_id, a.name_ar as account_name_ar, a.name_en as account_name_en,
  t.to_account_id,
  t.item_id,        i.name_ar as item_name_ar,        i.name_en as item_name_en,
  s.id as subcategory_id, s.name_ar as subcategory_name_ar, s.name_en as subcategory_name_en,
  c.id as category_id,    c.name_ar as category_name_ar,    c.name_en as category_name_en,
  c.icon as category_icon, c.color as category_color,
  t.created_by, t.created_at, t.updated_at,
  t.photo_path,
  a.currency, t.to_amount
from public.transactions t
join public.accounts a        on a.household_id = t.household_id and a.id = t.account_id
left join public.items i         on i.id = t.item_id
left join public.subcategories s on s.id = i.subcategory_id
left join public.categories c    on c.id = s.category_id
where t.deleted_at is null;

create or replace view public.v_monthly_category_totals with (security_invoker = true) as
select
  household_id,
  date_trunc('month', occurred_on)::date as month,
  type,
  category_id, category_name_ar, category_name_en, category_icon, category_color,
  sum(amount)::numeric(14,2) as total,
  count(*)                   as entries,
  currency
from public.v_transactions
where type in ('expense', 'income')
group by household_id, month, type, category_id, category_name_ar, category_name_en,
         category_icon, category_color, currency;

create or replace view public.v_monthly_summary with (security_invoker = true) as
select
  t.household_id,
  date_trunc('month', t.occurred_on)::date as month,
  coalesce(sum(t.amount) filter (where t.type = 'income'),  0)::numeric(14,2) as income,
  coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)::numeric(14,2) as expense,
  (coalesce(sum(t.amount) filter (where t.type = 'income'),  0)
   - coalesce(sum(t.amount) filter (where t.type = 'expense'), 0))::numeric(14,2) as net,
  a.currency
from public.transactions t
join public.accounts a on a.household_id = t.household_id and a.id = t.account_id
where t.deleted_at is null and t.type <> 'transfer'
group by t.household_id, month, a.currency;

create or replace view public.v_account_balances with (security_invoker = true) as
select
  a.id as account_id, a.household_id, a.name_ar, a.name_en, a.type, a.icon, a.color, a.is_archived,
  (a.opening_balance + coalesce(sum(
     case
       when t.type = 'income'   and t.account_id    = a.id then  t.amount
       when t.type = 'expense'  and t.account_id    = a.id then -t.amount
       when t.type = 'transfer' and t.account_id    = a.id then -t.amount
       when t.type = 'transfer' and t.to_account_id = a.id then  coalesce(t.to_amount, t.amount)
     end), 0))::numeric(14,2) as balance,
  a.currency
from public.accounts a
left join public.transactions t
  on t.household_id = a.household_id
 and t.deleted_at is null
 and (t.account_id = a.id or t.to_account_id = a.id)
group by a.id;

-- ---------- Operator: counts only, never amounts, notes or categories ----------
create or replace function public.operator_families()
returns table (
  household_id uuid, name text, status text, currencies text[], created_at timestamptz,
  admin_user_id uuid, members int, wallets int, entries int, last_entry_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select h.id, h.name, h.status, h.currencies, h.created_at,
    (select m.user_id from public.household_members m where m.household_id = h.id and m.role = 'owner' limit 1),
    (select count(*)::int from public.household_members m where m.household_id = h.id),
    (select count(*)::int from public.accounts a where a.household_id = h.id),
    (select count(*)::int from public.transactions t where t.household_id = h.id and t.deleted_at is null),
    (select max(t.updated_at) from public.transactions t where t.household_id = h.id)
  from public.households h
  order by h.created_at;
$$;

create or replace function public.set_family_status(p_household_id uuid, p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.households set status = p_status where id = p_household_id;
  if not found then raise exception 'No such family'; end if;
end $$;

-- ---------- Grants ----------
revoke execute on function public.valid_currencies(text[]) from public, anon;
revoke execute on function public.sync_main_currency() from public, anon, authenticated;
revoke execute on function public.check_account_currency() from public, anon, authenticated;
revoke execute on function public.check_txn_currency() from public, anon, authenticated;
revoke execute on function public.create_household(text, text, text, text[]) from public, anon;
revoke execute on function public.set_household_currencies(text[]) from public, anon;
grant  execute on function public.valid_currencies(text[]),
  public.create_household(text, text, text, text[]),
  public.set_household_currencies(text[]) to authenticated;

revoke execute on function public.operator_families() from public, anon, authenticated;
revoke execute on function public.set_family_status(uuid, text) from public, anon, authenticated;
grant  execute on function public.operator_families(), public.set_family_status(uuid, text) to service_role;
-- family-admin checks that the caller's family isn't suspended
grant select on public.households to service_role;

-- New columns are readable like the rest of their rows; members may not write currencies or status
-- directly (households keeps only "update (name)" from 0001).
grant select on public.v_transactions, public.v_monthly_category_totals,
  public.v_monthly_summary, public.v_account_balances to authenticated;
