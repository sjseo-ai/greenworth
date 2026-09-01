# GreenWorth Design System

## 0. Research Log

- Embedded refs: shortlisted Stripe, IBM Carbon, Linear; picked `taste-skill` + Stripe because the surface needs restrained financial-data typography, conservative geometry, and precise elevation without copying any branded asset or copy.
- Lazyweb: 3 desktop queries for renewable-energy finance, project-finance cash flow, and assumption-entry dashboards; 0 screens viewed because the anonymous endpoint returned a Pro paywall. No result was used.
- Imagen drafts: skipped because this is a dense operational analysis tool whose matching surface is live HTML controls and calculated tables; bitmap UI concepts would not improve the code-native primitive or interaction contract.
- Primitive showcase: the live page exposes default, focus, active, disabled, loading, empty, and error treatments through actual controls and result states at the tested breakpoints.

## 1. Atmosphere & Identity

GreenWorth is a calm investment-review room: precise enough for a lender, legible enough for a project developer, and explicit about assumptions. Its signature is the “model ledger”, a slim green rule and tabular-number treatment that visually connects editable assumptions to calculated outcomes. The page stays in one light theme. Design dials are variance 3, motion 2, density 7 because this is a regulated, data-heavy operational surface. The accurate model remains trust-first and Korean-first: dates, model phases, tax assumptions, reserve logic, and return definitions are visible where they affect a decision.

Primary personas and their pass criteria are:

- A renewable-energy developer can set the project calendar, understand that P75 is a net capacity factor, classify each CAPEX row, and trace development, construction, and operation timing without relying on memory or hidden help.
- A lender can distinguish annual DSCR from cumulative DSCR, identify balloon debt and withheld dividends, and verify that DSRA and legal reserve treatments reconcile with funding and cash flow.
- An investment committee reviewer can compare P-IRR, E-IRR before investor tax, investor-tax-after E-IRR, NPV, and P-PBP while seeing preset sources, limitations, and the exact capital reconciliation.
- Keyboard-only and screen-reader users can reach the same fields, preset descriptions, table states, and explanations in a logical order. Users at 200% zoom and users with reduced-motion preferences can complete the same review without losing information.

The accurate-model interface must not copy workbook layout, formula presentation, styling, or branded material. Workbook values may inform presets and validation, while GreenWorth primitives remain the only UI contract.

## 2. Color

| Role | Token | Value | Usage |
|---|---|---|---|
| Page | `--surface-page` | `#f4f7f5` | Application background |
| Primary surface | `--surface-primary` | `#ffffff` | Forms and result panels |
| Secondary surface | `--surface-secondary` | `#eef3f0` | Grouped assumptions and inactive controls |
| Strong surface | `--surface-strong` | `#102b27` | Header and high-emphasis result area |
| Text primary | `--text-primary` | `#10231f` | Headings and input values |
| Text secondary | `--text-secondary` | `#526760` | Explanations and captions |
| Text inverse | `--text-inverse` | `#f7fbf9` | Text on strong surfaces |
| Border default | `--border-default` | `#cdd9d3` | Fields, dividers, panels |
| Border strong | `--border-strong` | `#9eb1a8` | Hover and active outlines |
| Accent | `--accent-primary` | `#087a5b` | Primary actions, selected state, focus |
| Accent hover | `--accent-hover` | `#065e47` | Hover and pressed state |
| Accent soft | `--accent-soft` | `#dff3eb` | Selected and positive tint |
| Success | `--status-success` | `#176b4f` | Viable/healthy result |
| Warning | `--status-warning` | `#9a5b0b` | Review-needed result |
| Error | `--status-error` | `#b42318` | Invalid input and model failure |
| Info | `--status-info` | `#285f8f` | Neutral information |
| Shadow tint | `--shadow-tint` | `rgba(16, 69, 56, 0.16)` | Chromatic elevation adapted from the reference |

Accent green is reserved for interaction, selection, and positive feasibility signals. Warning and error colors are semantic exceptions. No decorative gradient or theme inversion is used.

## 3. Typography

Primary font is `Pretendard`, `SUIT`, `Noto Sans KR`, then system sans-serif. Mono is `IBM Plex Mono`, `SFMono-Regular`, then monospace. Financial numbers use tabular numerals.

| Level | Size | Weight | Line height | Tracking | Usage |
|---|---:|---:|---:|---:|---|
| Display | 36px | 650 | 1.15 | -0.025em | Page statement |
| H1 | 28px | 650 | 1.2 | -0.02em | Current input section |
| H2 | 20px | 650 | 1.3 | -0.01em | Panel heading |
| H3 | 16px | 650 | 1.4 | 0 | Group heading |
| Body | 15px | 450 | 1.55 | 0 | Default copy and fields |
| Body small | 13px | 450 | 1.5 | 0 | Guidance and metadata |
| Caption | 12px | 550 | 1.4 | 0.015em | Units and status labels |
| Metric | 26px | 650 | 1.1 | -0.02em | KPI output |

## 4. Spacing & Layout

The base unit is 4px. Tokens are `--space-1` 4px, `--space-2` 8px, `--space-3` 12px, `--space-4` 16px, `--space-5` 20px, `--space-6` 24px, `--space-8` 32px, `--space-10` 40px, and `--space-12` 48px.

The desktop shell is a 176px section rail, a fluid form canvas, and a 356px result rail inside a 1480px maximum width. Gaps are 16px. During initial module execution the dynamic workspace reserves 1120px, the input and result panels reserve 860px and 880px, the desktop section navigation reserves 236px, and the technology switch reserves 52px desktop or 112px stacked. These reserves prevent layout shift before controls mount. Accurate-model additions use content-shaped loading placeholders and the existing reserve strategy; they do not introduce guessed fixed heights. A future reserve adjustment must come from measured shipped content, not an arbitrary new pixel value.

Below 1180px, the result rail moves below the form. Below 760px, the section rail becomes a 44px horizontally scrollable tab row and all content becomes one column. The acceptance viewports are 375px, 768px, and 1280px. At narrow widths and 200% zoom, the finance preset reflows in document order, CAPEX rows follow their declared mobile order, and only the labeled cash-flow region may scroll horizontally. The page itself must not require horizontal scrolling for a primary task. Controls remain at least 44px, Korean and other CJK labels wrap without clipping, and keyboard focus remains visible inside any overflow region.

## 5. Components

### Project type switch
- Structure: four native buttons in a labeled group.
- States: default, hover, selected, focus-visible, pressed.
- Accessibility: `aria-pressed` exposes the selected technology; changing type resets to a disclosed default case.

### Section navigation
- Structure: native buttons linked to one visible model section.
- States: default, hover, current, focus-visible.
- Accessibility: current step uses `aria-current="step"`; keyboard order follows the visual order.

### Field
- Structure: visible label, optional help text, input/select, and unit suffix.
- Variants: number, percentage, currency, select, boolean (rendered as a native two-option select, never a checkbox, so it shares the same label/hint/unit slots and keyboard behavior as every other field), year, duration, and month.
- Accurate-model fields: base/start year, development years, construction years, and COD month appear in project calendar order. The P75 net capacity factor field includes persistent help explaining that the value is already net of modeled losses, so losses are not deducted again.
- ESS-only fields: capacity ramp-up (one independently editable multiplier per operating year, up to 15 years, defaulting to a reduced year-1/year-2 value and normal cycling thereafter), operating efficiency (round-trip efficiency covering transformer/PCS/cable/battery-DC losses, plus a separate auxiliary/house-load consumption percent deducted after round-trip losses), and battery augmentation (enabled, interval years, capacity-restore percent, unit cost per kWh, cost escalation) appear in the revenue section only when ESS is selected. The LTSA step (step-after-year, post-step multiplier) appears in the OPEX section only when ESS is selected and names the exact OPEX row it modifies.
- States: default, hover, focus, disabled, unavailable, and error.
- Accessibility: every control has a programmatic Korean-first label, units remain visible, and help is connected with `aria-describedby`. COD month exposes its valid range, duration units are explicit, and invalid fields use `aria-invalid` plus an inline error summary.

### Cost row
- CAPEX structure: item label, CAPEX category select, amount with unit, and remove button for user-added rows. The category selector is a required part of every CAPEX row.
- OPEX structure: item label, amount with unit, and remove button for user-added rows. OPEX rows do not get categories.
- Mobile read order: item label, CAPEX category select when applicable, amount, then remove. The visual layout must not change this DOM or keyboard order.
- States: default, focus, added, removed; required default rows cannot be deleted accidentally.
- Accessibility: each item, category, amount, and remove control has an accessible name that includes the row item or row number. The remove label states which row will be removed; category and amount errors are attached to their own controls.

### Read-only finance preset panel
- Structure: a labeled non-editable section and definition list, not disabled form controls. It covers WACC, historical progressive tax brackets, depreciation, NOL, annual DSCR, cumulative DSCR, legal reserve, and investor dividend tax.
- Provenance: source and limitation text is adjacent to the values and remains visible at every breakpoint. Historical progressive tax brackets are labeled as an example-file preset, not current law or tax advice.
- States: calculated source loaded, loading, unavailable with reason, and error. A technology change refreshes the entire preset as one named group and cannot leave mixed or stale values.
- Accessibility: the read-only finance preset panel is announced by its heading and read-only status. Terms and values remain paired in screen-reader and 200% zoom reading order; abbreviations are expanded on first use and no value is conveyed only through color or a tooltip.

### Result metric
- Structure: label, tabular value, unit, and one-line interpretation.
- Variants: P-IRR, E-IRR before investor tax, investor-tax-after E-IRR, NPV, and P-PBP; visual emphasis remains primary, neutral, or warning.
- Definitions: E-IRR before investor tax is the standard equity return after corporate tax and before investor dividend tax. Investor-tax-after E-IRR uses the investor cash flow after investor dividend tax. P-PBP is the first point when cumulative after-corporate-tax project CF reaches non-negative, on the project CF cumulative basis.
- States: calculated, loading skeleton, unavailable, error.
- Accessibility: full return names and tax bases remain in visible copy rather than abbreviation-only tooltips. Results are announced through a polite live region after a valid recalculation.

### Capital breakdown
- Structure: the 11-line capital breakdown displays exactly these cost or reserve lines in this order: equipment, civil, electrical, grid/line, transport/installation, indirect, land, contingency, construction interest, finance fee, DSRA.
- Reconciliation: reconciliation totals follow the eleven lines as a separate footer and show capital total, funding total, and any difference. Totals are not counted as additional capital lines.
- Reserve treatment: DSRA is a recoverable reserve, not a consumed cost. Its label and explanation must not present it as spent OPEX or a permanently consumed construction cost.
- States: calculated, loading, unavailable, and error. A non-zero reconciliation difference is an error state, not a warning or hidden rounding note.
- Accessibility: the line name, amount, unit, and reserve or reconciliation meaning are available as text. Reading order stays identical on desktop and mobile.

### Augmentation schedule (ESS only)
- Structure: a labeled section listing each scheduled battery augmentation event by calendar year and operating year, its CAPEX draw, and a summed total; appended only when at least one event exists, so non-ESS technologies and ESS cases with augmentation disabled render nothing extra.
- Boundary: augmentation CAPEX is explicitly not part of the 11-line capital breakdown or its reconciliation; the section states that it draws on that year's distributable cash first and calls additional equity second.
- States: calculated, absent (technology or config has no events). No loading or error state of its own; it follows the parent result panel's state.
- Accessibility: each event and the total are plain label/value text rows, matching the funding-list pattern used by capital and funding breakdowns.

### Sensitivity matrix
- Structure: labeled scenario rows with return values and a centered baseline marker.
- States: positive, baseline, negative, unavailable.
- Accessibility: the numeric result is present as text; color is never the only signal.

### Cash-flow table
- Structure: one semantic table spans the entire model calendar. Columns are calendar year, phase, operating fraction, generation or discharge, revenue, OPEX, corporate tax, interest, principal, annual DSCR, cumulative DSCR, dividends, project CF, and equity CF.
- Phase coverage: rows begin with development and construction, then continue through partial operations and full operations to the final operating row. Each partial-year row shows the actual operating fraction. Construction and operation remain in one comparable chronology.
- States: calculated, loading, unavailable, error, partial-year, balloon, withheld-dividend, and augmentation-year (ESS only). A balloon state exposes residual principal and timing. A withheld-dividend state names the failed annual DSCR, cumulative DSCR, or reserve gate and shows zero dividend without suppressing the row. An augmentation-year state appends the battery augmentation CAPEX amount to the phase cell as inline text, the same pattern used for balloon and withheld-dividend notes, rather than adding a new column.
- Narrow layout: the table keeps its comparison structure inside a labeled horizontal scroll region rather than converting years into disconnected cards. A focusable overflow region is required only when content actually overflows.
- Accessibility: use a caption plus scoped row and column headers. Sticky visual headers do not change reading order, every data cell retains its header relationship, abbreviations are expanded in the caption or adjacent key, and state text accompanies any status color.

### Model state language
- Calculated: values belong to the current valid input revision and the current technology preset.
- Loading: retain labels and structural placeholders, set the affected region busy, and never present the previous revision as current.
- Unavailable: show `N/A` plus a concise reason when a metric or cell is not meaningful for that phase or input.
- Error: preserve the user's inputs, show a located recovery message, and prevent stale calculated values from appearing valid.
- Partial-year: mark any operating row with less than a full calendar year and expose its operating fraction.
- Balloon: identify principal still due at maturity or the modeled end and show its amount in the affected row.
- Withheld-dividend: identify a dividend blocked by annual DSCR, cumulative DSCR, or reserve rules and state the blocking rule.

### Action button
- Variants: primary, secondary, quiet.
- States: default, hover, active, focus-visible, disabled, loading.
- Motion: only transform and opacity over the micro timing token.

## 6. Motion & Interaction

Micro feedback is 120ms ease-out; section changes use 220ms ease-in-out opacity and transform. Calculation updates use no decorative movement. Inputs recalculate after a 120ms debounce. `prefers-reduced-motion: reduce` removes transitions and smooth scrolling. No scroll listener is used.

## 7. Depth & Surface

Strategy is mixed but restrained: default structure uses borders and tonal shifts; only the sticky result rail receives a two-layer green-tinted shadow. Radius rules are 6px for fields/buttons and 10px for panels. No pill buttons and no radius above 10px.

| Level | Treatment | Usage |
|---|---|---|
| Flat | none | Page and form groups |
| Subtle | `0 1px 2px rgba(16, 69, 56, 0.06)` | Controls on hover |
| Elevated | two-layer green-tinted shadow | Result rail only |

## 8. Accessibility Constraints & Accepted Debt

Target is WCAG 2.2 AA: 4.5:1 body contrast, 3:1 large-text and control-boundary contrast, visible focus on every interactive element, complete keyboard reachability, 44px touch targets, reduced-motion support, text alternatives for any charted value, and concise Korean-first labels with units attached to each assumption.

Dense preset and table constraints are part of the acceptance contract. Preset values use headings and term-value relationships instead of disabled inputs, source and limitation copy stays in the reading flow, and screen-reader users can distinguish editable assumptions from reference values. The cash-flow wrapper has an accessible name and visible keyboard focus when scrollable; table headers retain semantic associations through horizontal scrolling. At 375px, 768px, 1280px, and 200% zoom, CJK content wraps without truncation, focus is not obscured, status explanations remain adjacent to the affected value, and no interaction requires pointer precision or memorizing a color legend.

Persona failure blocks completion: the developer must be able to classify CAPEX and trace the calendar; the lender must be able to trace debt, both DSCR gates, dividend withholding, and reserve recovery; the investment reviewer must be able to distinguish both E-IRR tax bases and reconcile all eleven capital lines. No metric abbreviation, sticky treatment, or responsive rearrangement may remove those tasks from keyboard or screen-reader users.

Accepted debt: none. The model is explicitly labeled as an indicative pre-feasibility calculation, not audited investment advice; that is a product-scope disclosure rather than accessibility debt.
