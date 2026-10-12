-- 0018_self_signup.sql · a person who signed up themselves may create one family (2026-10-12)
--
-- Until now only a login the operator created (raw_app_meta_data.family_admin) could create a family
-- (0009). The owner now wants strangers to be able to start their own family from the sign-in page,
-- so that check goes. Everything else in create_family is unchanged from 0014:
--   * you must be signed in, and anon still cannot call it
--   * one family per person ("Already in a household")
--   * the creator becomes that family's owner and sees only that family (table policies, untouched)
--   * the operator can still suspend the family (households.status, untouched)
--
-- Whether strangers can get a login at all is still decided by Supabase Auth ("Allow new users to
-- sign up"), which stays off until the owner turns it on. With it off this migration changes nothing
-- for anyone except a member who was removed from a family: they may now start their own.

create or replace function public.create_family(
  p_name text, p_display_name text, p_locale text default 'en', p_currencies text[] default '{EGP}')
returns uuid language plpgsql security definer set search_path = ''
as $$
declare hid uuid; clean text[];
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'Already in a household';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'The family needs a name' using errcode = '23514'; end if;
  clean := array(select upper(trim(x)) from unnest(p_currencies) with ordinality as u(x, n) order by n);
  if not public.valid_currencies(clean) then
    raise exception 'Choose one or two currencies' using errcode = '23514';
  end if;
  insert into public.households (name, currencies) values (trim(p_name), clean) returning id into hid;
  insert into public.household_members (household_id, user_id, display_name, role, locale)
  values (hid, auth.uid(), trim(p_display_name), 'owner', p_locale);
  insert into public.accounts (household_id, name_en, name_ar, type, icon, currency)
  values (hid, 'Cash', 'كاش', 'cash', 'banknote', clean[1]);
  perform public.seed_defaults(hid);
  perform public.seed_corrections(hid);
  perform public.seed_sample_entries(hid);
  perform public.seed_budgets(hid);
  return hid;
end $$;

revoke execute on function public.create_family(text, text, text, text[]) from public, anon;
