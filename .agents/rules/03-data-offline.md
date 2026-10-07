---
trigger: glob
globs: src/lib/**, src/hooks/**
---

# Data layer and offline rules

- The `Repository` interface in `src/lib/data/repository.ts` is the only door to data.
  Phase A: `mock-repository.ts`. Phase B: `live-repository.ts`. Selected by `NEXT_PUBLIC_DATA_MODE`.
  Changing the interface after Phase A requires updating both implementations in the same commit.
- The Dexie database is named per mode (`fa-mock` / `fa-live`), so sample data can never reach Supabase or mix with real data.
- `occurred_on` (a `YYYY-MM-DD` string) is computed from the phone's local date and always sent explicitly. Never use `toISOString().slice(0, 10)`.
- Domain types live in `src/lib/data/types.ts` and mirror the SQL in `supabase/migrations/0001_schema.sql`
  (same column names, snake_case on the wire, camelCase in TS via one mapper file).
- Reads in components use Dexie live queries (`useLiveQuery`) wrapped in repository hooks, so the UI
  updates instantly after a save and after a pull.
- Writes are **online-only** (decided 2026-10-07): the live repository upserts to Supabase first and puts the returned row into Dexie only after success. No outbox, no offline queue, no "Needs attention" list.
  Offline or failed request → nothing is written, the form keeps its input, and a toast says "No connection — try again".
- Pull (`src/lib/offline/sync.ts`): rows with `updated_at > last pull - 5 minutes`; run on app open, `visibilitychange` → visible and `online`.
  If the last successful pull is older than 25 days, do a full pull and drop local rows the server no longer has (soft-deleted entries are purged after 30 days).
- Validation: zod schemas in `src/lib/validation` are used both by forms and before sending to Supabase.
- `src/lib/reports/pivot.ts` and `src/lib/format/*` are pure functions with vitest tests. Keep them free of React and Dexie imports.
