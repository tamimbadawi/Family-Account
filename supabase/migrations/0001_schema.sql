-- =========================================================
-- 0001_schema.sql  ·  Family Accounts
-- =========================================================

-- ---------- Types ----------
create type public.category_kind as enum ('expense', 'income');
create type public.txn_type      as enum ('expense', 'income', 'transfer');
create type public.account_type  as enum ('cash', 'bank', 'card', 'wallet');

-- ---------- Households & members ----------
create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  currency   char(3) not null default 'EGP',
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role         text not null default 'member' check (role in ('owner', 'member')),
  locale       text not null default 'ar' check (locale in ('ar', 'en')),
  created_at   timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);

-- RLS helper: is the signed-in user a member of this household?
create or replace function public.is_member(hid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid())
  );
$$;

-- ---------- Wallets (accounts) ----------
create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households(id) on delete cascade,
  name_ar         text,
  name_en         text,
  type            public.account_type not null default 'cash',
  opening_balance numeric(14,2) not null default 0,
  icon            text,
  color           text,
  sort_order      int not null default 0,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (coalesce(name_ar, name_en) is not null),
  unique (household_id, id)
);

-- ---------- 3-tier categories ----------
create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind         public.category_kind not null,
  name_ar      text,
  name_en      text,
  icon         text,
  color        text,
  sort_order   int not null default 0,
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (coalesce(name_ar, name_en) is not null),
  unique (household_id, id)
);

create table public.subcategories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  category_id  uuid not null,
  name_ar      text,
  name_en      text,
  sort_order   int not null default 0,
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (coalesce(name_ar, name_en) is not null),
  unique (household_id, id),
  foreign key (household_id, category_id)
    references public.categories (household_id, id) on delete restrict
);
create index subcategories_category_idx on public.subcategories (category_id);

create table public.items (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null,
  subcategory_id uuid not null,
  name_ar        text,
  name_en        text,
  sort_order     int not null default 0,
  is_archived    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (coalesce(name_ar, name_en) is not null),
  unique (household_id, id),
  foreign key (household_id, subcategory_id)
    references public.subcategories (household_id, id) on delete restrict
);
create index items_subcategory_idx on public.items (subcategory_id);

-- ---------- Transactions ----------
create table public.transactions (
  id            uuid primary key default gen_random_uuid(), -- normally generated on the phone
  household_id  uuid not null references public.households(id) on delete cascade,
  type          public.txn_type not null,
  amount        numeric(14,2) not null check (amount > 0),
  occurred_on   date not null default current_date,
  account_id    uuid not null,
  to_account_id uuid,
  item_id       uuid,
  note          text check (char_length(note) <= 500),
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  foreign key (household_id, account_id)    references public.accounts (household_id, id),
  foreign key (household_id, to_account_id) references public.accounts (household_id, id),
  foreign key (household_id, item_id)       references public.items    (household_id, id),
  constraint txn_shape check (
    (type in ('expense', 'income') and item_id is not null and to_account_id is null)
    or
    (type = 'transfer' and item_id is null and to_account_id is not null
                       and to_account_id <> account_id)
  )
);
create index transactions_list_idx on public.transactions (household_id, occurred_on desc)
  where deleted_at is null;
create index transactions_sync_idx on public.transactions (household_id, updated_at);

-- ---------- Triggers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

create or replace function public.set_txn_audit()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create trigger accounts_touch      before update on public.accounts      for each row execute function public.set_updated_at();
create trigger categories_touch    before update on public.categories    for each row execute function public.set_updated_at();
create trigger subcategories_touch before update on public.subcategories for each row execute function public.set_updated_at();
create trigger items_touch         before update on public.items         for each row execute function public.set_updated_at();
create trigger transactions_audit  before insert or update on public.transactions for each row execute function public.set_txn_audit();

-- Item's category kind must match the entry type
create or replace function public.check_txn_kind()
returns trigger language plpgsql set search_path = ''
as $$
declare k public.category_kind;
begin
  if new.type = 'transfer' then return new; end if;
  select c.kind into k
  from public.items i
  join public.subcategories s on s.id = i.subcategory_id
  join public.categories   c on c.id = s.category_id
  where i.id = new.item_id;
  if k is null or k::text <> new.type::text then
    raise exception 'Item category kind (%) does not match entry type (%)', k, new.type
      using errcode = '23514';
  end if;
  return new;
end $$;

create trigger transactions_kind before insert or update on public.transactions
  for each row execute function public.check_txn_kind();

-- ---------- Row Level Security ----------
alter table public.households        enable row level security;
alter table public.household_members enable row level security;

create policy "members read household" on public.households
  for select to authenticated using (public.is_member(id));
create policy "members rename household" on public.households
  for update to authenticated using (public.is_member(id)) with check (public.is_member(id));

create policy "members see co-members" on public.household_members
  for select to authenticated using (public.is_member(household_id));
create policy "edit own profile" on public.household_members
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Same three policies on every data table. No DELETE policy = no hard deletes.
do $$
declare t text;
begin
  foreach t in array array['accounts','categories','subcategories','items','transactions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "household select" on public.%I for select to authenticated using (public.is_member(household_id))', t);
    execute format('create policy "household insert" on public.%I for insert to authenticated with check (public.is_member(household_id))', t);
    execute format('create policy "household update" on public.%I for update to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id))', t);
  end loop;
end $$;

-- ---------- Views (RLS-aware) ----------
create view public.v_transactions with (security_invoker = true) as
select
  t.id, t.household_id, t.type, t.amount, t.occurred_on, t.note,
  t.account_id, a.name_ar as account_name_ar, a.name_en as account_name_en,
  t.to_account_id,
  t.item_id,        i.name_ar as item_name_ar,        i.name_en as item_name_en,
  s.id as subcategory_id, s.name_ar as subcategory_name_ar, s.name_en as subcategory_name_en,
  c.id as category_id,    c.name_ar as category_name_ar,    c.name_en as category_name_en,
  c.icon as category_icon, c.color as category_color,
  t.created_by, t.created_at, t.updated_at
from public.transactions t
join public.accounts a        on a.household_id = t.household_id and a.id = t.account_id
left join public.items i         on i.id = t.item_id
left join public.subcategories s on s.id = i.subcategory_id
left join public.categories c    on c.id = s.category_id
where t.deleted_at is null;

create view public.v_monthly_category_totals with (security_invoker = true) as
select
  household_id,
  date_trunc('month', occurred_on)::date as month,
  type,
  category_id, category_name_ar, category_name_en, category_icon, category_color,
  sum(amount)::numeric(14,2) as total,
  count(*)                   as entries
from public.v_transactions
where type in ('expense', 'income')
group by 1, 2, 3, 4, 5, 6, 7, 8;

create view public.v_monthly_summary with (security_invoker = true) as
select
  household_id,
  date_trunc('month', occurred_on)::date as month,
  coalesce(sum(amount) filter (where type = 'income'),  0)::numeric(14,2) as income,
  coalesce(sum(amount) filter (where type = 'expense'), 0)::numeric(14,2) as expense,
  (coalesce(sum(amount) filter (where type = 'income'),  0)
   - coalesce(sum(amount) filter (where type = 'expense'), 0))::numeric(14,2) as net
from public.transactions
where deleted_at is null and type <> 'transfer'
group by 1, 2;

create view public.v_account_balances with (security_invoker = true) as
select
  a.id as account_id, a.household_id, a.name_ar, a.name_en, a.type, a.icon, a.color, a.is_archived,
  (a.opening_balance + coalesce(sum(
     case
       when t.type = 'income'   and t.account_id    = a.id then  t.amount
       when t.type = 'expense'  and t.account_id    = a.id then -t.amount
       when t.type = 'transfer' and t.account_id    = a.id then -t.amount
       when t.type = 'transfer' and t.to_account_id = a.id then  t.amount
     end), 0))::numeric(14,2) as balance
from public.accounts a
left join public.transactions t
  on t.household_id = a.household_id
 and t.deleted_at is null
 and (t.account_id = a.id or t.to_account_id = a.id)
group by a.id;

-- ---------- Default categories (bilingual) ----------
create or replace function public.seed_defaults(hid uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  tree jsonb := $json$[
    {"kind":"expense","en":"Household","ar":"المنزل","icon":"house","color":"#0F766E","subs":[
      {"en":"Utilities","ar":"المرافق","items":[["Electricity","كهرباء"],["Water","مياه"],["Gas","غاز"],["Internet","إنترنت"],["Mobile","موبايل"]]},
      {"en":"Rent & upkeep","ar":"إيجار وصيانة","items":[["Rent","إيجار"],["Repairs","تصليحات"],["Building fees","مصاريف العمارة"]]}]},
    {"kind":"expense","en":"Food","ar":"الطعام","icon":"shopping-basket","color":"#B45309","subs":[
      {"en":"Groceries","ar":"البقالة","items":[["Supermarket","سوبرماركت"],["Vegetables & fruit","خضار وفاكهة"],["Meat & poultry","لحوم ودواجن"],["Bread","عيش"]]},
      {"en":"Eating out","ar":"أكل برّه","items":[["Restaurants","مطاعم"],["Delivery","دليفري"]]}]},
    {"kind":"expense","en":"Transport","ar":"المواصلات","icon":"car","color":"#1D4ED8","subs":[
      {"en":"Car","ar":"العربية","items":[["Fuel","بنزين"],["Maintenance","صيانة"],["Parking","ركنة"]]},
      {"en":"Rides","ar":"مشاوير","items":[["Taxi & ride apps","تاكسي وتطبيقات"]]}]},
    {"kind":"expense","en":"Health","ar":"الصحة","icon":"heart-pulse","color":"#BE123C","subs":[
      {"en":"Medical","ar":"طبي","items":[["Pharmacy","صيدلية"],["Doctor","دكتور"],["Lab tests","تحاليل"]]}]},
    {"kind":"expense","en":"Family","ar":"العائلة","icon":"users","color":"#7C3AED","subs":[
      {"en":"Gifts & occasions","ar":"هدايا ومناسبات","items":[["Gifts","هدايا"],["Charity","صدقات"]]}]},
    {"kind":"income","en":"Income","ar":"الدخل","icon":"wallet","color":"#15803D","subs":[
      {"en":"Regular","ar":"دخل ثابت","items":[["Pension","معاش"],["Salary","مرتب"],["Rent received","إيجار"]]},
      {"en":"Other","ar":"أخرى","items":[["Gifts received","هدايا"],["Other","أخرى"]]}]}
  ]$json$;
  c jsonb; s jsonb; i jsonb;
  cid uuid; sid uuid;
  ci int := 0; si int; ii int;
begin
  for c in select value from jsonb_array_elements(tree) loop
    insert into public.categories (household_id, kind, name_en, name_ar, icon, color, sort_order)
    values (hid, (c->>'kind')::public.category_kind, c->>'en', c->>'ar', c->>'icon', c->>'color', ci)
    returning id into cid;
    ci := ci + 1; si := 0;
    for s in select value from jsonb_array_elements(c->'subs') loop
      insert into public.subcategories (household_id, category_id, name_en, name_ar, sort_order)
      values (hid, cid, s->>'en', s->>'ar', si)
      returning id into sid;
      si := si + 1; ii := 0;
      for i in select value from jsonb_array_elements(s->'items') loop
        insert into public.items (household_id, subcategory_id, name_en, name_ar, sort_order)
        values (hid, sid, i->>0, i->>1, ii);
        ii := ii + 1;
      end loop;
    end loop;
  end loop;
end $$;

-- ---------- Onboarding RPCs ----------
create or replace function public.create_household(
  p_name text, p_display_name text, p_locale text default 'ar')
returns uuid language plpgsql security definer set search_path = ''
as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'Already in a household';
  end if;
  insert into public.households (name) values (p_name) returning id into hid;
  insert into public.household_members (household_id, user_id, display_name, role, locale)
  values (hid, auth.uid(), p_display_name, 'owner', p_locale);
  insert into public.accounts (household_id, name_en, name_ar, type, icon)
  values (hid, 'Cash', 'كاش', 'cash', 'banknote');
  perform public.seed_defaults(hid);
  return hid;
end $$;

create or replace function public.add_member(p_email text, p_display_name text)
returns void language plpgsql security definer set search_path = ''
as $$
declare hid uuid; uid uuid;
begin
  select household_id into hid from public.household_members
  where user_id = auth.uid() and role = 'owner';
  if hid is null then raise exception 'Only the owner can add members'; end if;
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then raise exception 'No user with that email exists yet'; end if;
  insert into public.household_members (household_id, user_id, display_name)
  values (hid, uid, p_display_name) on conflict do nothing;
end $$;

-- ---------- Keep-alive heartbeat (called by GitHub Action + Vercel cron) ----------
create table public.heartbeat (
  id        int primary key default 1 check (id = 1),
  pinged_at timestamptz not null default now()
);
alter table public.heartbeat enable row level security; -- no policies: only the function writes

create or replace function public.keepalive()
returns timestamptz language sql volatile security definer set search_path = ''
as $$
  insert into public.heartbeat (id, pinged_at) values (1, now())
  on conflict (id) do update set pinged_at = now()
  returning pinged_at;
$$;

-- ---------- Grants ----------
-- Supabase grants ALL on new tables by default; start from zero, then grant exactly what's needed.
revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update on public.accounts, public.categories, public.subcategories,
  public.items, public.transactions to authenticated;
grant select on public.households, public.household_members to authenticated;
grant update (name) on public.households to authenticated;
grant update (display_name, locale) on public.household_members to authenticated;
grant select on public.v_transactions, public.v_monthly_category_totals,
  public.v_monthly_summary, public.v_account_balances to authenticated;

revoke execute on function public.seed_defaults(uuid) from public, anon, authenticated;
revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.create_household(text, text, text) from public, anon;
revoke execute on function public.add_member(text, text) from public, anon;
grant  execute on function public.is_member(uuid), public.create_household(text, text, text),
  public.add_member(text, text) to authenticated;
revoke execute on function public.keepalive() from public;
grant  execute on function public.keepalive() to anon, authenticated;
