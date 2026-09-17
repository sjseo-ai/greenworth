// 태양광 6 — O&M 보증 발전시간: 발전시간(h/일) ↔ 이용률 연동, 보증시간 기준 발전량·발전매출 분석 탭
// prototypes/src/solar.html을 제자리에서 고친다(한 번만 적용 — 다시 실행하면 앵커를 찾지 못해 멈춘다).
// 실행: node prototypes/tools/solar/solar-6-oam.mjs   → 이후 npm run build:prototypes
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(HERE, "../../src/solar.html");
const S = {};
readFileSync(resolve(HERE, "solar-6-oam-snippets.txt"), "utf8").replace(/\r\n/g, "\n").split(/^\/\/@@ /m).slice(1).forEach((block) => {
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

// ── 마크업 ────────────────────────────────────────────────────
const rateField = `                <div class="field"><label for="year1RatePct">1년차 이용률 (모듈 반영)</label><div class="iw"><input id="year1RatePct" type="number" value="14.95" step="0.01"><span class="unit">%</span></div></div>`;
once(rateField, `${rateField}\n${S.FIELD_HOURS}`, "field");

const rateSubhead = `              <div class="subhead subhead-row">\n                <span>운영연차별 이용률 (직접 수정 가능)</span>`;
once(rateSubhead, `${S.HINT_HOURS}\n${rateSubhead}`, "hint");

const kchTab = `        <button type="button" class="tab" role="tab" id="tab-kch" aria-controls="panel-kch" data-panel="panel-kch" aria-selected="false">KCH 개발수수료</button>`;
once(kchTab, `${S.TAB_BUTTON}\n${kchTab}`, "tab");

const kchPanel = `      <div class="tabpanel" role="tabpanel" id="panel-kch" aria-labelledby="tab-kch" hidden>`;
once(kchPanel, `${S.PANEL}\n\n${kchPanel}`, "panel");

once(`                  <thead><tr><th>연차 · 연도</th><th>이용률</th><th>발전량 (MWh)</th><th>판매</th></tr></thead>`, S.TABLE_HEAD, "table head");
once(`        <td>\${fmt(r.ratePct, 2)}%</td>`, S.TABLE_ROW, "table row");
once(`colspan="4" style="text-align:center;color:var(--ink-faint);">운영기간이 없습니다`, `colspan="5" style="text-align:center;color:var(--ink-faint);">운영기간이 없습니다`, "table empty");
once(`      return { seq: row.operationSequence, year: row.calendarYear, ratePct, fraction: row.operationFraction, gen, share: contractShareForRow(model, row) };`,
  `      const hours = 24 * rate(ratePct) * (1 - rate(model.revenue.curtailmentPct || 0)); // 계량기 기준 일평균 발전시간(h/일)\n      return { seq: row.operationSequence, year: row.calendarYear, ratePct, hours, fraction: row.operationFraction, gen, share: contractShareForRow(model, row) };`,
  "supply rows");

// ── 스크립트 ──────────────────────────────────────────────────
once(`  // ---------- 모듈사 비교 탭 — 등록된 모듈사(카탈로그 + 사용자 추가)를 같은 조건에서 각각 역산(탭이 보일 때만) ----------`,
  `${S.JS_HELPERS}\n\n  // ---------- 모듈사 비교 탭 — 등록된 모듈사(카탈로그 + 사용자 추가)를 같은 조건에서 각각 역산(탭이 보일 때만) ----------`, "helpers");

once(`  const resultsDirty = { summary: true, sens: true };`, `  const resultsDirty = { summary: true, sens: true, oam: true };`, "dirty");
once(`resultsDirty.entry = true; resultsDirty.cases = true; }`, `resultsDirty.entry = true; resultsDirty.cases = true; resultsDirty.oam = true; }`, "markDirty");
once(`    else if (activeTabId === 'tab-cases' && resultsDirty.cases) { resultsDirty.cases = false; renderCases(); }`,
  `    else if (activeTabId === 'tab-cases' && resultsDirty.cases) { resultsDirty.cases = false; renderCases(); }\n    else if (activeTabId === 'tab-oam' && resultsDirty.oam) { resultsDirty.oam = false; renderOamGuarantee(); }`, "renderActiveTab");
once(`    syncOperatingRateRows();\n    syncCdRateRows();`, `    syncOperatingRateRows();\n    syncGenerationHours(); // 1년차 발전시간 칸을 지금 이용률·손실률에 맞춘다\n    syncCdRateRows();`, "recalc hook");

once(`  $('applyRateBtn').addEventListener('click', () => {`, `${S.JS_LISTENERS}\n  $('applyRateBtn').addEventListener('click', () => {`, "listeners");
once(`el.id.startsWith('kch') || el.id.startsWith('mk-')`, `el.id.startsWith('kch') || el.id.startsWith('oam') || el.id.startsWith('mk-')`, "generic listener");

// ── 확정 필요 항목 ────────────────────────────────────────────
const excelCaveat = `              <li>엑셀(.xlsx) 회신 변환기`;
once(excelCaveat, `${S.CAVEAT}\n${excelCaveat}`, "caveat");
once(`전체 15개 항목`, `전체 16개 항목`, "caveat count");

writeFileSync(TARGET, s, "utf8");
console.log(`solar-6-oam: ${s.split("\n").length} lines`);
