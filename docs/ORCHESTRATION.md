# Orchestration — who does what

Three agents share this repo. **The two Antigravity agents build. Claude Code coordinates.**

| Agent | Role | Folder (its own git worktree) | Works on |
|---|---|---|---|
| **AG-1** | Builder (Antigravity) | `P:\App Builds\family-accounts-ag1` | the step assigned to AG-1 in `docs/PROGRESS.md` |
| **AG-2** | Builder (Antigravity) | `P:\App Builds\family-accounts-ag2` | the step assigned to AG-2 in `docs/PROGRESS.md` |
| **Claude** | Orchestrator (Claude Code) | `P:\App Builds\Accounting App` (`main`) | assigning steps, reviewing, merging, `PROGRESS.md`, Supabase/Vercel setup |

## 1. Folders: one per agent, always

Two agents in one folder overwrite each other's files. Each agent opens **only its own folder** as its workspace.
All three folders are worktrees of the same repository, so branches and commits are shared instantly without pushing.

## 2. One step = one branch = one pull request

1. The orchestrator assigns a step in `docs/PROGRESS.md` (owner + branch name) and gives you a prompt.
2. In your folder: `git fetch origin`, then `git switch -c step/<id> origin/main`
   (or `git switch step/<id>` if the orchestrator already created it).
3. Run the step's workflow (`/a1-design-system`, …). Commit only on your step branch.
4. Before opening the PR: `git fetch origin && git rebase origin/main`, then build/lint/typecheck/test again.
5. Push the branch, open a PR into `main` with the template, and stop. Report the PR link and preview URL.
6. The orchestrator reviews. Fix requested changes on the same branch. The orchestrator merges.

## 3. Waves (what can run in parallel)

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

When the user says "AG-x finished <step>":
1. Fetch, check out the PR branch, `npm ci && npm run build && npm run lint && npm run typecheck && npm test`.
2. Review the diff against `AGENTS.md`, `docs/DESIGN.md` and the step's workflow; open the preview at 390×844 (`/en` light/dark, `/ar` light).
3. If changes are needed, give the user a paste-ready fix prompt for that agent.
4. Otherwise merge into `main` (`--no-ff`), push, tick the step in `PROGRESS.md` with the agent's note, apply any shared-file requests.
5. Assign the next step(s) and hand the user paste-ready prompts for each agent.
