-- 0011_security_advisors.sql · close what get_advisors flagged before launch (2026-10-07)
--
-- * create_household(3 args) is no longer called by the app (welcome calls create_family);
--   signed-in users can no longer call it. It stays defined so nothing that references it breaks.
-- * keepalive() is only called without a login (GitHub Action and the Vercel cron use the
--   publishable key), so signed-in users lose EXECUTE. anon keeps it on purpose: it takes no
--   input, returns only a timestamp and writes one fixed row.
-- * heartbeat: an explicit deny-all policy says in the schema what "RLS on, no policies" meant.
-- * set_household_currencies() now also refuses a suspended family, like every table policy
--   does through is_member(). remove_member() is left as in 0006: the app removes members
--   through the family-admin Edge Function, which already refuses suspended families, and a
--   suspended owner could only remove someone from their own family (entries stay).
--
-- Still reported by the linter and accepted (each checks the caller itself):
--   is_member (used by every RLS policy), create_family (invited family admins only),
--   remove_member and set_household_currencies (family owner only), keepalive for anon.

revoke execute on function public.create_household(text, text, text) from public, anon, authenticated;
revoke execute on function public.keepalive() from authenticated;

create policy "no direct access" on public.heartbeat
  for all to anon, authenticated using (false) with check (false);

create or replace function public.set_household_currencies(p_currencies text[])
returns void language plpgsql security definer set search_path = ''
as $$
declare hid uuid; clean text[];
begin
  select household_id into hid from public.household_members
  where user_id = auth.uid() and role = 'owner';
  if hid is null or not public.is_member(hid) then
    raise exception 'Only the family admin can change currencies' using errcode = '42501';
  end if;
  clean := array(select upper(trim(x)) from unnest(p_currencies) with ordinality as u(x, n) order by n);
  if not public.valid_currencies(clean) then
    raise exception 'Choose one or two currencies' using errcode = '23514';
  end if;
  if exists (select 1 from public.accounts where household_id = hid and not (currency = any (clean))) then
    raise exception 'A wallet still uses a currency you removed' using errcode = '23514';
  end if;
  update public.households set currencies = clean where id = hid;
end $$;
