-- 0016_support_messages.sql · Contact support saves to the database (2026-10-08)
--
-- Settings → Contact support used to open the iPhone share sheet (Mail, WhatsApp…). Now the message,
-- the part of the app it is about and up to 3 photos are saved here, and the person who runs the app
-- reads them on /operator (through the `operator` Edge Function) and marks each one done.
--
-- * Sending goes through send_support_message() only; nobody can read, change or delete other
--   people's messages. The sender can read their own (not used by the app yet).
-- * A paused (suspended) family can still write: that is when they most need to reach support.
-- * Photos live in the private `support` bucket under <user_id>/<message_id>/<n>.<ext>; only the
--   sender can upload into their own folder, and nobody but the service role can read them
--   (the operator sees them through short-lived signed links).
-- * The id is made on the phone, so sending twice (a retry) never makes a second message.
-- * At most 20 messages per person per day, so a stuck phone can't flood the operator.

create table public.support_messages (
  id           uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  sent_by      uuid references auth.users(id) on delete set null,
  section      text check (section in ('home', 'addEntry', 'history', 'reports', 'wallets',
                                       'categories', 'budgets', 'family', 'signIn', 'other')),
  message      text not null default '' check (char_length(message) <= 2000),
  photo_paths  text[] not null default '{}' check (cardinality(photo_paths) <= 3),
  locale       text check (locale in ('en', 'ar')),
  status       text not null default 'new' check (status in ('new', 'done')),
  created_at   timestamptz not null default now(),
  handled_at   timestamptz,
  check (char_length(trim(message)) > 0 or cardinality(photo_paths) > 0)
);

create index support_messages_new_idx on public.support_messages (created_at) where status = 'new';
create index support_messages_household_idx on public.support_messages (household_id);
create index support_messages_sent_by_idx on public.support_messages (sent_by, created_at);

alter table public.support_messages enable row level security;
create policy "sender reads own" on public.support_messages
  for select to authenticated using (sent_by = (select auth.uid()));
revoke all on public.support_messages from anon, authenticated;
grant select on public.support_messages to authenticated;

-- ---------- A family member sends a message ----------
create or replace function public.send_support_message(
  p_id uuid, p_section text, p_message text, p_photo_paths text[], p_locale text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  clean text := trim(coalesce(p_message, ''));
  paths text[] := coalesce(p_photo_paths, '{}');
  p text;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select household_id into hid from public.household_members where user_id = uid limit 1;
  if hid is null then raise exception 'not_in_family' using errcode = '42501'; end if;

  -- Sent before (a retry after a lost answer): nothing new
  if exists (select 1 from public.support_messages where id = p_id) then
    if exists (select 1 from public.support_messages where id = p_id and sent_by = uid) then return p_id; end if;
    raise exception 'bad_request' using errcode = '23505';
  end if;

  if char_length(clean) > 2000 or cardinality(paths) > 3 then raise exception 'bad_request' using errcode = '23514'; end if;
  if clean = '' and cardinality(paths) = 0 then raise exception 'empty' using errcode = '23514'; end if;
  foreach p in array paths loop
    if p !~ ('^' || uid::text || '/' || p_id::text || '/[1-3]\.(jpg|webp)$') then
      raise exception 'bad_request' using errcode = '23514';
    end if;
  end loop;

  if (select count(*) from public.support_messages
      where sent_by = uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too_many' using errcode = '54000';
  end if;

  insert into public.support_messages (id, household_id, sent_by, section, message, photo_paths, locale)
  values (p_id, hid, uid, nullif(p_section, ''), clean, paths,
          case when p_locale in ('en', 'ar') then p_locale end);
  return p_id;
end $$;

-- ---------- Operator only (service role, via the `operator` Edge Function) ----------
create or replace function public.operator_support_messages()
returns table (id uuid, family text, sender text, section text, message text,
               photo_paths text[], locale text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select s.id, h.name,
    (select m.display_name from public.household_members m
     where m.household_id = s.household_id and m.user_id = s.sent_by),
    s.section, s.message, s.photo_paths, s.locale, s.created_at
  from public.support_messages s join public.households h on h.id = s.household_id
  where s.status = 'new'
  order by s.created_at;
$$;

create or replace function public.support_message_done(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.support_messages set status = 'done', handled_at = now()
  where id = p_id and status = 'new';
end $$;

revoke execute on function public.send_support_message(uuid, text, text, text[], text) from public, anon;
grant  execute on function public.send_support_message(uuid, text, text, text[], text) to authenticated;
revoke execute on function public.operator_support_messages() from public, anon, authenticated;
revoke execute on function public.support_message_done(uuid) from public, anon, authenticated;
grant  execute on function public.operator_support_messages(), public.support_message_done(uuid) to service_role;

-- ---------- Photos: private bucket, the sender uploads into their own folder only ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support', 'support', false, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "support upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'support' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- No select, update or delete policy: only the service role reads them.
