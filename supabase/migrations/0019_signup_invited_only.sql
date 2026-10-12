-- 0019_signup_invited_only.sql · only an invited person can start a family (2026-10-12)
--
-- 0018 let anyone with a login create a family. The owner's rule is: sign-up is for invited people
-- only. So create_family again requires raw_app_meta_data.family_admin, as it did from 0009 to 0014.
-- That flag is set only with the service role: by the `operator` Edge Function, and by the new
-- `sign-up` Edge Function, which creates a login only for an email with a live family invite.
-- A login made any other way (for example straight through the Auth API) cannot start a family.
-- Everything else in create_family is unchanged from 0018.

create or replace function public.create_family(
  p_name text, p_display_name text, p_locale text default 'en', p_currencies text[] default '{EGP}')
returns uuid language plpgsql security definer set search_path = ''
as $$
declare hid uuid; clean text[];
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not coalesce((select (u.raw_app_meta_data ->> 'family_admin')::boolean
                   from auth.users u where u.id = auth.uid()), false) then
    raise exception 'Only an invited family admin can create a family' using errcode = '42501';
  end if;
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
