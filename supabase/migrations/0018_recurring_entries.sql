-- 0018_recurring_entries.sql · Recurring rules for monthly bills, salaries, rent (2026-10-12)
--
-- One row = a monthly recurring rule (rent, salaries, school fees, subscriptions).
-- Entries are generated on the phone when the app opens for every due month not yet created.
-- Composite foreign keys keep rows inside the household.
-- A unique constraint on (household_id, recurring_rule_id, recurring_month) guarantees
-- that both phones opening concurrently or repeating the sync never duplicates an entry.

create table public.recurring_rules (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  type           public.txn_type not null,
  amount         numeric(14,2) not null check (amount > 0),
  day_of_month   smallint not null check (day_of_month between 1 and 31),
  start_month    text not null check (start_month ~ '^\d{4}-\d{2}$'),
  account_id     uuid not null,
  to_account_id  uuid,
  item_id        uuid,
  note           text check (char_length(note) <= 500),
  is_archived    boolean not null default false,
  created_by     uuid default auth.uid() references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, account_id)    references public.accounts (household_id, id),
  foreign key (household_id, to_account_id) references public.accounts (household_id, id),
  foreign key (household_id, item_id)       references public.items    (household_id, id),
  constraint recurring_shape check (
    (type in ('expense', 'income') and item_id is not null and to_account_id is null)
    or
    (type = 'transfer' and item_id is null and to_account_id is not null and to_account_id <> account_id)
  )
);

create index recurring_rules_household_idx on public.recurring_rules (household_id) where not is_archived;
create index recurring_rules_sync_idx      on public.recurring_rules (household_id, updated_at);

create trigger recurring_rules_touch before update on public.recurring_rules
  for each row execute function public.set_updated_at();

create trigger recurring_rules_kind before insert or update on public.recurring_rules
  for each row execute function public.check_txn_kind();

alter table public.recurring_rules enable row level security;
create policy "household select" on public.recurring_rules
  for select to authenticated using (public.is_member(household_id));
create policy "household insert" on public.recurring_rules
  for insert to authenticated with check (public.is_member(household_id));
create policy "household update" on public.recurring_rules
  for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

revoke all on public.recurring_rules from anon, authenticated;
grant select, insert, update on public.recurring_rules to authenticated;

-- Add recurring tracking to transactions
alter table public.transactions add column recurring_rule_id uuid;
alter table public.transactions add column recurring_month text check (recurring_month is null or recurring_month ~ '^\d{4}-\d{2}$');
alter table public.transactions add foreign key (household_id, recurring_rule_id) references public.recurring_rules (household_id, id);
alter table public.transactions add constraint transactions_recurring_month_uniq unique (household_id, recurring_rule_id, recurring_month);
create index transactions_recurring_rule_idx on public.transactions (household_id, recurring_rule_id) where recurring_rule_id is not null;
