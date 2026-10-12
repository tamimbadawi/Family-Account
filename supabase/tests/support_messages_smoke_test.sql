-- Support messages smoke test for 0016_support_messages.sql.
-- Same pattern as rls_smoke_test.sql: one DO block that always ends with an intentional exception,
-- so every change (including the throwaway auth users) is rolled back. Safe on the real project.
--
-- EXPECTED: an ERROR starting with "SUPPORT MESSAGES SMOKE TEST" where every line says PASS.

do $$
declare
  a_admin uuid := gen_random_uuid();  -- family A
  b_admin uuid := gen_random_uuid();  -- family B
  nobody  uuid := gen_random_uuid();  -- signed in, in no family
  ha uuid; hb uuid; m1 uuid := gen_random_uuid(); m2 uuid := gen_random_uuid(); n int; s text; r text := ''; ok boolean;

begin
  insert into auth.users (id, email, raw_app_meta_data) values
    (a_admin, 'sm-a-' || a_admin || '@test.local', '{"family_admin": true}'),
    (b_admin, 'sm-b-' || b_admin || '@test.local', '{"family_admin": true}'),
    (nobody,  'sm-x-' || nobody  || '@test.local', '{}');
  execute 'set local role authenticated';

  perform set_config('request.jwt.claim.sub', a_admin::text, true);
  ha := public.create_family('A', 'Anna', 'en', '{EGP}');
  perform set_config('request.jwt.claim.sub', b_admin::text, true);
  hb := public.create_family('B', 'Bob', 'en', '{EGP}');

  -- ---------- Who may send ----------
  perform set_config('request.jwt.claim.sub', nobody::text, true);
  ok := false;
  begin perform public.send_support_message(gen_random_uuid(), 'home', 'Hi', '{}', 'en'); exception when others then ok := true; end;
  r := r || format(E'\n%s someone in no family cannot send', case when ok then 'PASS' else 'FAIL' end);

  perform set_config('request.jwt.claim.sub', a_admin::text, true);
  perform public.send_support_message(m1, 'reports', '  The chart is empty  ', array[a_admin || '/' || m1 || '/1.jpg'], 'en');
  select household_id::text || '|' || message into s from public.support_messages where id = m1;
  r := r || format(E'\n%s a member sends a message (%s)', case when s = ha::text || '|The chart is empty' then 'PASS' else 'FAIL' end, s);
  perform public.send_support_message(m1, 'reports', 'The chart is empty', '{}', 'en');
  select count(*) into n from public.support_messages where id = m1;
  r := r || format(E'\n%s sending the same message again keeps one', case when n = 1 then 'PASS' else 'FAIL' end);
  ok := false;
  begin perform public.send_support_message(gen_random_uuid(), 'home', '  ', '{}', 'en'); exception when others then ok := sqlerrm = 'empty'; end;
  r := r || format(E'\n%s an empty message is refused', case when ok then 'PASS' else 'FAIL' end);
  ok := false;
  begin perform public.send_support_message(m2, 'home', 'x', array[b_admin || '/' || m2 || '/1.jpg'], 'en');
  exception when others then ok := true; end;
  r := r || format(E'\n%s a photo in someone else''s folder is refused', case when ok then 'PASS' else 'FAIL' end);
  ok := false;
  begin perform public.send_support_message(gen_random_uuid(), 'nope', 'x', '{}', 'en'); exception when others then ok := true; end;
  r := r || format(E'\n%s an unknown section is refused', case when ok then 'PASS' else 'FAIL' end);
  ok := false;
  begin insert into public.support_messages (id, household_id, message) values (gen_random_uuid(), ha, 'x');
  exception when others then ok := true; end;
  r := r || format(E'\n%s members cannot insert directly', case when ok then 'PASS' else 'FAIL' end);
  ok := false;
  begin update public.support_messages set status = 'done' where id = m1; get diagnostics n = row_count; ok := n = 0;
  exception when others then ok := true; end;
  r := r || format(E'\n%s members cannot close a message', case when ok then 'PASS' else 'FAIL' end);
  select count(*) into n from public.support_messages;
  r := r || format(E'\n%s the sender sees their own message (%s)', case when n = 1 then 'PASS' else 'FAIL' end, n);

  -- ---------- Privacy ----------
  perform set_config('request.jwt.claim.sub', b_admin::text, true);
  select count(*) into n from public.support_messages;
  r := r || format(E'\n%s another family sees none of them (%s)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  ok := false;
  begin perform public.send_support_message(m1, 'home', 'hijack', '{}', 'en'); exception when others then ok := true; end;
  r := r || format(E'\n%s nobody can reuse another person''s message id', case when ok then 'PASS' else 'FAIL' end);
  ok := false;
  begin perform * from public.operator_support_messages(); exception when others then ok := true; end;
  r := r || format(E'\n%s members cannot read the operator inbox', case when ok then 'PASS' else 'FAIL' end);
  ok := false;
  begin perform public.support_message_done(m1); exception when others then ok := true; end;
  r := r || format(E'\n%s members cannot mark a message done', case when ok then 'PASS' else 'FAIL' end);

  -- ---------- A paused family can still write ----------
  execute 'reset role';
  update public.households set status = 'suspended' where id = hb;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', b_admin::text, true);
  perform public.send_support_message(m2, 'signIn', 'We are paused', '{}', 'ar');
  r := r || format(E'\n%s a paused family can still send', case when exists (select 1 from public.support_messages where id = m2) then 'PASS' else 'FAIL' end);

  -- ---------- Limit ----------
  perform set_config('request.jwt.claim.sub', a_admin::text, true);
  for n in 1..19 loop perform public.send_support_message(gen_random_uuid(), 'other', 'x', '{}', 'en'); end loop;
  ok := false;
  begin perform public.send_support_message(gen_random_uuid(), 'other', 'x', '{}', 'en'); exception when others then ok := sqlerrm = 'too_many'; end;
  r := r || format(E'\n%s at most 20 messages per person per day', case when ok then 'PASS' else 'FAIL' end);

  -- ---------- Operator ----------
  execute 'set local role service_role';
  select count(*) into n from public.operator_support_messages() o where o.id in (m1, m2);
  r := r || format(E'\n%s the operator sees both open messages (%s)', case when n = 2 then 'PASS' else 'FAIL' end, n);
  select o.sender || ' · ' || o.family into s from public.operator_support_messages() o where o.id = m1;
  r := r || format(E'\n%s with who sent it (%s)', case when s = 'Anna · A' then 'PASS' else 'FAIL' end, s);
  perform public.support_message_done(m1);
  select count(*) into n from public.operator_support_messages() o where o.id = m1;
  r := r || format(E'\n%s a message marked done leaves the inbox', case when n = 0 then 'PASS' else 'FAIL' end);

  raise exception 'SUPPORT MESSAGES SMOKE TEST (rolled back):%', r;
end $$;
