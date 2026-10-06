---
description: Step A3b — assemble the Add/Edit entry bottom sheet from the A3a parts, with validation, save, checkmark and Undo.
---

# A3b · Add-entry sheet (most important screen)

Precondition: A2b and A3a are merged into `main`.
Read `AGENTS.md` and `docs/DESIGN.md` §4 "Add / Edit entry" carefully — follow its order exactly.
The parts already exist in `src/components/entry/` (from A3a). Reuse them; adjust them only where the assembled sheet needs it.

1. `EntrySheet` (vaul drawer, 92% height, grab handle; `mode: 'add' | 'edit'`), opened from the floating Add button on Home (and History later).
2. Layout top → bottom per DESIGN: TypeToggle, AmountDisplay, step area (Recents → CategoryPicker; transfer mode → two WalletPickers "From" → "To"), AmountPad, review strip (DateChips, wallet chip defaulting to last used, note), Save.
3. Switching type filters categories by kind and recolours the amount.
4. Save: zod validation (`src/lib/validation/entry.ts`), repository write, checkmark animation, close, sonner toast with Undo (6 s) that reverts the write.
5. Edit mode prefilled from an entry, title "Edit", with a quiet "Delete" button → soft delete + Undo toast.

Test on the phone-sized viewport that a typical expense takes: amount + 2 taps (recent) or amount + 3 taps (full path) + Save.
Then quick `/design-review` (sheet in each step, expense and transfer, `/en` and `/ar`) and Definition of Done.
