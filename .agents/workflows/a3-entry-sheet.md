---
description: Step A3 — the Add/Edit entry bottom sheet with amount pad, type toggle, 3-step category picker, recents, date and wallet chips, and undo.
---

# A3 · Add-entry sheet (most important screen)

Read `AGENTS.md` and `docs/DESIGN.md` §4 "Add / Edit entry" carefully — follow its order exactly.

Build in `src/components/entry/`:
1. `EntrySheet` (vaul drawer, 92% height, grab handle, opens from the Home/History Add button; `mode: 'add' | 'edit'`).
2. `TypeToggle` — segmented control expense/income/transfer; switching type filters categories by kind and recolours the amount.
3. `AmountDisplay` + `AmountPad` — custom 4×3 keypad, 64px keys, locale digits, decimal, backspace, max 2 decimals, max 9,999,999.99. The iOS keyboard must never open for the amount.
4. `CategoryPicker` — Recents chips (6 most-used items, one tap → Review) → category tiles (3-col) → subcategory rows → item rows; breadcrumb back; animated horizontal slide between steps (direction-aware for RTL). "+ جديد" at each level opens a small inline form (name + icon/colour for categories) and selects the new node.
5. Transfer mode: `WalletPicker` from → to (cannot be the same).
6. `DateChips` (Today / Yesterday / Pick → native `<input type="date">`, font-size ≥ 16px), `WalletChip` (defaults to last used), optional note (single line, 500 chars).
7. Save: zod validation (`src/lib/validation/entry.ts`), repository write, checkmark animation, close, sonner toast with Undo (6 s) that reverts the write.
8. Edit mode prefilled from an entry, with a quiet "حذف" button → soft delete + Undo toast.

Test on the phone-sized viewport that a typical expense takes: amount + 2 taps (recent) or amount + 3 taps (full path) + Save.
Then `/design-review` (sheet in every step, both types, both languages, both themes) and Definition of Done.
