# Multi-family plan — one app, many households

Draft 2026-10-07 · proposal for the orchestrator, not yet on the board (`docs/PROGRESS.md`).

## 1. Where we stand

The database already supports more than one family. Every table carries `household_id`, every row is
protected by RLS through `is_member()`, and composite foreign keys stop an entry from pointing at
another household's wallet or item. `create_household` seeds each new family its own categories and a
Cash wallet.

What still assumes **one** family:

| # | Assumption | Where | Why it breaks with two families |
|---|---|---|---|
| 1 | Usernames are global: `mama` → `mama@family.local` | `src/lib/auth/username.ts`, `supabase/functions/family-admin` | Two families can't both have a "mama" or "baba". The "taken" error tells family B a name exists in family A. |
| 2 | Only the maintainer can create a family's first login (Supabase dashboard, by hand) | PLAN.md "Handover", step 5 | Every new family needs Tamim, and Tamim is meant to have no access after handover. |
| 3 | The service has one owner: Injy owns Supabase, Vercel, GitHub and the backup passphrase | PLAN.md "Handover to Injy" | With several families on one database, Injy would hold everyone's finances. |
| 4 | One cache name on the phone: `fa-live` | `src/lib/offline/db.ts` `getDbName()` | If a different person signs in on the same phone, they briefly see the previous family's cached data. |
| 5 | Currency is hard-coded EGP in 6 places | `lib/format`, `AmountDisplay`, `CategoryDonut`, `IncomeSourcesView`, wallets page | Fine for Egyptian families only. `households.currency` already exists. |
| 6 | `listUsers({ perPage: 1000 })` scans all logins | `family-admin` `add_member` | Gets slower and eventually wrong past 1,000 users. |
| 7 | No test proves family A can't read family B | `supabase/tests/rls_smoke_test.sql` covers one household | The main promise of multi-family has no test. |
| 8 | Backups are one encrypted dump of the whole database | `backup.yml` | One family can't get back only its own data, and whoever holds the passphrase can read every family. |

## 2. The decision to make first: one shared app, or one copy per family?

| | **A. Shared (multi-tenant)** — one Supabase + one Vercel, many households | **B. One copy per family** — each family gets its own Supabase + Vercel from this repo |
|---|---|---|
| Code changes | The phases below (about 2–3 builder days) | Almost none: a setup guide and a script |
| New family | Owner gets an invite and is using it in 2 minutes | ~30 min of setup per family (accounts, keys, migrations, deploy) |
| Who can see the data | Whoever owns the Supabase project sees **all** families | Each family owns its own database. Same privacy model as Injy today |
| Updates | Push once, every family updated | Each copy has to be redeployed (or stays on its old version) |
| Free tier | Shared: 500 MB DB, **1 GB receipt photos**, 2 projects | Each family has its own free limits |
| Pausing | Never: daily use by many families keeps it awake | Each copy needs its own keep-alive |
| Best for | Friends and relatives who trust **you** with their numbers, or a future product | A few families who each want full ownership, like Injy |

**Recommendation: A (shared), run by a neutral operator account, with Injy's family as household #1.**
B doesn't scale past a handful of families and turns every fix into N deployments. A works if the
operator is trusted and Section 4 (privacy) is followed. If the families don't want any one person
holding their data, choose B and skip to Section 7.

Questions to answer before Phase C starts:
1. Who is the operator: Tamim, Injy, or a new "app" Gmail? This changes the handover plan (Section 6).
2. How do new families get in: **invite-only** (recommended) or open sign-up?
3. Is it free, or will families pay? Vercel Hobby is for **non-commercial use only**, so charging money means Vercel Pro (~$20/mo).
4. Egypt-only (EGP), or other currencies too?

## 3. Phases

Phase B (one real family) **still finishes first**. Three small changes should go into B2/B3 now
because they cost nothing then and are painful to change once real logins exist:

### C0 — groundwork, folded into B2/B3 (no visible change)
- **Usernames scoped to a family.** Login email becomes `<username>@<family-code>.family.local`
  (for example `mama@badawi7.family.local`). `family-code` is a short code stored on
  `households.code` (unique, lower case, 4–12 characters, suggested from the family name).
  Injy's family keeps working because migration renames the existing users once.
- **Per-user phone cache.** `getDbName()` → `fa-live-<userId>`; Sign out deletes that database.
- **Currency from the household.** `money()` and the 5 hard-coded spots read `household.currency`
  (still EGP for everyone). Add `currencySymbol(code, locale)` to `lib/format`.

### C1 — database (migration `0009_multi_family.sql`)
- `households.code text unique not null` + backfill for existing rows.
- `households.status` (`active` · `suspended`) and `households.created_by_invite uuid`.
- Table `family_invites (id, code_hash, created_at, expires_at, used_at, used_by_household)`.
  No policies: only the edge functions touch it.
- `create_household(p_name, p_display_name, p_locale, p_currency default 'EGP')` sets `code`.
- `is_member()` also requires `status = 'active'`, so a suspended family is locked out by the database.
- **Cross-family RLS test** `supabase/tests/multi_family_smoke_test.sql`: two households. As a member of A,
  select/insert/update every table, view and storage path of B. Every line must say PASS. This test
  must pass before any second family is invited.
- Run `get_advisors` and regenerate types.

### C2 — logins and onboarding
- **Login screen:** two fields stay two fields. *Family code* is remembered on the phone after the first
  sign-in and shown as a small line ("Badawi family · change"), so day-to-day it's still name +
  password. The rule of one primary action per screen still holds.
- **Invite link for a new family:** the operator creates one in an operator page (C4). The link
  `/{locale}/start?invite=…` opens a 3-step sheet: family name → your name and username → password.
  Edge function `start-family` checks the invite, creates the owner's login and calls `create_household`.
  The owner doesn't have to change a password they just chose themselves.
- **Adding members** (Settings → Family) works as it does now. Usernames only need to be unique *inside* the family.
  Remove the global `listUsers` scan: look up the one email directly.
- **Join link for a member** (optional, nice for parents): the owner taps "Invite by link" and the phone
  shows a QR or share link that pre-fills the family code on Login.
- Open sign-up stays **off** in Supabase Auth. Every family enters through an invite.

### C3 — privacy, data rights, recovery
- **Export my family's data:** the existing CSV export, plus a full JSON export (all tables + receipt
  photos as a zip) from Settings → Family (owner only).
- **Delete my family:** owner only, typed confirmation (the one place a confirm dialog is allowed,
  because it can't be undone). Waits 30 days, then hard-deletes the household, its logins and its
  storage folder. This is a deliberate exception to rule 6 and needs to be added to AGENTS.md.
- **Per-family backups:** the weekly job also writes one encrypted file per household
  (`pg_dump` filtered by `household_id` is awkward, so use a SQL export function per household).
  Restoring one family no longer means restoring everyone.
- **Owner forgot password:** today only the dashboard can fix it. Add a "co-owner" option (a second
  owner who can reset passwords), and an operator reset in C4 that checks identity outside the app
  (a phone call) before acting.
- A short privacy page (`/privacy`, both languages): who runs the service, what is stored, no
  trackers, how to export or delete.

### C4 — operator tools (minimal, no data access)
- Page `/operator` (only for logins listed in a server-side env var), served by an edge function
  that returns **counts only**: families, members per family, last activity date, storage used.
  It never returns entries, amounts or names of categories.
- Actions: create invite, suspend or unsuspend a family, reset an owner's password.
- Alerts: the existing advisor and keep-alive emails, plus a weekly check that warns at 70% of
  database size, storage, or MAU.

### C5 — limits and cost
| Limit (Supabase free) | Per family (estimate) | Families before it matters |
|---|---|---|
| Database 500 MB | ~2 MB/year of entries | 100+ families for years |
| Storage 1 GB | Receipts at ~150 KB: **~1,000 photos/year** if used daily | **~5–6 families/year**: this hits first |
| Monthly active users 50,000 | 2–5 | not a concern |
| Edge function calls 500k/month | small (admin actions only) | not a concern |

Actions: compress receipts harder (target ≤ 100 KB, already in `lib/photos/compress.ts`), add a
per-household storage quota (e.g. 100 MB) enforced in the storage policy, and plan the move to
Supabase Pro ($25/mo) at about 10 families. Rate-limit `start-family` and the login (Supabase does
login rate limiting by default).

### C6 — design and copy
- Household name in the Home header ("Badawi family") so a parent on a shared phone sees whose books are open.
- Family code on Settings → Family, with a Share button.
- Copy review for the new screens (Start, Family code, Export, Delete family) in `en` and `ar`.
- Quick `/design-review` on Login, Start, Settings → Family at 390×844, `/en` and `/ar` light.
- Seed categories: keep the Egyptian set. Add a per-currency or per-country template only if non-Egyptian families come.

## 4. Privacy rules for the shared model (add to AGENTS.md §3 when approved)
1. Every new table has `household_id` and the same three RLS policies. No exceptions.
2. Edge functions using the service-role key must filter by the caller's household on **every** query,
   and get a cross-family test.
3. The operator page and logs never contain amounts, notes, category names or photos.
4. Storage paths stay `receipts/<household_id>/…`, and the storage policy checks the first folder against `is_member()`.
5. The cross-family smoke test runs in CI on every migration PR.

## 5. Roadmap and assignment (suggested)

| Step | What | Needs first | Owner |
|---|---|---|---|
| C0 | Scoped usernames, per-user cache, currency from household | folded into **B2/B3** | AG-1 |
| C1 | `0009_multi_family.sql` + cross-family smoke test + advisors | B1 | Claude (owns Supabase) |
| C2 | Start-a-family flow, login with family code, `start-family` function, join link | C1, B2 | AG-1 |
| C3 | Export, delete family, per-family backups, co-owner, privacy page | C1 | AG-2 |
| C4 | Operator page and function (counts only) | C1 | AG-2 |
| C5 | Storage quota, receipt size, usage alerts | C1 | Claude |
| C6 | Household name on Home, copy, design review | C2 | AG-1 |
| 🚦 | Second family invited only after: cross-family test PASS on production, Injy's family running 2+ weeks without issues, privacy page live | all above | human |

## 6. Effect on the current handover plan
- **If Injy is the operator:** the handover stays as written. Injy also gets `/operator`, and
  holds the data of every family she invites. Families must know that.
- **If a neutral operator account runs it** (recommended): Supabase, Vercel and GitHub move to a
  dedicated "app" account instead of Injy's Gmail. Injy becomes owner of household #1 only, like
  any other family. The production-approval and encrypted-backup rules stay, with the operator as
  reviewer and passphrase holder.

## 7. If you choose B (one copy per family) instead
- Write `docs/NEW-FAMILY.md`: create Supabase project → apply migrations → deploy `family-admin` →
  create Vercel project from this repo with the 4 env vars → create the owner's login.
- A `scripts/new-family.sh` that applies migrations and sets env vars through the Supabase and Vercel CLIs.
- Still do C0's per-user cache and currency changes. Skip C1–C5.
- Updates: every family's Vercel project deploys from `main`, so a merge updates everyone, but each
  migration has to be applied once per project. That is the real cost of option B.
