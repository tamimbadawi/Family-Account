# Progress

**Edited only by the orchestrator (Claude Code).** Builders find their assignment here and report in their PR.
How the agents share the work: [`docs/ORCHESTRATION.md`](ORCHESTRATION.md).

Production URL: https://family-account-sigma.vercel.app (Vercel project `family-account`, team ASA_Contracting; every branch push gets a preview)

Status legend: ⏳ assigned · 🔍 in review · ✅ merged

## Phase A — Interface on sample data

### AG-1 queue · account-one, folder `C:\Dev\family-accounts\ag1`, port 3001

| # | Step | Workflow | Needs merged first | Branch | Status |
|---|---|---|---|---|---|
| 1 | A0 | `/a0-scaffold` — Next.js 16 + next-intl scaffold | — | `step/a0-scaffold` | ✅ |
| 2 | A1 | `/a1-design-system` — fonts, tokens, restyled shadcn/ui, format helpers, styleguide | A0 | `step/a1-design-system` | ✅ |
| 3 | A2b | `/a2b-shell-home` — tab bar shell, sync dot, Home | A1, **A2a** | `step/a2b-shell-home` | ✅ |
| 4 | A3a | `/a3a-entry-parts` — amount pad, type toggle, category picker, wallet/date parts | A1, **A2a** | `step/a3a-entry-parts` | ✅ |
| 5 | A3b | `/a3b-entry-sheet` — assemble the Add/Edit entry sheet ⭐ | A2b, A3a | `step/a3b-entry-sheet` | ✅ |
| 6 | A4 | `/a4-history` — History, edit, soft delete, Recently deleted | A3b | `step/a4-history` | ✅ |
| 7 | A6 | `/a6-settings-categories` — Settings, category & wallet managers, language | A2b | `step/a6-settings` | ✅ |
| 6 | A8a | `/a8-polish-pass` on what is merged: Login, Home, Add sheet, History, Settings | A4, A6, A7b | `step/a8a-polish` |  |
| + | A3d | `/a3d-calculator-pad` — + − × ÷ in the number pad with live result | fix/fit-and-income | `step/a3d-calculator` |  |
| + | Home money | Place `OurMoneyRow` (from A2c) on Home, keeping Home within one screen | **A2c** | `step/home-our-money` |  |
| + | A5e | `/a5c-report-library` part A5e: 6 Planning reports | **A5c** | `step/a5e-planning-reports` |  |
| 7 | A3c | `/a3c-receipt-photo` — optional receipt photo on an entry (camera, compression, thumbnail, viewer) | A3b, A4 | `step/a3c-receipt-photo` |  |
| 8 | A8b | `/a8-polish-pass` on Reports (Overview + Breakdown) and a last full sweep | **A5, A5b** | `step/a8b-polish` |  |

### AG-2 queue · account-two, folder `C:\Dev\family-accounts\ag2`, port 3002

| # | Step | Workflow | Needs merged first | Branch | Status |
|---|---|---|---|---|---|
| 1 | A7-icon | app icon (final: `design/icon.png`) | — | `step/a7-icon` | ✅ |
| 2 | A2a | `/a2a-data-layer` — types, repository, Dexie mock + sample data, hooks | A0 | `step/a2a-data-layer` | ✅ |
| 3 | A5b-logic | `/a5b-pivot-logic` — pure pivot engine + presets + CSV, with tests | A2a | `step/a5b-pivot-logic` | ✅ |
| 4 | A7a | `/a7a-pwa-plumbing` — service worker, manifest, icons and splash from `design/icon.png`, offline page | A0 | `step/a7a-pwa` | ✅ |
| 5 | A7b | `/a7b-login-install` — Login, Welcome and Install screens | **A1**, A7a | `step/a7b-login-install` | ✅ |
| 6 | A5 | `/a5-reports-overview` — Reports overview, donut, drill-down, trends | **A2b** | `step/a5-reports` | ✅ |
| 7 | A5b | `/a5b-breakdown-ui` — Breakdown tab: pivot table, chips, presets, share | A5, A5b-logic | `step/a5b-breakdown-ui` |  |
| + | A5c | `/a5c-report-library` part A5c: Reports hub (Overview · All reports · Breakdown) + 6 Money-flow reports | A5b | `step/a5c-report-hub` |  |
| + | A2c | `/a2c-wallets` — Cash at home + 3 banks in sample data, Our money sheet, Update balance | A5b | `step/a2c-wallets` |  |
| + | A5d | `/a5c-report-library` part A5d: 5 Banks & cash reports | A5c, A2c | `step/a5d-wallet-reports` |  |

**Bold** = owned by the other agent (the only reason you might have to wait).

### 🚦 Gate: Family approval (human step)
- [ ] Installed on both iPhones from the **production URL** (not a preview link: those require a Vercel login, and an installed app is tied to its address)
- [ ] Each logged 3 real expenses with no help (these are practice entries in sample mode and will not carry over)
- [ ] Both are happy with how it looks

#### Family test notes
_(write what you observed here: every hesitation, question, or complaint)_

| Step | Workflow | Owner | Branch | Status |
|---|---|---|---|---|
| A9 | `/a9-family-fixes` — fixes from the notes above | AG-1 | `step/a9-family-fixes` | |

- [ ] **Family approval confirmed** — only now may Phase B begin

## Phase B — Real data

| Step | Workflow | Owner | Branch | Status |
|---|---|---|---|---|
| B1 | `/b1-database` — migrations, smoke test, advisors, types | AG-1 | `step/b1-database` | ✅ |
| B2 | `/b2-auth` — Supabase auth, proxy, welcome, family | AG-1 | `step/b2-auth` | |
| B5 | `/b5-keepalive-backups` — keep-alive, backups, CSV | AG-2 | `step/b5-keepalive` | |
| B3 | `/b3-live-sync` — live repository + offline sync | AG-1 | `step/b3-live-sync` | |
| B4 | `/b4-reports-live` — reports on server views | AG-2 | `step/b4-reports-live` | |
| B6 | `/b6-handover` — final QA + handover docs | AG-1 | `step/b6-handover` | |

## Log
| Date | Step | Notes |
|---|---|---|
| 2026-10-05 | Setup | Repo created with plan, rules, workflows, schema (smoke-tested locally: 13/13 PASS) |
| 2026-10-06 | Setup | English default, Western digits, messages split per namespace, kind guards in schema, orchestration (2 Antigravity builders + Claude orchestrator) |
| 2026-10-06 | A7-icon | Final icon `design/icon.png` (1024, house + wallet, made in Gemini, chosen by the user). Login logo = same icon with rounded corners. |
| 2026-10-06 | A0 | AG-1: Next.js 16.3 + next-intl 4 (en default, ar RTL), proxy.ts, per-namespace messages, vitest (PR #2) |
| 2026-10-06 | A2a | AG-2: types, Repository, Dexie `fa-mock`/`fa-live`, seed of ~120 entries, hooks, 27 tests (PR #3). Follow-up for B3: drop duplicate `getWalletBalances`/`walletBalances`; `getDbName()` must not depend on `typeof process` in the browser |
| 2026-10-06 | A5b-logic | AG-2: pure `pivot()`, 5 presets, `pivotToCsv()` with tests (PR #4) |
| 2026-10-06 | A7a | AG-2: Serwist (Turbopack) service worker, manifest, icons + iOS splash from `design/icon.png`, `/~offline` (PR #7) |
| 2026-10-06 | A1, A2b, A3a, A3b | AG-1: design system + styleguide, shell/tab bar/Home, entry parts, Add/Edit sheet. Merged together on the user's "speed up" (look-and-feel review moves to one combined preview). Known: Home crashes on a fresh device until AG-2's seed fix lands |
| 2026-10-06 | B1 (early) | Claude: Supabase project `family-accounts` (ref zzbbniffrdigluisvxxb, eu-west-1). Applied 0001, 0002 (pg_cron purge), new 0003 (advisor fixes: lock rls_auto_enable, FK indexes). RLS smoke test 15/15 PASS. Types in src/lib/supabase/database.types.ts. App stays on mock data until the family gate. ABRD_Website paused to free the free-plan slot |
| 2026-10-06 | fix, A7b, A4, A6 | AG-2: seed moved out of liveQuery (first-launch crash fixed, PR #10); A7b Login/Welcome/Install (PR #11). AG-1: A4 History + Recently deleted (PR #12); A6 Settings, category/wallet managers, language, export (PR #13). CI RTL check fixed on main (dialog/drawer) |
| 2026-10-06 | 0004 | Claude: receipt photos: `transactions.photo_path`, private bucket `receipts` (2 MB, jpeg/webp), household-folder storage policies; photo smoke test 4/4 PASS; types updated. A3c queued for AG-1 |
| 2026-10-06 | A5 | AG-2: Reports Overview as two swipe pages (totals, donut, top 4 + See all drill-down; 6-month trends + wallet balances), recharts (PR #14). Screenshots removed from repo (now gitignored); kept main's dialog/drawer RTL fix |
| 2026-10-06 | A5 fix | AG-2: Reports readable sizes (body text 17px: 22 body vs 13 caption uses, was 5 vs 20), top 3 + See all, donut shrinks instead of text (PR #15) |
| 2026-10-06 | 0005 | Claude: new households get "Cash at home" + Adjustments/Balance correction items (seed_corrections); smoke test 2/2 PASS. Queued A3d calculator (AG-1), A2c wallets (AG-2), Home money row (AG-1) |
| 2026-10-06 | Reports library | User wants all reports as a library: 17 reports in 3 groups (A5c hub + money flow, A5d banks & cash: AG-2; A5e planning: AG-1). Reports bank card opens Our money sheet |
| 2026-10-06 | Handover plan | Owner = Injy (her Gmail). Tamim stays as emergency maintainer with NO data access: Supabase transferred to her org, repo transferred (Tamim collaborator), production environment needs her approval, backups encrypted with her passphrase. Family management in-app (B2 edge function), forced password change on first sign-in |
