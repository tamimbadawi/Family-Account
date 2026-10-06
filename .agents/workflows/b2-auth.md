---
description: Step B2 — Supabase clients, session handling in proxy.ts, and wiring Login, Welcome, Family and Sign out to real auth.
---

# B2 · Authentication

Read `AGENTS.md` and `.agents/rules/04-supabase-security.md`.

1. Install `@supabase/supabase-js @supabase/ssr`. `src/lib/supabase/client.ts` (createBrowserClient) and `server.ts` (createServerClient with Next cookies), typed with `database.types.ts`.
2. `proxy.ts`: keep next-intl routing, add Supabase session refresh; redirect to `/{locale}/login` only for app routes when there is no session. Exclude static assets, `/sw.js`/serwist routes, manifest, icons, `/api/keepalive`.
3. Login is **username + password**. `src/lib/auth/username.ts`: `usernameToEmail(u)` = `u.trim().toLowerCase() + "@family.local"` (with a vitest test); call `signInWithPassword({ email: usernameToEmail(username), password })`. Never show the email form to users. Friendly translated errors (wrong username or password, no connection). Sessions persist (no forced expiry).
4. After login: if the user has no `household_members` row → Welcome → `rpc('create_household', …)`; else → Home.
5. **Family management in the app (the owner, Injy, never needs the Supabase dashboard).** Supabase Edge Function `family-admin` (`supabase/functions/family-admin/index.ts`, deployed with the Supabase MCP `deploy_edge_function`). It verifies the caller's JWT and that the caller is `owner` of the household; it uses the service-role key from the function's own environment (never in the app, Vercel or git). Actions:
   - `add_member(username, display_name, temp_password)`: `auth.admin.createUser({ email: usernameToEmail(username), password, email_confirm: true, user_metadata: { must_change_password: true } })` + a `household_members` row.
   - `reset_password(user_id, temp_password)`: sets the password and `must_change_password: true`.
   - `remove_member(user_id)`: deletes the membership row and bans the auth user (`ban_duration: "876000h"`). Their past entries stay.
   - `transfer_owner(user_id)`: the new owner becomes `owner`, the caller becomes `member`.
   Settings → Family: list members (name, username); the owner sees Add / Reset password / Remove / Make owner (with an Undo-style confirmation sheet for Remove only, since it is not reversible from the app). Members see the list only.
5b. **First sign-in password change:** if `user_metadata.must_change_password` is true, after login show one screen "Choose your own password" (2 fields, show/hide) → `supabase.auth.updateUser({ password, data: { must_change_password: false } })`. Nobody who set the temporary password ever knows the real one.
6. Sign out clears the Supabase session **and** the local Dexie data (after warning if the outbox has unsynced items).
7. Get the project URL and publishable key via the Supabase MCP; add them to Vercel env vars (Production + Preview) and `.env.local` (never commit it).
8. Definition of Done (data mode can stay `mock` for screens until B3).
