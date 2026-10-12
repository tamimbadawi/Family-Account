---
trigger: always_on
---

# UI Verification Rule: Headless Only

Never use the IDE browser or a browser subagent to check UI. The IDE's built-in browser is far too slow and unreliable.

Always use:
- `npm run ui:check -- --quick --routes <changed>` while working on visual screens or components.
- The full `npm run ui:check` + `npm run ui:flows` before every PR.
- Paste both outputs into the PR description.
- A PR with any `FAIL` line is not done.
