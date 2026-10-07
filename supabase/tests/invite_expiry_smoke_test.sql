-- Invite expiry smoke test for 0013_invite_expiry.sql.
-- Same pattern as rls_smoke_test.sql: one DO block that always ends with an intentional exception,
-- so every change (including the throwaway auth users) is rolled back. Safe on the real project.
--
-- EXPECTED: an ERROR starting with "INVITE EXPIRY SMOKE TEST" where every line says PASS.

do $$
declare
  a_admin uuid := gen_random_uuid();  -- family A, invites Sara
  sara    uuid := gen_random_uuid();  -- family admin login made 25 h ago, never used
  used    uuid := gen_random_uuid();  -- made 25 h ago, signed in once (Welcome not finished)
  fresh   uuid := gen_random_uuid();  -- made 1 h ago, never used
  grace   uuid := gen_random_uuid();  -- made 2 days ago, but its clock (invited_at) restarted 1 h ago
  member  uuid := gen_random_uuid();  -- not a family admin, made 25 h ago, never used
  sara_email text := 'ie-s-' || gen_random_uuid() || '@test.local';
  ha uuid; inv uuid; n int; s text; r text := ''; ok boolean;
begin
  insert into auth.users (id, email, raw_app_meta_data) values
    (a_admin, 'ie-a-' || a_admin || '@test.local', '{"family_admin": true}');
  update auth.users set last_sign_in_at = now() where id = a_admin;
  insert into auth.users (id, email, raw_app_meta_data, created_at, last_sign_in_at) values
    (sara,   sara_email,                            '{"family_admin": true}', now() - interval '25 hours', null),
    (used,   'ie-u-' || used   || '@test.local', '{"family_admin": true}', now() - interval '25 hours', now() - interval '24 hours'),
    (fresh,  'ie-f-' || fresh  || '@test.local', '{"family_admin": true}', now() - interval '1 hour', null),
    (grace,  'ie-g-' || grace  || '@test.local',
       jsonb_build_object('family_admin', true, 'invited_at', now() - interval '1 hour'), now() - interval '2 days', null),
    (member, 'ie-m-' || member || '@test.local', '{}', now() - interval '25 hours', null);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', a_admin::text, true);
  ha := public.create_family('A', 'Anna', 'en', '{EGP}');
  inv := public.invite_family('Sara', sara_email);
  ok := false;
  begin perform public.expire_unused_family_logins(); exception when others then ok := true; end;
  r := r || format(E'\n%s members cannot run the clean-up', case when ok then 'PASS' else 'FAIL' end);

  execute 'reset role';
  execute 'set local role service_role';
  perform public.decide_family_invite(inv, 'approved');  -- the operator started Sara's family
  n := public.expire_unused_family_logins();
  execute 'reset role';

  select count(*) into n from auth.users where id = sara;
  r := r || format(E'\n%s unused login older than 24 h is deleted', case when n = 0 then 'PASS' else 'FAIL' end);
  select status into s from public.family_invites where id = inv;
  r := r || format(E'\n%s the inviting family sees it expired (%s)', case when s = 'expired' then 'PASS' else 'FAIL' end, s);
  select count(*) into n from auth.users where id in (used, fresh, grace, member, a_admin);
  r := r || format(E'\n%s used, fresh, restarted, member and active logins stay (%s of 5)', case when n = 5 then 'PASS' else 'FAIL' end, n);
  select count(*) into n from public.households where id = ha;
  r := r || format(E'\n%s the inviting family is untouched', case when n = 1 then 'PASS' else 'FAIL' end);

  raise exception 'INVITE EXPIRY SMOKE TEST (intentional, rolled back):%', r;
end $$;
