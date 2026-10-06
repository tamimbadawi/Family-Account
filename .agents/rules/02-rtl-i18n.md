---
trigger: glob
globs: src/**/*.tsx, src/**/*.ts, messages/*.json
---

# English-first, bilingual with Arabic RTL support

- Locales: `en` (default, LTR) and `ar` (RTL). Routes are `/en/...` and `/ar/...` via next-intl.
- `<html lang dir>` is set in `src/app/[locale]/layout.tsx` from the locale.
- **Only logical Tailwind utilities:** `ms- me- ps- pe- start- end- text-start text-end rounded-s rounded-e border-s border-e`.
  Forbidden: `ml- mr- pl- pr- left- right- text-left text-right rounded-l rounded-r border-l border-r`.
- Directional icons (ChevronLeft/Right, ArrowLeft/Right, back buttons) get `rtl:rotate-180`.
- Charts: Recharts does not mirror automatically — set `reversed` on the X axis and put the Y axis on the right when `dir === 'rtl'`.
- Horizontal scrollers (Recents, pivot columns) start at the inline-start edge in both directions.
- **Every user-facing string** comes from `messages/en/<namespace>.json` and `messages/ar/<namespace>.json`: one file per namespace (`app`, `nav`, `common`, `sync`, `home`, `entry`, `history`, `reports`, `settings`, `auth`, `install`, `offline`), used as `t('home.spentThisMonth')`. When you add a key, add it to both languages in the same commit. Only edit the namespace files of the screen you are building; a new namespace also needs one line in the list in `src/i18n/request.ts`.
- Names from the database have `name_ar` and `name_en`; display with `pickName(row, locale)` from `src/lib/format`, which falls back to the other language.
- Numbers: **always Western digits (0–9) in both languages.** Format through `money()` with `Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', { numberingSystem: 'latn', … })`. Without `numberingSystem: 'latn'`, `ar-EG` outputs Arabic-Indic digits. Still accept Arabic-Indic input anywhere text becomes a number via `normalizeDigits()`.
- Dates: `Intl.DateTimeFormat` with the locale and `numberingSystem: 'latn'`; relative labels ("Today", "Yesterday") come from messages. "Today" is computed in the phone's local time, never from `toISOString()` (UTC).
- Test every screen with long Arabic names (e.g. "مصاريف صيانة العمارة الشهرية") — text must truncate with an ellipsis, never overflow or wrap into icons.
