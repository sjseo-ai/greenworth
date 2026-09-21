// 공통 — 히어로 오른쪽의 "단가 범위" 상자를 직접 끌어볼 수 있는 슬라이더로 바꾼다.
// 최저단가(하한) · 현재 산정 결과 · 상한가(같은 축으로 환산)를 그래프에 눈금으로 찍고,
// 손잡이를 옮기면 그 단가의 P-IRR · E-IRR · 당사 배당+회수 · 순이익 · 목표 대비 · 입찰가격/상한가 여유를 바로 보여 준다.
// 슬라이더는 "보기"만 바꾸는 장치라 재계산·시나리오 저장·CSV에 들어가지 않는다.
// 대상: prototypes/src/{solar,offshore-wind,bess}.html — 육상풍력은 해상풍력에서 다시 파생한다.
//   node prototypes/tools/common/price-range-slider.mjs && node prototypes/tools/onshore-wind/onshore-1-derive.mjs && npm run build:prototypes
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "../../src");
const S = {};
readFileSync(resolve(HERE, "price-range-slider-snippets.txt"), "utf8").replace(/\r\n/g, "\n").split(/^\/\/@@ /m).slice(1).forEach((block) => {
  const i = block.indexOf("\n");
  S[block.slice(0, i).trim()] = block.slice(i + 1).replace(/\n+$/, "");
});

const PAGES = [
  { id: "solar", unit: "수령단가", cap: S.CAP_SOLAR, bidRow: S.BIDROW_SOLAR },
  { id: "offshore-wind", unit: "수령단가", cap: S.CAP_WIND, bidRow: S.BIDROW_WIND },
  { id: "bess", unit: "입찰단가", cap: S.CAP_BESS, bidRow: S.BIDROW_BESS },
];

for (const p of PAGES) {
  const file = resolve(SRC, `${p.id}.html`);
  let s = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const sub = (from, to, n, label) => {
    const found = s.split(from).length - 1;
    if (found !== n) throw new Error(`${p.id} · ${label}: expected ${n}, found ${found}`);
    s = s.split(from).join(to);
  };
  const once = (from, to, label) => sub(from, to, 1, label);

  // ── 화면 — 막대 → 눈금 있는 슬라이더, 결과 줄 추가 ──────────
  once(`  .price-range .bar { height: 6px; background: var(--line); border-radius: 4px; overflow: hidden; }
  .price-range .bar .fill { height: 100%; background: var(--accent); border-radius: 4px; }`, S.CSS, "css");
  once(`          <div class="bar"><div class="fill"></div></div>`, S.HTML.split("@@UNIT@@").join(p.unit), "graph markup");
  once(`          <div class="warn" role="status" id="priceFloorWarn"></div>`,
    `${S.LIVE}\n          <div class="warn" role="status" id="priceFloorWarn"></div>`, "live row");

  // ── 동작 — 슬라이더 상태·미리보기 ─────────────────────────────
  const js = S.JS.split("@@UNIT@@").join(p.unit).split("@@CAP@@").join(p.cap).split("@@BIDROW@@").join(p.bidRow);
  once(`  // ---------- 결과 탭 공통 — 보이는 탭만 계산한다(result-tabs-design-spec.md 규칙 10) ----------`,
    `${js}\n\n  // ---------- 결과 탭 공통 — 보이는 탭만 계산한다(result-tabs-design-spec.md 규칙 10) ----------`, "js block");

  // ── 산정 결과와 연결 ─────────────────────────────────────────
  once(`    $('priceRangeLow').textContent = floor.ok ? fmt(floor.price, 2) + ' 원/kWh (' + floor.binding + ' 기준)' : '—';`,
    `    $('priceRangeLow').textContent = floor.ok ? fmt(floor.price, 2) + ' 원/kWh (' + floor.binding + ' 기준)' : '—';
    setupPriceRange(model, solved.price, floor);`, "setup call");
  sub(`      $('priceRangeLow').textContent = '—'; $('priceRangeHigh').textContent = '—'; $('priceFloorWarn').className = 'warn';`,
    `      $('priceRangeLow').textContent = '—'; $('priceRangeHigh').textContent = '—'; $('priceFloorWarn').className = 'warn';
      clearPriceRange();`, 2, "clear calls");

  // ── 모델 입력이 아니라 보기 장치 — 재계산·시나리오·CSV에서 제외 ──
  once(`    if (el.id === 'bidPrice' ||`, `    if (el.id === 'priceRangeSlider' || el.id === 'bidPrice' ||`, "recalc listener");
  once(`      if (el.disabled || el.id === 'scenarioName'`, `      if (el.disabled || el.id === 'priceRangeSlider' || el.id === 'scenarioName'`, "scenario capture");
  once(`      if (el.id === 'scenarioName' || el.id === 'sensMetric' || el.hasAttribute('data-capex-index')`,
    `      if (el.id === 'priceRangeSlider' || el.id === 'scenarioName' || el.id === 'sensMetric' || el.hasAttribute('data-capex-index')`, "assumption snapshot");
  once(`      if (el.id === 'scenarioName' || seen.has(el.id)) return;`,
    `      if (el.id === 'priceRangeSlider' || el.id === 'scenarioName' || seen.has(el.id)) return;`, "csv general list");

  writeFileSync(file, s, "utf8");
  console.log(`  ${p.id}: ${p.unit} 범위 슬라이더 · 눈금(최저 · 산정${p.id === "bess" ? "" : " · 상한"})`);
}
console.log("price-range-slider: done — 이어서 onshore-1-derive.mjs와 npm run build:prototypes를 실행하세요.");
