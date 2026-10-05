---
description: Step A2 — Repository interface, mock repository with realistic sample data, app shell with bottom tabs, and the Home screen.
---

# A2 · App shell and sample data

Read `AGENTS.md`, `docs/PLAN.md` (Architecture, Project structure), `docs/DESIGN.md` §3 and §4 Home,
and `supabase/migrations/0001_schema.sql` (the data model the types must mirror).

1. `src/lib/data/types.ts`: Household, Member, Wallet (accounts table), Category, Subcategory, Item, Entry (transactions: expense | income | transfer, `deletedAt`), MonthSummary, CategoryTotal. camelCase; a `mappers.ts` converts to/from snake_case rows.
2. `src/lib/data/repository.ts`: one interface covering: list/add/update/archive for categories, subcategories, items, wallets; add/update/softDelete/restore/list entries (by month, with filters); recentItems(limit); monthSummary(month); categoryTotals(month, kind, level, parentId?); walletBalances(); entriesForPivot(period); syncStatus(). Return types are plain objects.
3. `src/lib/data/mock-repository.ts` using **Dexie** (`src/lib/offline/db.ts` — design the schema now so Phase B reuses it: tables `categories, subcategories, items, accounts, transactions, outbox, meta`). Seed on first run with the bilingual category tree from `seed_defaults` in the SQL, wallets Cash (كاش) and Bank (البنك), two members (ماما, بابا), and ~120 realistic Egyptian household entries over the last 3 months (EGP; electricity 300–900, groceries 150–1500, pension income monthly, a few transfers).
4. `RepositoryProvider` + hooks (`useEntries`, `useMonthSummary`, …) built on `useLiveQuery`; choose implementation by `NEXT_PUBLIC_DATA_MODE` (default `mock`).
5. `src/app/[locale]/(app)/layout.tsx`: shell per DESIGN §3 — large titles, sync dot (mock: always "synced"), bottom TabBar with the 4 tabs (placeholder pages for History/Reports/Settings), safe-area padding, route transitions with `motion/react`.
6. Home screen per DESIGN §4 (greeting, hero card, top categories, recent entries, floating Add button that does nothing yet, empty state).
7. `/design-review` on `/ar` and `/en`, then Definition of Done.
