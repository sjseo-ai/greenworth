import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("initial dynamic regions reserve stable layout space", async () => {
  const [tokens, layout, components, responsive] = await Promise.all([
    readFile(new URL("../styles/tokens.css", import.meta.url), "utf8"),
    readFile(new URL("../styles/layout.css", import.meta.url), "utf8"),
    readFile(new URL("../styles/components.css", import.meta.url), "utf8"),
    readFile(new URL("../styles/responsive.css", import.meta.url), "utf8"),
  ]);
  assert.match(tokens, /--workspace-reserve:\s*1120px/);
  assert.match(tokens, /--section-nav-reserve:\s*236px/);
  assert.match(tokens, /--technology-row-reserve:\s*52px/);
  assert.match(tokens, /--technology-stack-reserve:\s*112px/);
  assert.match(tokens, /--model-panel-reserve:\s*860px/);
  assert.match(tokens, /--results-panel-reserve:\s*880px/);
  assert.match(layout, /\.workspace\s*\{[^}]*min-height:\s*var\(--workspace-reserve\)/s);
  assert.match(layout, /\.model-panel\s*\{[^}]*min-height:\s*var\(--model-panel-reserve\)/s);
  assert.match(layout, /\.results-panel\s*\{[^}]*min-height:\s*var\(--results-panel-reserve\)/s);
  assert.match(components, /#section-navigation\s*\{[^}]*min-height:\s*var\(--section-nav-reserve\)/s);
  assert.match(components, /\.status-dot\s*\{[^}]*min-width:\s*64px/s);
  assert.match(components, /\.technology-switch\s*\{[^}]*min-height:\s*var\(--technology-row-reserve\)/s);
  assert.match(responsive, /\.technology-switch\s*\{[^}]*min-height:\s*var\(--technology-stack-reserve\)/s);
});

test("brand link keeps the design-system minimum target height", async () => {
  // Given: the brand anchor is the home interaction in the fixed header.
  const layout = await readFile(new URL("../styles/layout.css", import.meta.url), "utf8");

  // When: its layout contract is inspected.
  // Then: the actual anchor box, not a child or outline, owns a 44px minimum.
  assert.match(layout, /\.brand\s*\{[^}]*min-block-size:\s*44px/s);
});

test("direct file entry uses a classic bundle that browsers can execute", async () => {
  const [entry, bundle] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../js/app.bundle.js", import.meta.url), "utf8"),
  ]);
  assert.match(entry, /<script src="js\/app\.bundle\.js"><\/script>/);
  assert.doesNotMatch(entry, /<script type="module"/);
  assert.doesNotMatch(bundle, /^\s*(?:import|export)\s/m);
  assert.match(bundle, /buildTechnologySwitch\(\);\s*renderSection\(\);\s*calculate\(\);/);
});

test("accurate-model styling preserves responsive reading and overflow contracts", async () => {
  const [tokens, layout, components, responsive] = await Promise.all([
    readFile(new URL("../styles/tokens.css", import.meta.url), "utf8"),
    readFile(new URL("../styles/layout.css", import.meta.url), "utf8"),
    readFile(new URL("../styles/components.css", import.meta.url), "utf8"),
    readFile(new URL("../styles/responsive.css", import.meta.url), "utf8"),
  ]);
  const productStyles = `${layout}\n${components}\n${responsive}`;

  assert.match(components, /\.capex-cost-row\s*\{[^}]*grid-template-areas:\s*"item category amount remove"/s);
  assert.match(components, /\.opex-cost-row\s*\{[^}]*grid-template-areas:\s*"item amount remove"/s);
  assert.match(components, /\.capex-category-select\s*\{[^}]*grid-area:\s*category/s);
  assert.match(components, /\.finance-preset-panel\s*\{/);
  assert.match(components, /\.finance-preset-row\s*\{[^}]*display:\s*grid/s);
  assert.match(components, /\.finance-preset-warning\s*\{/);
  assert.match(components, /\.input-wrap input, \.input-wrap select\s*\{[^}]*height:\s*44px/s);
  assert.match(components, /\.metric-value--compact\s*\{[^}]*font-size:/s);
  assert.match(components, /\.reconciliation-error\s*\{/);
  assert.match(components, /\.cashflow-scroll-region:focus-visible\s*\{/);
  assert.match(components, /\.cashflow-scroll-region:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--accent-primary\)[^}]*outline-offset:\s*-3px/s);
  assert.doesNotMatch(components, /\.cashflow-scroll-region:focus-visible\s*\{[^}]*box-shadow:\s*inset/s);
  assert.match(components, /\.cashflow-key\s*\{[^}]*position:\s*sticky[^}]*inset-inline-start:\s*0[^}]*white-space:\s*normal[^}]*word-break:\s*keep-all[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(components, /\.cashflow-table\s*\{[^}]*width:\s*max-content[^}]*min-width:\s*100%/s);
  assert.match(components, /\.sensitivity-baseline-marker\s*\{[^}]*position:\s*relative[^}]*min-height:\s*44px[^}]*text-align:\s*center/s);
  assert.match(components, /\.sensitivity-baseline-marker::before\s*\{[^}]*background:\s*var\(--surface-muted\)/s);
  assert.match(components, /\.sensitivity-baseline-marker::after\s*\{[^}]*inset-inline-start:\s*50%[^}]*border-inline-start:\s*2px solid var\(--accent-primary\)/s);
  assert.match(layout, /\.intro h1,[^{]*\.methodology article p,[^{]*footer p\s*\{[^}]*word-break:\s*keep-all/s);
  assert.match(layout, /\.cashflow-scroll-region\s*\{[^}]*scroll-margin-block-start:\s*calc\(var\(--space-12\) \+ var\(--space-8\)\)/s);
  assert.match(responsive, /@media \(max-width:\s*900px\)[\s\S]*?\.capex-cost-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(120px,\s*0\.7fr\) 44px[^}]*grid-template-areas:\s*"item item item"\s*"category amount remove"/s);
  assert.match(responsive, /\.capex-cost-row\s*\{[^}]*grid-template-areas:\s*"item item"\s*"category category"\s*"amount remove"/s);
  assert.match(responsive, /@media \(max-width:\s*760px\)[\s\S]*?\.cashflow-scroll-region\s*\{[^}]*scroll-margin-block-start:\s*var\(--space-4\)/s);
  assert.match(responsive, /@media \(max-width:\s*760px\)[\s\S]*?\.cashflow-table thead th:nth-child\(2\),\s*\.cashflow-table \.cashflow-phase\s*\{[^}]*text-align:\s*left/s);
  assert.match(responsive, /@media \(max-width:\s*760px\)[\s\S]*?#section-navigation\s*\{[^}]*flex-wrap:\s*nowrap[^}]*overflow-x:\s*auto/s);
  assert.match(responsive, /@media \(max-width:\s*760px\)[\s\S]*?\.section-button\s*\{[^}]*flex:\s*0 0 auto/s);
  assert.match(responsive, /#section-navigation \.section-button:focus-visible\s*\{[^}]*outline-offset:\s*calc\(-1 \* var\(--space-1\)\)/s);
  assert.match(responsive, /\.header-actions \.button\s*\{[^}]*min-height:\s*44px/s);
  assert.doesNotMatch(responsive, /\.header-actions \.button\s*\{[^}]*min-height:\s*(?:[0-3]?\d|4[0-3])px/s);
  assert.match(tokens, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*transition-duration:\s*0\.01ms\s*!important/);
  assert.doesNotMatch(productStyles, /#[\da-f]{3,8}\b|rgba?\(|hsla?\(/i);
  assert.doesNotMatch(productStyles, /(?:linear|radial|conic)-gradient\s*\(/i);
});

// 이 하네스는 .omo/evidence/ 아래에 있고 그 폴더는 .gitignore로 제외돼 있다(작업 기록용 도구 폴더).
// 따라서 하네스가 있는 작업 PC에서만 검사하고, 없는 환경(새로 클론한 저장소·CI)에서는 건너뛴다.
test("resume repair browser harness covers every responsive and state contract", async (t) => {
  let harness;
  try {
    harness = await readFile(new URL(
      "../.omo/evidence/refine-feasibility-model-v3/task-6-responsive-docs/style-final-qa/resume-repair/browser-qa.mjs",
      import.meta.url,
    ), "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    t.skip("browser-qa.mjs가 없는 환경(.omo/evidence 제외 — 클론·CI)에서는 건너뜁니다");
    return;
  }

  for (const viewport of ["375x900", "768x1024", "1280x900", "640x900-dpr2"]) {
    assert.match(harness, new RegExp(`id:\\s*"${viewport}"`));
  }
  for (const state of ["hero", "capex", "finance", "results", "negative-unavailable", "loading", "error", "cashflow", "focus", "reduced-motion"]) {
    assert.match(harness, new RegExp(`"${state}"`));
  }
  assert.match(harness, /async function measureInputTextVisibility\(/);
  assert.match(harness, /async function captureLoadingState\(/);
  assert.match(harness, /async function captureErrorState\(/);
  assert.match(harness, /async function tabToCashflow\(/);
  assert.match(harness, /async function measureCashflowFocusPixels\(/);
  assert.match(harness, /async function measureCashflowOrientation\(/);
  assert.match(harness, /async function measureMobileNavigation\(/);
  assert.match(harness, /async function settleRestingCapture\(/);
  assert.match(harness, /page\.keyboard\.press\("Tab"\)/);
  assert.match(harness, /page\.keyboard\.press\("ArrowRight"\)/);
  assert.match(harness, /const horizontalOverlap = rect\.right > wrapperRect\.left && rect\.left < wrapperRect\.right/);
  assert.match(harness, /if \(wrapper\.contains\(node\)\) return \[\]/);
  assert.match(harness, /await page\.waitForFunction\([\s\S]*?scrollLeft > initial[\s\S]*?timeout:\s*1_000/s);
  assert.match(harness, /scrollMarginBlockStart/);
  assert.match(harness, /captionTop/);
  assert.match(harness, /captionGlyphLeft/);
  assert.match(harness, /captionTextInside/);
  assert.match(harness, /firstTwoHeaderLabelsVisible/);
  assert.match(harness, /firstPhaseTextStartsVisible/);
  assert.match(harness, /keyStickyAt240/);
  assert.match(harness, /headerCount/);
  assert.match(harness, /topAccentCoverage/);
  assert.match(harness, /leftAccentCoverage/);
  assert.match(harness, /captionGlyphClearance/);
  assert.match(harness, /keyGlyphClearance/);
  assert.match(harness, /headerGlyphClearance/);
  assert.match(harness, /hasVisibleFocusTreatment/);
  assert.match(harness, /headerTop/);
  assert.match(harness, /innerContentWidth/);
  assert.match(harness, /paintWidth/);
  assert.match(harness, /clientWidth/);
  assert.match(harness, /scrollWidth/);
  assert.match(harness, /minTouchTarget:\s*44/);
  assert.match(harness, /errors:\s*\{\s*console:\s*\[\],\s*page:\s*\[\],\s*request:\s*\[\]/s);
  assert.match(harness, /document\.activeElement\.blur\(\)/);
  assert.match(harness, /window\.scrollTo\(\{ top:\s*0, behavior:\s*"instant" \}\)/);
  assert.match(harness, /const previousScrollBehavior = document\.documentElement\.style\.scrollBehavior/);
  assert.match(harness, /document\.documentElement\.style\.scrollBehavior = "auto"/);
  assert.match(harness, /frame < 12 && stableTopFrames < 3/);
  assert.match(harness, /document\.documentElement\.style\.scrollBehavior = previousScrollBehavior/);
  assert.match(harness, /scrollTopReset/);
  assert.match(harness, /stickyHeaderSettled/);
  assert.match(harness, /\.skip-link/);
  for (const state of ["capex", "finance", "results", "negative-unavailable", "loading", "error", "cashflow"]) {
    assert.match(harness, new RegExp(`captureResting\\(page, (?:config\\.id|id), "${state}", null, \\{ fullPage: true \\}\\)`));
  }
  assert.doesNotMatch(harness, /\.cashflow-scroll-region"\)\.focus\(\)/);
});
