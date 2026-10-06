---
description: Step A2c — several banks plus cash at home: sample data, "Our money" sheet, and Update balance.
---

# A2c · Wallets: banks + cash at home

Read `AGENTS.md`, `docs/DESIGN.md` and `supabase/migrations/0005_wallets_and_corrections.sql` (the server side
is already done: new households get "Cash at home" and an "Adjustments → Balance correction" item for both kinds).
You own the data layer. AG-1 owns Home and adds the "Our money" row to it, using the component you build here.

1. Sample data (`mock-seed.ts`): wallets **Cash at home** (كاش في البيت, cash), **NBE** (البنك الأهلي, bank),
   **CIB** (بنك CIB, bank) and **Banque Misr** (بنك مصر, bank), with realistic opening balances and entries spread
   across them (pension into NBE, rent into CIB, ATM transfers bank → cash, groceries mostly cash). Also seed
   the Adjustments categories and Balance correction items exactly like `seed_corrections` in 0005.
   Bump the mock seed version so existing phones reseed `fa-mock` once.
2. Repository: `adjustWalletBalance(walletId, actualBalance, occurredOn)` computes the difference from the current
   balance and adds an income or expense entry with the matching Balance correction item (nothing when the
   difference is 0). Update the interface, the mock implementation and the tests.
3. `src/components/wallets/OurMoneySheet.tsx`: a bottom sheet with the total of all non-archived wallets as the hero
   (text-hero, tabular-nums), then one 56px row per wallet: type icon in a tinted circle, name, balance at the
   inline end. Grouped as "Cash" then "Banks". Tapping a row opens that wallet's entries in History (filter by
   wallet). It fits 390x844; scroll only inside the sheet if there are more than 6 wallets.
   Also export `OurMoneyRow` (one line: "Our money", total, chevron, 56px) for AG-1 to place on Home.
4. Settings → Wallets: every wallet row gets "Update balance": an AmountPad sheet titled "How much is in <wallet>
   now?" → `adjustWalletBalance` → Undo toast. Adding a wallet asks for name, type (Cash / Bank / Card) and
   current balance.
5. The Add sheet's WalletPicker shows all non-archived wallets as large chips that wrap (no horizontal scrolling),
   preselecting the last used one. Coordinate in your PR: if AG-1 already changed WalletPicker, keep their layout
   and only add the wrapping.
6. Strings in `messages/{en,ar}/` (wallets namespace). Quick `/design-review`, RTL grep, Definition of Done.
