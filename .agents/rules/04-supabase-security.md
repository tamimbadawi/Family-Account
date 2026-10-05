---
trigger: glob
globs: supabase/**, src/lib/supabase/**, src/app/api/**, proxy.ts
---

# Supabase and security rules

- Schema changes = a **new** numbered file in `supabase/migrations/` applied with the Supabase MCP `apply_migration`.
  Never edit a migration that has already been applied.
- Every new table: `enable row level security` + policies using `public.is_member(household_id)`,
  explicit `grant` statements (the migration revokes Supabase's default grants), and an `updated_at` trigger if it syncs.
- Views must be created `with (security_invoker = true)`.
- Functions: `set search_path = ''`, fully-qualified names, `security definer` only when required, and
  `revoke execute ... from public, anon` before granting to `authenticated`.
- After any schema change: run `get_advisors` (security and performance), fix findings, then regenerate
  `src/lib/supabase/database.types.ts` with `generate_typescript_types`.
- Run `supabase/tests/rls_smoke_test.sql` with `execute_sql` after schema changes; it rolls itself back.
- Client keys: only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` reach the browser.
  Never use a secret/service-role key in the app.
- `/api/keepalive` requires `Authorization: Bearer ${CRON_SECRET}` and only calls `rpc('keepalive')`.
- Auth: email + password, public sign-up disabled in the Supabase dashboard; `proxy.ts` refreshes the session
  and redirects to `/login` only when online and the session is truly missing.
