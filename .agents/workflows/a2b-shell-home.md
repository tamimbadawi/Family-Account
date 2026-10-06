---
description: Step A2b — app shell with bottom tabs and sync dot, and the Home screen, on top of the A1 design system and the A2a data layer.
---

# A2b · App shell and Home

Precondition: A1 and A2a are merged into `main`. Rebase your branch on `main` first.
Read `AGENTS.md`, `docs/DESIGN.md` §3 and §4 Home, and `src/lib/data/repository.ts` (do not change it; request changes in your PR).

1. Mount `RepositoryProvider` in `src/app/[locale]/(app)/layout.tsx`.
2. Shell per DESIGN §3: large titles, sync dot (mock: always "synced"), bottom TabBar with the 4 tabs (placeholder pages for History/Reports/Settings), safe-area padding, route transitions with `motion/react`.
3. Home screen per DESIGN §4 (greeting, hero card, top categories, recent entries, floating Add button that does nothing yet, empty state, loading skeleton).
4. `/design-review` on `/en` and `/ar`, then Definition of Done.
