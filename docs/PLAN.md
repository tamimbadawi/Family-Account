# Family Accounts PWA — Build Plan

Oct 5, 2026

> **In this repo:** work is split between two Antigravity builder agents and Claude Code as orchestrator. See `docs/ORCHESTRATION.md`. Run each roadmap step with its workflow (`/a0-scaffold` … `/b6-handover` in `.agents/workflows/`) instead of pasting the prompts below. Progress lives in `docs/PROGRESS.md`; the design spec in `docs/DESIGN.md`.

## Overview and key decisions

The app is a bilingual (Arabic/English) household money tracker. It runs as an installable iPhone web app. It is built on Next.js 16, Supabase and Vercel, all on free tiers. It logs expenses, income and transfers straight to the database; saving needs a connection.

| Decision | Choice | Why |
| --- | --- | --- |
| Scope | Expenses, income and transfers across "wallets" (cash, bank, card) | All-round accounting without debits and credits jargon |
| Categories | Category → Subcategory → Item, editable in-app, separate trees for expense and income | Strict 3-tier hierarchy, enforced in the database |
| Language | English (LTR, default) and Arabic (RTL), switchable per user | next-intl with `/en` and `/ar` routes |
| Auth | Supabase email + password, public sign-up disabled, sessions never expire | They log in once on each phone, then never again |
| Sharing | One "household"; both in-laws see and edit the same books | Row Level Security scopes every row to the household |
| Editing | Full edit; deletes are soft and restorable for 30 days | Mistakes are always recoverable |
| Offline | Online-only saves; the phone keeps a read-only copy of the last data it saw | Everyone using it is online; an offline outbox and sync engine is a lot of moving parts for no real gain (decided 2026-10-07) |
| PWA | Serwist service worker + iOS-specific install guide screen | `next-pwa` is unmaintained and needs webpack |
| Uptime | Daily GitHub Action + daily Vercel cron calling the database | Free Supabase projects pause after 7 days of low activity |
| Cost | $0/month | Supabase Free, Vercel Hobby, GitHub Free |

The trade-off: with no connection the app still opens and shows the last data it loaded, but Save is refused with a short "No connection — try again" message. Every save goes to Supabase first and only then updates the phone's copy, so there is never anything waiting to sync.

## Before you start (manual, about 30 minutes)

All accounts (GitHub, Supabase, Vercel) stay with you, the operator. Nothing is transferred to the family.

- [ ] Create a dedicated Gmail, for example `family.accounts.app@gmail.com`. Store its password with your in-laws or in a shared family password manager.
- [ ] Create a **GitHub** account with that email and a **private** repo, `family-accounts`. Add your own GitHub account as a collaborator.
- [ ] Create a **Supabase** account with that email (sign in with GitHub). Create one Free project in the region nearest Egypt, for example `eu-central-1` (Frankfurt). Save the database password.
- [ ] Create a **Vercel** Hobby account by signing in with the dedicated GitHub account.
- [ ] In Supabase, open **Authentication → Sign In / Providers**. Turn **off** "Allow new users to sign up" and turn **off** "Confirm email". You will create the two users by hand.
- [ ] In Antigravity, connect the MCP servers: **Supabase** (scoped to this one project, with read-write access) and **GitHub**. Optionally add **Vercel**. Use a personal access token from the dedicated accounts, not your own.
- [ ] Install Node.js 20.9 or newer locally. Next.js 16 requires it.

The Supabase MCP has `apply_migration`, `execute_sql`, `generate_typescript_types` and `get_advisors`. The roadmap prompts use all four.

## Architecture

The phone writes to its own local database first, and a sync engine pushes changes to Supabase whenever there is a connection. Row Level Security in Postgres is the only gatekeeper, so the app needs no custom API server.

```text
┌──────────── iPhone (installed app) ────────────┐        ┌──────── Supabase (Free) ────────┐
│  Screens: Home · History · Reports · Settings   │        │  Auth + Row Level Security      │
│                    │                            │  sync  │               │                 │
│  lib/data repository (mock or live)             │ ─────► │  Postgres tables + views        │
│                    │                            │        └───────────────▲─────────────────┘
│  Local copy + outbox (IndexedDB / Dexie)        │                        │ daily keep-alive
└─────────────────────────────────────────────────┘          Vercel cron · GitHub Action
```

The screens only ever talk to the repository. Swapping sample data for Supabase in Phase B changes nothing above it.

**Rules the agent must follow (these go into `AGENTS.md`):**

1. **Data writes go through the browser Supabase client.** Do not use Server Actions for writes; the repository is the one place that talks to Supabase. RLS protects every table.
2. **Server Components are used only for the login redirect and the Dashboard's first render.** Everything else is a Client Component reading from IndexedDB.
3. **IDs are UUIDs generated on the phone** (`crypto.randomUUID()`). A retried save (e.g. after a timeout) is an `upsert` and never makes a duplicate.
4. **Money is stored as `numeric(14,2)`**, never float. It is formatted with `Intl.NumberFormat` in EGP.
5. **English is the default locale; Arabic (RTL) is fully supported for wording.** Layout uses Tailwind logical classes (`ms-`, `me-`, `ps-`, `pe-`, `text-start`), never `ml-`/`mr-`/`left`/`right`, so RTL works for free.
6. **The amount input accepts Arabic-Indic digits** (٠١٢٣٤٥٦٧٨٩) and the Arabic decimal separator (٫), normalising them to Western digits before saving. The iPhone Arabic keyboard types these. **Display always uses Western digits (0–9) in both languages** (`numberingSystem: 'latn'` with `ar-EG`).
7. **Tap targets are at least 48 px tall** and body text is at least 17 px. One primary action per screen, with no hover-only UI.

**Screens (bottom tab bar, 4 tabs):** Home (this month at a glance + big "Add" button) · History (entries grouped by day, tap to edit) · Reports (dashboard + simple pivot "Breakdown" tables) · Settings (categories, wallets, language, export, sign out).

**UI-first rule.** All screens talk to a `lib/data` repository interface, never to Supabase directly. Phase A implements it with sample data stored on the phone. Phase B swaps in Supabase and offline sync behind the same interface. Then the approved UI does not change when the database arrives.

## Design direction (make-or-break)

The app should feel like a calm, premium banking app, not a form. The bar is "looks like it came from the App Store". Nothing moves to Phase B until both in-laws have used the sample-data version on their own iPhones and like it.

**Look and feel**

- **One typeface for both scripts:** IBM Plex Sans Arabic via `next/font/google`. It has matching Arabic and Latin letterforms, so mixed text looks deliberate. Use tabular numerals for all amounts.
- **Palette:** warm off-white surfaces (`#FAF8F5`), near-black ink (`#1C1917`), one deep accent (emerald `#0F766E`) for primary actions and income, and a muted terracotta (`#C2410C`) for expenses. Expenses are not alarm red, because spending is normal. Full dark mode is driven by iOS settings.
- **Category identity:** each category gets a colour and a Lucide icon, shown in a soft tinted circle. People recognise "the green house icon" faster than text.
- **Hierarchy:** one hero number per screen (this month's spending, 48–56 px), cards with 20–24 px radius, generous spacing, and no tables or grid lines anywhere.
- **Motion:** short, purposeful transitions (150–250 ms) such as sheets sliding up, a checkmark on save, and numbers counting up on the dashboard. Respect "Reduce Motion".

**Signature interactions**

1. **Add entry = one bottom sheet, three taps.** Big on-screen number pad (like Apple Cash, no iOS keyboard) → tap a category tile → tap subcategory → tap item → Save. Date defaults to today, with "Today / Yesterday / Pick" chips. Wallet defaults to the last used one.
2. **Recents first:** the 6 most-used items appear as one-tap tiles above the category grid, so most entries take 2 taps after the amount.
3. **Undo, not "Are you sure?":** every save, edit and delete shows a toast with a large Undo button for 6 seconds.
4. **Sync status is quiet:** a small dot shows online / offline. Offline is a short toast when Save is tapped, never an error dialog.

**Component stack:** Tailwind CSS v4 · shadcn/ui (Radix primitives, restyled to the palette above) · Vaul (iOS-style drawers) · Motion (`motion/react`) · Lucide icons · Recharts (dashboard) · Sonner (toasts).

**Design review loop (every UI prompt):** the agent opens the page in Antigravity's browser at iPhone size (390×844) in both Arabic and English, takes screenshots, critiques them against this section, and fixes issues before reporting done. You then check the Vercel preview on a real iPhone.

**Optional head start:** before prompt A2, mock the 4 key screens visually (Home, Add sheet, History, Reports). Then give the screenshots to the agent as the target.

## Reports and simple pivots

Reports has two tabs: **Overview** (the dashboard) and **Breakdown** (simple pivot tables). Every pivot is built from two plain-language choices, never drag-and-drop fields.

**How a Breakdown works**

1. **Show:** Spending · Income · Both (net).
2. **Split by** (rows): Category · Subcategory · Item · Wallet · Person who entered it.
3. **Across** (columns): Months · Weeks · Wallets · Nothing (a single total column).
4. **Period:** This month · Last 3 months · Last 6 months · This year · Custom.

Each choice is a row of large chips at the top of the screen, with no menus. The table below updates instantly.

**Ready-made pivots** (one tap, shown as cards above the chips):

| Preset | Split by | Across | Period |
| --- | --- | --- | --- |
| Where did our money go? | Category | Nothing | This month |
| Month by month | Category | Months | Last 6 months |
| Bills tracker | Item (Utilities only) | Months | This year |
| Which wallet? | Wallet | Months | Last 3 months |
| Who spent what | Person | Category | This month |

**How the table looks** (not a spreadsheet):

- The first column stays fixed and shows the category icon + name. Other columns scroll sideways with momentum.
- There is a **Total** row at the bottom and a **Total** column at the end, both bold.
- Cells get a soft heat tint (darker = bigger amount), so the big numbers stand out without reading every cell.
- Amounts are rounded to whole pounds in the grid. Zero shows as a faint dash.
- Tapping a row drills in one level (Category → Subcategory → Item) with a breadcrumb back. Tapping a cell opens a sheet listing the entries behind that number.
- On a phone, at most 4 columns are visible. More scroll sideways, with the newest month nearest the row labels (the start side in RTL).
- A "Share" button exports the current pivot as CSV or as an image for WhatsApp.

**Where it runs:** pivots are computed on the phone from the local Dexie mirror (`lib/reports/pivot.ts`), not on the server. They work offline and respond instantly. A household's few thousand rows a year take milliseconds.

## Database schema

The schema is one migration with 8 tables and 4 views. The 3-tier hierarchy and the household boundary are both enforced by composite foreign keys, so a transaction can never point at another household's item. It is applied in Phase B (prompt B1) through the Supabase MCP `apply_migration`, saved as `supabase/migrations/0001_schema.sql`.

Key rules baked in:

- A transaction stores only the **leaf** (`item_id`). Its subcategory and category are derived, so they can never disagree.
- Expense/income entries must have an item. Transfers must have a destination wallet and no item. A trigger checks that the item's category kind matches the entry type.
- There is **no delete permission** for app users. Entries are soft-deleted (`deleted_at`) and purged after 30 days. Categories and wallets are archived (`is_archived`).
- Names are stored as `name_ar` + `name_en`. User-added names fill the current language's column, and the UI falls back to the other.
- All views use `security_invoker = true`, so RLS still applies through them.

The full SQL lives in [`supabase/migrations/0001_schema.sql`](../supabase/migrations/0001_schema.sql). That file is the single source of truth; this plan intentionally does not duplicate it. It also contains guards so a category can never switch between expense and income, and groups/items can only move under a parent of the same kind.

**Optional, recommended: automatic purge of old deleted entries** (`0002_purge.sql`). Enable the Cron integration in the Supabase dashboard first if the `create extension` line fails.

The SQL lives in [`supabase/migrations/0002_purge.sql`](../supabase/migrations/0002_purge.sql).

**One-time user setup.** In Supabase, go to Authentication → Users → "Add user", tick auto-confirm, and do this for both in-laws. On first login the app's welcome screen calls `create_household`. The owner then adds the second person from Settings → Family, which calls `add_member`.

## Project structure

The app lives in `src/` with locale-prefixed routes, a repository layer that hides where data comes from, and an offline engine kept apart from the UI.

```text
family-accounts/
├── AGENTS.md                      # Rules Antigravity reads before every task
├── docs/PLAN.md                   # This plan (exported from this doc)
├── proxy.ts                       # Next 16 proxy: locale routing + Supabase session refresh
├── next.config.ts                 # next-intl + Serwist wrappers
├── messages/
│   ├── en/<namespace>.json        # UI strings, English (default), one file per screen
│   └── ar/<namespace>.json        # UI strings, Arabic: same file names and keys
├── public/
│   ├── icons/                     # 192, 512, maskable 512, apple-touch-icon 180
│   └── splash/                    # iOS startup images (generated)
├── supabase/
│   └── migrations/0001_schema.sql, 0002_purge.sql
├── .github/workflows/
│   ├── keepalive.yml              # Daily DB ping
│   └── backup.yml                 # Weekly pg_dump artifact
├── vercel.json                    # Daily cron → /api/keepalive
└── src/
    ├── app/
    │   ├── manifest.ts            # Web app manifest
    │   ├── sw.ts                  # Serwist service worker source
    │   ├── api/keepalive/route.ts # Cron target, calls keepalive()
    │   ├── ~offline/page.tsx      # Fallback when a page isn't cached
    │   └── [locale]/
    │       ├── layout.tsx         # <html lang dir>, fonts, providers, iOS meta
    │       ├── login/page.tsx
    │       ├── welcome/page.tsx   # First-run: name household (create_household)
    │       ├── install/page.tsx   # iPhone "Add to Home Screen" guide
    │       └── (app)/
    │           ├── layout.tsx     # Bottom tab bar, sync dot, auth guard
    │           ├── page.tsx       # Home
    │           ├── history/page.tsx
    │           ├── reports/page.tsx
    │           └── settings/
    │               ├── page.tsx
    │               ├── categories/page.tsx          # Tier 1
    │               ├── categories/[id]/page.tsx     # Tiers 2–3
    │               ├── wallets/page.tsx
    │               └── family/page.tsx              # add_member
    ├── components/
    │   ├── ui/                    # shadcn/ui primitives, restyled
    │   ├── layout/                # TabBar, ScreenHeader, SyncDot, SafeArea
    │   ├── entry/                 # EntrySheet, AmountPad, TypeToggle,
    │   │                          # CategoryPicker (3-step), DateChips, WalletPicker
    │   ├── history/               # DayGroup, EntryRow, UndoToast
    │   ├── reports/               # MonthSwitcher, HeroTotal, CategoryDonut, CategoryBars
    │   └── settings/              # TreeEditor, ColorIconPicker
    ├── lib/
    │   ├── data/
    │   │   ├── types.ts           # Domain types (Entry, Category, Wallet…)
    │   │   ├── repository.ts      # Interface every screen uses
    │   │   ├── mock-repository.ts # Phase A: sample data in IndexedDB
    │   │   └── live-repository.ts # Phase B: Dexie + outbox + Supabase
    │   ├── offline/
    │   │   ├── db.ts              # Dexie schema (mirror tables + outbox)
    │   │   ├── outbox.ts          # Queue writes
    │   │   └── sync.ts            # Push outbox, pull changes since cursor
    │   ├── supabase/
    │   │   ├── client.ts          # createBrowserClient (@supabase/ssr)
    │   │   ├── server.ts          # createServerClient for RSC
    │   │   └── database.types.ts  # Generated by Supabase MCP
    │   ├── format/                # money(), date(), normalizeDigits()
    │   └── validation/            # zod schemas for entry/category forms
    └── i18n/
        ├── routing.ts             # locales ['en','ar'], default 'en'
        └── request.ts
```

**Packages:** `next@16 react@19 tailwindcss@4 next-intl @supabase/supabase-js @supabase/ssr dexie dexie-react-hooks zod vaul motion lucide-react recharts sonner @serwist/turbopack serwist esbuild` plus `shadcn` (CLI).

**Environment variables** (Vercel + `.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the legacy anon key also works), `NEXT_PUBLIC_DATA_MODE=mock|live`, `CRON_SECRET`.

## Offline strategy

**Decision (2026-10-07): saves are online-only.** Everyone using the app has a connection, so there is no outbox, no background sync and no "Needs attention" queue. This replaces the earlier offline-first design.

1. **Local copy (Dexie) is a read cache.** Tables `categories`, `subcategories`, `items`, `accounts`, `transactions` mirror the server rows, plus `meta` (last pull time). Screens keep reading through `useLiveQuery`, so no screen changes when live mode arrives and the app opens instantly.
2. **Writes go to Supabase first.** Every add, edit, delete or archive is an `upsert` through the browser Supabase client. Only after the server accepts it is the returned row put into Dexie. Deletes set `deleted_at`; archives set `is_archived`.
3. **No connection → no save.** If `navigator.onLine` is false or the request fails, nothing is written locally; the sheet stays open with the user's input and a toast says "No connection — try again". Never a dialog, never lost typing.
4. **Pull.** Fetch rows with `updated_at > last pull − 5 minutes` from each table and bulk-put them into Dexie. Runs on app open, on `visibilitychange` to visible, and on the `online` event. If the last pull is older than 25 days, do a full pull and drop local rows the server no longer has (the purge hard-deletes soft-deleted entries after 30 days).
5. **Conflicts.** The last save to reach the server wins. Acceptable for three people.
6. **Separate local databases per mode.** `fa-mock` in mock mode and `fa-live` in live mode, so sample data never mixes with real data.
7. **Dates are local.** `occurred_on` is always computed on the phone in local time (never `toISOString().slice(0, 10)`) and always sent explicitly.
8. **Balance corrections read the server.** The correction amount is computed from the server balance (`v_account_balances`) at save time, never from the local copy. (PROGRESS.md P1.)
9. **Receipt photos upload before the entry.** Upload to Storage `receipts/<household_id>/<transaction_id>.jpg`, then save the entry with `photo_path`. If the upload fails, the save fails like any other offline save. Files of purged entries are removed through the Storage API. (PROGRESS.md P2, P3.)

## PWA setup for iPhone

Use **Serwist**, not `next-pwa`. `next-pwa` is unmaintained and needs webpack, while Next.js 16 builds with Turbopack by default ([source](https://aurorascharff.no/posts/dynamically-generating-pwa-app-icons-nextjs-16-serwist/)). Serwist has a Turbopack package, `@serwist/turbopack`, that serves the worker from a route handler ([Serwist Turbopack guide](https://serwist.pages.dev/docs/next/turbo)).

**1. Install:** `npm i -D @serwist/turbopack esbuild serwist`. If the Turbopack package gives trouble, the fallback is `@serwist/next` with `next build --webpack` ([webpack guide](https://serwist.pages.dev/docs/next/getting-started)). The agent should read the current guide before writing code.

**2. Service worker (`src/app/sw.ts`):** precache the app shell. Use NetworkFirst for page navigations with the cache as fallback, so cached screens open offline. Use CacheFirst for fonts and icons. Never cache `*.supabase.co` responses; data always comes from Supabase. Set the fallback document to `/~offline`.

**3. Manifest (`src/app/manifest.ts`):**

```ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Family Accounts · حساباتنا',
    short_name: 'Family Accounts',
    start_url: '/en',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FAF8F5',
    theme_color: '#FAF8F5',
    dir: 'ltr',
    lang: 'en',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
```

**4. iOS metadata (`src/app/[locale]/layout.tsx`):**

```ts
export const metadata: Metadata = {
  applicationName: 'Family Accounts',
  appleWebApp: { capable: true, title: 'Family Accounts', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: { apple: '/icons/apple-touch-icon.png' }, // 180×180, no transparency
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',     // draw under the notch; pad with env(safe-area-inset-*)
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAF8F5' },
    { media: '(prefers-color-scheme: dark)',  color: '#121110' },
  ],
};
```

**5. iPhone-specific polish:**

- Pad the tab bar and sheets with `env(safe-area-inset-bottom)` so they clear the home indicator.
- Set every input's font size to at least 16 px. Smaller sizes make iOS zoom in on focus.
- Generate iOS splash screens and icons with `npx pwa-asset-generator design/icon.png public/splash --splash-only --background "#FAF8F5"`. Without them, a white flash appears on launch.
- Use `overscroll-behavior: none` on the body and no `100vh`; use `100dvh` instead.

**6. Install guide screen (`/install`):** iPhones never show an automatic install prompt. Detect iOS that is not in standalone mode (`navigator.standalone !== true`). Then show a friendly 3-step illustrated guide in the user's language: tap Share → "Add to Home Screen" → Add. Link it from the login page.

**Important for handover:** the installed app has its own storage, separate from Safari. **Install first, then log in inside the installed app.** Logging in through Safari does not carry over.

## Keep-alive and backups

Two independent daily pings keep the free Supabase project awake, and a weekly dump plus in-app CSV export protect the data. Supabase pauses Free projects that show low activity over 7 days, and a few database requests a day are typically enough to prevent it ([Supabase docs](https://supabase.com/docs/guides/platform/free-project-pausing)). Each ping calls `keepalive()`, which writes a real row, so it counts as database activity.

**Ping 1: GitHub Action** (`.github/workflows/keepalive.yml`). Add repo secrets `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.

```yaml
name: Keep Supabase awake
on:
  schedule:
    - cron: '17 6 * * *'   # daily, 09:17 Cairo
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Call keepalive()
        run: |
          code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
            "${{ secrets.SUPABASE_URL }}/rest/v1/rpc/keepalive" \
            -H "apikey: ${{ secrets.SUPABASE_PUBLISHABLE_KEY }}" \
            -H "Content-Type: application/json" -d '{}')
          echo "HTTP $code"
          test "$code" = "200"   # a failed run emails the repo owner
```

**Ping 2: Vercel cron** (independent of GitHub). Hobby plans allow daily crons.

```json
// vercel.json
{ "crons": [{ "path": "/api/keepalive", "schedule": "43 18 * * *" }] }
```

`src/app/api/keepalive/route.ts` checks `Authorization: Bearer ${CRON_SECRET}`, calls `supabase.rpc('keepalive')`, sets `export const dynamic = 'force-dynamic'`, and returns the timestamp.

**Backup: weekly database dump** (`.github/workflows/backup.yml`). Add the secret `SUPABASE_DB_URL`, which is the **Session pooler** connection string. GitHub runners use IPv4, so the direct connection does not work. Use `supabase/setup-cli@v1`, then `supabase db dump --db-url "$SUPABASE_DB_URL" -f schema.sql` and `supabase db dump --db-url "$SUPABASE_DB_URL" --data-only -f data.sql`. Upload both files with `actions/upload-artifact@v4` and `retention-days: 90`. Schedule it every Sunday. The repo must stay **private** because the dump contains their finances.

**Backup: in-app export.** Settings → "Download my data (CSV)" exports all entries with category names in the current language. It opens directly in Excel or Numbers.

If the project ever pauses anyway, the owner gets an email from Supabase and can press "Resume project" in the dashboard. The data is kept.

## Execution roadmap

The build runs as 16 prompts in two phases. Phase A builds and polishes the entire interface on sample data. Phase B connects the real database behind it. Do not start Phase B until the family has approved Phase A on their own iPhones.

**How to run each prompt in Antigravity**

- Start a **new agent conversation per prompt**. The project memory lives in `AGENTS.md` and `docs/PLAN.md`, not in chat history, so context never overflows.
- Each prompt ends with the same "definition of done": screenshots at 390×844 in Arabic and English, a self-critique against the Design direction, a commit, a push, and the Vercel preview link.
- After each prompt, open the preview on your iPhone. If something looks off, fix it in the same conversation before moving on.

### Phase A: Interface on sample data

**A0 · Scaffold and deploy**

```text
Create a Next.js 16 App Router project (TypeScript, Tailwind v4, src/ dir, ESLint) in this repo.
Save docs/PLAN.md from the plan I paste below. Then write AGENTS.md containing: the 7 rules in
"Architecture", the UI-first rule, the whole "Design direction" section, and this definition of done:
"Before reporting done: open every changed screen in the browser at 390x844 in /ar and /en,
screenshot, critique against Design direction, fix, then commit, push, and give the Vercel preview URL."
Set up next-intl with locales ['en','ar'], default 'en', <html dir> set per locale, using proxy.ts
(Next 16 naming). Load the messages in messages/en/ and messages/ar/. Add a placeholder home page.
Connect the repo to Vercel and confirm a production deploy works. Do not touch Supabase yet.
[paste this whole doc exported as Markdown]
```

**A1 · Design system**

```text
Read AGENTS.md. Build the design system only:
- IBM Plex Sans Arabic via next/font, tabular numerals utility
- Tailwind v4 theme tokens for the palette in Design direction, light + dark (prefers-color-scheme)
- shadcn/ui init, then add and restyle: button, card, input, sheet/drawer (use vaul), tabs, switch,
  dropdown-menu, dialog, skeleton; sonner toasts
- money() and normalizeDigits() helpers in src/lib/format with unit tests
- A /[locale]/styleguide page showing every token, type size, component state, and a sample
  entry card, in both themes
Only logical Tailwind classes (ms/me/ps/pe/start/end).
```

**A2 · App shell and sample data**

```text
Read AGENTS.md and the Architecture + Project structure sections of docs/PLAN.md.
1. src/lib/data/types.ts and repository.ts: an interface covering categories (3 tiers),
   wallets, entries (expense/income/transfer, soft delete), monthly summaries and category totals.
2. mock-repository.ts: store in IndexedDB via Dexie, seed with the default bilingual
   category tree from the SQL seed in docs/PLAN.md, 2 wallets, and ~120 realistic Egyptian
   household entries over the last 3 months (EGP amounts).
3. Pick the repository by NEXT_PUBLIC_DATA_MODE (default 'mock'). Expose it via a React context + hooks.
4. (app)/layout.tsx: bottom tab bar with Home, History, Reports, Settings (Lucide icons,
   labels, safe-area padding), a quiet sync dot, page transitions with motion.
5. Home screen: greeting, hero "spent this month" figure, income vs spending mini-summary,
   last 5 entries, and a large floating Add button (opens nothing yet).
```

**A3 · Add-entry sheet (the most important screen)**

```text
Read AGENTS.md and "Signature interactions" in docs/PLAN.md. Build EntrySheet as a vaul drawer:
- Type toggle: Expense / Income / Transfer (segmented control, expense default)
- AmountPad: custom on-screen keypad, large live amount display in EGP, backspace, decimal,
  respects locale digits for display; never opens the iOS keyboard
- CategoryPicker: step 1 category tiles (icon in tinted circle), step 2 subcategory list,
  step 3 item list, breadcrumb to go back, "+ New" at each step to add inline; a Recents row
  of the 6 most-used items shown above step 1
- Transfer mode replaces the picker with From wallet -> To wallet
- DateChips: Today / Yesterday / Pick (native date input)
- Wallet selector defaulting to last used, optional note field
- Save: validation with zod, success checkmark animation, toast with Undo (6s)
Open it from the Home Add button. Save through the repository.
```

**A4 · History and editing**

```text
Read AGENTS.md. Build History: entries grouped by day with day totals, sticky day headers,
month switcher at top, filter chips (All / Expenses / Income), and an empty state with an
illustration. Tapping an entry opens the same EntrySheet in edit mode with a Delete button.
Delete is a soft delete with an Undo toast. Add Settings > "Recently deleted" listing the last
30 days with Restore.
```

**A5 · Reports dashboard**

```text
Read AGENTS.md. Build Reports (read-only): month switcher; hero card with spent, income and net;
a donut of spending by category (Recharts, category colours) with the total in the centre;
a ranked list of categories with amount, % and a thin bar; tap a category to drill into its
subcategories and items; a 6-month bar chart of spending vs income; wallet balances card.
Numbers count up on load. Must read clearly at a glance for someone with no finance background.
```

**A5b · Breakdown (simple pivots)**

```text
Read AGENTS.md and "Reports and simple pivots" in docs/PLAN.md. Add a Breakdown tab to Reports.
1. src/lib/reports/pivot.ts: a pure, unit-tested function pivot(entries, {measure, rows, columns,
   period}) returning row labels, column labels, cells, row/column/grand totals. Rows: category,
   subcategory, item, wallet, person. Columns: month, week, wallet, none.
2. PivotTable component: sticky first column with icon + name, horizontal scroll, bold total row
   and column, heat-tinted cells, whole-pound rounding, faint dash for zero, RTL-correct.
3. Chip rows for Show / Split by / Across / Period, plus the 5 ready-made preset cards.
4. Tap a row to drill down a level (breadcrumb back); tap a cell to open a sheet of its entries.
5. Share: CSV export and PNG image of the current pivot.
It must feel like a simple app screen, not a spreadsheet. Test with long Arabic names and 12 columns.
```

**A6 · Settings and category manager**

```text
Read AGENTS.md. Build Settings: Categories (separate Expense and Income tabs), Wallets,
Language (Arabic/English), Family (placeholder), Download data (placeholder), Sign out (placeholder).
Category manager: drill-down Category > Subcategory > Item; add new at every level (including a
whole new category with icon + colour picker); rename; drag to reorder; archive (hide) instead of
delete with a clear explanation. Wallet manager: add/rename/archive, type, opening balance.
```

**A7 · PWA, login and onboarding screens**

```text
Read AGENTS.md and "PWA setup for iPhone" in docs/PLAN.md. Read the current Serwist Turbopack
docs before coding. Implement the service worker, manifest, iOS metadata, icons (generate from a
simple logo you design as SVG), splash screens, /~offline page, and the /install guide screen.
Also build the visual-only Login and Welcome ("name your household") screens with mock behaviour.
Verify with a production build that the app installs and opens offline.
```

**A8 · Polish pass, then family test (gate)**

```text
Read AGENTS.md. Do a full design QA pass on every screen in both languages and both themes at
390x844 and 430x932: spacing rhythm, alignment in RTL, truncation of long Arabic names, contrast
(WCAG AA), tap targets >= 48px, loading skeletons, empty states, motion with reduced-motion
fallbacks. List every issue you find, fix them, and report before/after screenshots.
```

Then install it on both in-laws' iPhones **from the production URL** (Vercel preview URLs sit behind a Vercel login, and an installed app is tied to its address) and watch them log 3 real expenses without help. Note every hesitation. Feed the notes back to the agent in one "A9 fixes" prompt.

### Phase B: Real data

**B1 · Database**

```text
Read AGENTS.md and the "Database schema" section of docs/PLAN.md. Using the Supabase MCP:
apply 0001_schema.sql exactly via apply_migration (save it under supabase/migrations/), then
0002_purge.sql. Run get_advisors (security + performance) and fix anything flagged. Generate
TypeScript types into src/lib/supabase/database.types.ts. Test as SQL: an expense with an income
item must fail; a transfer to the same wallet must fail.
```

**B2 · Authentication**

```text
Read AGENTS.md. Add @supabase/ssr browser + server clients, session refresh in proxy.ts
(only redirect to /login when online and no session), wire the Login screen to email+password,
the Welcome screen to rpc('create_household'), Settings > Family to rpc('add_member'), and Sign out.
Login errors must be friendly and translated. Sessions persist indefinitely.
```

**B3 · Live repository (online-only saves)**

```text
Read AGENTS.md and "Offline strategy" in docs/PLAN.md. Implement live-repository.ts with the same
interface as the mock: writes go to Supabase first, then into the Dexie read cache; pulls refresh the
cache on open/focus. Do not change any screen components. Set NEXT_PUBLIC_DATA_MODE=live in Vercel.
Test: add/edit/delete on one phone shows on the other after focus; Save in airplane mode shows the
"No connection" toast and keeps the typed entry.
```

**B4 · Reports on server views**

```text
Read AGENTS.md. Point the Reports data methods at v_monthly_summary, v_monthly_category_totals and
v_account_balances.
```

**B5 · Keep-alive, backups, export**

```text
Read AGENTS.md and "Keep-alive and backups" in docs/PLAN.md. Create keepalive.yml, backup.yml,
vercel.json cron, /api/keepalive with CRON_SECRET, and the CSV export in Settings. Tell me exactly
which GitHub secrets and Vercel env vars to add. Trigger both workflows manually and confirm success.
```

**B6 · Final QA and handover prep**

```text
Read AGENTS.md. End-to-end test on the production URL: install, log in, add/edit/delete/restore,
offline Save shows the toast, add a category at all 3 levels, switch language, export CSV. Run Supabase
get_advisors again. Write docs/HANDOVER.md (for me) and a 1-page Arabic "how to use" guide with
screenshots (for the family).
```

## Handover checklist and known risks

Launch means the app runs on live data with no one touching it. You stay the operator and keep every account.

**Launch day (on the phones)**

- [ ] On each iPhone, open the production URL in Safari → Share → Add to Home Screen, **then** log in inside the installed app.
- [ ] Log in once on each phone, set the language, and add one real entry together.
- [ ] Confirm both keep-alive runs are green and `heartbeat.pinged_at` is today.
- [ ] Confirm the backup workflow has produced at least one artifact.
- [ ] Print or send the 1-page Arabic guide.
- [ ] Make sure Supabase, Vercel and GitHub alert emails reach an inbox you read, so a pause warning or failed run is never missed.

**Known risks**

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Supabase pauses the project | Low | Two daily pings; Resume button keeps data; owner gets an email |
| No signal when they want to log something | Low | Save shows "No connection — try again" and keeps the typed entry |
| Two people edit the same entry at once | Very low | Last write wins; edits are rare |
| iOS deletes the installed app's storage | Very low | Server is the source of truth; re-login restores everything |
| Free-tier limits (500 MB database) | Very low | Decades of household entries fit; the advisor email warns early |
| Next.js or Supabase breaking changes | None unless redeployed | Nothing auto-upgrades; the deployed build keeps running as is |
| Forgotten password | Medium | Owner resets it from the Supabase dashboard (Auth → Users) using the family Gmail |

The one thing that can never be automated away is a forgotten password. Keep the family Gmail login somewhere they can find it.

## Ownership · Tamim runs the app; no transfer

Decided 2026-10-07 (replaces the 2026-10-06 "Handover to Injy" plan). The code, the Supabase project and the Vercel project stay in Tamim's accounts. Tamim is the operator: he creates each family's admin from `/operator` (see `docs/MULTI-FAMILY.md`), and family admins manage their own members from Settings → Family. Nothing is transferred.

**How family data is protected (standard encryption):**
- At rest and in transit: Supabase encrypts the database and Storage on disk, and every connection is HTTPS/TLS.
- Between families: Row Level Security on every table and on the `receipts` bucket; one family can never read another. This is checked by the RLS smoke tests after each schema change.
- Backups: the weekly dump is gpg-encrypted with `BACKUP_PASSPHRASE` before it is uploaded; the job refuses to upload plain SQL.
- The operator screen and function logs show counts only, never amounts, notes, categories or photos.
- Not in scope: end-to-end encryption on the phone. As the project owner, Tamim could technically read data from the Supabase dashboard; he commits not to, and the family is told this plainly. Phone-side encryption can be added later if a family needs it (reports would then have to be added up on the phone).

**Launch day, in order:**
1. Apply any pending migrations, deploy the `operator` and `family-admin` Edge Functions, set `OPERATOR_EMAILS`, and run `get_advisors` (no WARN left).
2. Vercel production env: `NEXT_PUBLIC_DATA_MODE=live`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `CRON_SECRET`.
3. GitHub secrets: `BACKUP_PASSPHRASE`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_URL`. Run the backup once and restore it into a scratch project.
4. Tamim creates the family admin from `/en/operator` (temporary password, forced change on first sign-in). The admin names the family and adds members from Settings → Family.
5. Install on each iPhone from the production URL (Safari → Share → Add to Home Screen), then sign in inside the installed app.
