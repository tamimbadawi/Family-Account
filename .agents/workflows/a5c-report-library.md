---
description: Steps A5c / A5d / A5e — the Reports library (17 reports in three groups). A5c = hub + Money flow, A5d = Banks & cash, A5e = Planning.
---

# A5c–A5e · Reports library

Read `AGENTS.md`, `docs/DESIGN.md` (§3 native-app feel, §4 Reports) and `src/lib/reports/` (pivot engine).
Rules for EVERY report screen: the page never scrolls; it fits 390×844 and 375×667; lists (Biggest expenses,
Search results, Transfers log) scroll only inside their card; body text 17px; amounts `tabular-nums` via
`money()`; Western digits; tokens only; light and dark; RTL-correct (charts mirrored). Show less rather than
shrink. Every report has a short one-line explanation under its title, in plain words for an older user.

## Architecture (A5c builds it; A5d and A5e reuse it)
- **Pure report functions** in `src/lib/reports/<name>.ts`, each taking `(entries, lookups, options)` from
  `repo.entriesForPivot()` plus wallets, returning plain data. No React or Dexie imports. A vitest test for each.
- **Registry** `src/lib/reports/registry.ts`: `{ id, group: 'flow' | 'wallets' | 'planning', icon, titleKey,
  descKey, route }`. Adding a report = one registry line + one function + one screen.
- **Screens** at `src/app/[locale]/(app)/reports/r/[id]/page.tsx` (one shared shell: back chevron + title +
  explanation + optional period chip row; the report body below).
- Strings in `messages/{en,ar}/reports.json` under `library.*`.

## A5c — Hub + Money flow (AG-2)
1. Reports tab header: segmented control **Overview · All reports · Breakdown** (the current Overview pages stay
   as they are). Overview's bank/wallet card opens `OurMoneySheet` (from A2c; until A2c is merged, link to the
   wallet balances page instead).
2. **All reports**: three chips (Money flow / Banks & cash / Planning), then the group's rows (64px: tinted
   icon, title, one-line description, chevron). Each group fits one screen without scrolling.
3. Money flow reports:
   - **This month vs last month**: categories with this month, last month and a ↑/↓ change pill (spending up =
     expense colour, down = income colour). Top 6, then "See all" sheet.
   - **Year summary**: 12 bars (money in vs spent per month) + totals row (in, spent, saved, monthly average).
     Year switcher.
   - **Biggest expenses**: top 10 single entries in the chosen period; tap opens the entry's edit sheet.
   - **Daily spending calendar**: month grid, each day shaded by spend (accent 4–28% by rank, like the pivot
     heat tint); tap a day → sheet with that day's entries. Week starts Saturday.
   - **Income sources**: where money in came from (by item), donut + list, chosen period.
   - **Category deep-dive**: pick a category (chips) → 12-month bar trend, average line, and its subcategories
     and items with totals.

## A5d — Banks & cash (AG-2, after A2c)
   - **Net worth total**: one hero number (all non-archived wallets), change vs last month, then each wallet.
   - **Balance over time**: line per wallet over 6 / 12 months (end-of-month balances), legend as chips that
     toggle lines.
   - **In & out per wallet**: per wallet: money in, money out, transfers in/out, for the chosen month.
   - **Cash withdrawals**: transfers bank → cash wallets, with totals per month; "cash spent since" next to each.
   - **Transfers log**: every transfer (from → to, amount, date), filter by wallet.

## A5e — Planning (AG-1)
   - **Bills tracker**: the Utilities items (electricity, water, gas, internet, mobile) × last 12 months
     (reuse `pivot()` with the "Bills tracker" preset); highlight a bill > 25% above its 6-month average.
   - **Monthly averages**: average monthly spend per category over the last 6 / 12 months, with min and max.
   - **Who spent what**: spending split by family member (created_by), by category.
   - **Search & export**: one search field (word in item, category or note; amount range; date range) →
     results list with total → Share as CSV (`pivotToCsv`-style, UTF-8 BOM) or image.
   - **Unusual spending**: categories this month more than 30% above their 6-month average, with "+X EGP
     above normal" in plain words. Empty state: "Nothing unusual this month 👍".
   - **Spending pace**: spent so far this month vs a typical month by the same day (from the 6-month average),
     as one progress bar and a sentence ("You're 12% ahead of a normal month").

Each part: quick `/design-review` of every new screen (390×844 and 375×667, `/en` light+dark, `/ar` light),
RTL grep, screenshots in the PR description only, Definition of Done.
