-- Receipt-photo storage smoke test for 0004_receipt_photos.sql.
-- Same pattern as rls_smoke_test.sql: always ends with an intentional exception, so everything rolls back.
-- EXPECTED: an ERROR starting with "PHOTO SMOKE TEST" where every line says PASS.

do $$
declare
  mom uuid := gen_random_uuid(); bad uuid := gen_random_uuid();
  hid uuid; n int; r text := ''; ok boolean;
begin
  insert into auth.users (id, email) values (mom, 'smoke-mom-' || mom || '@test.local'), (bad, 'smoke-x-' || bad || '@test.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', mom::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', mom, 'role', 'authenticated')::text, true);
  hid := public.create_household('Smoke', 'Mom', 'en');

  insert into storage.objects (bucket_id, name, owner) values ('receipts', hid || '/t1.jpg', mom);
  r := r || E'\nPASS member can store a receipt in own household folder';

  ok := false;
  begin
    insert into storage.objects (bucket_id, name, owner) values ('receipts', gen_random_uuid() || '/t2.jpg', mom);
  exception when others then ok := true; end;
  r := r || format(E'\n%s member cannot write into another household folder', case when ok then 'PASS' else 'FAIL' end);

  perform set_config('request.jwt.claim.sub', bad::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', bad, 'role', 'authenticated')::text, true);
  select count(*) into n from storage.objects where bucket_id = 'receipts';
  r := r || format(E'\n%s outsider sees no receipts (%s)', case when n = 0 then 'PASS' else 'FAIL' end, n);

  execute 'set local role anon';
  select count(*) into n from storage.objects where bucket_id = 'receipts';
  r := r || format(E'\n%s anon sees no receipts (%s)', case when n = 0 then 'PASS' else 'FAIL' end, n);

  raise exception 'PHOTO SMOKE TEST (intentional, rolled back):%', r;
end $$;
