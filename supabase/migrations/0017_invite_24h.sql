-- 0017_invite_24h.sql · a family invite lives 24 hours from when it is sent (2026-10-12)
--
-- Before this, a request waited on /operator for ever: only a login the operator had already created
-- expired (0013). Now the request itself expires 24 hours after it is sent if nobody signed in:
-- the 15-minute clean-up job marks it 'expired', it leaves the operator's list, and the inviting
-- family no longer sees it (the app hides expired invites). The email is free to be invited again.
-- Rows are kept, never deleted, so the 5-a-day limit and the history still hold.

-- ---------- The clean-up job also expires requests nobody acted on ----------
create or replace function public.expire_unused_family_logins()
returns int language plpgsql security definer set search_path = ''
as $$
declare n int;
begin
  with gone as (
    delete from auth.users u
    where coalesce((u.raw_app_meta_data ->> 'family_admin')::boolean, false)
      and u.last_sign_in_at is null
      and not exists (select 1 from public.household_members m where m.user_id = u.id)
      and coalesce((u.raw_app_meta_data ->> 'invited_at')::timestamptz, u.created_at) < now() - interval '24 hours'
    returning lower(u.email) as email
  ), marked as (
    update public.family_invites i set status = 'expired', decided_at = now()
    where (i.status = 'approved' and i.email in (select email from gone))
       or (i.status = 'pending' and i.created_at < now() - interval '24 hours')
    returning 1
  )
  select count(*) into n from gone;
  return n;
end $$;

-- ---------- Inviting the same friend again after their invite ran out starts a new one ----------
-- Same as 0012, plus: this family's requests older than 24 hours are expired first, so the
-- "already pending" check below never hands back a request the clean-up job has not reached yet.
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

  update public.family_invites set status = 'expired', decided_at = now()
  where household_id = hid and status = 'pending' and created_at < now() - interval '24 hours';

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

-- ---------- The operator only sees requests that are still live ----------
create or replace function public.operator_family_invites()
returns table (invite_id uuid, friend_name text, email text, created_at timestamptz,
               from_family text, from_name text)
language sql stable security definer set search_path = ''
as $$
  select i.id, i.friend_name, i.email, i.created_at, h.name,
    (select m.display_name from public.household_members m
     where m.household_id = i.household_id and m.user_id = i.invited_by)
  from public.family_invites i join public.households h on h.id = i.household_id
  where i.status = 'pending' and i.created_at >= now() - interval '24 hours'
  order by i.created_at;
$$;
