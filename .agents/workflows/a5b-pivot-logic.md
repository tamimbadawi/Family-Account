---
description: Step A5b-logic — the pure pivot() function behind the Breakdown tab, with thorough vitest tests. No UI.
---

# A5b-logic · Pivot engine (no UI)

Precondition: A2a is merged into `main` (you need `src/lib/data/types.ts`; do not change it, request changes in your PR).
Read `AGENTS.md`, `.agents/rules/03-data-offline.md`, and `docs/PLAN.md` "Reports and simple pivots".

1. `src/lib/reports/pivot.ts` — pure function, no React/Dexie imports:
   `pivot(entries, lookups, { measure: 'expense'|'income'|'net', rows: 'category'|'subcategory'|'item'|'wallet'|'person', columns: 'month'|'week'|'wallet'|'none', period: {from, to}, filter?: {categoryId?, subcategoryId?} })`
   → `{ rowKeys, rowLabels, colKeys, colLabels, cells: number[][], rowTotals, colTotals, grandTotal }`.
   Rows sorted by total desc, columns chronological (newest first for display). Labels via `pickName(row, locale)`.
2. `src/lib/reports/presets.ts` — the 5 ready-made pivots from PLAN.md as data.
3. `src/lib/reports/export.ts` — `pivotToCsv(result)` (UTF-8 with BOM so Excel shows Arabic; Western digits).
4. Vitest tests: empty input, single cell, net with mixed types, transfers excluded, week boundaries (weeks start Saturday in Egypt), month boundaries in local time, soft-deleted excluded, filter by category, 12 month columns, each preset.
5. Definition of Done (no `/design-review`: there is no UI).
