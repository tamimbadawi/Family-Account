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
| 8 | A5e screens | `/a5c-report-library` part A5e: 6 Planning report screens on the merged logic (`src/lib/reports/planning.ts`), same pattern as A5c | A5c ✅ | `step/a5e-planning-reports` | ✅ |
| 9 | A8a | `/a8-polish-pass` on what is merged: Login, Home, Add sheet, History, Settings | **A3d, A3c (Claude)** | `step/a8a-polish` | ✅ |
| 8 | A8b | `/a8-polish-pass` on Reports (Overview + Breakdown) and a last full sweep | **A5, A5b** | `step/a8b-polish` | ✅ |

### AG-2 queue · account-two, folder `C:\Dev\family-accounts\ag2`, port 3002

| # | Step | Workflow | Needs merged first | Branch | Status |
|---|---|---|---|---|---|
| 1 | A7-icon | app icon (final: `design/icon.png`) | — | `step/a7-icon` | ✅ |
| 2 | A2a | `/a2a-data-layer` — types, repository, Dexie mock + sample data, hooks | A0 | `step/a2a-data-layer` | ✅ |
| 3 | A5b-logic | `/a5b-pivot-logic` — pure pivot engine + presets + CSV, with tests | A2a | `step/a5b-pivot-logic` | ✅ |
| 4 | A7a | `/a7a-pwa-plumbing` — service worker, manifest, icons and splash from `design/icon.png`, offline page | A0 | `step/a7a-pwa` | ✅ |
| 5 | A7b | `/a7b-login-install` — Login, Welcome and Install screens | **A1**, A7a | `step/a7b-login-install` | ✅ |
| 6 | A5 | `/a5-reports-overview` — Reports overview, donut, drill-down, trends | **A2b** | `step/a5-reports` | ✅ |
| 7 | A5b | `/a5b-breakdown-ui` — Breakdown tab: pivot table, chips, presets, share | A5, A5b-logic | `step/a5b-breakdown-ui` | ✅ |
| 8 | A5c | `/a5c-report-library` part A5c: Reports hub (Overview · All reports · Breakdown) + 6 Money-flow reports | A5b | `step/a5c-report-hub` | ✅ |
| 9 | Reports flows | ui:flows tests for the Reports hub, library and sheets | A5c ✅ | `test/reports-flows` | ✅ |
| 10 | A2c | `/a2c-wallets` PR 1: data layer (Cash + 3 banks, Balance correction, adjustWalletBalance, seed v2) | A5b | `step/a2c-wallets` | ✅ |
| 10b | A2c UI | PR 2: Our money sheet + OurMoneyRow, Update balance / Add wallet in Settings (not on Home, not the entry sheet) | A2c ✅ | `step/a2c-wallets-ui` | ✅ |
| 11 | A5d | `/a5c-report-library` part A5d: 5 Banks & cash reports | A5c, A2c | `step/a5d-wallet-reports` | ✅ |

| 12 | Home money | Place `OurMoneyRow` (from A2c) on Home, keeping Home within one screen | A2c | `step/home-our-money` | ✅ |

### Claude builder queue · folder `C:/Dev/family-accounts/cl`

Owns `src/components/entry/**` until A3c is merged (nobody else edits the entry sheet).

| # | Step | Workflow | Needs merged first | Branch | Status |
|---|---|---|---|---|---|
| 1 | A3d + save fix | calculator pad + one popup + wallet preselected once wallets load (Save works for income/expense) | — | `step/a3d-calculator` | ✅ |
| 2 | A3c | `/a3c-receipt-photo` — optional receipt photo on an entry | A3d | `step/a3c-receipt-photo` | ✅ |

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

### Before B3 (from the 2026-10-06 plan review) · must be closed before real data
| # | Item | Where | Status |
|---|---|---|---|
| P1 | Balance corrections: compute the correction from the server balance at save time, never the phone's copy (simple now that saves are online-only) | B3 | |
| P2 | Receipt photos: upload first, then save the entry with `photo_path`; a failed upload fails the save (no upload queue — saves are online-only) | B3 | |
| P3 | Orphan receipts: the 30-day purge hard-deletes entries but not their Storage files. Add cleanup through the Storage API (scheduled edge function or the backup workflow), since SQL cannot delete Storage objects | B5 | |
| P4 | `remove_member` RPC (owner only) + smoke test: removed member reads/writes nothing and sees no receipts; their entries stay | `0006` written, **apply in B2** | 🔍 |
| P5 | Backups encrypted with `BACKUP_PASSPHRASE`; job fails rather than upload plain SQL | `backup.yml` | ✅ |
| P6 | Money: add a test that client report totals equal the server views (`v_monthly_summary`, `v_account_balances`) to the piaster on the same data | B4 | |
| P7 | Dates: `localISODate()` in `lib/format`; never `toISOString().slice(0,10)` | fixed in balance corrections + export names | ✅ |

### B3 definition of done · two real phones
Saves are online-only (decided 2026-10-07; replaces the offline-sync checklist). B3 is not done until each passes on two iPhones against the production project:
1. Phone A adds 3 entries and edits one → each is in Supabase exactly once; Phone B shows them after open/focus.
2. Same entry edited on both phones → the later save wins, no duplicate, no crash.
3. Airplane mode → Save shows "No connection — try again", the typed entry stays in the sheet, nothing is written; reconnect → Save works.
4. Category and wallet created and used at once → no FK error.
5. Receipt added → shown on both phones; receipt replaced → new photo on both.
6. Fresh install / new phone → full household downloads.
7. Balance correction → correct final balance on both phones (see P1).

### After launch (not before)
Quick-repeat and favourite entries · smart category suggestion from the note · recurring expenses · monthly budgets ·
savings goals. Not planned: AI, notifications, bank feeds, investments, multi-currency.


| Step | Workflow | Owner | Branch | Status |
|---|---|---|---|---|
| B1 | `/b1-database` — migrations, smoke test, advisors, types | AG-1 | `step/b1-database` | ✅ |
| B2 | `/b2-auth` — Supabase auth, proxy, welcome, family | AG-1 | `step/b2-auth` | |
| B5 | `/b5-keepalive-backups` — keep-alive, backups, CSV | AG-2 | `step/b5-keepalive` | |
| B3 | `/b3-live-sync` — live repository, online-only saves | Claude | `ccr-719c3adc-klawge` (PR #70) | 🔍 |
| B4 | `/b4-reports-live` — reports on server views | AG-2 | `step/b4-reports-live` | |
| B6 | `/b6-handover` — final QA + launch docs (no ownership transfer, see PLAN.md "Ownership") | AG-1 | `step/b6-handover` | |

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
| 2026-10-06 | A5b | AG-2: Breakdown pivot table, presets, drill-down, sharing (PR #17). Gate: ui:check 24/24 ok on the preview. Follow-up: period chip clipped by the filter button. Reverted AG-2 loosening of ui-check (covered check inside scroll areas) |
| 2026-10-06 | Speed-up | User: Claude builds too; agents on Gemini 3.8 Flash Medium. Claude owns: + New form fix, A3d calculator, A5e planning reports. A5e logic merged (6 functions, 12 tests). AG-1 ships fix PR 1 then A8a |
| 2026-10-06 | fix PR 1 | AG-1: screens fit (ui:check 66/66 ok on preview). ui:flows found: no wallet preselected so Save stays disabled (income/expense cannot be saved), new-group overlay stays on top. Sent back to AG-1 |
| 2026-10-06 | Untangle | A5c merged (AG-2). Three chats were editing the entry sheet: the wallet-preselect fix now goes only into A3d (Claude builder), and AG-1's fix/save-flows is dropped. A5e screens move to AG-1; Home money row moves to AG-2 (it needs A2c); A3c moves to the Claude builder (entry owner) |
| 2026-10-06 | Reports flows | AG-2: ui:flows reports_tabs/library/sheets (en+ar, 3 sizes) + fixes: library links keep the locale, ?tab= read via useSearchParams. Merged with orchestrator lint fix (setState in effect -> derive during render). Gate on local main: reports flows 18/18, ui:check 42/42, build ok. Remaining ui:flows failures are the known entry-sheet ones (A3d). Follow-up: reports_sheets skips silently when a button is missing; biggest-expenses step looks for the wrong label |
| 2026-10-06 | A2c PR 1 | AG-2 was stuck 40 min (installed eslint-plugin-react, hunted a non-existent SEED_VERSION); re-prompted with A2c split in 2 PRs. PR 1 merged with orchestrator fixes: no hard-coded Arabic note on corrections, no silent fallback to a random item, test conflict with A3c resolved, cash wallet named Cash/كاش ("Cash at home" truncated History/Home rows). Gate on local main: ui:check 42/42, ui:flows 40/40 (income/expense save now pass), build ok, 129 tests |
| 2026-10-06 | Plan review | Claude: reviewed the external roadmap against the repo; most of it was already in PLAN.md. Added "Before B3" items P1–P7 and the two-phone B3 definition of done above. Fixed UTC date in balance corrections (`localISODate`), README rewritten (was "no app code yet"), backups now gpg-encrypted, `0006_remove_member` + smoke test written (not yet applied). Rejected from the review: versioned conflicts (LWW is enough for 3 people), 100k-row load tests, monitoring/notification phases, a separate ROADMAP.md |
| 2026-10-07 | Plan | Claude: offline saving dropped at the user's request — everyone using the app is online. B3 is now online-only writes + a Dexie read cache (no outbox, sync queue or "Needs attention"); P1, P2 and the B3 definition of done simplified; PLAN, AGENTS, rule 03, DESIGN, README and the B3/B4/B6 workflows updated |
| 2026-10-07 | A5e | AG-1: 6 Planning report screens + reports_planning flow. Merged with orchestrator fixes: 11px label -> caption token; sample entries never stamped after now (bank flow failed at 375x667 on production: a seeded noon entry sorted above a just-saved one), seed v3 so phones reseed. Gate on local main: ui:check 42/42, ui:flows 46/46, build ok, 139 tests. AG-1 -> A8a, AG-2 -> A5d while I review |
| 2026-10-07 | A2c UI | AG-2: Our money sheet, Update balance, Add wallet, History wallet filter + flows. Merged with orchestrator fixes: flows conflict with A5e resolved (both kept), History wallet chip is one 48px button with a translated label, our_money flow uses Cash/كاش, cash opening 12,000 (sample Cash showed -450), seed v4. Gate on local main: ui:check 42/42, ui:flows 58/58, build ok, 139 tests. AG-2 -> A5d |
| 2026-10-07 | A8a, #32, #35 | Claude: merged A8a polish (AG-1, #34), + New opens the full Settings category form (#32, Claude builder) and the early-month seed date fix (#35). Each checked on main + PR first (145 tests, typecheck, RTL) and confirmed on production: ui:check 24/24, ui:flows bank/income/expense/date/newcategory all ok. AG-1 -> A8b |
| 2026-10-07 | Phase A done | Claude: merged Home money row (#38, AG-2), A5d 5 Banks & cash reports (#37, AG-2; flows conflict resolved, kept main's fixed wallet flows + reports_wallets) and A8b Reports polish (#41, AG-1). Each gated on main+PR first (151 tests, typecheck, RTL, ui:flows, ui:check) and confirmed on production. All Phase A steps merged; next is the Family approval gate. AG-1 and AG-2 idle until the family test notes |
| 2026-10-07 | PR #65 | AG-1: feat(entry): main category and group displayed as breadcrumb beside amount |
| 2026-10-07 | Ownership | User: no transfer of code or data. App runs on Tamim's Supabase/Vercel/GitHub as operator, with standard encryption (at rest + TLS, RLS between families, gpg backups). Replaces the 2026-10-06 handover plan; PLAN.md "Ownership" section rewritten |
| 2026-10-07 | 0010, 0011 | Claude: applied 0010 budgets (smoke 9/9) and 0011 security advisors on production: create_household closed, keepalive anon-only, heartbeat deny-all policy, set_household_currencies refuses suspended families. Smoke on production: RLS 15/15, receipts 4/4, remove_member 7/7, multi-family 40/40. Advisors: 5 accepted WARNs (is_member, create_family, remove_member, set_household_currencies, keepalive for anon) + leaked-password protection (dashboard, paid plans). Types regenerated |
| 2026-10-07 | B3 | Claude: LiveRepository (saves upsert to Supabase first, Dexie fa-live is a read copy), pull-only sync with server-time cursors, OfflineError + "No connection — try again" toast on every save, P1 (correction from v_account_balances) and P2 (upload receipt first) done, one id per new entry so retries never duplicate, sign-out clears the copy. 226 tests, build ok. Not yet tried on phones: needs NEXT_PUBLIC_DATA_MODE=live on a preview, then the 7 two-phone checks |
