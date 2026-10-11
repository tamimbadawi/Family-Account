-- Sample data smoke test for 0014_sample_data.sql and 0015_richer_sample_data.sql.
-- Same pattern as rls_smoke_test.sql: one DO block that always ends with an intentional exception,
-- so every change (including the throwaway auth users) is rolled back. Safe on the real project.
--
-- EXPECTED: an ERROR starting with "SAMPLE DATA SMOKE TEST" where every line says PASS.

do $$
declare
  admin  uuid := gen_random_uuid();
  member uuid := gen_random_uuid();
  other  uuid := gen_random_uuid();  -- admin of another family
  ha uuid; hb uuid; n int; ok boolean; r text := '';
  real_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_app_meta_data) values
    (admin,  'sd-a-' || admin  || '@test.local', '{"family_admin": true}'),
    (member, 'sd-m-' || member || '@test.local', '{}'),
    (other,  'sd-o-' || other  || '@test.local', '{"family_admin": true}');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', other::text, true);
  hb := public.create_family('B', 'Bob', 'en', '{EGP}');
  perform set_config('request.jwt.claim.sub', admin::text, true);
  ha := public.create_family('A', 'Anna', 'en', '{EGP}');
  execute 'reset role';
  insert into public.household_members (household_id, user_id, display_name, role) values (ha, member, 'Mo', 'member');

  select count(*) into n from public.transactions where household_id = ha and is_sample and deleted_at is null;
  r := r || format(E'\n%s a new family starts with sample entries (%s)', case when n > 200 then 'PASS' else 'FAIL' end, n);
  select count(*) into n from public.accounts where household_id = ha and is_sample and not is_archived;
  r := r || format(E'\n%s a new family gets 3 sample banks (%s)', case when n = 3 then 'PASS' else 'FAIL' end, n);
  r := r || format(E'\n%s sample transfers fill Cash from the banks',
    case when exists (select 1 from public.transactions where household_id = ha and is_sample and type = 'transfer') then 'PASS' else 'FAIL' end);
  r := r || format(E'\n%s the household says it has sample data',
    case when (select has_sample_data from public.households where id = ha) then 'PASS' else 'FAIL' end);
  r := r || format(E'\n%s no sample entry is dated after today',
    case when not exists (select 1 from public.transactions where household_id = ha and occurred_on > current_date) then 'PASS' else 'FAIL' end);

  -- A real entry the family added themselves
  insert into public.transactions (id, household_id, type, amount, occurred_on, account_id, item_id)
  select real_id, ha, 'expense', 99, current_date, a.id, t.item_id
  from public.transactions t join public.accounts a on a.household_id = ha and a.type = 'cash' and not a.is_sample
  where t.household_id = ha and t.type = 'expense' limit 1;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member::text, true);
  ok := false;
  begin perform public.clear_sample_data(); exception when others then ok := true; end;
  r := r || format(E'\n%s a member cannot clear the samples', case when ok then 'PASS' else 'FAIL' end);

  perform set_config('request.jwt.claim.sub', admin::text, true);
  perform public.clear_sample_data();
  execute 'reset role';
  select count(*) into n from public.transactions where household_id = ha and deleted_at is null;
  r := r || format(E'\n%s clearing leaves only the family''s own entry (%s left)', case when n = 1 then 'PASS' else 'FAIL' end, n);
  r := r || format(E'\n%s the family''s own entry stays',
    case when exists (select 1 from public.transactions where id = real_id and deleted_at is null) then 'PASS' else 'FAIL' end);
  select count(*) into n from public.accounts where household_id = ha and is_sample and not is_archived;
  r := r || format(E'\n%s clearing hides the sample banks (%s visible)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  r := r || format(E'\n%s Cash stays',
    case when exists (select 1 from public.accounts where household_id = ha and type = 'cash' and not is_archived) then 'PASS' else 'FAIL' end);
  r := r || format(E'\n%s another family''s samples are untouched',
    case when exists (select 1 from public.transactions where household_id = hb and is_sample and deleted_at is null) then 'PASS' else 'FAIL' end);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', admin::text, true);
  perform public.restore_sample_data();
  execute 'reset role';
  select count(*) into n from public.transactions where household_id = ha and is_sample and deleted_at is null;
  r := r || format(E'\n%s undo brings the samples back (%s)', case when n > 200 then 'PASS' else 'FAIL' end, n);
  select count(*) into n from public.accounts where household_id = ha and is_sample and not is_archived;
  r := r || format(E'\n%s undo shows the sample banks again (%s)', case when n = 3 then 'PASS' else 'FAIL' end, n);
  r := r || format(E'\n%s anon cannot call clear_sample_data',
    case when not has_function_privilege('anon', 'public.clear_sample_data()', 'execute') then 'PASS' else 'FAIL' end);
  r := r || format(E'\n%s nobody calls seed_sample_entries directly',
    case when not has_function_privilege('authenticated', 'public.seed_sample_entries(uuid)', 'execute') then 'PASS' else 'FAIL' end);

  raise exception 'SAMPLE DATA SMOKE TEST (rolled back):%', r;
end $$;
