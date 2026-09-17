// 해상풍력 5 — 보증 구조 반영: 터빈사(TSA/LTSA, 출력곡선·기술적 가용률) / EPC·BOP(전기손실·계통 가용률) 구분과
// 보증 미달 시 귀책별 손실·LD 보전 분석 탭.
// prototypes/src/offshore-wind.html을 제자리에서 고친다(한 번만 적용 — 다시 실행하면 앵커를 찾지 못해 멈춘다).
// 실행: node prototypes/tools/offshore-wind/wind-5-warranty.mjs   → 이후 npm run build:prototypes
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(HERE, "../../src/offshore-wind.html");
const S = {};
readFileSync(resolve(HERE, "wind-5-warranty-snippets.txt"), "utf8").replace(/\r\n/g, "\n").split(/^\/\/@@ /m).slice(1).forEach((block) => {
  const i = block.indexOf("\n");
  S[block.slice(0, i).trim()] = block.slice(i + 1).replace(/\n+$/, "");
});

// 체크아웃 설정(autocrlf)에 따라 CRLF로 받을 수 있어, 여러 줄 앵커가 맞도록 LF로 맞춰 읽고 LF로 쓴다(저장소 기록은 LF).
let s = readFileSync(TARGET, "utf8").replace(/\r\n/g, "\n");
const once = (from, to, label) => {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`${label}: expected 1, found ${n}`);
  s = s.replace(from, () => to);
};

// ── 스타일 ────────────────────────────────────────────────────
once(`  /* ═══ 버튼 ═══ */`, `${S.CSS}\n\n  /* ═══ 버튼 ═══ */`, "css");

// ── C. 발전매출 — 보증 주체별 입력과 구성 표 ──────────────────
const lossFields = `                <div class="field"><label for="wakeLossPct">후류(웨이크) 손실</label><div class="iw"><input id="wakeLossPct" type="number" value="8" step="0.5" min="0" max="50"><span class="unit">%</span></div></div>
                <div class="field"><label for="electricalLossPct">전기·송전 손실</label><div class="iw"><input id="electricalLossPct" type="number" value="3" step="0.5" min="0" max="30"><span class="unit">%</span></div></div>`;
once(lossFields, S.FIELDS, "fields");
once(`<label for="turbineFactorDisplay">출력곡선 보정 × 가용률</label>`, `<label for="turbineFactorDisplay">출력곡선 × 가용률 × BOP</label>`, "factor label");
// 같은 산식 문구가 화면 설명과 코드 주석 두 곳에 있어 둘 다 바꾼다.
const formula = `1년차 순이용률 = 부지 총이용률 × 출력곡선 보정 × 가용률 × (1 −`;
if (s.split(formula).length - 1 !== 2) throw new Error(`hint formula: expected 2, found ${s.split(formula).length - 1}`);
s = s.split(formula).join(`1년차 순이용률 = 부지 총이용률 × 출력곡선 보정 × 출력곡선 보증 이행률 × 기술적 가용률(터빈사 보증) × BOP·계통 가용률(EPC 보증) × (1 −`);

const rateSubhead = `              <div class="subhead subhead-row">\n                <span>운영연차별 순이용률 (직접 수정 가능)</span>`;
once(rateSubhead, `${S.BUILDUP}\n${rateSubhead}`, "buildup");

// BOP·계통 가용률(99%)이 곱해져 기본 순이용률이 34.38 → 34.03%로 바뀐다 — 입력 기본값도 맞춰 "터빈 값 적용 중" 상태를 유지한다.
once(`<input id="year1RatePct" type="number" value="34.38" step="0.01">`, `<input id="year1RatePct" type="number" value="34.03" step="0.01">`, "y1 default");

// ── 탭 · 패널 ─────────────────────────────────────────────────
const kchTab = `        <button type="button" class="tab" role="tab" id="tab-kch" aria-controls="panel-kch" data-panel="panel-kch" aria-selected="false">KCH 개발수수료</button>`;
once(kchTab, `${S.TAB_BUTTON}\n${kchTab}`, "tab");
const kchPanel = `      <div class="tabpanel" role="tabpanel" id="panel-kch" aria-labelledby="tab-kch" hidden>`;
once(kchPanel, `${S.PANEL}\n\n${kchPanel}`, "panel");

// ── 순이용률 계산 — 보증 주체별 곱 ────────────────────────────
once(`    const y1 = Math.round((+$('siteBaseRatePct').value || 0) * curveF * rate(sp.avail) * losses * 100) / 100;`,
  `    // 보증 주체별 곱 — 터빈사(출력곡선 보증 이행률 × 기술적 가용률) × EPC·O&M(BOP·계통 가용률)\n`
  + `    const warranty = rate(+$('powerCurveWarrantyPct').value || 0) * rate(sp.avail) * rate(+$('bopAvailPct').value || 0);\n`
  + `    const y1 = Math.round((+$('siteBaseRatePct').value || 0) * curveF * warranty * losses * 100) / 100;`, "y1");
once("$('turbineFactorDisplay').value = `${fmt(d.curveF, 4)} × ${fmt(d.avail, 1)}%`;",
  "$('turbineFactorDisplay').value = `${fmt(d.curveF, 4)} × 가용률 ${fmt(d.avail, 1)}% × BOP ${fmt(+$('bopAvailPct').value || 0, 1)}%`;", "factor display");

// ── 렌더 함수 · 탭 배선 ───────────────────────────────────────
once(`  function renderTurbineCompare() {`, `${S.JS_BUILDUP}\n\n  function renderTurbineCompare() {`, "render fns");
once(`  const resultsDirty = { summary: true, sens: true };`, `  const resultsDirty = { summary: true, sens: true, warranty: true };`, "dirty");
once(`resultsDirty.entry = true; resultsDirty.cases = true; }`, `resultsDirty.entry = true; resultsDirty.cases = true; resultsDirty.warranty = true; }`, "markDirty");
once(`    else if (activeTabId === 'tab-cases' && resultsDirty.cases) { resultsDirty.cases = false; renderCases(); }`,
  `    else if (activeTabId === 'tab-cases' && resultsDirty.cases) { resultsDirty.cases = false; renderCases(); }\n`
  + `    else if (activeTabId === 'tab-warranty' && resultsDirty.warranty) { resultsDirty.warranty = false; renderWarranty(); }`, "renderActiveTab");
once(`    syncOperatingRateRows();\n    syncCdRateRows();`,
  `    syncOperatingRateRows();\n    renderGenerationBuildup(); // 보증 주체별 발전량 구성 표\n    syncCdRateRows();`, "recalc hook");

once(`  $('applyRateBtn').addEventListener('click', () => {`, `${S.JS_LISTENERS}\n  $('applyRateBtn').addEventListener('click', () => {`, "listeners");
once(`  const TURBINE_UPSTREAM_IDS = ['siteBaseRatePct', 'wakeLossPct', 'electricalLossPct', 'bosUnitPrice', 'refSpecificPower', 'powerCurveExp'];`,
  `  const TURBINE_UPSTREAM_IDS = ['siteBaseRatePct', 'wakeLossPct', 'electricalLossPct', 'powerCurveWarrantyPct', 'bopAvailPct', 'bosUnitPrice', 'refSpecificPower', 'powerCurveExp'];`, "upstream ids");
once(`el.id.startsWith('cs-') || el.id === 'caseDiscountAll' ||`,
  `el.id.startsWith('cs-') || el.id === 'caseDiscountAll' || /^(act|ld)[A-Z]/.test(el.id) ||`, "generic listener");

// ── 확정 필요 항목 ────────────────────────────────────────────
const lastCaveat = `              <li>엑셀(.xlsx) 회신 변환기`;
once(lastCaveat, `${S.CAVEAT}\n${lastCaveat}`, "caveat");
once(`전체 14개 항목`, `전체 15개 항목`, "caveat count");

writeFileSync(TARGET, s, "utf8");
console.log(`wind-5-warranty: ${s.split("\n").length} lines`);
