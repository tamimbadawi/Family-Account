---
trigger: glob
globs: src/**/*.tsx, src/**/*.ts, messages/*.json
---

# Arabic-first, RTL-correct, bilingual

- Locales: `ar` (default, RTL) and `en` (LTR). Routes are `/ar/...` and `/en/...` via next-intl.
- `<html lang dir>` is set in `src/app/[locale]/layout.tsx` from the locale.
- **Only logical Tailwind utilities:** `ms- me- ps- pe- start- end- text-start text-end rounded-s rounded-e border-s border-e`.
  Forbidden: `ml- mr- pl- pr- left- right- text-left text-right rounded-l rounded-r border-l border-r`.
- Directional icons (ChevronLeft/Right, ArrowLeft/Right, back buttons) get `rtl:rotate-180`.
- Charts: Recharts does not mirror automatically — set `reversed` on the X axis and put the Y axis on the right when `dir === 'rtl'`.
- Horizontal scrollers (Recents, pivot columns) start at the inline-start edge in both directions.
- **Every user-facing string** comes from `messages/ar.json` and `messages/en.json`. When you add a key, add it to both files in the same commit. Keys are nested by screen: `home.*`, `entry.*`, `history.*`, `reports.*`, `settings.*`, `common.*`.
- Names from the database have `name_ar` and `name_en`; display with `pickName(row, locale)` from `src/lib/format`, which falls back to the other language.
- Numbers: format with `Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', …)` through `money()`; a user setting (Settings → Language) chooses Arabic-Indic or Western digits — default Western digits in both languages for readability, but accept either as input via `normalizeDigits()`.
- Dates: `Intl.DateTimeFormat` with the locale; relative labels ("Today", "Yesterday") come from messages.
- Test every screen with long Arabic names (e.g. "مصاريف صيانة العمارة الشهرية") — text must truncate with an ellipsis, never overflow or wrap into icons.
