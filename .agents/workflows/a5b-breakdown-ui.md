---
description: Step A5b — Reports Breakdown tab UI on top of the A5b-logic pivot engine: pivot table, chips, presets, drill-down, CSV/PNG sharing.
---

# A5b · Breakdown (simple pivots)

Precondition: A5 and A5b-logic are merged into `main`.
Read `AGENTS.md`, `docs/PLAN.md` "Reports and simple pivots", and `docs/DESIGN.md` §4 Reports Breakdown.
`pivot()`, the presets and `pivotToCsv()` already exist in `src/lib/reports/` with tests: use them, don't rewrite them.

1. Add a Breakdown tab to Reports (next to Overview from A5).
2. `PivotTable` component per DESIGN spec: sticky first column, 52px rows, heat-tinted cells, whole-pound rounding, faint dash for zero, bold totals row and column, horizontal scroll with momentum, RTL-correct.
3. Chip rows (Show / Split by / Across / Period) and 5 preset cards that set all four at once.
4. Row tap drills down (category → subcategory → item) with breadcrumb; cell tap opens a sheet listing the entries behind it (tap entry → edit sheet).
5. Share: CSV via `pivotToCsv()` and PNG (render the visible table with `html-to-image`) via the Web Share API, falling back to download.
6. Test with long Arabic names and 12 month columns. Quick `/design-review` and Definition of Done.
