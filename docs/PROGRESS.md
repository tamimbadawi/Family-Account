# Progress

**Edited only by the orchestrator (Claude Code).** Builders find their assignment here and report in their PR.
How the agents share the work: [`docs/ORCHESTRATION.md`](ORCHESTRATION.md).

Production URL: _(filled in after A0 is merged)_

Status legend: ⏳ assigned · 🔍 in review · ✅ merged

## Phase A — Interface on sample data

| Step | Workflow | Owner | Branch | Status |
|---|---|---|---|---|
| A0 | `/a0-scaffold` — Next.js 16 + next-intl scaffold, deployed to Vercel | AG-1 | `step/a0-scaffold` | ⏳ |
| A7-icon | app icon + logo SVG only (part of `/a7-pwa-onboarding` step 3) | AG-2 | `step/a7-icon` | ⏳ |
| A1 | `/a1-design-system` — fonts, tokens, restyled shadcn/ui, format helpers, styleguide | AG-1 | `step/a1-design-system` | |
| A2a | `/a2a-data-layer` — types, repository, Dexie mock + sample data, hooks | AG-2 | `step/a2a-data-layer` | |
| A2b | `/a2b-shell-home` — tab bar shell, sync dot, Home | AG-1 | `step/a2b-shell-home` | |
| A7 | `/a7-pwa-onboarding` — PWA, icons, splash, install guide, login/welcome visuals | AG-2 | `step/a7-pwa` | |
| A3 | `/a3-entry-sheet` — Add/Edit entry sheet ⭐ most important screen | AG-1 | `step/a3-entry-sheet` | |
| A5 | `/a5-reports-overview` — Reports overview, donut, drill-down, trends | AG-2 | `step/a5-reports` | |
| A4 | `/a4-history` — History, edit, soft delete, Recently deleted | AG-1 | `step/a4-history` | |
| A5b | `/a5b-breakdown-pivots` — Breakdown pivot tables | AG-2 | `step/a5b-pivots` | |
| A6 | `/a6-settings-categories` — Settings, category & wallet managers, language | AG-1 | `step/a6-settings` | |
| A8 | `/a8-polish-pass` — full design QA | AG-1 | `step/a8-polish` | |

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
