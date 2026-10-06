-- 0004_receipt_photos.sql · one optional receipt photo per entry (2026-10-06)
-- Photos live in a private Storage bucket under <household_id>/<transaction_id>.jpg (or .webp).
-- Like entries, photos are never hard-deleted by the app: replacing one uploads a new path.

alter table public.transactions
  add column photo_path text check (char_length(photo_path) <= 300);

-- v_transactions exposes the photo path (new column appended at the end).
create or replace view public.v_transactions with (security_invoker = true) as
select
  t.id, t.household_id, t.type, t.amount, t.occurred_on, t.note,
  t.account_id, a.name_ar as account_name_ar, a.name_en as account_name_en,
  t.to_account_id,
  t.item_id,        i.name_ar as item_name_ar,        i.name_en as item_name_en,
  s.id as subcategory_id, s.name_ar as subcategory_name_ar, s.name_en as subcategory_name_en,
  c.id as category_id,    c.name_ar as category_name_ar,    c.name_en as category_name_en,
  c.icon as category_icon, c.color as category_color,
  t.created_by, t.created_at, t.updated_at,
  t.photo_path
from public.transactions t
join public.accounts a        on a.household_id = t.household_id and a.id = t.account_id
left join public.items i         on i.id = t.item_id
left join public.subcategories s on s.id = i.subcategory_id
left join public.categories c    on c.id = s.category_id
where t.deleted_at is null;

-- Private bucket: 2 MB max per file, JPEG/WebP only (the app compresses to ~200 KB before upload).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- The first folder of the object path must be a household the user belongs to.
create policy "receipts read own household" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and public.is_member(((storage.foldername(name))[1])::uuid));

create policy "receipts upload own household" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_member(((storage.foldername(name))[1])::uuid));

create policy "receipts replace own household" on storage.objects
  for update to authenticated
  using (bucket_id = 'receipts' and public.is_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'receipts' and public.is_member(((storage.foldername(name))[1])::uuid));
-- No delete policy: same rule as entries.
