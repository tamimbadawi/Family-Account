---
description: Step A0 — scaffold Next.js 16 into this repo without overwriting the planning files, set up next-intl (en default, ar RTL), and deploy to Vercel.
---

# A0 · Scaffold and deploy

Read `AGENTS.md` and `docs/PROGRESS.md` first.

1. This repo already contains planning files (AGENTS.md, docs/, design/, supabase/, messages/, .agents/, .github/, components.json, vercel.json). **Do not overwrite any of them.**
2. Scaffold in a temp folder, then move files in:
   `npx create-next-app@latest .scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --turbopack --yes`
   Copy everything from `.scaffold/` into the repo root **except** files that already exist here
   (if create-next-app generated its own AGENTS.md/CLAUDE.md, merge any useful Next.js notes into our AGENTS.md §2, then discard it). Merge `.gitignore` entries. Delete `.scaffold/`.
3. Add scripts to package.json: `"typecheck": "tsc --noEmit"`, `"test": "vitest run"`. Install dev deps `vitest`.
4. Install and configure **next-intl**: `src/i18n/routing.ts` (locales `['en','ar']`, defaultLocale `'en'`, localePrefix `'always'`), `src/i18n/request.ts`, plugin in `next.config.ts`, and locale routing in **`proxy.ts`** (Next 16 name). Move the app under `src/app/[locale]/`. `<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>`.
5. Messages are already in the repo as one file per namespace: `messages/en/*.json` and `messages/ar/*.json`. In `src/i18n/request.ts`, keep an explicit list `const namespaces = ['app', 'nav', 'common', 'sync', 'home', 'entry', 'history', 'reports', 'settings', 'auth', 'install', 'offline'] as const`, dynamically import `../../messages/${locale}/${ns}.json` for each, and merge them into `{ [ns]: json }`. Replace the default home page with a minimal placeholder showing `t('app.name')` and a link to switch language.
6. `npm run build` must pass. Commit (`chore: scaffold Next.js 16 + next-intl`) on your branch, push it, and open the PR.
7. **Do not set up Vercel or Supabase.** The orchestrator (Claude Code) connects the repo to Vercel when it merges A0 and owns all Vercel/Supabase configuration (projects, env vars, domains).
