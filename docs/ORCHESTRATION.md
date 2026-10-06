# Orchestration — who does what

Three agents share this repo. **The two Antigravity agents build. Claude Code coordinates.**

| Agent | Role | Folder (its own git worktree) | Works on |
|---|---|---|---|
| **AG-1** | Builder (Antigravity) | `P:\App Builds\family-accounts-ag1` | the step assigned to AG-1 in `docs/PROGRESS.md` |
| **AG-2** | Builder (Antigravity) | `P:\App Builds\family-accounts-ag2` | the step assigned to AG-2 in `docs/PROGRESS.md` |
| **Claude** | Orchestrator (Claude Code) | `P:\App Builds\Accounting App` (`main`) | assigning steps, reviewing, merging, `PROGRESS.md`, **all Vercel and Supabase configuration** (projects, env vars, crons). Builders use Supabase only through the MCP calls their workflow names (B1+) |

## 1. Folders: one per agent, always

Two agents in one folder overwrite each other's files. Each agent opens **only its own folder** as its workspace.
All three folders are worktrees of the same repository, so branches and commits are shared instantly without pushing.

Each folder has its own `node_modules` (run `npm install` once in your folder) and its own dev-server port,
so both agents can run the app at the same time:

| Agent | Dev server |
|---|---|
| AG-1 | `npm run dev -- -p 3001` → http://localhost:3001 |
| AG-2 | `npm run dev -- -p 3002` → http://localhost:3002 |
| Claude | `npm run dev` → http://localhost:3000 |

## 2. Queue mode: work through your queue without waiting

Each agent has a **queue** in `docs/PROGRESS.md`. One step = one branch = one pull request, and you move on
as soon as the PR is open. Never wait for a review of your own previous step.

For each step in your queue, in order:
1. `git fetch origin`, then read the current board with `git show origin/main:docs/PROGRESS.md`.
   Skip steps already ✅ or that have an open PR from you.
2. Check the step's **Needs merged first** column against `origin/main`:
   - Everything merged → `git switch -c step/<id> origin/main`.
   - The only thing missing is **your own** previous step → stack on it: `git switch -c step/<id> step/<previous>`
     and write "Stacked on step/<previous>" at the top of the PR description.
   - Something from the **other agent** is missing → try your next step that isn't blocked. If every remaining
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

## 3. Waves (overview; the queues in `docs/PROGRESS.md` are the source of truth)

| Wave | AG-1 | AG-2 | Depends on |
|---|---|---|---|
| 0 | **A0** scaffold + Vercel | **A7-icon** app icon/logo SVG only (`design/logo.svg`, `design/icon.svg`) | — |
| 1 | **A1** design system | **A2a** data layer + sample data (no UI) | A0 |
| 2 | **A2b** shell + Home | **A7** PWA, login, welcome, install | A1 + A2a / A1 |
| 3 | **A3** Add-entry sheet ⭐ | **A5** Reports overview | A2b |
| 4 | **A4** History + edit + Recently deleted | **A5b** Breakdown pivots | A3 / A5 |
| 5 | **A6** Settings + category manager | — | A2b |
| 6 | **A8** polish pass (one agent only: it touches everything) | — | all of Phase A |
| — | 🚦 Family test on the **production URL** → **A9** fixes (AG-1) | | |
| B | **B1** database → **B2** auth → **B3** live sync → **B6** handover | **B5** keep-alive + backups (after B1) → **B4** reports live (after B3) | Family approval |

## 4. Shared files: one owner each

Only the owner edits these. Anyone else writes the change they need under "Shared-file change requests" in their PR,
and the orchestrator applies it when merging.

| File | Owner |
|---|---|
| `docs/PROGRESS.md`, `docs/ORCHESTRATION.md`, `AGENTS.md`, `.agents/**` | Claude |
| `src/lib/data/repository.ts`, `types.ts`, `mappers.ts`, `src/lib/offline/db.ts` | AG-2 (from A2a) |
| `src/app/globals.css`, `src/app/tokens.css`, `src/components/ui/**` | AG-1 (from A1) |
| `src/app/[locale]/layout.tsx`, `src/app/[locale]/(app)/layout.tsx`, `src/components/layout/**` | AG-1 (A0/A2b); AG-2 may add iOS metadata in A7 |
| `src/i18n/request.ts` namespace list | whoever adds a namespace (one line; conflicts are trivial) |
| `messages/{en,ar}/<ns>.json` | the agent building that screen |
| `package.json` / `package-lock.json` | anyone may add deps; on conflict take `main`'s lockfile and rerun `npm install` |

## 5. Orchestrator loop (Claude)

Whenever the user says an agent opened a PR or is BLOCKED (or just "check"):
1. `git fetch`; find every new `step/*` branch on origin. Merge in dependency order (stacked branches after their base).
2. For each: build, lint, typecheck, test, and a quick look at the diff and preview against `AGENTS.md`, `DESIGN.md` and the workflow.
3. Green and on-spec → merge into `main` (`--no-ff`), push, mark ✅ in `PROGRESS.md` with the agent's note, apply shared-file requests.
4. Not OK → fix trivial issues myself during the merge; otherwise give the user a short paste-ready fix prompt for that agent.
5. If an agent was BLOCKED and is now unblocked, tell the user to send it: "continue your queue".
