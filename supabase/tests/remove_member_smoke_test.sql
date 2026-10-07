-- Smoke test for 0006_remove_member.sql. Same pattern as rls_smoke_test.sql:
-- one DO block that always ends with an exception, so everything rolls back.
-- EXPECTED OUTPUT: an ERROR starting with "SMOKE TEST RESULTS"; every line must say PASS.

do $$
declare
  mom uuid := gen_random_uuid();
  dad uuid := gen_random_uuid();
  hid uuid; cash uuid; elec uuid;
  n int; r text := ''; ok boolean;
begin
  insert into auth.users (id, email) values
    (mom, 'smoke-mom-' || mom || '@test.local'),
    (dad, 'smoke-dad-' || dad || '@test.local');
  -- Only a family admin invited by the operator can create a family (0009)
  update auth.users set raw_app_meta_data = '{"family_admin": true}' where id = mom;

  execute 'set local role authenticated';

  perform set_config('request.jwt.claim.sub', mom::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', mom, 'role', 'authenticated')::text, true);
  hid := public.create_family('Smoke', 'Mom', 'en');
  -- The family-admin Edge Function adds members with the service role (add_member RPC dropped in 0009)
  execute 'reset role';
  insert into public.household_members (household_id, user_id, display_name) values (hid, dad, 'Dad');
  execute 'set local role authenticated';
  select id into cash from public.accounts where household_id = hid and type = 'cash';
  select id into elec from public.items where household_id = hid and name_en = 'Electricity';

  -- Dad (member) adds an entry, then tries to remove Mom
  perform set_config('request.jwt.claim.sub', dad::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', dad, 'role', 'authenticated')::text, true);
  insert into public.transactions (household_id, type, amount, occurred_on, account_id, item_id)
  values (hid, 'expense', 100, current_date, cash, elec);
  begin
    perform public.remove_member(mom); ok := false;
  exception when others then ok := true; end;
  r := r || format(E'\n%s member cannot remove anyone', case when ok then 'PASS' else 'FAIL' end);

  -- Mom removes Dad
  perform set_config('request.jwt.claim.sub', mom::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', mom, 'role', 'authenticated')::text, true);
  begin
    perform public.remove_member(mom); ok := false;
  exception when others then ok := true; end;
  r := r || format(E'\n%s owner cannot remove themselves', case when ok then 'PASS' else 'FAIL' end);
  perform public.remove_member(dad);
  select count(*) into n from public.transactions where household_id = hid;
  r := r || format(E'\n%s removed member''s entries stay with the household (%s)', case when n = 1 then 'PASS' else 'FAIL' end, n);

  -- Dad, removed, sees and writes nothing
  perform set_config('request.jwt.claim.sub', dad::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', dad, 'role', 'authenticated')::text, true);
  select count(*) into n from public.transactions;
  r := r || format(E'\n%s removed member reads no entries (%s)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  select count(*) into n from public.households;
  r := r || format(E'\n%s removed member reads no household (%s)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  begin
    insert into public.transactions (household_id, type, amount, occurred_on, account_id, item_id)
    values (hid, 'expense', 5, current_date, cash, elec);
    ok := false;
  exception when others then ok := true; end;
  r := r || format(E'\n%s removed member cannot add entries', case when ok then 'PASS' else 'FAIL' end);
  select count(*) into n from storage.objects where bucket_id = 'receipts';
  r := r || format(E'\n%s removed member sees no receipt photos (%s)', case when n = 0 then 'PASS' else 'FAIL' end, n);

  raise exception 'SMOKE TEST RESULTS%', r;
end $$;
