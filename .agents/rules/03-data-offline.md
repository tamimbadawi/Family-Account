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
  updates instantly after a local write and after a sync pull.
- Writes: one Dexie transaction writes the row **and** appends to `outbox`. Never write to Supabase directly from UI code.
- Sync (`src/lib/offline/sync.ts`): push outbox in insertion order with `upsert`; pull rows with
  `updated_at > cursor - 5 minutes`; run on app open, `visibilitychange` → visible, `online`, and after local writes.
  iOS has no Background Sync API — do not rely on it.
  If the last successful pull is older than 25 days, do a full pull and drop local rows the server no longer has (soft-deleted entries are purged after 30 days).
- A server-rejected row (constraint error) stays in the outbox flagged `failed`, surfaced in Settings → "Needs attention". Never silently drop user data.
- Validation: zod schemas in `src/lib/validation` are used both by forms and before enqueueing.
- `src/lib/reports/pivot.ts` and `src/lib/format/*` are pure functions with vitest tests. Keep them free of React and Dexie imports.
