# Design spec — حساباتنا · Family Accounts

The bar: **it should look like it came from the App Store.** Calm, warm, spacious, obviously easy.
Two older people who have never used a finance app must log an expense with no help on day one.

Tokens: `design/tokens.css` (copied to `src/app/tokens.css`). This file explains how to use them.

---

## 1. Principles

1. **One thing per screen.** Each screen has one hero (usually a number) and one primary action.
2. **Recognition over reading.** Colour + icon identify a category before its name is read.
3. **Forgiving.** Everything is undoable. No "Are you sure?" for reversible actions.
4. **Quietly reliable.** Offline is normal. The only sync signal is a small dot.
5. **Arabic is the original, not a translation.** Design in Arabic first, then check English.

## 2. Foundations

| Token | Light | Dark | Use |
|---|---|---|---|
| canvas | #FAF8F5 | #121110 | app background |
| surface | #FFFFFF | #1C1A18 | cards, sheets |
| surface-2 | #F3EFE9 | #262320 | chips, inputs, pressed |
| ink / ink-muted | #1C1917 / #6B6560 | #F5F2EE / #A8A29E | text |
| accent | #0F766E | #2DD4BF | primary buttons, selected states |
| income | #15803D | #4ADE80 | money in |
| expense | #C2410C | #FB923C | money out (never red) |

**Type** — IBM Plex Sans Arabic (weights 400, 500, 600, 700) via `next/font/google`, variable `--font-plex-arabic`.

| Class | Size | Weight | Use |
|---|---|---|---|
| `text-hero` | 52px | 700 | one big amount per screen |
| `text-display` | 36px | 600 | amount pad display |
| `text-title` | 24px | 700 | screen title |
| `text-heading` | 19px | 600 | card titles, list primary |
| `text-body` | 17px | 400/500 | default |
| `text-caption` | 15px | 400 | secondary lines (minimum size anywhere) |

All amounts: `tabular-nums`. Currency suffix "ج.م" (ar) / "EGP" (en) at 60% size, `text-ink-muted`.

**Spacing** — 8-pt rhythm. Screen padding `px-5`, card padding `p-5`, gap between cards `gap-4`, sections `gap-8`.
**Radius** — cards `rounded-card` (20px), sheets `rounded-t-sheet` (28px), buttons `rounded-2xl`, chips `rounded-full`.
**Elevation** — only `shadow-card` and `shadow-sheet`. Prefer surface contrast over shadows.
**Icons** — Lucide, stroke 1.75, 24px in lists, 28px in category tiles, inside 48px tinted circles (`bg-[color]/12`).
**Motion** — 180ms `ease-out-soft` for state changes, 250ms for sheets; hero numbers count up over 600ms on Reports; save = checkmark draw 300ms. All disabled under reduced motion.

## 3. Layout shell

- **Top:** large title (`text-title`) left-aligned at the inline start, safe-area top padding. Sync dot at the inline end: green dot "تم الحفظ" / grey-hollow "محفوظ على التليفون" when items are queued.
- **Bottom tab bar:** 4 tabs — الرئيسية Home · السجل History · التقارير Reports · الإعدادات Settings. 64px + safe-area inset, surface background with top hairline, active tab = accent icon + label, inactive = ink-muted. Labels always visible.
- **Floating Add button** on Home and History: 64px circle, accent, plus icon, sits above the tab bar at the inline end, `shadow-card`.
- Content max width 520px, centred (for iPad / desktop previews).

## 4. Screens

### Home
1. Greeting: "صباح الخير، ماما" (time-of-day + display name), `text-heading`, ink-muted.
2. **Hero card:** "صرفنا الشهر ده" label → amount `text-hero` → small line "دخل ٥٬٠٠٠ · باقي ٤٬٦٤٩" (income · net). Tapping goes to Reports.
3. **Top categories this month:** 3 horizontal pills with icon, name, amount.
4. **Recent entries:** last 5 as EntryRow (icon circle, item name, sub-line "category · wallet", amount at the inline end coloured by type). "عرض الكل" → History.
5. Empty state (no entries yet): friendly illustration + "ابدأ بتسجيل أول مصروف" + big Add button.

### Add / Edit entry — the most important screen (bottom sheet, vaul, 92% height)
Order top → bottom:
1. Grab handle, then **TypeToggle**: segmented control مصروف / دخل / تحويل (expense default). Changing type re-colours the amount.
2. **Amount display**, `text-display`, centred, placeholder "٠". Caret-free; shows formatted value live.
3. **Step area** (animated slide between steps, breadcrumb above it: "المنزل ‹ المرافق"):
   - Step 0 **Recents row:** up to 6 most-used items as chips with icon — one tap selects item and jumps to Review.
   - Step 1 **Category tiles:** 3-column grid of tiles (48px icon circle + name below), "+ جديد" tile last.
   - Step 2 **Subcategories:** large list rows (56px), "+ جديد" row last.
   - Step 3 **Items:** large list rows, "+ جديد" row last. Selecting an item → Review.
   - Transfer mode replaces steps with two WalletPickers: "من" → "إلى".
4. **AmountPad** (visible while amount is focused/empty): 4×3 keys, 64px tall, digits in current locale, "٫" decimal, backspace. Keys `bg-surface-2`, pressed state darker, no iOS keyboard ever.
5. **Review strip:** chips for Date (اليوم / امبارح / اختار…), Wallet (last used), Note (optional, opens a single-line input).
6. **Save** — full-width `h-14` accent button, disabled until amount > 0 and an item (or both wallets) are chosen. On save: checkmark animation, sheet closes, toast "اتسجل ✓" with **تراجع** (Undo).
Edit mode: same sheet, prefilled, title "تعديل", plus a text button "حذف" at the bottom (soft delete + Undo toast).

### History
- Month switcher at top (‹ أكتوبر ٢٠٢٦ ›), filter chips: الكل / مصروفات / دخل.
- Days as groups: sticky header "النهارده · الإثنين ٥ أكتوبر" with the day total at the inline end.
- EntryRow as on Home; swipe is NOT used (hard for older users) — tap opens Edit.
- Empty month: calm illustration + "مفيش مصاريف الشهر ده".

### Reports — tab "نظرة عامة" (Overview)
1. Month switcher.
2. Hero card: spent (expense colour), income, net — net in large type.
3. **Donut** of spending by category (category colours, 64% inner radius, total in centre).
4. Ranked category list: icon, name, amount, % and a thin progress bar in the category colour. Tap → drill into subcategories → items (breadcrumb).
5. **6-month bars:** spending vs income side by side, current month highlighted.
6. **Wallet balances** card: each wallet with its balance.

### Reports — tab "تفصيل" (Breakdown: simple pivots)
- Preset cards row (horizontal scroll): "فلوسنا راحت فين؟", "شهر بشهر", "متابعة الفواتير", "أي محفظة؟", "مين صرف إيه".
- Four chip rows — **اعرض** (مصروفات / دخل / الصافي), **قسّم حسب** (القسم / الفرع / البند / المحفظة / الشخص), **على** (الشهور / الأسابيع / المحافظ / بدون), **الفترة** (الشهر ده / ٣ شهور / ٦ شهور / السنة دي / اختار).
- **PivotTable:** sticky first column (icon + name, 140px), value columns 96px, max 4 visible then horizontal scroll, newest month nearest the labels. Cells: whole pounds, `tabular-nums`, heat tint = accent at 4–28% opacity by value rank; zero = faint "–". Bold total row (bottom) and total column (end) on `surface-2`. Row tap = drill down; cell tap = sheet listing its entries.
- Share button: CSV or PNG image (for WhatsApp).
- This is the one place a grid is allowed — it must still feel airy: 52px rows, no vertical lines, a single hairline under the header and above totals.

### Settings
Grouped inset list (iOS style): الأقسام (Categories) · المحافظ (Wallets) · العائلة (Family) · اللغة (Language) · تنزيل بياناتي (Download CSV) · المحذوفات (Recently deleted) · محتاج انتباه (Needs attention — only if sync failures) · تسجيل الخروج (Sign out).
- **Category manager:** tabs مصروفات / دخل; list of categories (icon circle, name, count of items, chevron). Drill-down to subcategories then items. Each level: "+ إضافة" row at top, tap a row to rename / change icon & colour / archive. Reorder with a drag handle (visible only in "ترتيب" mode). Archive explains: "هيختفي من الاختيارات، والمصاريف القديمة هتفضل زي ما هي".
- **Colour & icon picker:** 12 preset colours (the seed palette + 6 more), 40 curated Lucide icons in a grid.

### Login · Welcome · Install
- Login: logo, app name, two large fields (email, password), show-password toggle, primary button. Link "إزاي أنزّل التطبيق على الموبايل؟" → Install.
- Welcome (first run): "سمّوا بيتكم" household name field + your name; creates household and default categories.
- Install guide (shown when iOS Safari and not standalone): 3 illustrated steps — Share icon → "إضافة إلى الشاشة الرئيسية" → "إضافة". Large illustrations, one step per card.

## 5. Copy tone
Warm, short, everyday Egyptian-friendly Arabic; never banking jargon. English mirrors it ("Spent this month", "Money in", "Undo").
Words to avoid in UI: transaction, ledger, debit, credit, record, submit, error code.

## 6. Review checklist (used by /design-review)
- [ ] One hero, one primary action; nothing competes with them.
- [ ] Only tokens; no hard-coded colours; light and dark both look intentional.
- [ ] RTL mirrored correctly; icons flipped; no `left/right` utilities.
- [ ] All text ≥ 15px, body 17px; tap targets ≥ 48px; contrast WCAG AA.
- [ ] Amounts tabular, aligned, formatted via `money()`.
- [ ] Long Arabic names truncate gracefully.
- [ ] Empty, loading (skeleton), and offline states designed.
- [ ] Motion subtle; reduced-motion respected.
- [ ] Would a 65-year-old understand this screen in 3 seconds?
