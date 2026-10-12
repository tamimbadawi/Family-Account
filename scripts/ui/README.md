# Headless UI Testing System (scripts/ui)

## Part 0 — Project Inspection Findings
- **Package Manager:** `npm` (detected via `package-lock.json`)
- **Framework:** Next.js 16.3.8 (App Router), React 19.2.8, Tailwind CSS v4, Serwist
- **Core Scripts:**
  - `dev`: `next dev`
  - `build`: `next build`
  - `start`: `next start`
- **Default Dev Port:** 3000 (auto-assigns a free port if 3000 is occupied)
- **i18n Routes & Locales:** `next-intl`
  - Locales: `en` (default, LTR) and `ar` (Arabic, RTL)
  - Routing: `/[locale]/...`
- **Theme Support:** `next-themes` with CSS custom properties (`light` and `dark` modes)
- **Authentication:**
  - Routes: `/[locale]/login`, `/[locale]/choose-password`, `/[locale]/welcome`
  - Modes: Local mock repository in development (`NEXT_PUBLIC_DATA_MODE=mock`), Supabase Auth in live mode
- **Main Application Routes:**
  - `/[locale]` (Home / Overview)
  - `/[locale]/history` (History ledger - list screen)
  - `/[locale]/reports` (Reports Overview, Breakdown, All Reports tabs)
  - `/[locale]/reports/r/[slug]` (Deep-dive report views)
  - `/[locale]/settings` (Settings hub)
  - `/[locale]/settings/categories` (Category & item hierarchy - list screen)
  - `/[locale]/settings/wallets` (Wallets & payment methods)
  - `/[locale]/settings/family` (Family members management)
  - `/[locale]/settings/deleted` (Recently deleted transactions - list screen)
  - `/[locale]/install` (PWA install guide)
  - `/[locale]/styleguide` (Design system styleguide)
  - `/[locale]/operator` (Multi-family operator portal)

---

## Architecture Overview
The UI verification system uses headless Chromium via `playwright-core` (without installing extra browser packages) and connects to existing system-installed browsers (Google Chrome, Microsoft Edge, Brave) or a CI-installed Chromium binary.

```
scripts/ui/
├── README.md        # This documentation and inspection report
├── config.mjs       # Viewport sizes, default routes, and thresholds
├── browser.mjs      # Zero-download Chromium launcher (finds system browser)
├── server.mjs       # Automatic server lifecycle manager (free-port & process-tree kill)
├── helpers.mjs      # Test interaction and verification primitives
├── check.mjs        # Full screen visual & layout audit (npm run ui:check)
├── flows.mjs        # User interaction flow runner (npm run ui:flows)
└── flows/           # Modular user flow specifications
    ├── auth.mjs
    ├── entry.mjs
    ├── categories.mjs
    ├── wallets.mjs
    ├── reports.mjs
    └── preferences.mjs
```

---

## Usage

### 1. Screen Audit (`npm run ui:check`)
Verifies that every screen complies with the design non-negotiables: no page scrolling, no covered text, no text cut under the tab bar, no text truncation with ellipsis, tap targets $\ge 44\text{px}$, and no console/request errors.

```bash
# Fast check while developing (quick mode: 390x844, light theme, specified routes)
npm run ui:check -- --quick --routes /en,/en/history

# Full matrix check (all sizes: 390x844, 375x667, 412x700; light & dark; all routes)
npm run ui:check

# Run against an existing running dev server
npm run ui:check -- --base http://localhost:3000

# Run in production build mode
npm run ui:check -- --prod
```

### 2. User Flows (`npm run ui:flows`)
Runs end-to-end action tests across sizes (including on-screen keyboard viewport `390x420`) and locales (`en`, `ar`):

```bash
# Run all user interaction flows
npm run ui:flows

# Run quick mode (390x844, English only)
npm run ui:flows -- --quick

# Run specific flows
npm run ui:flows -- --flows income,expense,photo
```

### Registered User Flows
- `auth_login`: Signs in on `/login` form, verifies validations and routing.
- `income`: Adds an income entry (Money in $\to$ 5,000 $\to$ Regular $\to$ Pension $\to$ Save) and asserts balance updates.
- `expense`: Adds an expense entry (Money out $\to$ 250 $\to$ Food $\to$ Groceries $\to$ Supermarket $\to$ Save).
- `switchtype`: Switches between Money in and Money out in the sheet, verifying category tree swap and amount preservation.
- `newgroup`: Creates a subcategory group inside the category picker (+ New Group $\to$ name $\to$ Save).
- `newcategory`: Creates a category (+ New $\to$ name, color, icon $\to$ Save).
- `photo`: Attaches receipt photo, verifies camera compression, thumbnail, full viewer, remove & undo, save.
- `date`: Calendar date picker (Yesterday, day 1 of month, chips update).
- `bank`: Adds a new wallet/bank during entry creation and saves to it.
- `reports_tabs`: Switches between Overview, Breakdown, All reports tabs, preset buttons, filters.
- `reports_library`: Navigates through report library cards, switcher controls, and back.
- `reports_sheets`: Opens drill-down bottom sheets from overview, breakdown cell, category deep dive.
- `settings_categories`: Category management in Settings (view, reorder, edit).
- `language_switch`: Switches between English (LTR) and Arabic (RTL).
- `theme_switch`: Switches between Light and Dark mode.
