---
trigger: always_on
---

# Design quality is the product

The users are two older, non-technical people on iPhones. The interface is make-or-break:
if it looks like a form or a spreadsheet, the project has failed even if the code is perfect.

Before writing any UI, read `docs/DESIGN.md` (the section for the screen you are building).

Always:
- Use tokens from `src/app/tokens.css` via Tailwind classes (`bg-canvas`, `text-ink`, `text-ink-muted`,
  `bg-surface`, `border-line`, `text-accent`, `text-income`, `text-expense`, `rounded-card`, `rounded-sheet`).
  Never write hex colours, arbitrary px values, or custom shadows inside components.
- One hero element per screen (usually a large amount, `text-hero tabular-nums`).
- Generous spacing on an 8-pt rhythm (`gap-2/3/4/6/8`, screen padding `px-5`).
- Category identity = Lucide icon inside a soft tinted circle in the category colour.
- Every list has an empty state (illustration or large icon + one friendly sentence + one action).
- Every async view has a skeleton, not a spinner.
- Tap targets ≥ 48px; primary buttons full-width, `h-14`, `rounded-2xl`.
- Copy: short, warm, everyday words. "Spent this month", not "Total expenditure". No jargon:
  never "transaction", "ledger", "debit", "credit" in the UI — say "entry", "money in", "money out".

Never:
- Data tables, grid lines, zebra stripes, or more than one level of nesting on a screen
  (exception: the Breakdown pivot in Reports, which has its own spec).
- Modal "Are you sure?" dialogs for reversible actions — use an Undo toast.
- Hover-only affordances, tiny icon-only buttons without labels, or text below 15px.
- Default shadcn grey look — every component must be restyled to the palette.

After building anything visual, run the `/design-review` workflow before you report done.
