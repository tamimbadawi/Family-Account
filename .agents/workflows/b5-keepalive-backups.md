---
description: Step B5 — activate keep-alive (GitHub Action + Vercel cron), weekly backups, and the CSV export.
---

# B5 · Keep-alive, backups, export

Read `AGENTS.md` and `docs/PLAN.md` "Keep-alive and backups". The workflow files already exist in `.github/workflows/` and `vercel.json` already has the cron.

1. Implement `src/app/api/keepalive/route.ts`: `export const dynamic = 'force-dynamic'`; require `Authorization: Bearer ${process.env.CRON_SECRET}`; call `rpc('keepalive')` with the publishable key; return `{ ok, pingedAt }`.
2. Settings → "تنزيل بياناتي": CSV of all non-deleted entries (date, type, amount, category, subcategory, item, wallet, note, entered by) in the current language, UTF-8 with BOM.
3. Tell me exactly which values to add:
   - GitHub repo secrets: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_URL` (Session pooler string).
   - Vercel env: `CRON_SECRET` (generate a random 32-byte hex for me).
4. After I add them: trigger `keepalive.yml` and `backup.yml` manually (GitHub MCP or `gh workflow run`) and confirm both succeed and an artifact exists; call `/api/keepalive` with the secret; check `select pinged_at from heartbeat` via `execute_sql`.
5. Definition of Done.
