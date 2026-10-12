-- =========================================================
-- 0009_family_invites_and_member_age.sql · Family Invites & Member Age (2026-10-11)
-- =========================================================

-- 1. Add age to public.household_members
alter table public.household_members
  add column if not exists age smallint check (age > 0 and age < 130);

grant update (age) on public.household_members to authenticated;

-- 2. Create public.family_invites table
create table if not exists public.family_invites (
  id           uuid primary key default gen_random_uuid(),
  token        text not null unique,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  redeemed_at  timestamptz,
  redeemed_by  uuid references auth.users(id) on delete set null,
  household_id uuid references public.households(id) on delete set null
);

-- Indexes on token and created_at
create unique index if not exists family_invites_token_idx on public.family_invites (token);
create index if not exists family_invites_created_at_idx on public.family_invites (created_at desc);

-- Enable RLS
alter table public.family_invites enable row level security;

-- Grants & Policies
revoke all on public.family_invites from anon, authenticated;
grant select, insert, update, delete on public.family_invites to service_role;

-- Allow authenticated users to view invites they created
create policy "admins see own created invites"
  on public.family_invites
  for select
  to authenticated
  using (created_by = (select auth.uid()));

grant select on public.family_invites to authenticated;

-- 3. Atomic PL/pgSQL function: public.provision_invited_household
create or replace function public.provision_invited_household(
  p_token text,
  p_user_id uuid,
  p_family_name text,
  p_currency char(3),
  p_display_name text,
  p_age int,
  p_locale text default 'en'
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_invite_id uuid;
  v_hid uuid;
  v_currency char(3);
  v_locale text;
  v_name text;
begin
  -- Validate inputs
  if p_token is null or trim(p_token) = '' then
    raise exception 'invalid_token' using errcode = '22023';
  end if;

  if p_user_id is null then
    raise exception 'invalid_user' using errcode = '22023';
  end if;

  if p_family_name is null or trim(p_family_name) = '' then
    raise exception 'invalid_family_name' using errcode = '22023';
  end if;

  if p_age is null or p_age <= 0 or p_age >= 130 then
    raise exception 'invalid_age' using errcode = '22023';
  end if;

  v_currency := upper(trim(coalesce(p_currency, 'EGP')));
  v_locale := case when lower(trim(coalesce(p_locale, 'en'))) = 'ar' then 'ar' else 'en' end;
  v_name := coalesce(nullif(trim(p_display_name), ''), 'Owner');

  -- Atomic token validation and redemption:
  -- Only succeed if token exists, is not already redeemed, and has not expired
  update public.family_invites
     set redeemed_at = now(),
         redeemed_by = p_user_id
   where token = trim(p_token)
     and redeemed_at is null
     and expires_at > now()
   returning id into v_invite_id;

  if v_invite_id is null then
    -- Check specific reason for caller diagnostic
    if not exists (select 1 from public.family_invites where token = trim(p_token)) then
      raise exception 'invite_not_found' using errcode = '22023';
    elsif exists (select 1 from public.family_invites where token = trim(p_token) and redeemed_at is not null) then
      raise exception 'invite_already_redeemed' using errcode = '22023';
    else
      raise exception 'invite_expired' using errcode = '22023';
    end if;
  end if;

  -- Insert into public.households
  insert into public.households (name, currency)
  values (trim(p_family_name), v_currency)
  returning id into v_hid;

  -- Insert into public.household_members
  insert into public.household_members (household_id, user_id, display_name, role, locale, age)
  values (v_hid, p_user_id, v_name, 'owner', v_locale, p_age::smallint);

  -- Create default cash wallet
  insert into public.accounts (household_id, name_en, name_ar, type, icon)
  values (v_hid, 'Cash at home', 'كاش في البيت', 'cash', 'banknote');

  -- Seed defaults and corrections
  perform public.seed_defaults(v_hid);
  perform public.seed_corrections(v_hid);

  -- Link household_id on redeemed invite record
  update public.family_invites
     set household_id = v_hid
   where id = v_invite_id;

  return v_hid;
end $$;

-- 4. Helper function: public.validate_invite_token
create or replace function public.validate_invite_token(p_token text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_invite record;
begin
  select id, expires_at, redeemed_at
    into v_invite
    from public.family_invites
   where token = trim(p_token);

  if not found then
    return jsonb_build_object('valid', false, 'status', 'not_found');
  elsif v_invite.redeemed_at is not null then
    return jsonb_build_object('valid', false, 'status', 'redeemed');
  elsif v_invite.expires_at <= now() then
    return jsonb_build_object('valid', false, 'status', 'expired');
  else
    return jsonb_build_object('valid', true, 'status', 'valid');
  end if;
end $$;

revoke execute on function public.provision_invited_household(text, uuid, text, char(3), text, int, text) from public, anon;
grant execute on function public.provision_invited_household(text, uuid, text, char(3), text, int, text) to authenticated, service_role;

revoke execute on function public.validate_invite_token(text) from public;
grant execute on function public.validate_invite_token(text) to anon, authenticated, service_role;
