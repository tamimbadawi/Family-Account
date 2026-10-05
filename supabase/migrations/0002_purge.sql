-- Purge soft-deleted transactions after 30 days (pg_cron).
-- If "create extension" fails, enable Cron in Supabase Dashboard → Integrations first.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'purge-deleted-transactions', '0 3 * * *',
  $$ delete from public.transactions where deleted_at < now() - interval '30 days' $$
);
