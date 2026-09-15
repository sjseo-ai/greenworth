// 태양광 5a — 모듈사 카탈로그 한 곳 관리 + 화면에서 새 모듈 등록·삭제·내보내기·불러오기 + 시나리오에 사용자 추가 모듈 포함
// solar-v4-backup.html(v4 결과)에서 읽어 solar-bid-price-prototype.html로 쓴다. 파이프라인: solar-5a → solar-5b
import { open, BASE, MODULES, snippets } from "./solar-lib.mjs";
const S = snippets("solar-5a-snippets.txt");
const f = open(BASE);

// ── 마크업: 정적 행·옵션 → 빈 컨테이너(스크립트가 카탈로그로 그린다) ──
f.between(`<select id="moduleMaker">`, `</select>`, `<select id="moduleMaker"></select>`);
f.between(`<select id="secondaryMaker">`, `</select>`, `<select id="secondaryMaker"></select>`);
f.rep(`<h2>모듈사 비교 — 국산 4사 · 중국산 3사</h2>`, `<h2>모듈사 비교 — <span id="moduleCountHead">국산 4종 · 중국산 3종</span></h2>`);
for (const id of ["moduleTableBody", "moduleCarbonBody", "moduleSpecBody"]) f.between(`<tbody id="${id}">`, `</tbody>`, `<tbody id="${id}"></tbody>`);
f.rep(`<th>연간 열화<br>(%/년)</th></tr></thead>`, `<th>연간 열화<br>(%/년)</th><th></th></tr></thead>`);
f.rep(`7개사 비교 보기 →`, `모듈사 비교 보기 →`);
f.rep(`            <div class="subtotal strong"><span>사별 스펙 출처와 확인 수준</span><span></span></div>`,
  S.FORM + `\n            <div class="subtotal strong"><span>사별 스펙 출처와 확인 수준</span><span></span></div>`);
f.between(`<span>사별 스펙 출처와 확인 수준</span><span></span></div>`, `</ul>`,
  `<span>사별 스펙 출처와 확인 수준</span><span></span></div>\n            <ul class="todo-list" id="moduleSourceList"></ul>`);
f.rep(`<li><strong>모듈사 비교</strong> — `, `<li><strong>모듈사 비교</strong> — 모듈 목록은 코드의 <code>MODULE_CATALOG</code> 한 곳에서 관리(기준일 2026-09-14)하고, 새 제품·제조사는 "모듈사 비교" 탭의 "새 모듈 등록"으로 추가·공유(JSON)할 수 있음. `);

// ── 스크립트: 카탈로그 · 사용자 추가 저장소 ──
const catalogJs = JSON.stringify(MODULES, null, 2).split("\n").join("\n  ");
f.between(`  // 사별 탄소검증 제품 프리셋(값 = 검증 배출량, none = 미검증)`, `  const MAKER_BY_ID = Object.fromEntries(MODULE_MAKERS.map((m) => [m.id, m]));`,
  S.CATALOG.split("__CATALOG__").join(catalogJs));
f.rep(`7개사를 같은 조건에서 각각 역산(탭이 보일 때만 7회 역산)`, `등록된 모듈사(카탈로그 + 사용자 추가)를 같은 조건에서 각각 역산(탭이 보일 때만)`);
f.rep(`  // ---------- 모듈 제조사 → 이용률·열화율·모듈 단가·탄소 등급 ----------`, S.UI + `\n  // ---------- 모듈 제조사 → 이용률·열화율·모듈 단가·탄소 등급 ----------`);
// 사별 고정 리스너 → 패널 위임 리스너 + 등록·삭제·내보내기·불러오기
f.between(`  // 탄소검증 제품 선택 → 그 제품의 검증 배출량을 칸에 채운다(직접 입력이면 그대로)`,
  `    $('moduleMaker').value = b.dataset.mkPick;\n    applyModuleDerived();\n    recalcAll();\n  }));`, S.LISTENERS);
f.reRep(/MAKER_BY_ID\[([^\]]+?)\]/g, "makerById($1)", 7);
f.rep(`    const rows = MODULE_MAKERS.map((mk) => {`, `    const rows = allModules().map((mk) => {`);
f.rep(`    MODULE_MAKERS.forEach((mk) => {`, `    allModules().forEach((mk) => {`);
f.rep(`(CARBON_PRODUCTS[mk.id] || [])`, `productsOf(mk.id)`);
for (const t of ["MODULE_MAKERS", "CARBON_PRODUCTS", "MAKER_BY_ID"]) if (f.has(t)) throw new Error(`남은 참조: ${t} × ${f.has(t)}`);

// ── 공통 리스너 · 시나리오 저장/복원 ──
f.rep(`el.id.startsWith('kch') || el.disabled) return;`, `el.id.startsWith('kch') || el.id.startsWith('mk-') || el.id.startsWith('newMk') || el.type === 'file' || el.disabled) return;`);
f.rep(`if (el.disabled || el.id === 'scenarioName' || el.id === 'sensMetric') return;`, `if (el.disabled || el.id === 'scenarioName' || el.id === 'sensMetric' || el.id.startsWith('newMk') || el.type === 'file') return;`);
f.rep(`    state.cdRates = Array.from(document.querySelectorAll('#cdRateGrid [data-cd-index]')).map((el) => el.value);`,
  `    state.cdRates = Array.from(document.querySelectorAll('#cdRateGrid [data-cd-index]')).map((el) => el.value);
    state.customModules = customModules.map(({ custom, ...t }) => t); // 사용자 추가 모듈 정의 — 시나리오 파일만으로 복원되게`);
f.rep(`  function applyScenarioState(state) {
    Object.entries(state.fields || {}).forEach(([id, val]) => {`, `  function applyScenarioState(state) {
    // 시나리오에 담긴 사용자 추가 모듈을 먼저 목록에 합치고 표를 다시 그려야, 그 모듈의 선택·표 칸 값이 복원된다.
    if (Array.isArray(state.customModules) && state.customModules.length) mergeModules(state.customModules);
    renderModuleUI();
    Object.entries(state.fields || {}).forEach(([id, val]) => {`);

f.save("solar-5a");
