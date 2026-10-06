---
description: Step B2 — Supabase clients, session handling in proxy.ts, and wiring Login, Welcome, Family and Sign out to real auth.
---

# B2 · Authentication

Read `AGENTS.md` and `.agents/rules/04-supabase-security.md`.

1. Install `@supabase/supabase-js @supabase/ssr`. `src/lib/supabase/client.ts` (createBrowserClient) and `server.ts` (createServerClient with Next cookies), typed with `database.types.ts`.
2. `proxy.ts`: keep next-intl routing, add Supabase session refresh; redirect to `/{locale}/login` only for app routes when there is no session. Exclude static assets, `/sw.js`/serwist routes, manifest, icons, `/api/keepalive`.
3. Login is **username + password**. `src/lib/auth/username.ts`: `usernameToEmail(u)` = `u.trim().toLowerCase() + "@family.local"` (with a vitest test); call `signInWithPassword({ email: usernameToEmail(username), password })`. Never show the email form to users. Friendly translated errors (wrong username or password, no connection). Sessions persist (no forced expiry).
4. After login: if the user has no `household_members` row → Welcome → `rpc('create_household', …)`; else → Home.
5. Settings → Family: list members; owner sees "Add family member" (username + name) → `rpc('add_member', { p_email: usernameToEmail(username), … })`, with a note that the account must first be created in Supabase.
6. Sign out clears the Supabase session **and** the local Dexie data (after warning if the outbox has unsynced items).
7. Get the project URL and publishable key via the Supabase MCP; add them to Vercel env vars (Production + Preview) and `.env.local` (never commit it).
8. Definition of Done (data mode can stay `mock` for screens until B3).
