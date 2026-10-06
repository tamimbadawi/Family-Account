-- 0006_remove_member.sql · the owner can remove a family member (2026-10-06)
--
-- Removing a member deletes only their membership row. Their past entries stay
-- (they belong to the household; created_by keeps pointing at them). Because every
-- policy, including the receipts bucket, goes through public.is_member(), a removed
-- user immediately loses read and write access to the household's rows and photos.
-- Their auth login is untouched: the owner can delete it in the Supabase dashboard.

create or replace function public.remove_member(p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare hid uuid;
begin
  select household_id into hid from public.household_members
  where user_id = auth.uid() and role = 'owner';
  if hid is null then raise exception 'Only the owner can remove members'; end if;
  if p_user_id = auth.uid() then raise exception 'The owner cannot remove themselves'; end if;
  delete from public.household_members
  where household_id = hid and user_id = p_user_id and role <> 'owner';
  if not found then raise exception 'That person is not a member of this household'; end if;
end $$;

revoke execute on function public.remove_member(uuid) from public, anon;
grant execute on function public.remove_member(uuid) to authenticated;
