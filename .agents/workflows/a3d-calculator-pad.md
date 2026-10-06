---
description: Step A3d — simple arithmetic (+ − × ÷) in the AmountPad, with a live result.
---

# A3d · Calculator in the number pad

Precondition: the fit/income fix (fix/fit-and-income) is merged. You own `src/components/entry/**`.
Read `AGENTS.md` and `docs/DESIGN.md` §4 "Add / Edit entry" (AmountPad).

1. Pure helper `src/lib/format/expression.ts`: `evaluateExpression(tokens)` for + − × ÷ with normal precedence
   (× ÷ before + −), no `eval`/`Function`. Result rounded to 2 dp; `null` when incomplete, when dividing by zero,
   or when the result is ≤ 0. Extend `applyKey(value, key)` to accept operator keys: an operator after an
   operator replaces it; the max is 2 decimals per number; at most 12 numbers. Thorough vitest tests,
   including `120+85+40=245`, `1000/4=250`, `10-20 → null`, `5/0 → null`, `2+3×4=14`.
2. AmountPad becomes 4 columns × 4 rows: digits on the start side, operators in the inline-end column
   (÷ × − + from top to bottom). The keys keep the 64px height; the operator keys use a subtle accent tint.
   Western digits; RTL-correct column placement.
3. Display: while an expression has an operator, show the expression in one small line (text-body, ink-muted,
   e.g. `120 + 85 + 40`) above the big amount, and the big amount shows the live result (`245`). With no
   operator, it looks exactly like today. If the result is invalid, the big amount shows "—" and Save is
   disabled with a short hint (messages in `messages/{en,ar}/entry.json`).
4. Save stores the RESULT only (the expression is not stored).
5. The sheet must still fit 390x844 and 375x667 without scrolling (phase 1 = type + amount + pad + Next).
6. Quick `/design-review` (`/en` + `/ar`), RTL grep, then Definition of Done.
