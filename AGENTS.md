# AGENTS.md — Family Accounts (حساباتنا)

You are building a bilingual (English-first, LTR default with Arabic RTL support) household accounting PWA for two non-technical,
older family members who will use it **only on iPhones**. They have zero spreadsheet skills.
If a screen would confuse someone who has never used a finance app, it is wrong.

**Read before every task:** this file → `docs/ORCHESTRATION.md` (how the agents share the work) →
`docs/PROGRESS.md` (find the step assigned to you) → the section of `docs/PLAN.md` / `docs/DESIGN.md`
that your workflow names. Work through **your queue** on the board, one branch per step, in your own folder.

---

## 1. The two phases (never skip ahead)

| Phase | What | Data source |
|---|---|---|
| **A — Interface** | Every screen, fully polished, on realistic sample data | `NEXT_PUBLIC_DATA_MODE=mock` (Dexie, on the phone) |
| **B — Real data** | Supabase auth, database, offline sync behind the *same* interface | `NEXT_PUBLIC_DATA_MODE=live` |

Phase B starts **only** after `docs/PROGRESS.md` shows the "Family approval" gate ticked.
In Phase B you must not redesign screens — only swap what is behind `src/lib/data/repository.ts`.

## 2. Stack (fixed — do not substitute)

Next.js 16 App Router · React 19 · TypeScript strict · Tailwind CSS v4 · shadcn/ui (restyled) ·
next-intl (`en` default, `ar`) · Dexie (IndexedDB) · Supabase (`@supabase/supabase-js`, `@supabase/ssr`) ·
Serwist (`@serwist/turbopack`) · vaul · motion (`motion/react`) · lucide-react · recharts · sonner · zod.
Hosting: Vercel Hobby. Node ≥ 20.9. Package manager: **npm**.

Next 16 naming: request interception lives in **`proxy.ts`** (not `middleware.ts`).
Never use `next-pwa` (unmaintained, webpack-only).

## 3. Hard architecture rules

1. **Screens never import Supabase.** All data goes through the `Repository` interface in
   `src/lib/data/repository.ts`, obtained from the `useRepository()` hook.
2. **Writes go through the browser** (repository → Dexie → outbox → Supabase). No Server Actions for writes — they cannot queue offline.
3. **IDs are generated on the phone** with `crypto.randomUUID()`; sync uses `upsert` so retries never duplicate.
4. **Money:** `numeric(14,2)` in the DB; in TS keep amounts as numbers rounded to 2 dp at the edge; display only via `money()` in `src/lib/format`. Currency is EGP.
5. **Hierarchy:** Category → Subcategory → Item. An expense/income entry stores only `item_id`. Transfers store `to_account_id` and no item.
6. **Nothing is hard-deleted.** Entries: set `deleted_at` (restorable 30 days). Categories, items, wallets: set `is_archived`.
7. **The database is the security boundary.** Every table has RLS; never weaken a policy or grant to make UI code work. Run Supabase `get_advisors` after any schema change.
8. Server Components only for: the auth redirect shell and the first render of Reports → Overview. Everything else is a Client Component.

## 4. Design non-negotiables (full spec: `docs/DESIGN.md`)

- Looks like a premium App Store app. Calm, warm, spacious. **No tables, grids lines, or dense lists** — except the Breakdown pivot, which follows its own spec.
- Tokens only, from `src/app/tokens.css` (copied from `design/tokens.css`). Never hard-code hex colours, px font sizes, or shadows in components.
- Font: IBM Plex Sans Arabic for both scripts; `tabular-nums` on every amount.
- Body text ≥ 17px, tap targets ≥ 48px, one primary action per screen.
- **RTL:** only logical utilities — `ms-/me-/ps-/pe-/start-/end-/text-start/text-end/rounded-s/rounded-e`. Never `ml-/mr-/pl-/pr-/left-/right-/text-left/text-right`. Directional icons (chevrons, arrows) flip with `rtl:rotate-180`.
- No raw strings in components — every user-facing string comes from `messages/en/<namespace>.json` + `messages/ar/<namespace>.json` (add both every time).
- **Western digits (0–9) everywhere, in both languages.** Arabic is for wording only. Format with `numberingSystem: 'latn'`.
- Amount entry uses the custom on-screen `AmountPad` — never the iOS keyboard. Normalise Arabic-Indic digits (٠-٩) and `٫` with `normalizeDigits()` anywhere text becomes a number.
- Feedback: Undo toasts (6 s) instead of "Are you sure?" dialogs. Offline is never an error.
- Motion 150–250 ms, ease-out; honour `prefers-reduced-motion`.
- Light and dark mode both first-class (follow iOS setting).

## 5. Commands

```bash
npm run dev          # local dev (service worker disabled in dev)
npm run build        # production build — must pass before you report done
npm run lint
npm run typecheck    # tsc --noEmit
npm test             # vitest (pure logic: format, pivot, sync)
```
Supabase work goes through the **Supabase MCP** (`apply_migration`, `execute_sql`,
`generate_typescript_types`, `get_advisors`). Never paste secrets into code or commits.

## 6. Where things live

```
docs/PLAN.md        full build plan (architecture, schema, offline, PWA, roadmap)
docs/DESIGN.md      design system + screen-by-screen spec  ← read for any UI task
docs/ORCHESTRATION.md  who does what, branches, folders, shared-file ownership
docs/PROGRESS.md    step checklist + assignments — edited only by the orchestrator
design/tokens.css   source of truth for colour/type/radius tokens
messages/en|ar/     all UI strings, one JSON file per namespace (screen)
supabase/migrations SQL — applied in Phase B via MCP, never edited after being applied
supabase/tests      RLS smoke test (runs inside a rolled-back transaction)
.agents/workflows   one workflow per roadmap step: /a0-scaffold … /b6-handover, /design-review
src/lib/data        Repository interface + mock + live implementations
src/lib/offline     Dexie schema, outbox, sync engine (Phase B)
src/lib/reports     pivot() and report helpers — pure, unit-tested
```

## 7. Definition of done (every step)

1. `npm run build`, `npm run lint`, `npm run typecheck`, `npm test` all pass.
2. Run the **quick /design-review** on every screen you touched (390×844, `/en` light and `/ar` light). Fix what it finds. The full matrix runs once in A8.
3. Commit on your step branch with a clear message (`feat(entry): amount pad and category picker`), push the branch, and open a pull request into `main` using the PR template.
4. Put the one-line notes (what changed, anything deferred, the **Vercel preview URL**) in the PR description. **Do not edit `docs/PROGRESS.md`.** Where a workflow says "tick PROGRESS.md" or "commit and push", this rule replaces it.
5. Report back in one or two lines (step, PR link, open questions), then **continue with the next step in your queue** (`docs/ORCHESTRATION.md` §2). Stop only when your queue is done or every remaining step is BLOCKED.

## 8. Never

- Never work on a step that isn't in your queue, and never on a step assigned to another agent.
- Never commit to `main`, merge pull requests, or rebase/force-push someone else's branch. Only the orchestrator merges.
- Never edit a shared file you don't own (see `docs/ORCHESTRATION.md` §4). Write the change you need in your PR description instead.
- Never install a UI kit other than shadcn/ui, or a state library (React context + Dexie live queries are enough).
- Never add analytics, trackers, or third-party scripts.
- Never cache `*.supabase.co` responses in the service worker.
- Never commit `.env*` files (only `.env.example`).
- Never change an applied migration — add a new numbered migration instead.
