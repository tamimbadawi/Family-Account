-- Minimal stand-in for Supabase's auth schema and roles, so the migration and
-- rls_smoke_test.sql can be run against a plain local Postgres 15+ (never run this on Supabase).
--
--   createdb fa_test
--   psql fa_test -f supabase/tests/local_auth_stub.sql
--   psql fa_test -v ON_ERROR_STOP=1 -f supabase/migrations/0001_schema.sql
--   psql fa_test -f supabase/tests/rls_smoke_test.sql     # expect the intentional "SMOKE TEST RESULTS" error, all PASS

create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;     -- mimic Supabase defaults
alter default privileges in schema public grant all on functions to anon, authenticated;

create schema auth;
grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated;
