-- Family invites smoke test for 0011_family_invites.sql.
-- Same pattern as rls_smoke_test.sql: one DO block that always ends with an intentional exception,
-- so every change (including the throwaway auth users) is rolled back. Safe on the real project.
--
-- EXPECTED: an ERROR starting with "FAMILY INVITES SMOKE TEST" where every line says PASS.

do $$
declare
  a_admin uuid := gen_random_uuid();  -- family A
  b_admin uuid := gen_random_uuid();  -- family B
  nobody  uuid := gen_random_uuid();  -- signed in, in no family
  ha uuid; hb uuid; i1 uuid; i2 uuid; n int; s text; r text := ''; ok boolean;

begin
  insert into auth.users (id, email, raw_app_meta_data) values
    (a_admin, 'fi-a-' || a_admin || '@test.local', '{"family_admin": true}'),
    (b_admin, 'fi-b-' || b_admin || '@test.local', '{"family_admin": true}'),
    (nobody,  'fi-x-' || nobody  || '@test.local', '{}');
  execute 'set local role authenticated';

  perform set_config('request.jwt.claim.sub', a_admin::text, true);
  ha := public.create_family('A', 'Anna', 'en', '{EGP}');
  perform set_config('request.jwt.claim.sub', b_admin::text, true);
  hb := public.create_family('B', 'Bob', 'en', '{EGP}');

  -- ---------- Who may invite ----------
  perform set_config('request.jwt.claim.sub', nobody::text, true);
  ok := false;
  begin perform public.invite_family('Friend', 'friend@test.local'); exception when others then ok := true; end;
  r := r || format(E'\n%s someone in no family cannot invite', case when ok then 'PASS' else 'FAIL' end);

  perform set_config('request.jwt.claim.sub', a_admin::text, true);
  i1 := public.invite_family(' Sara ', ' Sara@Test.Local ');
  select email into s from public.family_invites where id = i1;
  r := r || format(E'\n%s a member invites a family (email stored as %s)', case when s = 'sara@test.local' then 'PASS' else 'FAIL' end, s);
  i2 := public.invite_family('Sara', 'sara@test.local');
  r := r || format(E'\n%s inviting the same friend again reuses the open request', case when i1 = i2 then 'PASS' else 'FAIL' end);
  ok := false;
  begin perform public.invite_family('X', 'not-an-email'); exception when others then ok := true; end;
  r := r || format(E'\n%s a bad email is refused', case when ok then 'PASS' else 'FAIL' end);
  ok := false;
  begin insert into public.family_invites (household_id, friend_name, email) values (ha, 'X', 'x@test.local');
  exception when others then ok := true; end;
  r := r || format(E'\n%s members cannot insert directly', case when ok then 'PASS' else 'FAIL' end);
  ok := false;
  begin update public.family_invites set status = 'approved' where id = i1; get diagnostics n = row_count; ok := n = 0;
  exception when others then ok := true; end;
  r := r || format(E'\n%s members cannot approve their own request', case when ok then 'PASS' else 'FAIL' end);

  perform public.invite_family('F2', 'f2@test.local');
  perform public.invite_family('F3', 'f3@test.local');
  perform public.invite_family('F4', 'f4@test.local');
  perform public.invite_family('F5', 'f5@test.local');
  ok := false;
  begin perform public.invite_family('F6', 'f6@test.local'); exception when others then ok := sqlerrm = 'too_many'; end;
  r := r || format(E'\n%s at most 5 requests per family per day', case when ok then 'PASS' else 'FAIL' end);

  -- ---------- Privacy between families ----------
  perform set_config('request.jwt.claim.sub', b_admin::text, true);
  select count(*) into n from public.family_invites;
  r := r || format(E'\n%s another family sees none of them (%s)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  perform public.invite_family('Sara', 'sara@test.local');
  ok := false;
  begin perform * from public.operator_family_invites(); exception when others then ok := true; end;
  r := r || format(E'\n%s members cannot read the operator list', case when ok then 'PASS' else 'FAIL' end);
  ok := false;
  begin perform public.decide_family_invite(i1, 'approved'); exception when others then ok := true; end;
  r := r || format(E'\n%s members cannot decide a request', case when ok then 'PASS' else 'FAIL' end);

  -- ---------- Operator ----------
  execute 'reset role';
  execute 'set local role service_role';
  select count(*) into n from public.operator_family_invites() where email = 'sara@test.local';
  r := r || format(E'\n%s operator sees both open requests for Sara (%s)', case when n = 2 then 'PASS' else 'FAIL' end, n);
  select from_name into s from public.operator_family_invites() where invite_id = i1;
  r := r || format(E'\n%s operator sees who invited (%s)', case when s = 'Anna' then 'PASS' else 'FAIL' end, s);
  perform public.decide_family_invite(i1, 'approved');
  select count(*) into n from public.operator_family_invites() where email = 'sara@test.local';
  r := r || format(E'\n%s approving closes every open request for that email (%s left)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  execute 'reset role';
  execute 'set local role authenticated';

  perform set_config('request.jwt.claim.sub', a_admin::text, true);
  select status into s from public.family_invites where id = i1;
  r := r || format(E'\n%s the inviting family sees it approved (%s)', case when s = 'approved' then 'PASS' else 'FAIL' end, s);

  raise exception 'FAMILY INVITES SMOKE TEST (intentional, rolled back):%', r;
end $$;
