---
description: Step A7b — styled Login, Welcome and Install-guide screens (visual only, mock behaviour).
---

# A7b · Login, Welcome and Install screens

Precondition: A1 and A7a are merged.
Read `AGENTS.md` and `docs/DESIGN.md` §4 Login · Welcome · Install.

1. `/install` guide page (3 illustrated cards: Share → "Add to Home Screen" → Add); show a gentle banner linking to it when on iOS Safari and not in standalone mode (`navigator.standalone !== true`).
2. Visual-only Login and Welcome screens. Logo = `public/icons/icon-1024.png` at 96px with rounded corners. Mock behaviour: any input "logs in"; Welcome stores names locally.
3. Both must fit 390×844 without scrolling (DESIGN.md §3).
4. Quick `/design-review`, then Definition of Done. Ask the user to install the preview on a real iPhone.
