# Progress

**Edited only by the orchestrator (Claude Code).** Builders find their assignment here and report in their PR.
How the agents share the work: [`docs/ORCHESTRATION.md`](ORCHESTRATION.md).

Production URL: _(filled in after A0 is merged)_

Status legend: ⏳ assigned · 🔍 in review · ✅ merged

## Phase A — Interface on sample data

### AG-1 queue · account-one, folder `C:\Dev\family-accounts\ag1`, port 3001

| # | Step | Workflow | Needs merged first | Branch | Status |
|---|---|---|---|---|---|
| 1 | A0 | `/a0-scaffold` — Next.js 16 + next-intl scaffold | — | `step/a0-scaffold` | ✅ |
| 2 | A1 | `/a1-design-system` — fonts, tokens, restyled shadcn/ui, format helpers, styleguide | A0 | `step/a1-design-system` |  |
| 3 | A2b | `/a2b-shell-home` — tab bar shell, sync dot, Home | A1, **A2a** | `step/a2b-shell-home` |  |
| 4 | A3a | `/a3a-entry-parts` — amount pad, type toggle, category picker, wallet/date parts | A1, **A2a** | `step/a3a-entry-parts` |  |
| 5 | A3b | `/a3b-entry-sheet` — assemble the Add/Edit entry sheet ⭐ | A2b, A3a | `step/a3b-entry-sheet` |  |
| 6 | A4 | `/a4-history` — History, edit, soft delete, Recently deleted | A3b | `step/a4-history` |  |
| 7 | A6 | `/a6-settings-categories` — Settings, category & wallet managers, language | A2b | `step/a6-settings` |  |
| 8 | A8 | `/a8-polish-pass` — full design QA | **all of Phase A** | `step/a8-polish` |  |

### AG-2 queue · account-two, folder `C:\Dev\family-accounts\ag2`, port 3002

| # | Step | Workflow | Needs merged first | Branch | Status |
|---|---|---|---|---|---|
| 1 | A7-icon | app icon (final: `design/icon.png`) | — | `step/a7-icon` | ✅ |
| 2 | A2a | `/a2a-data-layer` — types, repository, Dexie mock + sample data, hooks | A0 | `step/a2a-data-layer` | ✅ |
| 3 | A5b-logic | `/a5b-pivot-logic` — pure pivot engine + presets + CSV, with tests | A2a | `step/a5b-pivot-logic` | ✅ |
| 4 | A7 | `/a7-pwa-onboarding` — PWA, icons, splash, install guide, login/welcome visuals | **A1** | `step/a7-pwa` |  |
| 5 | A5 | `/a5-reports-overview` — Reports overview, donut, drill-down, trends | **A2b** | `step/a5-reports` |  |
| 6 | A5b | `/a5b-breakdown-ui` — Breakdown tab: pivot table, chips, presets, share | A5, A5b-logic | `step/a5b-breakdown-ui` |  |

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
| B1 | `/b1-database` — migrations, smoke test, advisors, types | AG-1 | `step/b1-database` | |
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
