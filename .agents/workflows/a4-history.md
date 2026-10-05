---
description: Step A4 — History screen grouped by day, month switcher, filters, edit via the entry sheet, soft delete with undo, and Recently deleted.
---

# A4 · History and editing

Read `AGENTS.md` and `docs/DESIGN.md` §4 History.

1. `src/app/[locale]/(app)/history/page.tsx`: MonthSwitcher, filter chips (all/expenses/income), entries grouped by day with sticky day headers and day totals (`src/components/history/DayGroup.tsx`, `EntryRow.tsx` shared with Home).
2. Tap an entry → `EntrySheet` in edit mode. Delete → soft delete with Undo toast.
3. Settings → "المحذوفات" (Recently deleted) page: entries deleted in the last 30 days with a Restore button each.
4. Empty month state and loading skeletons.
5. Performance: smooth with 2,000 entries (virtualise only if needed).
6. `/design-review` and Definition of Done.
