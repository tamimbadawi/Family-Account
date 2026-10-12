-- Smoke test for 0018_recurring_entries.sql. Same pattern as budgets_smoke_test.sql:
-- one DO block that always ends with an exception, so everything rolls back.
-- EXPECTED OUTPUT: an ERROR starting with "SMOKE TEST RESULTS"; every line must say PASS.

do $$
declare
  mom uuid := gen_random_uuid();
  stranger uuid := gen_random_uuid();
  hid uuid; cash uuid; bank uuid; food uuid; groceries uuid; income_cat uuid; salary_item uuid;
  rid uuid; tid uuid;
  n int; r text := ''; ok boolean;
begin
  insert into auth.users (id, email, raw_app_meta_data) values
    (mom, 'smoke-mom-' || mom || '@test.local', '{"family_admin": true}'),
    (stranger, 'smoke-x-' || stranger || '@test.local', '{}');

  execute 'set local role authenticated';

  perform set_config('request.jwt.claim.sub', mom::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', mom, 'role', 'authenticated')::text, true);
  hid := public.create_family('Smoke', 'Mom', 'en');

  select id into cash from public.accounts where household_id = hid and type = 'cash' limit 1;
  select id into bank from public.accounts where household_id = hid and type = 'bank' limit 1;
  select id into food from public.categories where household_id = hid and kind = 'expense' limit 1;
  select id into groceries from public.items i join public.subcategories s on s.id = i.subcategory_id
    where s.household_id = hid and s.category_id = food limit 1;
  select id into income_cat from public.categories where household_id = hid and kind = 'income' limit 1;
  select id into salary_item from public.items i join public.subcategories s on s.id = i.subcategory_id
    where s.household_id = hid and s.category_id = income_cat limit 1;

  -- 1. Insert expense recurring rule
  insert into public.recurring_rules (
    household_id, type, amount, day_of_month, start_month, account_id, item_id, note
  ) values (
    hid, 'expense', 1500, 10, '2026-08', cash, groceries, 'Weekly market'
  ) returning id into rid;
  r := r || E'\nPASS expense recurring rule inserted';

  -- 2. Insert transfer recurring rule
  insert into public.recurring_rules (
    household_id, type, amount, day_of_month, start_month, account_id, to_account_id, note
  ) values (
    hid, 'transfer', 5000, 1, '2026-08', bank, cash, 'Monthly cash ATM withdrawal'
  );
  r := r || E'\nPASS transfer recurring rule inserted';

  -- 3. Mismatched item kind rejected
  ok := false;
  begin
    insert into public.recurring_rules (
      household_id, type, amount, day_of_month, start_month, account_id, item_id
    ) values (
      hid, 'expense', 100, 15, '2026-08', cash, salary_item
    );
  exception when check_violation then ok := true; end;
  r := r || format(E'\n%s expense rule with income item rejected', case when ok then 'PASS' else 'FAIL' end);

  -- 4. Insert transaction linked to recurring rule
  insert into public.transactions (
    household_id, type, amount, occurred_on, account_id, item_id, recurring_rule_id, recurring_month
  ) values (
    hid, 'expense', 1500, '2026-08-10', cash, groceries, rid, '2026-08'
  ) returning id into tid;
  r := r || E'\nPASS transaction linked to recurring rule inserted';

  -- 5. Duplicate transaction for same rule and month is rejected by unique constraint
  ok := false;
  begin
    insert into public.transactions (
      household_id, type, amount, occurred_on, account_id, item_id, recurring_rule_id, recurring_month
    ) values (
      hid, 'expense', 1500, '2026-08-10', cash, groceries, rid, '2026-08'
    );
  exception when unique_violation then ok := true; end;
  r := r || format(E'\n%s duplicate entry for same rule and month rejected', case when ok then 'PASS' else 'FAIL' end);

  -- 6. Stranger cannot see recurring rules
  perform set_config('request.jwt.claim.sub', stranger::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);

  select count(*) into n from public.recurring_rules where household_id = hid;
  r := r || format(E'\n%s stranger cannot select recurring rules (%s)', case when n = 0 then 'PASS' else 'FAIL' end, n);

  ok := false;
  begin
    update public.recurring_rules set is_archived = true where id = rid;
    get diagnostics n = row_count;
    if n = 0 then ok := true; end if;
  exception when others then ok := true; end;
  r := r || format(E'\n%s stranger cannot update recurring rules', case when ok then 'PASS' else 'FAIL' end);

  raise exception 'SMOKE TEST RESULTS:%', r;
end $$;
