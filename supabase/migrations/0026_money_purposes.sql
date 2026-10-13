-- 0026_money_purposes.sql · Money purposes and investment values (2026-10-13)

create type public.account_purpose as enum ('spending', 'goal', 'investment');

alter table public.accounts
  add column purpose public.account_purpose not null default 'spending',
  add column investment_kind text
    check (investment_kind is null
           or investment_kind in ('gold','certificate','stocks','property','other')),
  add column matures_on date,
  add constraint accounts_investment_shape check (
    (purpose = 'investment' and investment_kind is not null)
    or (purpose <> 'investment' and investment_kind is null and matures_on is null)
  );

update public.accounts a
set purpose = 'goal'
where a.type = 'wallet'
  and exists (
    select 1
    from public.savings_goals g
    where g.wallet_id = a.id
  )
  and not exists (
    select 1
    from public.transactions t
    where t.account_id = a.id
      and t.type in ('expense', 'income')
  );

create table public.investment_values (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  account_id    uuid not null,
  value         numeric(14,2) not null check (value >= 0),
  valued_on     date not null default current_date,
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  unique (household_id, id),
  foreign key (household_id, account_id)
    references public.accounts (household_id, id) on delete cascade
);

create index investment_values_account_idx on public.investment_values (household_id, account_id);
create index investment_values_sync_idx on public.investment_values (household_id, updated_at);

create trigger investment_values_touch before update on public.investment_values
  for each row execute function public.set_updated_at();

alter table public.investment_values enable row level security;
create policy "household select" on public.investment_values
  for select to authenticated using (public.is_member(household_id));
create policy "household insert" on public.investment_values
  for insert to authenticated with check (public.is_member(household_id));
create policy "household update" on public.investment_values
  for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

revoke all on public.investment_values from anon, authenticated;
grant select, insert, update on public.investment_values to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'investment_values')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'investment_values'
     ) then
    execute 'alter publication supabase_realtime add table public.investment_values';
  end if;
end $$;
