-- 0019_savings_goals.sql · Savings goals linked to wallets (2026-10-12)
--
-- A goal has a name, target amount, optional target date and an icon.
-- Money is added to a goal by a normal transfer into a wallet linked to that goal,
-- so the books still balance.
-- Composite foreign keys keep rows inside the household.
-- Soft delete via is_archived.

create table public.savings_goals (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  name_en        text not null check (char_length(name_en) between 1 and 60),
  name_ar        text check (name_ar is null or char_length(name_ar) <= 60),
  target_amount  numeric(14,2) not null check (target_amount > 0),
  target_date    date,
  icon           text check (icon is null or char_length(icon) <= 40),
  color          text check (color is null or char_length(color) <= 40),
  wallet_id      uuid not null,
  is_archived    boolean not null default false,
  created_by     uuid default auth.uid() references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, wallet_id) references public.accounts (household_id, id) on delete cascade
);

create index savings_goals_household_idx on public.savings_goals (household_id) where not is_archived;
create index savings_goals_sync_idx      on public.savings_goals (household_id, updated_at);
create index savings_goals_wallet_idx    on public.savings_goals (household_id, wallet_id);

create trigger savings_goals_touch before update on public.savings_goals
  for each row execute function public.set_updated_at();

alter table public.savings_goals enable row level security;
create policy "household select" on public.savings_goals
  for select to authenticated using (public.is_member(household_id));
create policy "household insert" on public.savings_goals
  for insert to authenticated with check (public.is_member(household_id));
create policy "household update" on public.savings_goals
  for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

revoke all on public.savings_goals from anon, authenticated;
grant select, insert, update on public.savings_goals to authenticated;
