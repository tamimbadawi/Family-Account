---
description: Step A3a — the Add-entry building blocks as standalone components (amount pad, type toggle, category picker, wallet picker, date chips) on a demo page. A3b assembles them into the sheet.
---

# A3a · Add-entry parts

Precondition: A1 and A2a are merged into `main`.
Read `AGENTS.md` and `docs/DESIGN.md` §4 "Add / Edit entry" carefully. You build the parts, **not** the sheet.

Build in `src/components/entry/` (each a Client Component with clear props, no knowledge of the sheet):
1. `TypeToggle` — segmented control expense / income / transfer; `value`, `onChange`.
2. `AmountDisplay` + `AmountPad` — custom 4×3 keypad, 64px keys, Western digits 0–9 in both languages, "." decimal, backspace, max 2 decimals, max 9,999,999.99. Value is a string state machine exported as a pure helper (`applyKey(value, key)`) with vitest tests. Never opens the iOS keyboard.
3. `CategoryPicker` — Recents chips (from `useRecentItems(6)`, one tap → `onPick(item)`) → category tiles (3-col) → subcategory rows → item rows; breadcrumb back; animated horizontal slide between steps (direction-aware for RTL). "+ New" at each level opens a small inline form (name + icon/colour for categories), saves through the repository, and selects the new node. Props: `kind`, `onPick`.
4. `WalletPicker` — `value`, `onChange`, optional `exclude` (for transfers: from ≠ to).
5. `DateChips` (Today / Yesterday / Pick → native `<input type="date">`, font-size ≥ 16px; local dates only), `NoteField` (single line, 500 chars).
6. Demo page `src/app/[locale]/styleguide/entry/page.tsx` showing every part in every state (this is a new page; do not edit A1's styleguide page).
7. Quick `/design-review` on `/en/styleguide/entry` and `/ar/styleguide/entry`, then Definition of Done.

You own `src/components/entry/**` until A3b is merged; A3b may then change it.
