# Multi-family plan — one app, many households

Decided 2026-10-07 with the user · not yet on the board (`docs/PROGRESS.md`).

## 1. Decisions

| Question | Decision |
|---|---|
| Shape | **One database and one app for every family** (multi-tenant). Each family is a household. |
| Who runs it | Tamim runs the service (Supabase, Vercel, GitHub). He only sets **each new family's admin email** (and a first password). |
| Family admin | Every family has its own admin (the household `owner`). The admin names the family, writes their own name, **picks the family's currencies**, and adds the family's members. |
| Login | **Email + password.** The email is the username. No more `name@family.local` usernames. |
| Names | Every person has a **name, typed when they are added** (by the admin for members; by the admin themself on Welcome). That name is what the app shows everywhere ("Added by Mama"); the email is only for signing in. |
| Joining | **By invitation only.** Open sign-up stays off. Nobody can create a family unless Tamim created them as a family admin. |
| Cost | Free and non-commercial: Vercel Hobby + Supabase Free. |
| Currencies | **The family chooses** 1 or 2 currencies, from any currency the phone knows (common ones first). Every wallet holds one of them. No automatic exchange rates, and amounts are never added across currencies. |

## 2. How a family gets started

1. **Tamim** opens `/en/operator` → *Start a new family* → types the admin's **email** and a first password, and sends the password to them privately.
2. **The family admin** signs in with that email → chooses their own password → **Welcome**: family name, their own name, main currency, optional second currency → *Get started*.
3. **The admin adds each member** in Settings → Family: **name** (what the app shows), **email** (what they sign in with), first password.
   No email? Use the admin's own with a tag, e.g. `injy+mama@gmail.com`.
4. **Each member** signs in with their email → chooses their own password → Home.

**Invites from families (0012):** anyone in a family can tap *Invite a new family* in Settings → Family (friend's name + email).
The request waits under *Invited by other families* on `/operator`; *Start their family* creates the admin login (and marks the
request approved, for every family that invited that email), *Decline* closes it. The inviting family sees Waiting / Started / Not now.
At most 5 requests per family per day. Sign-up stays invite-only.

No email is ever sent by the app, so no mail service or domain is needed. "Forgot password" is handled the same way as today:
the family admin resets a member's password, and Tamim resets a family admin's password from `/operator`.
Email links (invites, self-service reset) can come later with Resend + a domain (§8).

## 3. What is built (branch `ccr-71092192-wbizym`)

| Part | Where | Status |
|---|---|---|
| Migration: invite-only `create_household(name, display_name, locale, currencies)`, `households.currencies` + `status`, wallet `currency`, transfer `to_amount`, views per currency, `set_household_currencies`, `operator_families` / `set_family_status` (service role only), `add_member(email)` dropped | `supabase/migrations/0009_multi_family.sql` | written, **not applied** |
| Cross-family + currency smoke test, 33 checks | `supabase/tests/multi_family_smoke_test.sql` | 33/33 PASS locally |
| Existing smoke tests updated for invite-only families | `rls_`, `remove_member_`, `receipts_smoke_test.sql` | all PASS locally on 0001–0009 |
| Local Postgres stub now covers every migration (cron, storage, service role) | `supabase/tests/local_auth_stub.sql` | done |
| `operator` Edge Function (OPERATOR_EMAILS secret): list families (counts only), create family admin, pause/resume, reset admin password | `supabase/functions/operator` | written, **not deployed** |
| `family-admin`: add members by name + email; no global user scan; never says which family owns an email; refuses when the family is paused | `supabase/functions/family-admin` | written, **not deployed** |
| Login with email | `login/page.tsx`, `lib/auth/email.ts` | done |
| Welcome: your name (shown in the app) + main and second currency | `welcome/page.tsx`, `components/family/CurrencySelect.tsx` | done |
| Settings → Family: name + email + first password; email shown under each name | `settings/family/page.tsx` | done |
| `/operator` page | `(app)/operator/page.tsx`, `messages/*/operator.json` | done |
| `money(amount, locale, { currency })`, `currencySymbol`, `currencyChoices` | `lib/format/currency.ts` | done |
| Database types | `lib/supabase/database.types.ts` | hand-edited; regenerate after applying 0009 |
| Family invites: `family_invites` table, `invite_family` (members), `operator_family_invites` / `decide_family_invite` (service role) + smoke test, 14 checks | `0012_family_invites.sql`, `supabase/tests/family_invites_smoke_test.sql` | written, **not applied**; 14/14 PASS locally |

## 4. To go live (Claude owns Supabase and Vercel)
1. Apply `0006`, `0007` (pending since B2) and `0009` with `apply_migration`; run all four smoke tests with `execute_sql`; run `get_advisors`; regenerate types.
2. Deploy `operator` and `family-admin`; set the secret `OPERATOR_EMAILS=<Tamim's email>`.
3. Supabase Auth: sign-up **off**, email confirmations off (accounts are created confirmed), sessions never expire.
4. Tamim creates Injy's family admin from `/en/operator` instead of the dashboard (replaces PLAN.md handover step 5).

## 5. Still to build

| Step | What | Owner |
|---|---|---|
| M3 | Settings → Currencies (admin): add a second currency, swap the main one (`set_household_currencies`). Welcome already promises "you can change this later". | AG-1 |
| M4 | Currencies in every screen: wallet currency on Add wallet (only when the family has 2), amount symbol from the wallet in the entry sheet, "You received" field on a transfer between currencies, currency switch on Home and Reports, `currency` column in CSV, mock data with a second currency, report helpers filtered by currency + tests | AG-2 |
| M0b | Phone cache per person (`fa-live-<userId>`), deleted on sign out (part of B3) | AG-1 |
| M5 | `/privacy` page (en + ar), delete family (admin, typed confirmation, hard delete after 30 days), 100 MB receipt quota per family, weekly usage email at 70% of a free-tier limit | AG-2 |
| M6 | Family name in the Home header, link to `/operator` for Tamim, copy and quick `/design-review` of all new screens | AG-1 |
| 🚦 | Second family only after: multi-family smoke test PASS on production, Injy's family using it 2+ weeks, privacy page live | human |

## 6. Privacy rules (add to AGENTS.md §3 when approved)
1. Every new table has `household_id` and the same three RLS policies.
2. Service-role Edge Functions filter by the caller's household on every query and never reveal another family's data (not even whether an email belongs to it).
3. `/operator` and function logs show counts only, never amounts, notes, categories or photos.
4. Tamim runs the database, so he can technically read every family's data. Say so on the privacy page.
5. `multi_family_smoke_test.sql` must pass after every migration.

## 7. Free-tier limits

| Supabase free limit | Per family | When it matters |
|---|---|---|
| Database 500 MB | ~2 MB/year | 100+ families |
| Storage 1 GB (receipt photos) | ~150 MB/year with a photo every day | **~6 families/year: hits first** |
| Monthly active users 50,000 | 2–5 | never |

## 8. Later (not needed while testing)
- Email invites and "Forgot password?" links: Resend (free, 100/day) as Supabase custom SMTP, needs a domain.
- Per-family backups (today: one encrypted dump of everything).

## 9. Docs to update when this is approved
- PLAN.md: Auth (email, invite-only), Sharing (many families), remove "Not planned: multi-currency", handover step 5.
- AGENTS.md §3: rules in §6; delete-family exception to "nothing is hard-deleted" (M5).
- DESIGN.md: currency pickers, cross-currency transfer field, currency switch, `/operator`.
- HANDOVER.md: `OPERATOR_EMAILS`, `/operator`.
