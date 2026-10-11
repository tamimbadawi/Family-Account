---
description: Step B6 — end-to-end QA on production, final security advisors, and handover documents.
---

# B6 · Final QA and handover

Read `AGENTS.md` and `docs/PLAN.md` "Handover checklist and known risks".

1. End-to-end on the **production** URL at iPhone size: install guide, login, welcome, add/edit/delete/restore, Save in airplane mode shows the "No connection" toast and keeps the entry, add a category at all 3 levels, archive, switch language, both report tabs, export CSV, sign out/in.
2. `get_advisors` (security + performance) — must be clean or every remaining item explained.
3. Run `/design-review` one last time on Home, Add sheet and Reports.
4. Fill in `docs/HANDOVER.md` (accounts, where secrets live, how to resume a paused project, how to reset a password, how to restore a backup).
5. Write `docs/GUIDE-ar.md`: a 1-page Arabic how-to for the family with screenshots (add an entry, fix a mistake, see the month, download data). Export it to PDF for printing.
6. Write the **launch-day runbook** in docs/HANDOVER.md exactly as in docs/PLAN.md "Ownership" (nothing is transferred; the operator keeps every account; how family data is protected; launch steps in order).
7. Report to the orchestrator (do not edit PROGRESS.md). Report: production URL, advisor status, and the handover-day checklist for me.
