# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

GreenWorth: a static, dependency-free web app that models pre-feasibility project finance for four renewable
technologies (onshore wind, offshore wind, solar, ESS) on a single calendar-year axis from development through
construction to operation. No backend, no build framework, no npm dependencies. UI and methodology copy are
Korean-first (developer/lender/investment-committee personas — see `DESIGN.md`).

## Commands

```bash
npm run serve   # node scripts/serve.mjs — serves the app at http://localhost:4173 (default port; --port/--host/PORT override)
npm test        # node --test — runs every tests/*.test.mjs file
```

- Run a single test file: `node --test tests/finance.test.mjs`
- Run a single test by name: `node --test --test-name-pattern="ESS augmentation" tests/finance.test.mjs`
- No separate lint/build/typecheck script exists.
- The app also runs by double-clicking `index.html` directly (`file://`) — no server required.

## Architecture

### Two parallel copies of the frontend code — keep them in sync

`index.html` loads `js/app.bundle.js` as a **classic script** (not `type="module"`), specifically so the app also
works when opened directly from `file://` without hitting ES module CORS restrictions. The real source lives as ES
modules in `js/app.js`, `js/finance.js`, `js/form-view.js`, `js/project-data.js`, `js/results-view.js` (import
graph: `app.js` → `finance.js`, `form-view.js`, `project-data.js`, `results-view.js`; `finance.js` and `form-view.js`
→ `project-data.js`). `js/app.bundle.js` is a pre-built, import/export-free IIFE concatenation of those same
modules — there is no bundler wired into `package.json`.

**Whenever you edit any `js/*.js` module, you must regenerate `js/app.bundle.js` to match** (e.g. by running an
ES-module-to-IIFE bundler such as esbuild over `js/app.js` and its imports) before the change is real from a
user's perspective, since `index.html` never executes the source modules directly. `tests/layout-contract.test.mjs`
enforces the shape of this contract (bundle has no bare `import`/`export` statements and contains the expected
tail call `buildTechnologySwitch(); renderSection(); calculate();`), but it cannot verify the bundle's *logic*
matches the sources — that's on you to keep true by hand.

### Module responsibilities

- **`js/project-data.js`** — pure data: `CAPEX_CATEGORIES`, per-technology default assumptions/presets
  (`TECHNOLOGIES`), and `createCase(technology)` which deep-clones a fresh default case.
- **`js/finance.js`** — the calculation engine, no DOM access. Builds the calendar, allocates CAPEX draws, solves
  total investment iteratively (construction interest, financing fees, and DSRA all depend on the amount raised,
  so it converges within a tolerance), amortizes debt, computes taxable income with NOL, derives DSCR/dividend
  gates, and returns everything via `analyzeCase(model, technology)`; `sensitivityCases(model, technology)` runs
  scenario variants. This is where nearly all "how is X calculated" questions resolve — see the long inline
  Korean methodology comments and `README.md`'s "모델 구조" section for the intended financial logic before
  changing formulas.
- **`js/form-view.js`** — renders the editable assumption form per section (`SECTIONS`) and technology, including
  the read-only finance-preset panel and ESS-only fields (ramp-up, augmentation, LTSA step).
- **`js/results-view.js`** — renders KPIs, the 11-line capital breakdown + funding reconciliation, sensitivity
  matrix, augmentation schedule, and the full cash-flow table from an `analyzeCase` result.
- **`js/app.js`** — wires DOM events, owns per-technology state (`cases: Map`), debounces recalculation (120ms),
  handles native input validity, and drives the reset/export actions. No calculation logic lives here.

### Design contract

`DESIGN.md` is a binding spec (colors, type scale, spacing/layout reserves, component states, motion, a11y
targets), not just notes — several of its exact values are asserted directly by
`tests/layout-contract.test.mjs` (e.g. `--workspace-reserve: 1120px`, `--model-panel-reserve: 860px`, the 44px
`.brand` touch target). Check it before changing `styles/*.css` sizing/reserve values.

### Tests

`tests/*.test.mjs` use Node's built-in `node:test` — no test framework dependency.

- `tests/finance.test.mjs` — the calculation engine's correctness contract (calendar/leap-day handling, P75
  net-of-loss treatment, IDC, debt amortization/balloon, progressive tax + NOL, DSCR/dividend gates, ESS
  ramp-up/augmentation/LTSA, validation rejects malformed input). `tests/fixtures/onshore-workbook-benchmark.mjs`
  holds reference values used to check the model against the original example workbook's numbers.
- `tests/form-contract.test.mjs` / `tests/results-contract.test.mjs` — assert on rendered form/results DOM shape.
- `tests/layout-contract.test.mjs` — asserts CSS reserve values and the classic-bundle contract described above.
- `tests/docs-methodology-contract.test.mjs` — guards a specific accessible inline term in `index.html`.
- `tests/static-server.test.mjs` / `tests/static-server-boundaries.test.mjs` — exercise `scripts/serve.mjs` (range
  requests, compression negotiation, path-traversal/method/encoding boundaries) by spawning it as a child process.

### Static server (`scripts/serve.mjs`)

A dependency-free Node HTTP server used only for local dev (`npm run serve`). It serves an explicit allowlist
(`PRELOAD_PATHS`) of files — `index.html`, the four `styles/*.css` files, and `js/app.bundle.js` — nothing else,
with brotli/gzip negotiation and byte-range support. Adding a new static asset requires adding it to
`PRELOAD_PATHS`/`PUBLIC_FILES` here or it will 404.

## Workflow: 기획문서 sync + GitHub push after edits

This repo is connected to `origin` → https://github.com/sjseo-ai/greenworth (public). Whenever you make a
substantive edit to any app file (`js/*.js` + regenerated `js/app.bundle.js`, `index.html`, `styles/*.css`,
`scripts/serve.mjs`, `tests/*.test.mjs`, etc.):

1. **Update 기획문서** — the planning docs under `과제정의서/` (`PRD_사업성분석_프로토타입.md`,
   `과제정의서_3팀_서신준.md`, `변수정의서_초안_이터레이션1.md`) and any related diagram — so they still describe
   the current behavior/assumptions, not a stale version. If a change doesn't affect anything those docs describe,
   say so and skip the edit rather than padding it.
2. **Commit and push to GitHub** once the change (code + bundle + updated 기획문서, tests passing) is verified —
   don't leave verified work sitting uncommitted locally.
3. **Never commit** `샘플/`, `과제정의서/ESS_단가산정모델.xlsx`, or
   `과제정의서/ESS_비가격점수_가격환산_계산기_1.xlsx` — vendor-confidential (real counterparty names/pricing),
   already excluded via `.gitignore`, and this repo is public. Extend the `.gitignore` rather than un-ignoring
   these if new similar files show up.

## Known model boundaries (stated in `README.md`)

This is explicitly a pre-feasibility indicative model, not audited investment advice: no P50/P90 selector, no
monthly/quarterly generation or price curves, no VAT, no asset-class-specific depreciation, no debt sculpting, no
refinancing. The tax bracket preset is a historical example from the source workbook, not current law. Don't
"fix" these by silently adding scope — they're intentional exclusions the UI and docs disclose to the user.
