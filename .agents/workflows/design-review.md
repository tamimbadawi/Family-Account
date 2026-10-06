---
description: Screenshot every changed screen on iPhone sizes in Arabic and English, critique against docs/DESIGN.md, and fix issues before reporting done.
---

# /design-review

1. Make sure the dev server is running (`npm run dev`). For PWA-specific checks use `npm run build && npm start`.
2. List the routes changed in this step (from `git diff --name-only` plus the step's goal).
3. For each route, open it in the browser at **390×844** (iPhone 15/16) and **430×932** (Pro Max):
   - `/en/...` light, `/en/...` dark, `/ar/...` light (RTL). Emulate dark with `prefers-color-scheme: dark`.
   - Use realistic data, including one very long Arabic item name and a 7-digit amount. Every number must be in Western digits (0–9) in both languages.
4. Screenshot each state. Then critique each screenshot against `docs/DESIGN.md` §6 checklist and §4 for that screen.
   Be harsh: write down every issue (spacing, alignment, hierarchy, contrast, truncation, RTL mirroring, motion, copy).
5. Grep the changed files for forbidden patterns and fix any hits:
   `ml-|mr-|pl-|pr-|left-|right-|text-left|text-right|#[0-9a-fA-F]{3,6}|text-\[\d+px\]` (allowed only inside tokens.css).
6. Fix everything found, re-screenshot, and compare before/after.
7. Report: a short list of what you fixed and the final screenshots. If something can't be fixed without a design decision, ask.
