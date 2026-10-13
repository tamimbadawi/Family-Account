-- supabase/tests/money_purposes_smoke_test.sql
-- RLS and constraint smoke test for 0026_money_purposes.sql.
-- Runs inside a rolled-back transaction (raises an exception at the end).
-- EXPECTED OUTPUT: an ERROR starting with "SMOKE TEST RESULTS"; every line must say PASS.

do $$
declare
  mom uuid := gen_random_uuid();
  stranger uuid := gen_random_uuid();
  hid uuid;
  stranger_hid uuid;
  cash_id uuid;
  inv_id uuid;
  val_id uuid;
  n int;
  r text := '';
  ok boolean;
begin
  insert into auth.users (id, email, raw_app_meta_data) values
    (mom, 'smoke-mom-' || mom || '@test.local', '{"family_admin": true}'),
    (stranger, 'smoke-x-' || stranger || '@test.local', '{}');

  execute 'set local role authenticated';

  perform set_config('request.jwt.claim.sub', mom::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', mom, 'role', 'authenticated')::text, true);
  hid := public.create_family('Smoke Money', 'Mom', 'en');

  -- 1. An existing account defaults to purpose 'spending'
  select id into cash_id from public.accounts where household_id = hid and type = 'cash' limit 1;
  select count(*) into n from public.accounts where id = cash_id and purpose = 'spending' and investment_kind is null and matures_on is null;
  r := r || format(E'\n%s existing account defaults to purpose spending', case when n = 1 then 'PASS' else 'FAIL' end);

  -- 2. purpose='investment' without investment_kind is rejected
  ok := false;
  begin
    insert into public.accounts (household_id, name_en, type, purpose, investment_kind)
    values (hid, 'Bad Investment', 'wallet', 'investment', null);
  exception when check_violation then ok := true; end;
  r := r || format(E'\n%s purpose investment without investment_kind is rejected', case when ok then 'PASS' else 'FAIL' end);

  -- 3. purpose='spending' with investment_kind set is rejected
  ok := false;
  begin
    insert into public.accounts (household_id, name_en, type, purpose, investment_kind)
    values (hid, 'Bad Spending', 'wallet', 'spending', 'gold');
  exception when check_violation then ok := true; end;
  r := r || format(E'\n%s purpose spending with investment_kind set is rejected', case when ok then 'PASS' else 'FAIL' end);

  -- Create a valid investment account
  insert into public.accounts (household_id, name_en, type, purpose, investment_kind)
  values (hid, 'Gold Pocket', 'wallet', 'investment', 'gold')
  returning id into inv_id;

  -- 4. A member can insert and read an investment_values row for their own household
  insert into public.investment_values (household_id, account_id, value, valued_on)
  values (hid, inv_id, 96000.50, current_date)
  returning id into val_id;

  select count(*) into n from public.investment_values where household_id = hid and account_id = inv_id and id = val_id;
  r := r || format(E'\n%s member can insert and read an investment_values row', case when n = 1 then 'PASS' else 'FAIL' end);

  -- 5. A member of ANOTHER household cannot read or insert it
  perform set_config('request.jwt.claim.sub', stranger::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  stranger_hid := public.create_family('Stranger Family', 'Stranger', 'en');

  select count(*) into n from public.investment_values where id = val_id;
  r := r || format(E'\n%s member of another household cannot read it', case when n = 0 then 'PASS' else 'FAIL' end);

  ok := false;
  begin
    insert into public.investment_values (household_id, account_id, value, valued_on)
    values (hid, inv_id, 100000, current_date);
  exception when others then ok := true; end;
  r := r || format(E'\n%s member of another household cannot insert into it', case when ok then 'PASS' else 'FAIL' end);

  -- Switch back to mom
  perform set_config('request.jwt.claim.sub', mom::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', mom, 'role', 'authenticated')::text, true);

  -- 6. A negative value is rejected
  ok := false;
  begin
    insert into public.investment_values (household_id, account_id, value, valued_on)
    values (hid, inv_id, -500, current_date);
  exception when check_violation then ok := true; end;
  r := r || format(E'\n%s negative value is rejected', case when ok then 'PASS' else 'FAIL' end);

  -- 7. Anon can do nothing on investment_values
  execute 'set local role anon';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);

  select count(*) into n from public.investment_values where id = val_id;
  r := r || format(E'\n%s anon cannot select investment_values', case when n = 0 then 'PASS' else 'FAIL' end);

  ok := false;
  begin
    insert into public.investment_values (household_id, account_id, value, valued_on)
    values (hid, inv_id, 50000, current_date);
  exception when insufficient_privilege then ok := true; when others then ok := true; end;
  r := r || format(E'\n%s anon cannot insert investment_values', case when ok then 'PASS' else 'FAIL' end);

  raise exception 'SMOKE TEST RESULTS:%', r;
end $$;
