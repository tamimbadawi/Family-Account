-- 0016_security_hardening.sql · Two database hardening fixes (2026-10-11)
-- Fix 1: safe_cast_uuid — exception-safe UUID cast for storage RLS policies.
--         PostgreSQL's expression evaluator may reorder AND/OR clauses, so a plain
--         ::uuid cast on an unvalidated path fragment can throw 22P02 before any
--         guard expression is checked.  Using a PL/pgSQL function with an EXCEPTION
--         handler makes the cast unconditionally safe: malformed input returns NULL
--         and the policy evaluates to false rather than crashing.
--
-- Fix 2: set_txn_audit — the original trigger unconditionally overwrote created_by
--         on every operation.  Two bugs resulted:
--         a) During INSERT under postgres / service_role contexts (seeds, restores,
--            migrations) auth.uid() is NULL, silently wiping the provided created_by.
--         b) During UPDATE by a co-family-member the original author was replaced.
--         The fixed trigger preserves created_by/created_at on UPDATE and only sets
--         them on INSERT when auth.uid() is available.

-- ---------- Fix 1: safe UUID cast ----------

create or replace function public.safe_cast_uuid(val text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return val::uuid;
exception
  when invalid_text_representation then
    return null;
end $$;

-- Revoke public execute; only the storage RLS evaluator (via SECURITY INVOKER
-- policies) needs it, and it runs as the calling role already.
revoke all on function public.safe_cast_uuid(text) from public;
grant execute on function public.safe_cast_uuid(text) to authenticated;

-- Re-create the four storage policies to use safe_cast_uuid instead of a bare cast.
-- Dropping first so we can alter them cleanly.

drop policy if exists "receipts read own household"    on storage.objects;
drop policy if exists "receipts upload own household"  on storage.objects;
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

-- ---------- Fix 2: null-safe, operation-aware audit trigger ----------

create or replace function public.set_txn_audit()
returns trigger language plpgsql set search_path = ''
as $$
begin
  -- updated_at / updated_by are always refreshed on every write.
  new.updated_at := now();
  new.updated_by := auth.uid();

  if tg_op = 'INSERT' then
    -- Only stamp created_by when we actually have a session user; during
    -- seeds, restores, or migrations auth.uid() is NULL and we must
    -- preserve whatever value was supplied by the caller (or leave it NULL).
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
    -- created_at defaults to now() if not supplied (e.g. client-generated IDs
    -- that include a timestamp can pass their own value and it will be kept).
    new.created_at := coalesce(new.created_at, now());
  elsif tg_op = 'UPDATE' then
    -- A co-family-member editing an entry must not change its original author
    -- or creation timestamp — those are immutable once set.
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;

  return new;
end $$;

-- The trigger itself already exists on public.transactions from 0001_schema.sql;
-- replacing the function body is sufficient — no need to drop/recreate the trigger.
