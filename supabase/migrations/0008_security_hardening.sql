-- Migration: 0008_security_hardening.sql
-- Security Hardening & Tenant Isolation Enforcement

-- 1. Pre-flight check: Never automatically delete duplicate household memberships.
--    Detect duplicates and abort the migration with a clear remediation message.
do $$
declare
  dup_count int;
  dup_users text;
begin
  select count(distinct user_id), string_agg(user_id::text, ', ')
  into dup_count, dup_users
  from (
    select user_id
    from public.household_members
    group by user_id
    having count(*) > 1
  ) dups;

  if dup_count > 0 then
    raise exception 'Migration 0008 aborted: found % user(s) with multiple household memberships: (%). Please manually resolve duplicate memberships before applying this migration.', dup_count, dup_users;
  end if;
end $$;

-- 2. Enforce single-household invariant (one user belongs to at most one household)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'household_members_user_id_key'
      and conrelid = 'public.household_members'::regclass
  ) then
    alter table public.household_members add constraint household_members_user_id_key unique (user_id);
  end if;
end $$;

-- 3. Drop legacy vulnerable RPC public.add_member(text, text)
--    Provisioning is handled by the family-admin Edge Function using the Supabase Auth Admin API.
drop function if exists public.add_member(text, text);

-- 4. Hardened transaction audit trigger
--    - Authenticated users cannot forge created_by or created_at on INSERT.
--    - Original created_by and created_at are strictly immutable on UPDATE.
--    - Resilient to SECURITY DEFINER functions: an end-user JWT ('authenticated' or 'anon')
--      is NEVER classified as trusted, even if executed inside a SECURITY DEFINER function owned by postgres.
--    - Only genuine service_role requests or direct administrative sessions (psql/migrations as postgres)
--      may specify historical creation metadata.
create or replace function public.set_txn_audit()
returns trigger language plpgsql set search_path = ''
as $$
declare
  jwt_role text;
  is_trusted boolean;
begin
  jwt_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    case
      when nullif(current_setting('request.jwt.claims', true), '') is not null
           and current_setting('request.jwt.claims', true) ~ '^\s*\{'
      then (current_setting('request.jwt.claims', true)::jsonb ->> 'role')
      else null
    end
  );

  if jwt_role in ('authenticated', 'anon') then
    is_trusted := false;
  elsif jwt_role = 'service_role' then
    is_trusted := true;
  elsif jwt_role is null and session_user in ('postgres', 'supabase_admin') and current_user in ('postgres', 'supabase_admin') then
    is_trusted := true;
  else
    is_trusted := false;
  end if;

  if tg_op = 'INSERT' then
    if not is_trusted then
      if auth.uid() is not null then
        new.created_by := auth.uid();
        new.created_at := now();
      else
        raise exception 'Cannot create transaction without authenticated user identity' using errcode = '42501';
      end if;
    else
      new.created_by := coalesce(new.created_by, auth.uid());
      new.created_at := coalesce(new.created_at, now());
    end if;
  else -- tg_op = 'UPDATE'
    if not is_trusted then
      new.created_by := old.created_by;
      new.created_at := old.created_at;
    else
      new.created_by := coalesce(new.created_by, old.created_by);
      new.created_at := coalesce(new.created_at, old.created_at);
    end if;
  end if;

  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

-- 5. Safe regex-backed UUID cast helper
create or replace function public.safe_cast_uuid(p_val text)
returns uuid language plpgsql immutable set search_path = ''
as $$
begin
  if p_val is not null and p_val ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return p_val::uuid;
  end if;
  return null;
end $$;

revoke execute on function public.safe_cast_uuid(text) from public;
grant execute on function public.safe_cast_uuid(text) to anon, authenticated;

-- 6. Storage RLS policies with safe UUID parsing
drop policy if exists "receipts read own household" on storage.objects;
drop policy if exists "receipts upload own household" on storage.objects;
drop policy if exists "receipts replace own household" on storage.objects;

create policy "receipts read own household" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and public.safe_cast_uuid((storage.foldername(name))[1]) is not null
    and public.is_member(public.safe_cast_uuid((storage.foldername(name))[1]))
  );

create policy "receipts upload own household" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and public.safe_cast_uuid((storage.foldername(name))[1]) is not null
    and public.is_member(public.safe_cast_uuid((storage.foldername(name))[1]))
  );

create policy "receipts replace own household" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'receipts'
    and public.safe_cast_uuid((storage.foldername(name))[1]) is not null
    and public.is_member(public.safe_cast_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'receipts'
    and public.safe_cast_uuid((storage.foldername(name))[1]) is not null
    and public.is_member(public.safe_cast_uuid((storage.foldername(name))[1]))
  );
