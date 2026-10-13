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
| — | Nothing waiting |

## Deployed

| Date | PR | What it changed |
|---|---|---|
| 2026-10-13 | [#113](https://github.com/tamimbadawi/Family-Account/pull/113), [#116](https://github.com/tamimbadawi/Family-Account/pull/116), [#117](https://github.com/tamimbadawi/Family-Account/pull/117), [#118](https://github.com/tamimbadawi/Family-Account/pull/118), [#119](https://github.com/tamimbadawi/Family-Account/pull/119), [#120](https://github.com/tamimbadawi/Family-Account/pull/120) | Money restructure: Home shows "To spend" and "Saved"; Our money is a page (`/money`) with Spending and Saving; goals moved to `/money/goals`; investments (gold, certificate, stocks, property, other) with Add money, Take out and Update value; wallet pickers grouped by purpose; Reports wallet card in three groups; "What we have" and Balance over time no longer add spending and saved together; Our money help guide. Migration `0026_money_purposes` applied first |
| 2026-10-13 | [#115](https://github.com/tamimbadawi/Family-Account/pull/115) | Speed: Settings → Family, Currencies and the name on Home open from the copy on the phone and no longer wait on the server; a test fails if a screen calls the server when it opens |
| 2026-10-13 | [#110](https://github.com/tamimbadawi/Family-Account/pull/110) | Settings → More settings shows "Admin panel" (opens `/operator`) for the operator only, so it can be reached from the installed iPhone app |
| 2026-10-13 | [#114](https://github.com/tamimbadawi/Family-Account/pull/114) | Tooling (merged with the release): `ui:feature` and `ui:site` checks for the agents. Small phones: the Welcome form scrolls to its button, entry captions wrap instead of being cut |
| 2026-10-12 | [#109](https://github.com/tamimbadawi/Family-Account/pull/109) | Tap any total to see the entries behind it: Reports categories (incl. search results), Overview totals and donut, every report (goals, people, wallets, bills, budgets, income, months), Home top categories. History opens already filtered, with a Back button; entries in drill-down lists show their date; arrows point the reading direction in Arabic |
| 2026-10-12 | [#108](https://github.com/tamimbadawi/Family-Account/pull/108) | History shows the total of a search or filter (e.g. "bread": money out and how many times this month), with "See its history" to open that item's trend card; Reports → All categories gets a search box (find a category, group or item by name with its total this month) |
| 2026-10-12 | [#107](https://github.com/tamimbadawi/Family-Account/pull/107) | Fix: the installed app no longer opens with empty Reports and History after waking up (it never empties its copy without a sign-in, and pulls again when the sign-in returns) |
| 2026-10-12 | [#106](https://github.com/tamimbadawi/Family-Account/pull/106) | Help guides: a Help button with step-by-step spotlight tours of every main screen, English and Arabic |
| 2026-10-12 | [#105](https://github.com/tamimbadawi/Family-Account/pull/105) | Operator dashboard at `/operator` (Overview, Families, Inbox, To do); iPhone install steps describe the Share button. Migration `0025_operator_insights` applied and `operator` Edge Function redeployed (v6); `get_advisors` shows no new warnings |
| 2026-10-12 | [#104](https://github.com/tamimbadawi/Family-Account/pull/104) | Savings goals on the first Reports page; Install app in Settings (iPhone + Android); collapsible More settings |
| 2026-10-12 | [#103](https://github.com/tamimbadawi/Family-Account/pull/103) | Instant sync between devices (Supabase Realtime on 10 tables, debounce/reconnect scheduler, quiet updating pill); sample savings goals in mock data. Migration `0024_realtime` applied |
| 2026-10-12 | [#102](https://github.com/tamimbadawi/Family-Account/pull/102) | Full download when the phone's copy is empty and on every sign-in; sign-out answers on the first tap. Vercel did not start a deployment for this merge, so it went live with `vercel deploy --prod` from the linked `wt-release` folder |
| 2026-10-12 | [#101](https://github.com/tamimbadawi/Family-Account/pull/101) | Sign-in, join, welcome and choose-password move on with a full page load |
| 2026-10-12 | [#100](https://github.com/tamimbadawi/Family-Account/pull/100) | Goals from the + sheet, goal card and entries list, goals in Reports, sample goals (migration `0023`), currencies in Settings, member invite link lasts 24 hours (`family-admin` function v8), sign-out lands on sign-in |
| 2026-10-12 | [#99](https://github.com/tamimbadawi/Family-Account/pull/99) | Also carries #97 and #98: searchable currency picker, invite links for members and new families, M3 currencies, savings goals fixes (add goal, add money from a wallet, take money out), Recently deleted without placeholder cards |

## Parked

Not deployed, and not part of a deploy unless the owner says so.

| Item | Where | Note |
|---|---|---|
| Security hardening (migration `0016_security_hardening`, Settings page, backup workflow) | branch `fix/sec-hardening-and-session-purge` (pushed, WIP, no PR) | Migration not applied; its number clashes with `0016_support_messages` |
| Older security hardening + local auth (40 files) | branch `fix/sec-database-hardening` (pushed, WIP) and local stash "wip-before-r1" | WIP |
| A8c polish sweep (tap targets, tokens, breakdown chips; 6 files) | PR #48 closed unmerged, branch `step/a8c-sweep` | From 2026-10-07, never went live |
| Headless UI test scripts | PR #81 (draft) | Test tooling only, no change to the app |
| Early draft of custom recurrence and a donut size tweak | local branch `backup/main-draft-2026-10-13` (not pushed) | Replaced by PR #96 and the M3 donut change; kept only as a backup |

## Known issues, not fixed

- Settings at 360×640 hides "Sign out".
- Receipt photo thumbnail is off screen at 360×640.

## Notes

- If a merge to `main` does not start a Vercel deployment, deploy with `vercel deploy --prod` from the linked `wt-release` folder (happened with #102).
- Checked 2026-10-12: PR #73 (replaced by #75), PR #87 (replaced by #90), `archive/*` and `test-merge-retention` hold nothing that still needs to go live.
