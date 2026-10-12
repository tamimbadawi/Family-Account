-- 0025_operator_insights.sql · numbers for the operator dashboard (2026-10-12)
--
-- The person who runs the app sees how the app is used, never what families spend: only counts and
-- dates, no amounts, notes, categories or wallet names. Sample entries (is_sample) are left out of
-- every count. Called only by the `operator` Edge Function (service role), like operator_families().
-- Days are counted in Cairo time, where the families live.

create or replace function public.operator_insights()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with real_entries as (
    select t.household_id, t.created_by, t.created_at
    from public.transactions t
    where t.deleted_at is null and not t.is_sample
  ),
  member_rows as (
    select m.household_id, m.user_id, m.display_name, m.role, m.created_at as joined_at,
      u.email, u.last_sign_in_at,
      (select count(*)::int from real_entries e where e.household_id = m.household_id and e.created_by = m.user_id) as entries,
      (select max(e.created_at) from real_entries e where e.household_id = m.household_id and e.created_by = m.user_id) as last_entry_at
    from public.household_members m
    left join auth.users u on u.id = m.user_id
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'families', (select count(*) from public.households),
      'people', (select count(*) from public.household_members),
      'entries', (select count(*) from real_entries),
      'entries7d', (select count(*) from real_entries where created_at > now() - interval '7 days'),
      'entries30d', (select count(*) from real_entries where created_at > now() - interval '30 days'),
      'activeFamilies7d', (select count(distinct household_id) from real_entries where created_at > now() - interval '7 days'),
      'signIns7d', (select count(*) from member_rows where last_sign_in_at > now() - interval '7 days'),
      'supportOpen', (select count(*) from public.support_messages where status = 'new')
    ),
    -- Entries added per day, last 30 days (days with none are 0)
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'entries', coalesce(c.n, 0)) order by d.day), '[]'::jsonb)
      from generate_series(
        ((now() at time zone 'Africa/Cairo')::date - 29), (now() at time zone 'Africa/Cairo')::date, interval '1 day'
      ) as d(day)
      left join (
        select (created_at at time zone 'Africa/Cairo')::date as day, count(*) as n
        from real_entries
        where created_at > now() - interval '31 days'
        group by 1
      ) c on c.day = d.day::date
    ),
    -- Every family with its people: who signed in when, and how many entries each one added
    'families', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'householdId', h.id,
        'name', h.name,
        'status', h.status,
        'createdAt', h.created_at,
        'entries', (select count(*) from real_entries e where e.household_id = h.id),
        'entries7d', (select count(*) from real_entries e where e.household_id = h.id and e.created_at > now() - interval '7 days'),
        'lastEntryAt', (select max(e.created_at) from real_entries e where e.household_id = h.id),
        'hasSample', exists (
          select 1 from public.transactions t where t.household_id = h.id and t.is_sample and t.deleted_at is null
        ),
        'members', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'name', r.display_name,
            'email', r.email,
            'role', r.role,
            'joinedAt', r.joined_at,
            'lastSignInAt', r.last_sign_in_at,
            'entries', r.entries,
            'lastEntryAt', r.last_entry_at
          ) order by r.role desc, r.joined_at), '[]'::jsonb)
          from member_rows r where r.household_id = h.id
        )
      ) order by h.created_at desc), '[]'::jsonb)
      from public.households h
    ),
    -- Messages sent from Settings → Contact support in the last 30 days, open and done
    'supportRecent', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id,
        'family', h.name,
        'sender', (select m.display_name from public.household_members m
                   where m.household_id = s.household_id and m.user_id = s.sent_by),
        'email', (select u.email from auth.users u where u.id = s.sent_by),
        'section', s.section,
        'message', s.message,
        'photoCount', coalesce(array_length(s.photo_paths, 1), 0),
        'status', s.status,
        'createdAt', s.created_at,
        'handledAt', s.handled_at
      ) order by s.created_at desc), '[]'::jsonb)
      from public.support_messages s join public.households h on h.id = s.household_id
      where s.created_at > now() - interval '30 days'
    )
  );
$$;

revoke execute on function public.operator_insights() from public, anon, authenticated;
grant  execute on function public.operator_insights() to service_role;
