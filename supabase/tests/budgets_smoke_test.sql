-- Smoke test for 0010_budgets.sql. Same pattern as rls_smoke_test.sql:
-- one DO block that always ends with an exception, so everything rolls back.
-- EXPECTED OUTPUT: an ERROR starting with "SMOKE TEST RESULTS"; every line must say PASS.

do $$
declare
  mom uuid := gen_random_uuid();
  stranger uuid := gen_random_uuid();
  hid uuid; food uuid; groceries uuid; other_group uuid; income_cat uuid; bid uuid;
  n int; r text := ''; ok boolean;
begin
  insert into auth.users (id, email, raw_app_meta_data) values
    (mom, 'smoke-mom-' || mom || '@test.local', '{"family_admin": true}'),
    (stranger, 'smoke-x-' || stranger || '@test.local', '{}');

  execute 'set local role authenticated';

  perform set_config('request.jwt.claim.sub', mom::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', mom, 'role', 'authenticated')::text, true);
  hid := public.create_household('Smoke', 'Mom', 'en');
  select id into food from public.categories where household_id = hid and kind = 'expense' order by sort_order limit 1;
  select id into groceries from public.subcategories where household_id = hid and category_id = food limit 1;
  select id into other_group from public.subcategories where household_id = hid and category_id <> food limit 1;
  select id into income_cat from public.categories where household_id = hid and kind = 'income' limit 1;

  select count(*) into n from public.budgets where household_id = hid and is_starter and not is_archived;
  r := r || format(E'\n%s new household gets its own starter budgets (%s)', case when n = 4 then 'PASS' else 'FAIL' end, n);
  select id into bid from public.budgets where household_id = hid and category_id = food;
  update public.budgets set amount = 4321, is_starter = false where id = bid;
  select count(*) into n from public.budgets where id = bid and amount = 4321 and not is_starter;
  r := r || format(E'\n%s family can change a starter budget', case when n = 1 then 'PASS' else 'FAIL' end);
  update public.budgets set is_archived = true where household_id = hid;

  insert into public.budgets (household_id, category_id, amount) values (hid, food, 5000) returning id into bid;
  insert into public.budgets (household_id, category_id, subcategory_id, amount) values (hid, food, groceries, 2000);
  r := r || E'\nPASS category and group budgets inserted';

  ok := false;
  begin
    insert into public.budgets (household_id, category_id, amount) values (hid, food, 100);
  exception when unique_violation then ok := true; end;
  r := r || format(E'\n%s second active budget for the same category is rejected', case when ok then 'PASS' else 'FAIL' end);

  ok := false;
  begin
    insert into public.budgets (household_id, category_id, amount) values (hid, income_cat, 100);
  exception when check_violation then ok := true; end;
  r := r || format(E'\n%s budget on an income category is rejected', case when ok then 'PASS' else 'FAIL' end);

  ok := false;
  begin
    insert into public.budgets (household_id, category_id, subcategory_id, amount) values (hid, food, other_group, 100);
  exception when check_violation then ok := true; end;
  r := r || format(E'\n%s group from another category is rejected', case when ok then 'PASS' else 'FAIL' end);

  update public.budgets set is_archived = true where id = bid;
  insert into public.budgets (household_id, category_id, amount) values (hid, food, 6000);
  r := r || E'\nPASS a removed (archived) budget can be set again';

  ok := false;
  begin
    delete from public.budgets where id = bid;
  exception when insufficient_privilege then ok := true; end;
  r := r || format(E'\n%s hard delete is blocked', case when ok then 'PASS' else 'FAIL' end);

  perform set_config('request.jwt.claim.sub', stranger::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  select count(*) into n from public.budgets where household_id = hid;
  r := r || format(E'\n%s outsider sees no budgets', case when n = 0 then 'PASS' else 'FAIL' end);

  raise exception 'SMOKE TEST RESULTS%', r;
end $$;
