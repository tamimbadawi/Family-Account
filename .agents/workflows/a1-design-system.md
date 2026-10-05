---
description: Step A1 — fonts, tokens, restyled shadcn/ui primitives, format helpers, and a styleguide page.
---

# A1 · Design system

Read `AGENTS.md`, `docs/DESIGN.md` §2–3, and `design/tokens.css`.

1. Font: IBM Plex Sans Arabic via `next/font/google` (subsets `arabic`,`latin`; weights 400/500/600/700; `variable: '--font-plex-arabic'`, `display: 'swap'`), applied on `<html>`.
2. shadcn/ui: `components.json` already exists — run `npx shadcn@latest init` accepting it (keep our aliases), then add: `button card input label tabs switch drawer dialog dropdown-menu skeleton sonner separator scroll-area`. (`drawer` uses vaul.)
3. Copy `design/tokens.css` → `src/app/tokens.css` and `@import "./tokens.css";` at the **end** of `globals.css` so our values override shadcn's. Remove shadcn's `.dark` class block (we follow the OS setting via media query).
4. Restyle each primitive to the spec: buttons `h-14 rounded-2xl text-body font-semibold` (primary = accent), cards `rounded-card bg-surface shadow-card p-5`, drawer `rounded-t-sheet shadow-sheet` with a grab handle, inputs `h-14 rounded-2xl bg-surface-2 text-body`.
5. `src/lib/format/`: `money(amount, locale, {sign?, compact?})`, `normalizeDigits(str)` (Arabic-Indic and Eastern Arabic-Indic digits, `٫`→`.`, `٬`/`,`→''), `pickName(row, locale)`, `formatDay(date, locale)` (Today/Yesterday/weekday). Vitest tests for each.
6. Build `src/app/[locale]/styleguide/page.tsx`: colour swatches, type scale, buttons (all states), card, chips, segmented control, an EntryRow sample, an empty state, skeletons — in the current theme.
7. Run `/design-review` on `/ar/styleguide` and `/en/styleguide` (light + dark). Then do the Definition of Done in AGENTS.md §7.
