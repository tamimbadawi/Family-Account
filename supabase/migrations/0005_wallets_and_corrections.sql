-- 0005_wallets_and_corrections.sql · several banks + cash at home, and balance corrections (2026-10-06)
-- New households get a "Cash at home" wallet, and both trees get a "Balance correction" item so that
-- "Update balance" can record the difference as a normal, visible entry.

create or replace function public.seed_corrections(hid uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare cid uuid; sid uuid; k public.category_kind;
begin
  foreach k in array array['expense', 'income']::public.category_kind[] loop
    insert into public.categories (household_id, kind, name_en, name_ar, icon, color, sort_order)
    values (hid, k, 'Adjustments', 'تسويات', 'scale', '#64748B', 99)
    returning id into cid;
    insert into public.subcategories (household_id, category_id, name_en, name_ar, sort_order)
    values (hid, cid, 'Balance correction', 'تصحيح الرصيد', 0)
    returning id into sid;
    insert into public.items (household_id, subcategory_id, name_en, name_ar, sort_order)
    values (hid, sid, 'Balance correction', 'تصحيح الرصيد', 0);
  end loop;
end $$;

create or replace function public.create_household(
  p_name text, p_display_name text, p_locale text default 'en')
returns uuid language plpgsql security definer set search_path = ''
as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'Already in a household';
  end if;
  insert into public.households (name) values (p_name) returning id into hid;
  insert into public.household_members (household_id, user_id, display_name, role, locale)
  values (hid, auth.uid(), p_display_name, 'owner', p_locale);
  insert into public.accounts (household_id, name_en, name_ar, type, icon)
  values (hid, 'Cash at home', 'كاش في البيت', 'cash', 'banknote');
  perform public.seed_defaults(hid);
  perform public.seed_corrections(hid);
  return hid;
end $$;

revoke execute on function public.seed_corrections(uuid) from public, anon, authenticated;
revoke execute on function public.create_household(text, text, text) from public, anon;
grant  execute on function public.create_household(text, text, text) to authenticated;
