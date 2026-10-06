# Family Accounts · حساباتنا

A calm, bilingual (English/Arabic) household accounting app for iPhone, installed from the browser.
Expenses, income and transfers across wallets; 3-level categories; simple reports and pivot tables;
works offline; zero running costs.

**Stack:** Next.js 16 · Tailwind CSS v4 · shadcn/ui · next-intl · Dexie · Supabase · Serwist · Vercel

## Status
Personal family use only: it is installed from Safari ("Add to Home Screen"), never published to the App Store.

Planning complete — no app code yet. The app is built step by step by two Antigravity agents, coordinated by Claude Code
using the workflows in `.agents/workflows/`. Track progress in [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Start here
1. [`docs/SETUP.md`](docs/SETUP.md) — accounts, pushing this repo, connecting Antigravity + MCP (once).
2. [`docs/ORCHESTRATION.md`](docs/ORCHESTRATION.md) — two Antigravity agents build in parallel, Claude Code reviews and merges.
3. [`docs/PROGRESS.md`](docs/PROGRESS.md) — who is on which step right now.

## What's in this repo
| Path | Purpose |
|---|---|
| `AGENTS.md` | Project rules every agent reads first |
| `.agents/rules/` | Scoped rules: design quality, RTL/i18n, data/offline, Supabase security |
| `.agents/workflows/` | One slash command per roadmap step + `/design-review` |
| `docs/PLAN.md` | Full build plan: architecture, schema, offline, PWA, roadmap, risks |
| `docs/DESIGN.md` | Design system and screen-by-screen spec |
| `design/tokens.css` | Colour, type, radius and motion tokens (Tailwind v4) |
| `messages/` | Arabic and English UI strings |
| `supabase/migrations/` | Database schema (applied in Phase B) |
| `supabase/tests/` | RLS smoke test (self-rolling-back) + local auth stub |
| `.github/workflows/` | CI, daily Supabase keep-alive, weekly database backup |
| `components.json` | shadcn/ui configuration |
| `vercel.json` | Daily keep-alive cron |

## Two phases
- **Phase A — Interface:** every screen built and polished on realistic sample data, approved by the family on their iPhones.
- **Phase B — Real data:** Supabase auth, database and offline sync connected behind the same interface.
