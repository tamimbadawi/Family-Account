-- Minimal stand-in for Supabase's auth, storage, and cron schemas/roles,
-- so all migrations (0001-0008) and smoke tests can run against a plain local Postgres 15+
-- (never run this on Supabase).

do $$ begin
  create role anon nologin;
exception when duplicate_object then null; end $$;

do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null; end $$;

grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;

-- Auth stub
create schema if not exists auth;
grant usage on schema auth to anon, authenticated;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated;

-- Storage stub (for 0004, 0008, receipts_smoke_test, and security_hardening_smoke_test)
create schema if not exists storage;
grant usage on schema storage to anon, authenticated;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
grant select on storage.buckets to anon, authenticated;

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant select, insert, update on storage.objects to authenticated;
grant select on storage.objects to anon;

create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select string_to_array(name, '/');
$$;
grant execute on function storage.foldername(text) to anon, authenticated;

-- Cron stub (for 0002_purge.sql)
create schema if not exists cron;
create or replace function cron.schedule(text, text, text)
returns bigint language sql as $$ select 1::bigint; $$;
