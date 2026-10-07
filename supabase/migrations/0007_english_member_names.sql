-- 0007_english_member_names.sql · family member names are written in English (2026-10-06)
-- Same rule as isEnglishName() in src/lib/members: a letter, then letters, spaces, . ' - (max 30).
-- Not applied yet: apply in B2 together with 0006.

alter table public.household_members
  add constraint household_members_display_name_english
  check (display_name ~ '^[A-Za-z][A-Za-z .''-]{0,29}$');
