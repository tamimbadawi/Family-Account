---
description: Step A8 — full design QA pass on every screen before the family test (the Phase A gate).
---

# A8 · Polish pass (Phase A gate)

Read `AGENTS.md` and all of `docs/DESIGN.md`.

1. Run `/design-review` on **every** route: Home, Add sheet (all steps, all types), History, Reports (both tabs, drill-downs), Settings and all sub-pages, Login, Welcome, Install, Offline — at 390×844 and 430×932, `/ar` + `/en`, light + dark.
2. Check specifically: spacing rhythm, alignment in RTL, truncation of long Arabic names, WCAG AA contrast in both themes, tap targets ≥ 48px, skeletons everywhere data loads, empty states, motion + reduced-motion, number formatting consistency, no English leaking into `/ar`.
3. Write the full issue list into `docs/PROGRESS.md` under A8, fix everything, attach before/after screenshots in the report.
4. Definition of Done. Then stop: the next step is the human family test (see PROGRESS.md).
