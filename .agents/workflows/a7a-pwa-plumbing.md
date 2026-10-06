---
description: Step A7a — Serwist service worker, manifest, iOS metadata, icons and splash screens from design/icon.png, offline page. No styled screens.
---

# A7a · PWA plumbing (no styled screens)

Precondition: A0 is merged. Does **not** need A1. Don't style anything beyond the bare `/~offline` page (A1 owns the design system).
Read `AGENTS.md` and `docs/PLAN.md` "PWA setup for iPhone".
**Read the current Serwist Turbopack docs (https://serwist.pages.dev/docs/next/turbo) before writing code.**

1. Install `@serwist/turbopack serwist esbuild` (dev). Service worker: precache app shell; NetworkFirst for navigations with cache fallback; CacheFirst for fonts/icons/images; never cache `*.supabase.co`; fallback document `/~offline`. Disabled in dev. If Turbopack integration fails, fall back to `@serwist/next` + `next build --webpack` and say so in the PR.
2. `src/app/manifest.ts` exactly as in PLAN.md.
3. The app icon is **final**: `design/icon.png` (1024×1024, full-bleed, chosen by the user). Do not redesign it. Generate `public/icons/` (192, 512, maskable 512, apple-touch-icon 180, no transparency) and iOS splash screens with `npx pwa-asset-generator design/icon.png` (background `#FAF8F5`) into `public/splash/`. Copy `design/icon.png` to `public/icons/icon-1024.png` for the login logo.
4. iOS metadata and viewport exactly as in PLAN.md. In `src/app/[locale]/layout.tsx`, only add the `metadata`/`viewport` exports and the `apple-touch-startup-image` links. AG-1 owns the rest of that file (fonts, body classes).
5. Plain `/~offline` page (one sentence from `messages/*/offline.json`).
6. Verify with `npm run build && npm start`: installable, opens offline after the first load. Then Definition of Done (no `/design-review`: no styled UI).
