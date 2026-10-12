-- Invite 24 h smoke test for 0017_invite_24h.sql.
-- Same pattern as rls_smoke_test.sql: one DO block that always ends with an intentional exception,
-- so every change (including the throwaway auth users) is rolled back. Safe on the real project.
--
-- EXPECTED: an ERROR starting with "INVITE 24H SMOKE TEST" where every line says PASS.

do $$
declare
  a_admin uuid := gen_random_uuid();  -- family A, invites two friends
  stale_email text := 'i24-s-' || gen_random_uuid() || '@test.local';
  fresh_email text := 'i24-f-' || gen_random_uuid() || '@test.local';
  ha uuid; stale uuid; fresh uuid; again uuid; n int; s text; r text := '';
begin
  insert into auth.users (id, email, raw_app_meta_data) values
    (a_admin, 'i24-a-' || a_admin || '@test.local', '{"family_admin": true}');
  update auth.users set last_sign_in_at = now() where id = a_admin;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', a_admin::text, true);
  ha := public.create_family('A', 'Anna', 'en', '{EGP}');
  stale := public.invite_family('Stale', stale_email);
  fresh := public.invite_family('Fresh', fresh_email);
  execute 'reset role';

  update public.family_invites set created_at = now() - interval '25 hours' where id = stale;  -- sent 25 h ago

  execute 'set local role service_role';
  select count(*) into n from public.operator_family_invites() where invite_id = stale;
  r := r || format(E'\n%s the operator no longer sees a request older than 24 h', case when n = 0 then 'PASS' else 'FAIL' end);
  select count(*) into n from public.operator_family_invites() where invite_id = fresh;
  r := r || format(E'\n%s the operator still sees a fresh request', case when n = 1 then 'PASS' else 'FAIL' end);
  execute 'reset role';

  -- Inviting the same friend again before the clean-up job ran starts a new request
  execute 'set local role authenticated';
  again := public.invite_family('Stale', stale_email);
  execute 'reset role';
  select status into s from public.family_invites where id = stale;
  r := r || format(E'\n%s inviting again expires the old request (%s)', case when s = 'expired' then 'PASS' else 'FAIL' end, s);
  r := r || format(E'\n%s and starts a new one', case when again <> stale then 'PASS' else 'FAIL' end);

  update public.family_invites set created_at = now() - interval '25 hours' where id = again;
  execute 'set local role service_role';
  perform public.expire_unused_family_logins();
  execute 'reset role';
  select status into s from public.family_invites where id = again;
  r := r || format(E'\n%s the clean-up job expires a request older than 24 h (%s)', case when s = 'expired' then 'PASS' else 'FAIL' end, s);
  select status into s from public.family_invites where id = fresh;
  r := r || format(E'\n%s a fresh request stays pending (%s)', case when s = 'pending' then 'PASS' else 'FAIL' end, s);
  select count(*) into n from public.family_invites where household_id = ha;
  r := r || format(E'\n%s nothing is deleted (%s of 3 rows kept)', case when n = 3 then 'PASS' else 'FAIL' end, n);

  raise exception 'INVITE 24H SMOKE TEST (intentional, rolled back):%', r;
end $$;
