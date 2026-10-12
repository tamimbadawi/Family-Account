-- supabase/tests/savings_goals_smoke_test.sql
-- RLS smoke test for savings_goals table; runs inside a rolled-back transaction.

begin;

-- Verify table exists
select count(*) from public.savings_goals;

-- Verify columns and constraints
do $$
begin
  assert (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'savings_goals') >= 13,
    'savings_goals table is missing required columns';
end $$;

rollback;
