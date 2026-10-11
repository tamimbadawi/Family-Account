-- 0012_family_invites.sql · anyone in a family can invite another family (2026-10-07)
--
-- Families stay invite-only (docs/MULTI-FAMILY.md): only the operator creates a family admin.
-- A member asks for a friend's family with invite_family(name, email); the request waits on
-- /operator, where the operator approves it (creates the friend's family admin login, see the
-- `operator` Edge Function) or declines it. Requests are never deleted, only decided.
-- The inviting family sees its own requests and their state; nobody else's.

create table public.family_invites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,  -- the family that invited
  invited_by   uuid references auth.users(id) on delete set null,
  friend_name  text not null check (char_length(trim(friend_name)) between 1 and 60),
  email        text not null check (email = lower(trim(email)) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz
);

-- One open request per friend per family; the operator's list is the pending ones, oldest first.
create unique index family_invites_one_pending_idx on public.family_invites (household_id, email) where status = 'pending';
create index family_invites_household_idx on public.family_invites (household_id, created_at);
create index family_invites_invited_by_idx on public.family_invites (invited_by);
create index family_invites_pending_idx on public.family_invites (created_at) where status = 'pending';

-- Members read their own family's requests. Writes only through the functions below.
alter table public.family_invites enable row level security;
create policy "household select" on public.family_invites for select to authenticated using (public.is_member(household_id));
revoke all on public.family_invites from anon, authenticated;
grant select on public.family_invites to authenticated;

-- ---------- A member invites a friend's family ----------
-- Same friend asked twice while still pending: returns the open request instead of a second one.
-- At most 5 requests per family per day, so a lost phone can't flood the operator.
create or replace function public.invite_family(p_friend_name text, p_email text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare hid uuid; hstatus text; clean_email text := lower(trim(p_email)); existing uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select m.household_id, h.status into hid, hstatus
  from public.household_members m join public.households h on h.id = m.household_id
  where m.user_id = auth.uid() limit 1;
  if hid is null then raise exception 'not_in_family' using errcode = '42501'; end if;
  if hstatus is distinct from 'active' then raise exception 'suspended' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_friend_name, ''))) not between 1 and 60 then
    raise exception 'bad_name' using errcode = '23514';
  end if;
  if clean_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'bad_email' using errcode = '23514'; end if;

  select id into existing from public.family_invites
  where household_id = hid and email = clean_email and status = 'pending';
  if existing is not null then return existing; end if;

  if (select count(*) from public.family_invites
      where household_id = hid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'too_many' using errcode = '54000';
  end if;

  insert into public.family_invites (household_id, invited_by, friend_name, email)
  values (hid, auth.uid(), trim(p_friend_name), clean_email)
  returning id into existing;
  return existing;
end $$;

-- ---------- Operator only (service role, via the `operator` Edge Function) ----------
create or replace function public.operator_family_invites()
returns table (invite_id uuid, friend_name text, email text, created_at timestamptz,
               from_family text, from_name text)
language sql stable security definer set search_path = ''
as $$
  select i.id, i.friend_name, i.email, i.created_at, h.name,
    (select m.display_name from public.household_members m
     where m.household_id = i.household_id and m.user_id = i.invited_by)
  from public.family_invites i join public.households h on h.id = i.household_id
  where i.status = 'pending'
  order by i.created_at;
$$;

-- Deciding one request decides every open request for the same email (two families invited the same friend).
create or replace function public.decide_family_invite(p_invite_id uuid, p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
declare target text;
begin
  if p_status not in ('approved', 'declined') then raise exception 'bad_status' using errcode = '23514'; end if;
  select email into target from public.family_invites where id = p_invite_id;
  if target is null then raise exception 'No such invite'; end if;
  update public.family_invites set status = p_status, decided_at = now()
  where email = target and status = 'pending';
end $$;

revoke execute on function public.invite_family(text, text) from public, anon;
grant  execute on function public.invite_family(text, text) to authenticated;
revoke execute on function public.operator_family_invites() from public, anon, authenticated;
revoke execute on function public.decide_family_invite(uuid, text) from public, anon, authenticated;
grant  execute on function public.operator_family_invites(), public.decide_family_invite(uuid, text) to service_role;
