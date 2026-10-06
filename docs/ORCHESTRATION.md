# Orchestration — who does what

**Four Antigravity chats build (two per account). Claude Code coordinates.**

| Chat | Account | Folder (its own git worktree) | Dev server | Queue |
|---|---|---|---|---|
| **AG-1** | account-one | `P:\App Builds\family-accounts-ag1` | `npm run dev -- -p 3001` | AG-1 in `docs/PROGRESS.md` |
| **AG-1B** | account-one | `P:\App Builds\family-accounts-ag1b` | `npm run dev -- -p 3003` | AG-1B |
| **AG-2** | account-two | `P:\App Builds\family-accounts-ag2` | `npm run dev -- -p 3002` | AG-2 |
| **AG-2B** | account-two | `P:\App Builds\family-accounts-ag2b` | `npm run dev -- -p 3004` | AG-2B |
| **Claude** | Claude Code | `P:\App Builds\Accounting App` (`main`) | `npm run dev` (3000) | reviewing, merging, `PROGRESS.md`, **all Vercel and Supabase configuration** |

Builders use Supabase only through the MCP calls their workflow names (B1+).

## 1. Folders: one per chat, always

Two chats in one folder overwrite each other's files. Each chat opens **only its own folder** as its workspace.
All folders are worktrees of the same repository, so branches and commits are shared instantly without pushing.
Each folder needs its own `npm install` once, and uses its own dev-server port (table above).

## 2. Queue mode: work through your queue without waiting

Each chat has a **queue** in `docs/PROGRESS.md`. One step = one branch = one pull request, and you move on
as soon as the PR is open. Never wait for a review of your own previous step.

For each step in your queue, in order:
1. `git fetch origin`, then read the current board with `git show origin/main:docs/PROGRESS.md`.
   Skip steps already ✅ or that have an open PR from you.
2. Check the step's **Needs merged first** column against `origin/main`:
   - Everything merged → `git switch -c step/<id> origin/main`.
   - The only thing missing is **your own** previous step → stack on it: `git switch -c step/<id> step/<previous>`
     and write "Stacked on step/<previous>" at the top of the PR description.
   - Something from **another chat** (bold) is missing → try your next step that isn't blocked. If every remaining
     step is blocked, stop and report `BLOCKED on <step>`. Don't wait or poll.
3. Run the step's workflow. Commit only on that branch.
4. `git fetch origin && git rebase origin/main` (stacked: rebase on your previous branch), then build/lint/typecheck/test.
5. Push, open the PR into `main` with the template, and go straight back to 1.
6. If the orchestrator posts review comments, fix them on that step's branch before starting your next step.

**Speed rules:**
- Per-step `/design-review` is the **quick** version: 390×844 only, `/en` light and `/ar` light. The full matrix
  (430×932, dark mode, every state) runs once in A8.
- Don't gold-plate. Build what the workflow and DESIGN.md say, make it look right, open the PR, move on.
- If the conversation gets long or slow, start a new conversation with the same queue prompt.
  The board is the memory, so you lose nothing.

## 3. Timeline (overview; the queues in `docs/PROGRESS.md` are the source of truth)

| Wave | AG-1 | AG-1B | AG-2 | AG-2B |
|---|---|---|---|---|
| 0 | A0 scaffold | — | A7-icon | — |
| 1 | A1 design system | — | A2a data layer | — |
| 2 | A2b shell + Home | A3a entry parts | — (waits for A2b) | A5b-logic → A7 PWA |
| 3 | A3b entry sheet ⭐ | A6 settings | A5 reports overview | (A7 continues) |
| 4 | A4 history | — | A5b breakdown UI | — |
| 5 | A8 polish (alone: it touches everything) | — | — | — |
| — | 🚦 Family test on the **production URL** → A9 fixes (AG-1) | | | |
| B | B1 → B2 → B3 → B6 (AG-1) | | B5 (after B1) → B4 (after B3) (AG-2) | |

More than four chats would not help: the remaining steps depend on each other.

## 4. Shared files: one owner each

Only the owner edits these. Anyone else writes the change they need under "Shared-file change requests" in their PR,
and the orchestrator applies it when merging.

| File | Owner |
|---|---|
| `docs/PROGRESS.md`, `docs/ORCHESTRATION.md`, `AGENTS.md`, `.agents/**` | Claude |
| `src/lib/data/repository.ts`, `types.ts`, `mappers.ts`, `src/lib/offline/db.ts` | AG-2 (from A2a) |
| `src/app/globals.css`, `src/app/tokens.css`, `src/components/ui/**` | AG-1 (from A1) |
| `src/app/[locale]/layout.tsx`, `src/app/[locale]/(app)/layout.tsx`, `src/components/layout/**` | AG-1 (A0/A2b); AG-2B may add iOS metadata in A7 |
| `src/components/entry/**` | AG-1B (A3a), then AG-1 (from A3b) |
| `src/lib/reports/**` | AG-2B (A5b-logic), then AG-2 |
| `src/i18n/request.ts` namespace list | whoever adds a namespace (one line; conflicts are trivial) |
| `messages/{en,ar}/<ns>.json` | the chat building that screen |
| `package.json` / `package-lock.json` | anyone may add deps; on conflict take `main`'s lockfile and rerun `npm install` |

## 5. Orchestrator loop (Claude)

Whenever the user says a chat opened a PR or is BLOCKED (or just "check"):
1. `git fetch`; find every new `step/*` branch on origin. Merge in dependency order (stacked branches after their base).
2. For each: build, lint, typecheck, test, and a quick look at the diff and preview against `AGENTS.md`, `DESIGN.md` and the workflow.
3. Green and on-spec → merge into `main` (`--no-ff`), push, mark ✅ in `PROGRESS.md` with the chat's note, apply shared-file requests.
4. Not OK → fix trivial issues myself during the merge; otherwise give the user a short paste-ready fix prompt for that chat.
5. If a chat was BLOCKED and is now unblocked, tell the user to send it: "continue your queue".
