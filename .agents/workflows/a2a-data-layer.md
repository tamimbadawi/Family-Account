---
description: Step A2a — domain types, Repository interface, Dexie mock repository with realistic sample data, and data hooks. No UI.
---

# A2a · Data layer and sample data (no UI)

Read `AGENTS.md`, `.agents/rules/03-data-offline.md`, `docs/PLAN.md` (Architecture, Project structure, Offline strategy),
and `supabase/migrations/0001_schema.sql` (the data model the types must mirror).
This step runs in parallel with A1 (design system): do not touch `src/app/`, `src/components/`, `globals.css` or `tokens.css`.

1. `src/lib/data/types.ts`: Household, Member, Wallet (accounts table), Category, Subcategory, Item, Entry (transactions: expense | income | transfer, `deletedAt`), MonthSummary, CategoryTotal. camelCase; a `mappers.ts` converts to/from snake_case rows.
2. `src/lib/data/repository.ts`: one interface covering: list/add/update/archive for categories, subcategories, items, wallets; add/update/softDelete/restore/list entries (by month, with filters); recentItems(limit); monthSummary(month); categoryTotals(month, kind, level, parentId?); walletBalances(); entriesForPivot(period); syncStatus(). Return types are plain objects. **You own this file and `types.ts` for the rest of Phase A** (see ORCHESTRATION.md §4).
3. `src/lib/offline/db.ts` (Dexie schema, designed so Phase B reuses it: tables `categories, subcategories, items, accounts, transactions, outbox, meta`). Database name per mode: `fa-mock` / `fa-live`.
4. `src/lib/data/mock-repository.ts`: seed on first run with the bilingual category tree from `seed_defaults` in the SQL, wallets Cash (كاش) and Bank (البنك), two members (ماما, بابا), and ~120 realistic Egyptian household entries over the last 3 months (EGP; electricity 300–900, groceries 150–1500, pension income monthly, a few transfers). Dates are local `YYYY-MM-DD` strings.
5. `src/lib/data/provider.tsx`: `RepositoryProvider` + hooks (`useRepository`, `useEntries`, `useMonthSummary`, `useCategoryTotals`, `useRecentItems`, `useWalletBalances`, …) built on `useLiveQuery`; implementation chosen by `NEXT_PUBLIC_DATA_MODE` (default `mock`). Do not mount the provider in a layout: A2b does that.
6. Vitest tests for the mock repository logic that doesn't need a browser (mappers, month summary, wallet balances, soft delete/restore), using `fake-indexeddb`.
7. Definition of Done (no `/design-review` needed: there is no UI in this step).
