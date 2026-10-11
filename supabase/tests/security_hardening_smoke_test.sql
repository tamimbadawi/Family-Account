-- supabase/tests/security_hardening_smoke_test.sql
-- Self-rolling-back test suite for migration 0008_security_hardening.sql.
-- Expected result: EXCEPTION starting with "SMOKE TEST RESULTS: ALL PASS".

-- Helper in pg_temp for testing SECURITY DEFINER behavior
create or replace function pg_temp.sec_definer_insert_test(
  p_hid uuid, p_cash uuid, p_elec uuid, p_forged_uid uuid
)
returns uuid language plpgsql security definer
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  insert into public.transactions (id, household_id, type, amount, account_id, item_id, created_by, created_at)
  values (new_id, p_hid, 'expense', 99.00, p_cash, p_elec, p_forged_uid, now() - interval '1 year');
  return new_id;
end;
$$;

do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  hid_1  uuid;
  hid_2  uuid;
  cash_1 uuid;
  elec_1 uuid;
  txn_id uuid := gen_random_uuid();
  sec_def_txn_id uuid;
  actual_creator uuid;
  actual_created_at timestamptz;
  past_date timestamptz := now() - interval '30 days';
  n int;
  r text := '';
  ok boolean;
begin
  insert into auth.users (id, email) values
    (user_a, 'sec-test-a-' || user_a || '@test.local'),
    (user_b, 'sec-test-b-' || user_b || '@test.local');

  execute 'set local role authenticated';

  -- CHECK 1: public.add_member is dropped
  ok := false;
  begin
    perform public.add_member('test@test.local', 'Test');
  exception when undefined_function then
    ok := true;
  end;
  r := r || format(E'\n%s Check 1: public.add_member is dropped', case when ok then 'PASS' else 'FAIL' end);

  -- CHECK 2: UNIQUE (user_id) prevents multi-household membership
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  hid_1 := public.create_household('House 1', 'Owner A', 'en');

  ok := false;
  begin
    insert into public.households (name) values ('House 2') returning id into hid_2;
    insert into public.household_members (household_id, user_id, display_name)
    values (hid_2, user_a, 'Duplicate A');
  exception when unique_violation then
    ok := true;
  end;
  r := r || format(E'\n%s Check 2: Duplicate household membership blocked by UNIQUE (user_id)', case when ok then 'PASS' else 'FAIL' end);

  -- CHECK 3: Authenticated insert forces created_by = auth.uid() and created_at = now()
  select id into cash_1 from public.accounts where household_id = hid_1 and type = 'cash' limit 1;
  select id into elec_1 from public.items where household_id = hid_1 limit 1;

  insert into public.transactions (id, household_id, type, amount, account_id, item_id, created_by, created_at)
  values (txn_id, hid_1, 'expense', 150.00, cash_1, elec_1, user_b, past_date);

  select created_by, created_at into actual_creator, actual_created_at
  from public.transactions where id = txn_id;

  ok := (actual_creator = user_a) and (actual_created_at > now() - interval '10 seconds');
  r := r || format(E'\n%s Check 3: Authenticated insert enforces caller identity and real-time timestamp', case when ok then 'PASS' else 'FAIL' end);

  -- CHECK 3b: SECURITY DEFINER function does NOT elevate authenticated caller to trusted
  sec_def_txn_id := pg_temp.sec_definer_insert_test(hid_1, cash_1, elec_1, user_b);
  select created_by, created_at into actual_creator, actual_created_at
  from public.transactions where id = sec_def_txn_id;

  ok := (actual_creator = user_a) and (actual_created_at > now() - interval '10 seconds');
  r := r || format(E'\n%s Check 3b: SECURITY DEFINER does not bypass caller identity enforcement', case when ok then 'PASS' else 'FAIL' end);

  -- CHECK 4: Untrusted insert with missing auth.uid() is rejected (missing auth.uid() not treated as trusted)
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
  ok := false;
  begin
    insert into public.transactions (id, household_id, type, amount, account_id, item_id, created_by, created_at)
    values (gen_random_uuid(), hid_1, 'expense', 50.00, cash_1, elec_1, user_b, past_date);
  exception when others then
    ok := true;
  end;
  r := r || format(E'\n%s Check 4: Untrusted insert with missing auth.uid() is rejected', case when ok then 'PASS' else 'FAIL' end);

  -- Restore User A identity
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  -- CHECK 5: Transaction update preserves immutable audit columns
  update public.transactions
  set created_by = user_b,
      created_at = past_date
  where id = txn_id;

  select created_by, created_at into actual_creator, actual_created_at
  from public.transactions where id = txn_id;

  ok := (actual_creator = user_a) and (actual_created_at > now() - interval '10 seconds');
  r := r || format(E'\n%s Check 5: Transaction update preserves immutable audit trail', case when ok then 'PASS' else 'FAIL' end);

  -- CHECK 6: Safe UUID parsing handles malformed, uppercase, null, and valid UUIDs
  ok := (public.safe_cast_uuid('non-uuid-path') is null)
    and (public.safe_cast_uuid('') is null)
    and (public.safe_cast_uuid(null) is null)
    and (public.safe_cast_uuid(upper(hid_1::text)) = hid_1)
    and (public.safe_cast_uuid(hid_1::text) = hid_1);
  r := r || format(E'\n%s Check 6: safe_cast_uuid robust on null, empty, malformed, and uppercase inputs', case when ok then 'PASS' else 'FAIL' end);

  -- CHECK 7: Two distinct households isolation (User B in Household 2)
  perform set_config('request.jwt.claim.sub', user_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);
  hid_2 := public.create_household('House 2', 'Owner B', 'en');

  -- User B cannot read Household 1 transactions
  select count(*) into n from public.transactions where household_id = hid_1;
  ok := (n = 0);
  r := r || format(E'\n%s Check 7a: User B cannot read Household 1 transactions', case when ok then 'PASS' else 'FAIL' end);

  -- User B cannot insert into Household 1
  ok := false;
  begin
    insert into public.transactions (id, household_id, type, amount, account_id, item_id)
    values (gen_random_uuid(), hid_1, 'expense', 20.00, cash_1, elec_1);
  exception when others then
    ok := true;
  end;
  r := r || format(E'\n%s Check 7b: User B cannot insert into Household 1', case when ok then 'PASS' else 'FAIL' end);

  -- CHECK 8: Storage RLS malformed paths and household isolation (when storage schema exists)
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    -- User A context
    perform set_config('request.jwt.claim.sub', user_a::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

    -- Reject malformed path without crashing on 22P02
    ok := false;
    begin
      insert into storage.objects (bucket_id, name, owner) values ('receipts', 'not-a-uuid/photo.jpg', user_a);
    exception
      when sqlstate '22P02' then ok := false; -- Must NOT throw 22P02
      when others then ok := true;           -- Rejected cleanly by RLS policy
    end;
    r := r || format(E'\n%s Check 8a: Storage rejects malformed path without 22P02 crash', case when ok then 'PASS' else 'FAIL' end);

    -- Reject upload to Household 2 folder
    ok := false;
    begin
      insert into storage.objects (bucket_id, name, owner) values ('receipts', hid_2 || '/photo.jpg', user_a);
    exception when others then ok := true; end;
    r := r || format(E'\n%s Check 8b: Storage rejects upload to other household folder', case when ok then 'PASS' else 'FAIL' end);

    -- Allow upload to own household folder (including uppercase UUID)
    ok := false;
    begin
      insert into storage.objects (bucket_id, name, owner) values ('receipts', upper(hid_1::text) || '/photo.jpg', user_a);
      ok := true;
    exception when others then ok := false; end;
    r := r || format(E'\n%s Check 8c: Storage allows upload to own household folder with uppercase UUID', case when ok then 'PASS' else 'FAIL' end);

    -- User B cannot read User A's receipt
    perform set_config('request.jwt.claim.sub', user_b::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);
    select count(*) into n from storage.objects where name = (upper(hid_1::text) || '/photo.jpg');
    ok := (n = 0);
    r := r || format(E'\n%s Check 8d: User B cannot read User A storage receipt', case when ok then 'PASS' else 'FAIL' end);
  else
    r := r || E'\nSKIP Check 8: storage.objects table not present in current schema';
  end if;

  raise exception 'SMOKE TEST RESULTS:%', r;
end $$;
