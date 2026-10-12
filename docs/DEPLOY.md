# Deploy queue

Changes that are finished and checked, waiting to go live. Nothing here is live yet.

**How it works**
- Every finished change is a pull request into `main` with green checks. It is added to **Waiting** below and is **not** merged.
- When the owner says **"deploy"**, every pull request under **Waiting** is merged into `main`, top to bottom, and the live app updates once (Vercel deploys `main` by itself, nothing to do in Vercel).
- After the deploy, the merged items move to **Deployed** with the date.
- If a pull request goes red or has a conflict before the deploy, it is fixed first; it is never merged red.

## Waiting

| PR | What it changes |
|---|---|
| [#108](https://github.com/tamimbadawi/Family-Account/pull/108) | History shows the total of a search or filter (e.g. "bread": money out and how many times this month), with "See its history" to open that item's trend card |

## Deployed

| Date | PR | What it changed |
|---|---|---|
| 2026-10-12 | [#107](https://github.com/tamimbadawi/Family-Account/pull/107) | Fix: the installed app no longer opens with empty Reports and History after waking up (it never empties its copy without a sign-in, and pulls again when the sign-in returns) |
| 2026-10-12 | [#106](https://github.com/tamimbadawi/Family-Account/pull/106) | Help guides: a Help button with step-by-step spotlight tours of every main screen, English and Arabic |
| 2026-10-12 | [#105](https://github.com/tamimbadawi/Family-Account/pull/105) | Operator dashboard at `/operator` (Overview, Families, Inbox, To do); iPhone install steps describe the Share button. Migration `0025_operator_insights` applied and `operator` Edge Function redeployed (v6); `get_advisors` shows no new warnings |
| 2026-10-12 | [#104](https://github.com/tamimbadawi/Family-Account/pull/104) | Savings goals on the first Reports page; Install app in Settings (iPhone + Android); collapsible More settings |
