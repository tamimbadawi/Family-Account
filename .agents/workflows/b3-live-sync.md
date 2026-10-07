---
description: Step B3 — live repository on Supabase with a Dexie read cache; saves are online-only. Switched on without changing any screen.
---

# B3 · Live repository (online-only saves)

Read `AGENTS.md`, `.agents/rules/03-data-offline.md`, and `docs/PLAN.md` "Offline strategy".
Decision 2026-10-07: **no offline saving.** No outbox, no background sync, no "Needs attention" queue.

1. `src/lib/data/live-repository.ts` implementing the same `Repository` interface. Every write: validate (zod) → `upsert` to Supabase → on success put the returned row into Dexie `fa-live`. On failure or `navigator.onLine === false`: write nothing and throw a typed `OfflineError`; the screen keeps its input and shows the "No connection — try again" toast. No screen component may change beyond showing that toast; if one must, explain why first.
2. `src/lib/offline/sync.ts` is pull-only: per-table `updated_at > last pull − 5 min`, on app open / visible / `online`; full pull + drop missing rows if the last pull is older than 25 days.
3. First login on a device: full pull, show a one-time loading skeleton.
4. Balance corrections: compute the correction from the server balance (`v_account_balances`) at save time (PROGRESS P1).
5. Receipt photos: upload to Storage `receipts/<household_id>/<transaction_id>.jpg` (`upsert: true`) first, then save the entry with `photo_path`. Download lazily when viewed and cache in Dexie. Never cache `*.supabase.co` in the service worker.
6. Sync dot shows online / offline only (no "N waiting").
7. Set `NEXT_PUBLIC_DATA_MODE=live` in Vercel (Preview first).
8. Tests: vitest for the pull cursor and for "a failed upsert writes nothing to Dexie". Manual on two phones per the B3 definition of done in `docs/PROGRESS.md`.
9. Definition of Done.
