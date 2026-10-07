-- 0009_budgets.sql · monthly budgets per expense category or group (2026-10-07)
--
-- One row = a monthly spending limit on an expense category (subcategory_id null) or on one
-- group (subcategory) inside it. The same amount applies to every month. "Removing" a budget
-- archives it (no DELETE policy, nothing is hard-deleted). The app warns softly from 80%.
-- Every new household gets its own starter budgets (amounts vary per family); they are normal
-- rows the family can change or remove. is_starter turns false once the app saves a change.

create table public.budgets (
  id             uuid primary key default gen_random_uuid(), -- normally generated on the phone
  household_id   uuid not null references public.households(id) on delete cascade,
  category_id    uuid not null,
  subcategory_id uuid,
  amount         numeric(14,2) not null check (amount > 0),
  is_starter     boolean not null default false,
  is_archived    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (household_id, category_id)    references public.categories    (household_id, id) on delete restrict,
  foreign key (household_id, subcategory_id) references public.subcategories (household_id, id) on delete restrict
);

-- One active budget per category/group (a whole-category budget has subcategory_id null).
create unique index budgets_one_active_idx on public.budgets (household_id, category_id, subcategory_id)
  nulls not distinct where not is_archived;
create index budgets_household_category_idx    on public.budgets (household_id, category_id);
create index budgets_household_subcategory_idx on public.budgets (household_id, subcategory_id);
create index budgets_sync_idx                  on public.budgets (household_id, updated_at);

create trigger budgets_touch before update on public.budgets for each row execute function public.set_updated_at();

-- Only expense categories have budgets, and a group budget must sit inside its own category.
create or replace function public.check_budget_target()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (select kind from public.categories where id = new.category_id) is distinct from 'expense' then
    raise exception 'Budgets are only for expense categories' using errcode = '23514';
  end if;
  if new.subcategory_id is not null and
     (select category_id from public.subcategories where id = new.subcategory_id) is distinct from new.category_id then
    raise exception 'The group is not inside this category' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger budgets_target_guard before insert or update of category_id, subcategory_id on public.budgets
  for each row execute function public.check_budget_target();

-- Same three policies as every other data table. No DELETE policy = no hard deletes.
alter table public.budgets enable row level security;
create policy "household select" on public.budgets for select to authenticated using (public.is_member(household_id));
create policy "household insert" on public.budgets for insert to authenticated with check (public.is_member(household_id));
create policy "household update" on public.budgets for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

revoke all on public.budgets from anon, authenticated;
grant select, insert, update on public.budgets to authenticated;

-- ---------- Starter budgets for every new household ----------
-- Typical monthly amounts (EGP) for the default expense categories, each nudged by a random
-- 0.85–1.15 and rounded to 100, so every family starts from its own numbers.
create or replace function public.seed_budgets(hid uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  starter jsonb := '{"Household": 3000, "Food": 6000, "Transport": 1500, "Health": 1000}';
  c record;
begin
  for c in
    select id, name_en from public.categories
    where household_id = hid and kind = 'expense' and name_en in (select jsonb_object_keys(starter))
  loop
    insert into public.budgets (household_id, category_id, amount, is_starter)
    values (hid, c.id,
            greatest(100, round((starter->>c.name_en)::numeric * (0.85 + random() * 0.3) / 100) * 100),
            true);
  end loop;
end $$;

-- Same as 0005, plus the starter budgets.
create or replace function public.create_household(
  p_name text, p_display_name text, p_locale text default 'en')
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
  values (hid, 'Cash at home', 'كاش في البيت', 'cash', 'banknote');
  perform public.seed_defaults(hid);
  perform public.seed_corrections(hid);
  perform public.seed_budgets(hid);
  return hid;
end $$;

revoke execute on function public.seed_budgets(uuid) from public, anon, authenticated;
revoke execute on function public.create_household(text, text, text) from public, anon;
grant  execute on function public.create_household(text, text, text) to authenticated;

-- Households created before this migration get their starter budgets too.
do $$
declare h uuid;
begin
  for h in select id from public.households where not exists (select 1 from public.budgets b where b.household_id = households.id) loop
    perform public.seed_budgets(h);
  end loop;
end $$;
