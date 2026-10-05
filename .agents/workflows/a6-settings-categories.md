---
description: Step A6 — Settings screen, 3-level category manager (add, rename, icon/colour, reorder, archive), wallet manager, language switch.
---

# A6 · Settings and category manager

Read `AGENTS.md` and `docs/DESIGN.md` §4 Settings.

1. Settings: iOS-style grouped inset list with the items in DESIGN §4. Family, Download, Sign out are placeholders until Phase B (Download can already export mock data as CSV).
2. Category manager (`src/app/[locale]/(app)/settings/categories/...`): tabs Expense/Income; drill-down Category → Subcategory → Item; "+ إضافة" at every level including whole new categories; rename; icon & colour picker (`src/components/settings/ColorIconPicker.tsx`: 12 colours, 40 curated Lucide icons); reorder mode with drag handles (`sort_order`); archive with the explanatory sentence; "Show archived" toggle to un-archive.
3. Wallet manager: add, rename, type (cash/bank/card/wallet), opening balance (AmountPad), archive.
4. Language: Arabic/English switch (changes route locale and stores preference); digit style option (Western / Arabic-Indic).
5. `/design-review` and Definition of Done.
