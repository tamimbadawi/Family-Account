-- Invited sign-up smoke test for 0019_signup_invited_only.sql (replaces the 0018 self sign-up test).
-- Same pattern as rls_smoke_test.sql: one DO block that always ends with an intentional exception,
-- so every change (including the throwaway auth users) is rolled back. Safe on the real project.
--
-- EXPECTED: an ERROR starting with "INVITED SIGN-UP SMOKE TEST" where every line says PASS.

do $$
declare
  stranger uuid := gen_random_uuid();  -- got a login without an invite; their own metadata claims to be an admin
  su_a uuid := gen_random_uuid();  -- invited, signed up through the sign-up function
  su_b uuid := gen_random_uuid();  -- invited, signed up through the sign-up function
  inv  uuid := gen_random_uuid();  -- invited family admin, as before
  ha uuid; hb uuid; hi uuid;
  n int; r text := ''; ok boolean;
begin
  insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
    (stranger, 'su-x-' || stranger || '@test.local', '{}', '{"family_admin": true, "operator": true, "role": "owner"}'),
    (su_a, 'su-a-' || su_a || '@test.local', '{"family_admin": true}', '{}'),
    (su_b, 'su-b-' || su_b || '@test.local', '{"family_admin": true}', '{}'),
    (inv,  'su-i-' || inv  || '@test.local', '{"family_admin": true}', '{}');

  r := r || format(E'\n%s anon cannot call create_family', case when not
    has_function_privilege('anon', 'public.create_family(text,text,text,text[])', 'execute') then 'PASS' else 'FAIL' end);

  execute 'set local role authenticated';

  -- ---------- A login without an invite cannot start a family ----------
  perform set_config('request.jwt.claim.sub', stranger::text, true);
  ok := false;
  begin perform public.create_family('Stranger', 'Sam', 'en', '{EGP}'); exception when others then ok := true; end;
  r := r || format(E'\n%s a login without an invite cannot create a family, whatever its own metadata says', case when ok then 'PASS' else 'FAIL' end);
  select count(*) into n from public.households;
  r := r || format(E'\n%s ... and sees no family', case when n = 0 then 'PASS' else 'FAIL' end);

  -- ---------- An invited person creates exactly one family ----------
  perform set_config('request.jwt.claim.sub', su_a::text, true);
  select count(*) into n from public.households;
  r := r || format(E'\n%s before creating a family they see no family at all', case when n = 0 then 'PASS' else 'FAIL' end);
  select count(*) into n from public.transactions;
  r := r || format(E'\n%s ... and no entries', case when n = 0 then 'PASS' else 'FAIL' end);

  ok := true;
  begin ha := public.create_family('Self A', 'Sara', 'en', '{EGP}'); exception when others then ok := false; end;
  r := r || format(E'\n%s an invited person can create a family', case when ok then 'PASS' else 'FAIL' end);
  select count(*) into n from public.household_members where user_id = su_a and household_id = ha and role = 'owner';
  r := r || format(E'\n%s ... and is its owner', case when n = 1 then 'PASS' else 'FAIL' end);
  ok := false;
  begin perform public.create_family('Self A2', 'Sara', 'en', '{EGP}'); exception when others then ok := true; end;
  r := r || format(E'\n%s a second family for the same person is refused', case when ok then 'PASS' else 'FAIL' end);

  -- ---------- Two invited families cannot see each other ----------
  perform set_config('request.jwt.claim.sub', su_b::text, true);
  hb := public.create_family('Self B', 'Bassem', 'en', '{SAR}');
  perform set_config('request.jwt.claim.sub', su_a::text, true);
  select count(*) into n from public.households;
  r := r || format(E'\n%s they see only their own family', case when n = 1 then 'PASS' else 'FAIL' end);
  select count(*) into n from public.accounts where household_id = hb;
  r := r || format(E'\n%s ... none of another family''s wallets', case when n = 0 then 'PASS' else 'FAIL' end);
  select count(*) into n from public.transactions where household_id = hb;
  r := r || format(E'\n%s ... none of another family''s entries', case when n = 0 then 'PASS' else 'FAIL' end);
  ok := false;
  begin
    insert into public.household_members (household_id, user_id, display_name, role, locale)
    values (hb, su_a, 'Sara', 'owner', 'en');
  exception when others then ok := true; end;
  r := r || format(E'\n%s they cannot add themselves to another family', case when ok then 'PASS' else 'FAIL' end);

  -- ---------- A family admin the operator made still works ----------
  perform set_config('request.jwt.claim.sub', inv::text, true);
  ok := true;
  begin hi := public.create_family('Invited', 'Injy', 'en', '{EGP}'); exception when others then ok := false; end;
  r := r || format(E'\n%s a family admin made by the operator can still create a family', case when ok then 'PASS' else 'FAIL' end);

  -- ---------- The operator can still pause the family ----------
  execute 'reset role';
  update public.households set status = 'suspended' where id = ha;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', su_a::text, true);
  select count(*) into n from public.accounts where household_id = ha;
  r := r || format(E'\n%s a suspended family reads nothing', case when n = 0 then 'PASS' else 'FAIL' end);

  raise exception E'INVITED SIGN-UP SMOKE TEST%', r;
end $$;
