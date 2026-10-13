---
trigger: always_on
---

# UI checks: the only way UI is verified

Never use the IDE browser or a browser subagent. Never start or restart the dev server by hand for a check;
the scripts start it once and keep it running, so the next check starts at once. There are exactly two checks.

## 1. The feature you are building

Run after every UI change, before you say anything is done:

```bash
npm run ui:feature
```

It works out from git which screens your changes touch and checks only those (390×844, light, `/en` and `/ar`),
plus only the user flows that go through them. It prints the screens it chose on the first line.
If it misses a screen, name it yourself: `npm run ui:feature -- --routes /settings,/reports`.

Fix every `FAIL` line and run it again. Do not move on with a `FAIL` line.
Do not run the whole-site check while you are still building.

## 2. The whole site

Run once when the feature is finished, before every pull request, and whenever the user says "check the site":

```bash
npm run ui:site
```

It builds the app (only when the code has changed), then checks every screen on the main iPhone and the smallest
Android, in light and dark, in English and Arabic, plus every user flow (including with the keyboard open).
It takes about a minute and a half. Paste its summary line and every `FAIL` line into the PR description.
A PR with any `FAIL` line is not done.

`npm run ui:site -- --full` runs the same on all six phone sizes (about 12 minutes). Only the orchestrator runs
it, as the merge gate before a release.

## For both

- Read only the `FAIL` lines and the last line. Open a screenshot from `.ui-check/` only for a failing screen.
- If a `FAIL` is in code you did not touch, do not fix it; list it in your PR description.
- If the server will not start or every screen fails at once, run `npm run ui:stop` and try once more.
  If it still fails, stop and show the last lines of `.ui-check/server.log`.
- Report in one line: which check, how many screens and flow runs, how many failed, how many seconds.
- `npm run ui:stop` ends the dev server the checks keep running. Run it when you finish for the day.
