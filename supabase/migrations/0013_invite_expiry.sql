-- 0013_invite_expiry.sql · a new family's login is cancelled if nobody signs in within 24 hours (2026-10-07)
--
-- The operator creates a family admin login (from an invite or directly). If that login is never used
-- within 24 hours, a pg_cron job deletes it: the email is free again and the operator can start the
-- family afresh. The family that invited them sees "Expired". A login that has signed in once is never
-- touched, even before Welcome is finished. Members added by a family admin are not affected.
-- The clock starts at app_metadata.invited_at when set, else at the login's created_at.

alter table public.family_invites drop constraint family_invites_status_check;
alter table public.family_invites add constraint family_invites_status_check
  check (status in ('pending', 'approved', 'declined', 'expired'));

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
    where i.status = 'approved' and i.email in (select email from gone)
    returning 1
  )
  select count(*) into n from gone;
  return n;
end $$;

revoke execute on function public.expire_unused_family_logins() from public, anon, authenticated;
grant  execute on function public.expire_unused_family_logins() to service_role;

-- Logins already waiting when this rule went live get their 24 hours from now, not from when they were made.
update auth.users u
set raw_app_meta_data = u.raw_app_meta_data || jsonb_build_object('invited_at', now())
where coalesce((u.raw_app_meta_data ->> 'family_admin')::boolean, false)
  and u.last_sign_in_at is null
  and not exists (select 1 from public.household_members m where m.user_id = u.id)
  and not (u.raw_app_meta_data ? 'invited_at');

select cron.schedule('expire-unused-family-logins', '*/15 * * * *', $$ select public.expire_unused_family_logins() $$);
