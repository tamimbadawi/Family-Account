---
description: Step B3 — live repository on Dexie + outbox + Supabase sync, switched on without changing any screen.
---

# B3 · Live repository with offline sync

Read `AGENTS.md`, `.agents/rules/03-data-offline.md`, and `docs/PLAN.md` "Offline strategy" (all 9 points).

1. `src/lib/offline/outbox.ts` and `sync.ts` exactly per the Offline strategy (ordered push via upsert, pull with 5-minute overlap cursor per table, triggers on open/visible/online/after-write, backoff, failed rows kept and surfaced).
2. `src/lib/data/live-repository.ts` implementing the same `Repository` interface on top of the Dexie tables + outbox. No screen component may change; if one must, explain why first.
3. First login on a device: full pull, show a one-time "جاري التحميل…" skeleton.
4. Sync dot: synced / N waiting / offline. Settings → "محتاج انتباه" lists failed rows with Retry and Discard.
5. Set `NEXT_PUBLIC_DATA_MODE=live` in Vercel (Preview first).
6. Tests: vitest for outbox ordering and cursor logic. Manual (on the preview): airplane mode → add 3 entries + edit 1 + create a new item and use it → reconnect → confirm in Supabase (`execute_sql`) every row arrived exactly once, and a second device sees them after opening.
7. Definition of Done.
