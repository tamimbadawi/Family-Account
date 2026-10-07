-- Minimal stand-in for Supabase's auth schema and roles, so the migration and
-- rls_smoke_test.sql can be run against a plain local Postgres 15+ (never run this on Supabase).
--
--   createdb fa_test
--   psql fa_test -f supabase/tests/local_auth_stub.sql
--   psql fa_test -v ON_ERROR_STOP=1 -f supabase/migrations/0001_schema.sql
--   psql fa_test -f supabase/tests/rls_smoke_test.sql     # expect the intentional "SMOKE TEST RESULTS" error, all PASS

do $$ begin  -- roles are cluster-wide: survive re-creating the test database
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
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

-- Added for 0002–0009 and multi_family_smoke_test.sql (2026-10-07):
--   psql fa_test -v ON_ERROR_STOP=1 -f each file in supabase/migrations, in order
--   psql fa_test -f supabase/tests/multi_family_smoke_test.sql
grant usage on schema public to service_role;
alter table auth.users add column raw_app_meta_data jsonb not null default '{}'::jsonb;

-- pg_cron (0002): a no-op schedule()
create schema cron;
create function cron.schedule(job text, schedule text, command text) returns bigint
  language sql as $$ select 1::bigint $$;

-- Storage (0004): buckets, objects with RLS, foldername()
create schema storage;
grant usage on schema storage to anon, authenticated;
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid
);
alter table storage.objects enable row level security;
grant select, insert, update on storage.objects to anon, authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1 : greatest(array_length(string_to_array(name, '/'), 1) - 1, 1)]
$$;
grant execute on function storage.foldername(text) to anon, authenticated;
