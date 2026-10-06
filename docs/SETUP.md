# Setup — before the first workflow (~30 minutes, done once by you)

## 1. Dedicated accounts (owned by the family, not you)
1. Create a Gmail, e.g. `family.accounts.app@gmail.com`. Keep its password where the family can find it.
2. **GitHub**: sign up with that Gmail. Add your own GitHub account as a collaborator later.
3. **Supabase**: sign in with that GitHub account → New project → Free plan, region `eu-central-1` (Frankfurt), save the database password.
   - Authentication → Sign In / Providers → Email: turn **OFF** "Allow new users to sign up" and **OFF** "Confirm email".
4. **Vercel**: sign up (Hobby) with "Continue with GitHub" using that GitHub account.

## 2. Push this repo
In a terminal (Antigravity has one built in), from this folder:

```bash
# create an EMPTY private repo on github.com first: family-accounts (no README, no .gitignore)
git remote add origin https://github.com/<family-account>/family-accounts.git
git push -u origin main
```
The repo already contains one commit. Keep the repo **private** — backups will contain their finances.

## 3. Antigravity (two builder agents) + Claude Code (orchestrator)
Read [`ORCHESTRATION.md`](ORCHESTRATION.md) first. Each Antigravity agent gets its **own folder** (a git worktree);
never point two agents at the same folder. Claude Code keeps `P:\App Builds\Accounting App` for merging.

1. Open `P:\App Builds\family-accounts-ag1` as AG-1's workspace and `P:\App Builds\family-accounts-ag2` as AG-2's. Antigravity reads `AGENTS.md` and `.agents/rules/*.md` automatically;
   the workflows in `.agents/workflows/` appear as slash commands (`/a0-scaffold`, …, `/design-review`).
2. Connect MCP servers (Agent panel → ⋯ → MCP Servers → MCP Store, or edit the raw config).
   Prefer the store entries; `docs/mcp_config.example.json` shows the shape for reference.
   - **Supabase** — scope it to this one project (project ref from the Supabase URL). Needs write access for migrations.
   - **GitHub** — a fine-grained token from the *family* GitHub account, limited to this repo.
   - **Vercel** — optional but handy for env vars and deploy checks.
3. Optional: `npx skills add supabase/agent-skills` adds Supabase's official agent guidance.
4. Agent settings: start in "Agent-assisted" / review mode so you approve terminal commands and file changes for the first few steps.

## 4. Run the build
- Claude Code (the orchestrator) gives you a paste-ready prompt for each agent. Paste it into a **new** conversation for that agent.
- When an agent finishes, tell Claude "AG-x finished <step>". Claude reviews, merges, and hands you the next prompts.
- Open preview links on your iPhone whenever you like; tell Claude anything you dislike and it becomes a fix prompt.
- One step per conversation keeps the agent's context small and focused.

## 5. Local tools (only if you want to run things yourself)
- Node.js 22 (`.nvmrc`), npm.
- Optional local DB test: Postgres 15+ — see the header of `supabase/tests/local_auth_stub.sql`.
