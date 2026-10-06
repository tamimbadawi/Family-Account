# Family Accounts · حساباتنا

A calm, bilingual (English/Arabic) household accounting app for iPhone, installed from the browser.
Expenses, income and transfers across wallets; 3-level categories; a reports library and pivot tables;
works offline; zero running costs.

**Live:** https://family-account-sigma.vercel.app (install from Safari → Share → Add to Home Screen)

**Stack:** Next.js 16 · Tailwind CSS v4 · shadcn/ui · next-intl · Dexie · Supabase · Serwist · Vercel

Personal family use only: never published to the App Store.

## Status
**Phase A (interface on sample data) is nearly complete.** Every screen runs on realistic sample data stored on the
phone; nothing reaches Supabase yet. **Phase B (real data)** starts after the family approval gate.
The live checklist, who is on which step, and the decision log are in [`docs/PROGRESS.md`](docs/PROGRESS.md),
which is the single source of truth for what happens next.

What works today (sample data):
- **Add / edit entries** in one sheet: calculator amount pad, category chips, wallet, in-app date picker, note, optional receipt photo
- **Home** with this month's totals, **History** with edit, soft delete and Recently deleted (30 days)
- **Reports**: Overview, a library of money-flow and planning reports, and a Breakdown pivot table with CSV/PNG sharing
- **Wallets** (Cash + banks) with balance corrections
- **Settings**: categories (3 levels) and wallets managers, language, CSV export
- **PWA**: service worker, offline page, iOS icons and splash screens, Login / Welcome / Install screens

Already prepared for Phase B: Supabase project with schema, Row Level Security and smoke tests (`supabase/`),
generated types, receipt-photo bucket, and keep-alive + encrypted weekly backup workflows.

## Architecture in one paragraph
Screens talk only to a `Repository` interface (`src/lib/data/repository.ts`). In Phase A it is the mock repository
over a local Dexie database (`fa-mock`). In Phase B a live repository writes to a separate Dexie database (`fa-live`)
plus an outbox, and syncs to Supabase on open, focus and reconnect (last write wins). Every row carries
`household_id` and RLS scopes it to members. Details: [`docs/PLAN.md`](docs/PLAN.md) → Architecture and Offline strategy.

## Run it locally
```bash
nvm use            # Node 22
npm ci
cp .env.example .env.local   # NEXT_PUBLIC_DATA_MODE=mock is all Phase A needs
npm run dev        # http://localhost:3000/en  (Arabic: /ar)
```

Checks:
```bash
npm run lint && npm run typecheck && npm test && npm run check-rtl && npm run build
npm run ui:check   # screens fit on iPhone sizes (needs a running app)
npm run ui:flows   # click-through flows in en + ar
```

## How it is built
Two Antigravity builder agents work in parallel on their own branches; Claude Code assigns steps, reviews and merges
([`docs/ORCHESTRATION.md`](docs/ORCHESTRATION.md)). Each roadmap step has a slash-command workflow in `.agents/workflows/`.

## What's in this repo
| Path | Purpose |
|---|---|
| `AGENTS.md` | Project rules every agent reads first |
| `.agents/rules/` | Scoped rules: design quality, RTL/i18n, data/offline, Supabase security |
| `.agents/workflows/` | One slash command per roadmap step + `/design-review` |
| `docs/PROGRESS.md` | **Current status, queues and log (authoritative)** |
| `docs/PLAN.md` | Architecture, schema, offline strategy, PWA, roadmap, risks, handover |
| `docs/DESIGN.md` | Design system and screen-by-screen spec |
| `docs/SETUP.md` | One-time account and tool setup |
| `src/lib/data/` | Types, repository interface, mock repository and seed |
| `src/lib/reports/` | Pure report and pivot logic (unit tested) |
| `messages/` | Arabic and English UI strings |
| `supabase/migrations/` | Database schema |
| `supabase/tests/` | Self-rolling-back RLS, receipts and membership smoke tests |
| `.github/workflows/` | CI, daily Supabase keep-alive, weekly encrypted backup |
