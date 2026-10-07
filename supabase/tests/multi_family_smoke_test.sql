-- Multi-family + currency smoke test for 0009_multi_family.sql.
-- Same pattern as rls_smoke_test.sql: one DO block that always ends with an intentional exception,
-- so every change (including the throwaway auth users) is rolled back. Safe on the real project.
--
-- EXPECTED: an ERROR starting with "MULTI-FAMILY SMOKE TEST" where every line says PASS.
-- Must pass on production before a second family is invited (docs/MULTI-FAMILY.md).

do $$
declare
  a_admin uuid := gen_random_uuid();  -- invited family admin, family A (EGP + USD)
  a_mem   uuid := gen_random_uuid();  -- member of A
  b_admin uuid := gen_random_uuid();  -- invited family admin, family B (SAR)
  nobody  uuid := gen_random_uuid();  -- signed in, never invited
  ha uuid; hb uuid; a_cash uuid; a_usd uuid; b_cash uuid; a_elec uuid; a_txn uuid; t uuid;
  n int; v numeric; c text; r text := ''; ok boolean;

begin
  insert into auth.users (id, email, raw_app_meta_data) values
    (a_admin, 'mf-a-' || a_admin || '@test.local', '{"family_admin": true}'),
    (a_mem,   'mf-m-' || a_mem   || '@test.local', '{}'),
    (b_admin, 'mf-b-' || b_admin || '@test.local', '{"family_admin": true}'),
    (nobody,  'mf-x-' || nobody  || '@test.local', '{}');
  execute 'set local role authenticated';

  -- ---------- Who may create a family ----------
  perform set_config('request.jwt.claim.sub', nobody::text, true);
  ok := false;
  begin perform public.create_household('X', 'Nobody', 'en', '{EGP}'); exception when others then ok := true; end;
  r := r || format(E'\n%s person without an invite cannot create a family', case when ok then 'PASS' else 'FAIL' end);

  perform set_config('request.jwt.claim.sub', a_admin::text, true);
  ok := false;
  begin perform public.create_household('A', 'Anna', 'en', '{EGP,USD,EUR}'); exception when others then ok := true; end;
  r := r || format(E'\n%s three currencies are rejected', case when ok then 'PASS' else 'FAIL' end);
  ok := false;
  begin perform public.create_household('A', 'Anna', 'en', '{EGP,egp}'); exception when others then ok := true; end;
  r := r || format(E'\n%s the same currency twice is rejected', case when ok then 'PASS' else 'FAIL' end);
  ok := false;
  begin perform public.create_household('A', 'Anna', 'en', '{EG}'); exception when others then ok := true; end;
  r := r || format(E'\n%s a malformed currency code is rejected', case when ok then 'PASS' else 'FAIL' end);

  ha := public.create_household('Family A', 'Anna', 'en', '{egp, usd}');
  select array_to_string(currencies, ',') || '/' || currency into c from public.households where id = ha;
  r := r || format(E'\n%s family chooses its own currencies, main first (%s)', case when c = 'EGP,USD/EGP' then 'PASS' else 'FAIL' end, c);

  ok := false;
  begin perform public.create_household('A2', 'Anna', 'en', '{EGP}'); exception when others then ok := true; end;
  r := r || format(E'\n%s a family admin cannot create a second family', case when ok then 'PASS' else 'FAIL' end);

  perform set_config('request.jwt.claim.sub', b_admin::text, true);
  hb := public.create_household('Family B', 'Badr', 'ar', '{SAR}');

  -- The family-admin Edge Function adds members with the service role
  execute 'reset role';
  insert into public.household_members (household_id, user_id, display_name) values (ha, a_mem, 'Mama');
  execute 'set local role authenticated';

  -- ---------- Wallet currencies ----------
  perform set_config('request.jwt.claim.sub', a_admin::text, true);
  select id, currency into a_cash, c from public.accounts where household_id = ha and type = 'cash';
  r := r || format(E'\n%s first wallet uses the main currency (%s)', case when c = 'EGP' then 'PASS' else 'FAIL' end, c);
  insert into public.accounts (household_id, name_en, type, currency) values (ha, 'Dollars', 'bank', 'USD') returning id into a_usd;
  insert into public.accounts (household_id, name_en, type) values (ha, 'Bank', 'bank') returning currency into c;
  r := r || format(E'\n%s wallet without a currency gets the main one (%s)', case when c = 'EGP' then 'PASS' else 'FAIL' end, c);
  ok := false;
  begin insert into public.accounts (household_id, name_en, type, currency) values (ha, 'Euros', 'bank', 'EUR');
  exception when others then ok := true; end;
  r := r || format(E'\n%s wallet in a currency the family did not choose is rejected', case when ok then 'PASS' else 'FAIL' end);

  -- ---------- Transfers between currencies ----------
  ok := false;
  begin insert into public.transactions (household_id, type, amount, account_id, to_account_id)
        values (ha, 'transfer', 5000, a_cash, a_usd);
  exception when others then ok := true; end;
  r := r || format(E'\n%s EGP -> USD transfer without the received amount is rejected', case when ok then 'PASS' else 'FAIL' end);

  insert into public.transactions (household_id, type, amount, account_id, to_account_id, to_amount)
  values (ha, 'transfer', 5000, a_cash, a_usd, 100);
  select balance into v from public.v_account_balances where account_id = a_usd;
  r := r || format(E'\n%s USD wallet receives the USD amount (%s)', case when v = 100 then 'PASS' else 'FAIL' end, v);
  select balance into v from public.v_account_balances where account_id = a_cash;
  r := r || format(E'\n%s EGP wallet loses the EGP amount (%s)', case when v = -5000 then 'PASS' else 'FAIL' end, v);

  select id into t from public.accounts where household_id = ha and name_en = 'Bank';
  insert into public.transactions (household_id, type, amount, account_id, to_account_id, to_amount)
  values (ha, 'transfer', 10, a_cash, t, 999) returning to_amount into v;
  r := r || format(E'\n%s same-currency transfer ignores a received amount', case when v is null then 'PASS' else 'FAIL' end);

  ok := false;
  begin update public.accounts set currency = 'EGP' where id = a_usd; exception when others then ok := true; end;
  r := r || format(E'\n%s wallet currency cannot change once it has entries', case when ok then 'PASS' else 'FAIL' end);

  -- ---------- Totals never mix currencies ----------
  select id into a_elec from public.items where household_id = ha and name_en = 'Electricity';
  insert into public.transactions (household_id, type, amount, account_id, item_id) values (ha, 'expense', 300, a_cash, a_elec)
  returning id into a_txn;
  insert into public.transactions (household_id, type, amount, account_id, item_id) values (ha, 'expense', 20, a_usd, a_elec);
  select count(*) into n from public.v_monthly_summary where household_id = ha;
  select expense into v from public.v_monthly_summary where household_id = ha and currency = 'USD';
  r := r || format(E'\n%s monthly summary has one row per currency (%s rows, USD expense %s)',
                   case when n = 2 and v = 20 then 'PASS' else 'FAIL' end, n, v);
  select count(*) into n from public.v_monthly_category_totals where household_id = ha;
  r := r || format(E'\n%s category totals split by currency (%s rows)', case when n = 2 then 'PASS' else 'FAIL' end, n);

  -- ---------- Changing currencies ----------
  perform set_config('request.jwt.claim.sub', a_mem::text, true);
  ok := false;
  begin perform public.set_household_currencies('{EGP}'); exception when others then ok := true; end;
  r := r || format(E'\n%s member cannot change currencies', case when ok then 'PASS' else 'FAIL' end);
  ok := false;
  begin update public.households set currencies = '{EGP}' where id = ha; exception when others then ok := true; end;
  r := r || format(E'\n%s nobody edits currencies directly', case when ok then 'PASS' else 'FAIL' end);

  perform set_config('request.jwt.claim.sub', a_admin::text, true);
  ok := false;
  begin perform public.set_household_currencies('{EGP}'); exception when others then ok := true; end;
  r := r || format(E'\n%s a currency still used by a wallet cannot be removed', case when ok then 'PASS' else 'FAIL' end);
  perform public.set_household_currencies('{USD,EGP}');
  select currency into c from public.households where id = ha;
  r := r || format(E'\n%s admin can swap the main currency (%s)', case when c = 'USD' then 'PASS' else 'FAIL' end, c);

  -- ---------- Only the admin renames the family ----------
  perform set_config('request.jwt.claim.sub', a_mem::text, true);
  update public.households set name = 'Renamed by member' where id = ha;
  get diagnostics n = row_count;
  r := r || format(E'\n%s member cannot rename the family (%s rows)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  perform set_config('request.jwt.claim.sub', a_admin::text, true);
  update public.households set name = 'Family A renamed' where id = ha;
  get diagnostics n = row_count;
  r := r || format(E'\n%s admin can rename the family (%s row)', case when n = 1 then 'PASS' else 'FAIL' end, n);

  -- ---------- Family B cannot see or touch family A ----------
  perform set_config('request.jwt.claim.sub', b_admin::text, true);
  select (select count(*) from public.households where id = ha)
       + (select count(*) from public.household_members where household_id = ha)
       + (select count(*) from public.accounts where household_id = ha)
       + (select count(*) from public.categories where household_id = ha)
       + (select count(*) from public.subcategories where household_id = ha)
       + (select count(*) from public.items where household_id = ha)
       + (select count(*) from public.transactions where household_id = ha)
       + (select count(*) from public.v_transactions where household_id = ha)
       + (select count(*) from public.v_monthly_summary where household_id = ha)
       + (select count(*) from public.v_monthly_category_totals where household_id = ha)
       + (select count(*) from public.v_account_balances where household_id = ha)
    into n;
  r := r || format(E'\n%s family B reads nothing of family A in any table or view (%s)', case when n = 0 then 'PASS' else 'FAIL' end, n);

  select id into b_cash from public.accounts where household_id = hb and type = 'cash';
  ok := false;
  begin insert into public.transactions (household_id, type, amount, account_id, item_id) values (ha, 'expense', 1, a_cash, a_elec);
  exception when others then ok := true; end;
  r := r || format(E'\n%s family B cannot add entries to family A', case when ok then 'PASS' else 'FAIL' end);
  ok := false;
  begin insert into public.transactions (household_id, type, amount, account_id, to_account_id, to_amount)
        values (hb, 'transfer', 1, b_cash, a_cash, 1);
  exception when others then ok := true; end;
  r := r || format(E'\n%s family B cannot transfer into a family A wallet', case when ok then 'PASS' else 'FAIL' end);
  ok := false;
  begin insert into public.accounts (household_id, name_en, type) values (ha, 'Sneaky', 'cash');
  exception when others then ok := true; end;
  r := r || format(E'\n%s family B cannot add wallets to family A', case when ok then 'PASS' else 'FAIL' end);

  update public.transactions set amount = 1 where id = a_txn;
  get diagnostics n = row_count;
  r := r || format(E'\n%s family B cannot edit family A entries (%s rows)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  update public.households set name = 'Hacked' where id = ha;
  get diagnostics n = row_count;
  r := r || format(E'\n%s family B cannot rename family A (%s rows)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  ok := false;
  begin insert into public.household_members (household_id, user_id, display_name) values (ha, b_admin, 'Badr');
  exception when others then ok := true; end;
  r := r || format(E'\n%s family B cannot join family A by itself', case when ok then 'PASS' else 'FAIL' end);

  ok := false;
  begin insert into storage.objects (bucket_id, name, owner) values ('receipts', ha || '/x.jpg', b_admin);
  exception when others then ok := true; end;
  r := r || format(E'\n%s family B cannot upload into family A receipts', case when ok then 'PASS' else 'FAIL' end);

  ok := false;
  begin perform * from public.operator_families(); exception when others then ok := true; end;
  r := r || format(E'\n%s family admins cannot call the operator overview', case when ok then 'PASS' else 'FAIL' end);
  ok := false;
  begin perform public.set_family_status(ha, 'suspended'); exception when others then ok := true; end;
  r := r || format(E'\n%s family admins cannot suspend a family', case when ok then 'PASS' else 'FAIL' end);

  -- ---------- Operator: counts only; suspending locks a family out ----------
  execute 'reset role';
  execute 'set local role service_role';
  select members into n from public.operator_families() where household_id = ha;
  r := r || format(E'\n%s operator sees member counts (%s)', case when n = 2 then 'PASS' else 'FAIL' end, n);
  perform public.set_family_status(ha, 'suspended');
  execute 'reset role';
  execute 'set local role authenticated';

  perform set_config('request.jwt.claim.sub', a_mem::text, true);
  select count(*) into n from public.transactions where household_id = ha;
  r := r || format(E'\n%s suspended family reads no entries (%s)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  perform set_config('request.jwt.claim.sub', b_admin::text, true);
  select count(*) into n from public.accounts where household_id = hb;
  r := r || format(E'\n%s other families keep working (%s wallets)', case when n = 1 then 'PASS' else 'FAIL' end, n);

  raise exception 'MULTI-FAMILY SMOKE TEST (intentional, rolled back):%', r;
end $$;
