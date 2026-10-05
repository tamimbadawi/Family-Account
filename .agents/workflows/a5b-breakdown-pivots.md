---
description: Step A5b — Reports Breakdown tab with simple pivot tables, presets, drill-down, and CSV/PNG sharing.
---

# A5b · Breakdown (simple pivots)

Read `AGENTS.md`, `docs/PLAN.md` "Reports and simple pivots", and `docs/DESIGN.md` §4 Reports Breakdown.

1. `src/lib/reports/pivot.ts` — pure function:
   `pivot(entries, lookups, { measure: 'expense'|'income'|'net', rows: 'category'|'subcategory'|'item'|'wallet'|'person', columns: 'month'|'week'|'wallet'|'none', period: {from, to}, filter?: {categoryId?, subcategoryId?} })`
   → `{ rowKeys, rowLabels, colKeys, colLabels, cells: number[][], rowTotals, colTotals, grandTotal }`. Rows sorted by total desc, columns chronological (newest first for display). Vitest tests: empty input, single cell, net with mixed types, week boundaries (weeks start Saturday in Egypt), soft-deleted excluded.
2. `PivotTable` component per DESIGN spec: sticky first column, 52px rows, heat-tinted cells, whole-pound rounding, faint dash for zero, bold totals row and column, horizontal scroll with momentum, RTL-correct.
3. Chip rows (Show / Split by / Across / Period) and 5 preset cards that set all four at once.
4. Row tap drills down (category → subcategory → item) with breadcrumb; cell tap opens a sheet listing the entries behind it (tap entry → edit sheet).
5. Share: CSV (UTF-8 with BOM so Excel shows Arabic) and PNG (render the visible table with `html-to-image`) via the Web Share API, falling back to download.
6. Test with long Arabic names and 12 month columns. `/design-review` and Definition of Done.
