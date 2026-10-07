# Multi-family plan — one app, many households

Decided 2026-10-07 · proposal for the orchestrator, not yet on the board (`docs/PROGRESS.md`).

## 1. Decisions

| Question | Decision |
|---|---|
| Shape | **One database and one app for every family** (multi-tenant). Each family is a household. |
| Who runs it | Tamim runs the service (Supabase, Vercel, GitHub) while testing. **Every family has its own family admin** (the household `owner`), who manages only that family. |
| Login | **Email + password.** The email is the username. No more `name@family.local` usernames. |
| Joining | **Invite only.** Tamim invites a family admin; the family admin invites their own members. Open sign-up stays off. |
| Cost | Free and non-commercial: Vercel Hobby + Supabase Free are allowed. |
| Currencies | Each family picks **1 or 2 currencies** (e.g. EGP + USD). Every wallet holds one currency. No automatic exchange rates. |

## 2. What already works

Every table has `household_id`. RLS (`is_member()`) and composite foreign keys keep each family's
rows apart, and `create_household` seeds each new family its own categories and a Cash wallet.
Phase B hasn't put real logins in place yet (B2 not merged), so moving from usernames to email logins
needs **no migration of existing users**.

## 3. What changes

| # | Today | Change | Where |
|---|---|---|---|
| 1 | Username → `name@family.local` | Real email is the login | `lib/auth/username.ts` (remove), Login, Welcome, Settings → Family, `family-admin` |
| 2 | Tamim creates the first login by hand in the dashboard | Tamim sends an invite email; the admin opens it and sets a password | new `invite-family` edge function |
| 3 | Admin types a username + temporary password for each member | Admin types the member's email; the member gets an invite email | `family-admin` `add_member` → `invite_member` |
| 4 | Forgotten password = dashboard only | "Forgot password?" on Login sends a reset email | Login + new `/reset-password` page |
| 5 | One phone cache `fa-live` | `fa-live-<userId>`, deleted on sign out | `lib/offline/db.ts` |
| 6 | EGP hard-coded in 6 places | Currency comes from the wallet | `lib/format` + 5 components |
| 7 | No cross-family test | Smoke test with two households | `supabase/tests/` |
| 8 | `listUsers({ perPage: 1000 })` scan | Gone (Supabase returns "already registered" itself) | `family-admin` |

## 4. Login and invites

**Emails need a real mail sender.** Supabase's built-in mail is for testing only (a handful of
emails per hour). Set up **custom SMTP with Resend** (free: 3,000 emails/month, 100/day) under
Supabase → Authentication → SMTP, with a sender like `no-reply@<domain>`. Without a domain,
Resend can only send to your own address, so **a domain is required** (or use a Gmail
app password as SMTP for testing; Gmail allows ~500/day). Email templates (invite, reset password)
in English + Arabic, in one email.

**Flow 1 — new family (Tamim → family admin)**
1. Tamim opens `/operator` (only his email, listed in a server-side env var) → *Invite a family* → types the admin's email.
2. `invite-family` calls `auth.admin.inviteUserByEmail(email, { data: { role: 'family_admin' }, redirectTo: '/welcome' })`.
3. The admin taps the link in the email → chooses a password → Welcome: family name, own name, currencies (§5) → `create_household`.
4. `create_household` only works for a user invited as `family_admin` (checked from `auth.users.raw_app_meta_data`, set by the function, not by the user).

**Flow 2 — family member (admin → member)**
1. Settings → Family → *Add someone* → name + email.
2. `family-admin` `invite_member` invites the email and adds a `household_members` row (`member`).
3. The member taps the link → chooses a password → goes straight to Home.

**Parents without email:** the admin can still use an email the family controls (e.g. the
admin's own Gmail with `+mama`: `injy+mama@gmail.com`). The invite and any reset email then go to the
admin, who sets things up on the parent's phone. Show this as a hint under the email field.

**Rules**
- One person = one email = one family (`create_household` and `invite_member` refuse an email already in a family).
- The admin can: invite, remove (as now: ban the login, keep their entries), hand over the admin role, resend an invite.
- Supabase Auth settings: sign-up **off**, email confirmation on, invite link valid 24 h, sessions never expire (unchanged).
- `must_change_password` is no longer needed (people choose their own password from the invite).

## 5. Two currencies per family

**Model.** `households.currencies text[]` with 1–2 ISO codes (first = main). Each wallet has
`currency`. An entry has no currency of its own: it uses its wallet's. Totals are **never added
across currencies**.

| Area | Behaviour |
|---|---|
| Welcome / Settings | Pick the main currency (default EGP) and optionally a second one from a short list: EGP, USD, EUR, GBP, SAR, AED, KWD, QAR. A currency can be added later. It can only be removed if no wallet uses it. |
| Wallets | Add wallet asks for the currency only when the family has 2. Can't change once the wallet has entries. |
| Entry sheet | Amount shows the selected wallet's currency symbol. Nothing else changes. |
| Transfer between wallets of different currencies | A second amount field appears: "You received" (e.g. 100 USD → 5,000 EGP). Stored as `to_amount`. No exchange-rate service. |
| Home / Reports | Main currency by default. If the family has 2, a small two-option switch (EGP · USD) at the top. Each currency's numbers are shown on their own. |
| Breakdown / CSV | A `currency` column; pivots are filtered to one currency at a time. |

**Schema (in `0009`)**
- `households.currencies text[] not null default '{EGP}'`, check 1–2 items, each in the allowed list.
- `accounts.currency char(3) not null default 'EGP'`, with a trigger that checks it's in the household's list and can't change once the wallet has entries.
- `transactions.to_amount numeric(14,2)`: required when a transfer goes between wallets of different currencies, otherwise null.
- `v_account_balances` uses `to_amount` for incoming cross-currency transfers. The monthly views gain a `currency` column (from the wallet).
- `households.currency` (single) stays for compatibility and = `currencies[1]`.

**Code**
- `money(amount, locale, currency)`; `currencySymbol(code, locale)` with Arabic symbols (ج.م, $, €, £, ر.س, د.إ, د.ك, ر.ق). Western digits as always.
- Report helpers (`lib/reports/*`) take a `currency` filter. Tests: mixed-currency data never sums across currencies.
- This replaces "Not planned: multi-currency" in PLAN.md.

## 6. Database (`0009_multi_family.sql`)
- Currency columns and checks from §5.
- `create_household(p_name, p_display_name, p_locale, p_currencies)`, allowed only for invited family admins.
- `households.status` (`active` · `suspended`); `is_member()` also requires `active`, so Tamim can lock a family out from the database.
- **Cross-family smoke test** `supabase/tests/multi_family_smoke_test.sql`: two households. As a member of A, try to select, insert and update every table, view, RPC and the storage path of B. Every line must say PASS. It must pass on production before a second family is invited.
- Run `get_advisors`, regenerate types.

## 7. Privacy and data (kept small while testing)
- **Be honest with the families:** Tamim runs the database, so technically he can see every family's data. Say so on a short `/privacy` page (en + ar) and in the invite email. This replaces the "Tamim has no data access" plan in PLAN.md for the multi-family version.
- `/operator` and the edge-function logs show **counts only** (families, members, last activity, storage used), never amounts, notes or names of categories.
- Family admin can **export** the family's data (existing CSV) and **delete the family** (typed confirmation, then hard-delete after 30 days). This is the one allowed exception to "nothing is hard-deleted"; add it to AGENTS.md.
- Backups stay one encrypted weekly dump (enough while testing).

## 8. Free-tier limits

| Supabase free limit | Per family | When it matters |
|---|---|---|
| Database 500 MB | ~2 MB/year | 100+ families |
| Storage 1 GB (receipt photos) | ~150 MB/year if a photo every day | **~6 families/year: hits first** |
| Emails via Resend | a few per family | 100/day, fine |
| Monthly active users 50,000 | 2–5 | never |

Actions: compress receipts to ≤ 100 KB, a 100 MB storage quota per family (storage policy +
a friendly message), and a weekly check in the keep-alive job that emails Tamim at 70% of any limit.

## 9. Steps

Phase B (Injy's family on real data) **still finishes first**. Steps M0 change B2/B3 work before it's built, so nothing is done twice.

| Step | What | Needs first | Owner |
|---|---|---|---|
| M0a | **Email login instead of usernames** in B2: Login with email, Forgot password, `/reset-password`, invite-based Settings → Family | folded into B2 | AG-1 |
| M0b | Phone cache per user, cleared on sign out | folded into B3 | AG-1 |
| M1 | `0009_multi_family.sql` (currencies, status, admin-only `create_household`) + cross-family smoke test + advisors + types; Resend SMTP + bilingual email templates | B1 | Claude (owns Supabase) |
| M2 | `invite-family` function + `/operator` page (invite, list counts, suspend) | M1 | AG-2 |
| M3 | Welcome with currency choice; `family-admin` → `invite_member`, resend, remove, hand over | M1, M0a | AG-1 |
| M4 | Two currencies in the app: `money()` with currency, wallet currency, cross-currency transfer, currency switch on Home/Reports, CSV column, tests | M1 | AG-2 |
| M5 | Privacy page, delete family, storage quota, limit alerts | M1 | AG-2 |
| M6 | Family name in the Home header, copy review, quick `/design-review` on Login, Welcome, Settings → Family, entry sheet (transfer), Reports | M3, M4 | AG-1 |
| 🚦 | Invite the 2nd family only after: cross-family test PASS on production, Injy's family using it 2+ weeks, privacy page live | all | human |

## 10. Docs to update when this is approved
- PLAN.md: Auth row (email + invites), Sharing row (many households), "Not planned: multi-currency" removed, Handover section (Tamim runs the service).
- AGENTS.md §3: delete-family exception to rule 6; "every new table has `household_id` + the three RLS policies"; "service-role functions filter by the caller's household on every query".
- DESIGN.md: currency switch, cross-currency transfer field, Forgot password, invite screens.
- HANDOVER.md: Resend account and domain, Supabase SMTP settings, `/operator`.
