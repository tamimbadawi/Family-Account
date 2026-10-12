-- 0024_realtime.sql — add household tables to supabase_realtime publication
-- Guarded so re-running is harmless.

do $$
declare
  t text;
  tables text[] := array[
    'accounts',
    'categories',
    'subcategories',
    'items',
    'transactions',
    'budgets',
    'recurring_rules',
    'savings_goals',
    'households',
    'household_members'
  ];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array tables loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t)
       and not exists (
         select 1
         from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = t
       ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
