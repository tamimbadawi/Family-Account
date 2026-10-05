---
description: Step B1 — apply the Supabase migrations via MCP, run advisors and the RLS smoke test, generate TypeScript types.
---

# B1 · Database

Precondition: `docs/PROGRESS.md` shows the **Family approval** gate ticked. If not, stop and tell me.
Read `AGENTS.md`, `.agents/rules/04-supabase-security.md`, and `docs/PLAN.md` "Database schema".

1. Supabase MCP `list_tables` — confirm the project is empty (if not, stop and show me).
2. `apply_migration` name `0001_schema` with the exact contents of `supabase/migrations/0001_schema.sql`.
3. `apply_migration` name `0002_purge` with `supabase/migrations/0002_purge.sql`. If `create extension pg_cron` fails, tell me to enable Cron in Dashboard → Integrations, then retry.
4. `execute_sql` with `supabase/tests/rls_smoke_test.sql` (it creates two test users, runs checks, and rolls back). All checks must report `PASS`.
5. `get_advisors` for `security` and `performance`; fix findings with a new migration `0003_*` if needed (never edit 0001/0002).
6. `generate_typescript_types` → `src/lib/supabase/database.types.ts`.
7. Tell me to: create the two users in Dashboard → Authentication → Users (auto-confirm) and confirm "Allow new users to sign up" is OFF.
8. Commit, push, tick B1 in PROGRESS.md.
