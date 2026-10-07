-- 0009_budgets.sql · monthly budgets per expense category or group (2026-10-07)
--
-- One row = a monthly spending limit on an expense category (subcategory_id null) or on one
-- group (subcategory) inside it. The same amount applies to every month. "Removing" a budget
-- archives it (no DELETE policy, nothing is hard-deleted). The app warns softly from 80%.

create table public.budgets (
  id             uuid primary key default gen_random_uuid(), -- normally generated on the phone
  household_id   uuid not null references public.households(id) on delete cascade,
  category_id    uuid not null,
  subcategory_id uuid,
  amount         numeric(14,2) not null check (amount > 0),
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
