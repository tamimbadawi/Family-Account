---
description: Step A0 — scaffold Next.js 16 into this repo without overwriting the planning files, set up next-intl (ar default, RTL), and deploy to Vercel.
---

# A0 · Scaffold and deploy

Read `AGENTS.md` and `docs/PROGRESS.md` first.

1. This repo already contains planning files (AGENTS.md, docs/, design/, supabase/, messages/, .agents/, .github/, components.json, vercel.json). **Do not overwrite any of them.**
2. Scaffold in a temp folder, then move files in:
   `npx create-next-app@latest .scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --turbopack --yes`
   Copy everything from `.scaffold/` into the repo root **except** files that already exist here
   (if create-next-app generated its own AGENTS.md/CLAUDE.md, merge any useful Next.js notes into our AGENTS.md §2, then discard it). Merge `.gitignore` entries. Delete `.scaffold/`.
3. Add scripts to package.json: `"typecheck": "tsc --noEmit"`, `"test": "vitest run"`. Install dev deps `vitest`.
4. Install and configure **next-intl**: `src/i18n/routing.ts` (locales `['ar','en']`, defaultLocale `'ar'`, localePrefix `'always'`), `src/i18n/request.ts`, plugin in `next.config.ts`, and locale routing in **`proxy.ts`** (Next 16 name). Move the app under `src/app/[locale]/`. `<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>`.
5. Load `messages/ar.json` / `messages/en.json` (already in the repo). Replace the default home page with a minimal placeholder showing `t('app.name')` and a link to switch language.
6. `npm run build` must pass. Commit (`chore: scaffold Next.js 16 + next-intl`) and push.
7. Using the Vercel MCP (or the dashboard), import this GitHub repo as a Vercel project (framework Next.js, Node 22). Add env var `NEXT_PUBLIC_DATA_MODE=mock`. Confirm the production URL loads `/ar` right-to-left.
8. Tick A0 in `docs/PROGRESS.md` with the production URL, commit, push. Report the URL.
