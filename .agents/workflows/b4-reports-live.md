---
description: Step B4 — Reports Overview on Supabase views; Breakdown stays local.
---

# B4 · Reports on server views

Read `AGENTS.md`.

1. Live repository: `monthSummary`, `categoryTotals`, `walletBalances` read `v_monthly_summary`, `v_monthly_category_totals`, `v_account_balances`; with no connection, compute the same numbers from the Dexie cache.
2. Breakdown pivots keep computing locally from Dexie (already correct by design) — verify they match the views for the same month.
3. Definition of Done.
