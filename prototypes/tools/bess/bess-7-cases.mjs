// BESS 7 — 입찰 사례 탭: ESS 중앙계약시장 회차별 결과(2023 제주 · 2025 제1·2차 · 제3차 예정)와 선정 사업지로 사업성 추정.
// prototypes/src/bess.html을 제자리에서 고친다(한 번만 적용). 실행 후 npm run build:prototypes
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(HERE, "../../src/bess.html");
const S = {};
readFileSync(resolve(HERE, "bess-7-cases-snippets.txt"), "utf8").replace(/\r\n/g, "\n").split(/^\/\/@@ /m).slice(1).forEach((block) => {
  const i = block.indexOf("\n");
  S[block.slice(0, i).trim()] = block.slice(i + 1).replace(/\n+$/, "");
});

let s = readFileSync(TARGET, "utf8").replace(/\r\n/g, "\n");
const once = (from, to, label) => {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`${label}: expected 1, found ${n}`);
  s = s.replace(from, () => to);
};

// ── 탭 · 패널 ─────────────────────────────────────────────────
const kchTab = `        <button type="button" class="tab" role="tab" id="tab-kch" aria-controls="panel-kch" data-panel="panel-kch" aria-selected="false">KCH 개발수수료</button>`;
once(kchTab, `${S.TAB_BUTTON}\n${kchTab}`, "tab");
const kchPanel = `      <div class="tabpanel" role="tabpanel" id="panel-kch" aria-labelledby="tab-kch" hidden>`;
once(kchPanel, `${S.PANEL}\n\n${kchPanel}`, "panel");

// ── 사례 데이터 · 렌더 함수 ───────────────────────────────────
once(`  // ---------- 요약 탭 — 연도별 현금흐름 차트 · 산출 근거(kv) · 경고 · 연도별 상세 (spec 4장) ----------`,
  `${S.JS_DATA}\n\n  // ---------- 요약 탭 — 연도별 현금흐름 차트 · 산출 근거(kv) · 경고 · 연도별 상세 (spec 4장) ----------`, "render fns");

// ── 탭 배선 ───────────────────────────────────────────────────
once(`  const resultsDirty = { summary: true, sens: true };`, `  const resultsDirty = { summary: true, sens: true, cases: true };`, "dirty");
once(`  function markResultsDirty() { resultsDirty.summary = true; resultsDirty.sens = true; }`,
  `  function markResultsDirty() { resultsDirty.summary = true; resultsDirty.sens = true; resultsDirty.cases = true; }`, "markDirty");
once(`    else if (activeTabId === 'tab-sens' && resultsDirty.sens) { resultsDirty.sens = false; computeSensitivity(); renderSensitivityView(); }\n  }`,
  `    else if (activeTabId === 'tab-sens' && resultsDirty.sens) { resultsDirty.sens = false; computeSensitivity(); renderSensitivityView(); }\n`
  + `    else if (activeTabId === 'tab-cases' && resultsDirty.cases) { resultsDirty.cases = false; renderCases(); }\n  }`, "renderActiveTab");

// ── 리스너 — 사례 입력은 본 모델과 무관해 탭만 다시 그린다 ────
const tabsInit = `  // ---------- 탭 — 초기 상태를 HTML 속성에 기대지 않고 JS가 정한다`;
once(tabsInit, `${S.JS_LISTENERS}\n\n${tabsInit}`, "listeners");
once(`el.id.startsWith('kch') || el.disabled) return;`, `el.id.startsWith('kch') || el.id.startsWith('cs-') || el.id.startsWith('rd-') || el.disabled) return;`, "generic listener");

// ── 확정 필요 항목 — 목록의 마지막 li 뒤에 추가 ───────────────
const caveatsAt = s.indexOf('id="modelCaveatsFull"');
if (caveatsAt < 0) throw new Error("caveats: anchor not found");
const listEnd = s.indexOf("</ul>", caveatsAt);
if (listEnd < 0) throw new Error("caveats: list end not found");
s = s.slice(0, listEnd) + `${S.CAVEAT}\n            ` + s.slice(listEnd);
once(`전체 11개 항목`, `전체 12개 항목`, "caveat count");

writeFileSync(TARGET, s, "utf8");
console.log(`bess-7-cases: ${s.split("\n").length} lines`);
