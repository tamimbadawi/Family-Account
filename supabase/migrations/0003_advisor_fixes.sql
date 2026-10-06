-- 0003_advisor_fixes.sql · fixes from the Supabase advisors after 0001/0002 (2026-10-06)

-- Supabase's "automatic RLS" helper (an event-trigger function in public) must not be callable over the API.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

-- Cover the composite foreign keys (household_id, …) and the audit columns.
create index if not exists subcategories_household_category_idx on public.subcategories (household_id, category_id);
create index if not exists items_household_subcategory_idx      on public.items (household_id, subcategory_id);
create index if not exists transactions_household_account_idx   on public.transactions (household_id, account_id);
create index if not exists transactions_household_to_account_idx on public.transactions (household_id, to_account_id);
create index if not exists transactions_household_item_idx      on public.transactions (household_id, item_id);
create index if not exists transactions_created_by_idx          on public.transactions (created_by);
create index if not exists transactions_updated_by_idx          on public.transactions (updated_by);
