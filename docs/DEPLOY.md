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
| [#105](https://github.com/tamimbadawi/Family-Account/pull/105) | iPhone install steps describe the Share button (square with an up arrow) and every place it can be, instead of "tap ••• at the bottom" |
| [#105](https://github.com/tamimbadawi/Family-Account/pull/105) | **Operator dashboard** at `/operator`: Overview (usage numbers, entries per day), Families (people, sign-ins, entries), Inbox (support messages with who/where/photos), To do (who looks stuck). **On deploy also:** apply migration `0025_operator_insights.sql` and redeploy the `operator` Edge Function, both through the Supabase MCP, then run `get_advisors` |

## Deployed

| Date | PR | What it changed |
|---|---|---|
| 2026-10-12 | [#104](https://github.com/tamimbadawi/Family-Account/pull/104) | Savings goals on the first Reports page; Install app in Settings (iPhone + Android); collapsible More settings |
