---
description: Step B4 — Reports Overview on Supabase views with offline caching; Breakdown stays local.
---

# B4 · Reports on server views

Read `AGENTS.md`.

1. Live repository: `monthSummary`, `categoryTotals`, `walletBalances` read `v_monthly_summary`, `v_monthly_category_totals`, `v_account_balances` when online; results cached in Dexie `meta` keyed by query.
2. Offline: serve the cache and show a subtle "حتى <time>" label. If there are unsynced local entries, fall back to computing from Dexie so totals include them.
3. Breakdown pivots keep computing locally from Dexie (already correct by design) — verify they match the views for the same month.
4. Definition of Done.
