---
description: Step A7 — Serwist service worker, manifest, iOS metadata, icons and splash screens, offline page, install guide, and visual login/welcome screens.
---

# A7 · PWA, login and onboarding screens

Read `AGENTS.md`, `docs/PLAN.md` "PWA setup for iPhone", and `docs/DESIGN.md` §4 Login · Welcome · Install.
**Read the current Serwist Turbopack docs (https://serwist.pages.dev/docs/next/turbo) before writing code.**

1. Install `@serwist/turbopack serwist esbuild` (dev). Service worker: precache app shell; NetworkFirst for navigations with cache fallback; CacheFirst for fonts/icons/images; never cache `*.supabase.co`; fallback document `/~offline`. Disabled in dev. If Turbopack integration fails, fall back to `@serwist/next` + `next build --webpack` and note it in PROGRESS.md.
2. `src/app/manifest.ts` and iOS metadata/viewport exactly as in PLAN.md.
3. Design a simple, beautiful app icon as SVG (emerald rounded square, a stylised wallet/house mark, no text). Generate `public/icons/` (192, 512, maskable 512, apple-touch-icon 180 with no transparency) and iOS splash screens with `npx pwa-asset-generator` into `public/splash/`, then add the `apple-touch-startup-image` links.
4. `/install` guide page (3 illustrated cards); show a gentle banner linking to it when iOS Safari and not standalone.
5. Visual-only Login and Welcome screens (mock behaviour: any input "logs in"; Welcome stores names locally).
6. Verify with `npm run build && npm start`: Lighthouse PWA installability passes; app opens offline after first load; safe areas correct in standalone mode.
7. `/design-review` and Definition of Done. Ask me to install the preview on a real iPhone.
