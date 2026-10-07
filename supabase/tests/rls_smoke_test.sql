-- RLS + constraint smoke test for 0001_schema.sql
--
-- Safe to run on the real project (Supabase MCP execute_sql or the SQL editor):
-- everything happens inside one DO block that ALWAYS ends by raising an exception,
-- which rolls back every change, including the two throwaway auth users.
--
-- EXPECTED OUTPUT: an ERROR whose message starts with "SMOKE TEST RESULTS" and lists
-- each check as PASS or FAIL. The error is intentional. Every line must say PASS.

do $$
declare
  mom  uuid := gen_random_uuid();
  dad  uuid := gen_random_uuid();
  bad  uuid := gen_random_uuid();
  hid uuid; cash uuid; bank uuid; elec uuid; pension uuid;
  n int; r text := '';
  ok boolean;
  dad_email text;
begin
  insert into auth.users (id, email) values
    (mom, 'smoke-mom-' || mom || '@test.local'),
    (dad, 'smoke-dad-' || dad || '@test.local'),
    (bad, 'smoke-x-'   || bad || '@test.local');
  -- Only a family admin invited by the operator can create a family (0009)
  update auth.users set raw_app_meta_data = '{"family_admin": true}' where id = mom;
  dad_email := 'smoke-dad-' || dad || '@test.local';

  execute 'set local role authenticated';

  -- Mom creates the household
  perform set_config('request.jwt.claim.sub', mom::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', mom, 'role', 'authenticated')::text, true);
  hid := public.create_family('Smoke', 'Mom', 'ar');
  select count(*) into n from public.items;
  r := r || format(E'\n%s seed created items (%s)', case when n > 20 then 'PASS' else 'FAIL' end, n);

  -- The family-admin Edge Function adds members with the service role (add_member RPC dropped in 0009)
  execute 'reset role';
  insert into public.household_members (household_id, user_id, display_name) values (hid, dad, 'Dad');
  execute 'set local role authenticated';

  select id into cash from public.accounts where household_id = hid and type = 'cash';
  insert into public.accounts (household_id, name_en, type) values (hid, 'Bank', 'bank') returning id into bank;
  select id into elec    from public.items where household_id = hid and name_en = 'Electricity';
  select id into pension from public.items where household_id = hid and name_en = 'Pension';

  insert into public.transactions (household_id, type, amount, account_id, item_id)
    values (hid, 'expense', 350.50, cash, elec);
  insert into public.transactions (household_id, type, amount, account_id, item_id)
    values (hid, 'income', 5000, bank, pension);
  insert into public.transactions (household_id, type, amount, account_id, to_account_id)
    values (hid, 'transfer', 1000, bank, cash);
  r := r || E'\nPASS valid expense, income, transfer inserted';

  ok := false;
  begin
    insert into public.transactions (household_id, type, amount, account_id, item_id)
      values (hid, 'expense', 10, cash, pension);
  exception when others then ok := true; end;
  r := r || format(E'\n%s expense with an income item is rejected', case when ok then 'PASS' else 'FAIL' end);

  ok := false;
  begin
    insert into public.transactions (household_id, type, amount, account_id, to_account_id)
      values (hid, 'transfer', 10, cash, cash);
  exception when others then ok := true; end;
  r := r || format(E'\n%s transfer to the same wallet is rejected', case when ok then 'PASS' else 'FAIL' end);

  ok := false;
  begin
    update public.categories set kind = 'income' where household_id = hid and name_en = 'Household';
  exception when others then ok := true; end;
  r := r || format(E'\n%s category kind cannot change', case when ok then 'PASS' else 'FAIL' end);

  ok := false;
  begin
    update public.items set subcategory_id = (
      select id from public.subcategories where household_id = hid and name_en = 'Regular')
    where id = elec;
  exception when others then ok := true; end;
  r := r || format(E'\n%s item cannot move to an income group', case when ok then 'PASS' else 'FAIL' end);

  ok := false;
  begin
    delete from public.transactions where household_id = hid;
  exception when insufficient_privilege then ok := true; end;
  r := r || format(E'\n%s hard delete is blocked', case when ok then 'PASS' else 'FAIL' end);

  select count(*) into n from public.v_account_balances
   where household_id = hid and ((account_id = cash and balance = 649.50) or (account_id = bank and balance = 4000));
  r := r || format(E'\n%s wallet balances correct', case when n = 2 then 'PASS' else 'FAIL' end);

  -- Dad (member) sees the same data but cannot promote himself
  perform set_config('request.jwt.claim.sub', dad::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', dad, 'role', 'authenticated')::text, true);
  select count(*) into n from public.v_transactions where household_id = hid;
  r := r || format(E'\n%s second member sees shared entries (%s)', case when n = 3 then 'PASS' else 'FAIL' end, n);

  ok := false;
  begin
    update public.household_members set role = 'owner' where user_id = dad;
  exception when insufficient_privilege then ok := true; end;
  r := r || format(E'\n%s member cannot change own role', case when ok then 'PASS' else 'FAIL' end);

  update public.household_members set display_name = 'Baba' where user_id = dad;
  r := r || E'\nPASS member can rename self';

  -- Stranger sees nothing and cannot write into the household
  perform set_config('request.jwt.claim.sub', bad::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', bad, 'role', 'authenticated')::text, true);
  select count(*) into n from public.transactions;
  r := r || format(E'\n%s outsider sees no entries', case when n = 0 then 'PASS' else 'FAIL' end);

  ok := false;
  begin
    insert into public.categories (household_id, kind, name_en) values (hid, 'expense', 'Hack');
  exception when others then ok := true; end;
  r := r || format(E'\n%s outsider cannot insert into the household', case when ok then 'PASS' else 'FAIL' end);

  -- Anonymous: keepalive works, data does not
  execute 'set local role anon';
  perform public.keepalive();
  r := r || E'\nPASS anon can call keepalive()';

  ok := false;
  begin
    perform 1 from public.transactions limit 1;
  exception when insufficient_privilege then ok := true; end;
  r := r || format(E'\n%s anon cannot read entries', case when ok then 'PASS' else 'FAIL' end);

  raise exception 'SMOKE TEST RESULTS (intentional error, all changes rolled back):%', r;
end $$;
