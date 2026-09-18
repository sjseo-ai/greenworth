// 해상풍력 9 — 목표 DSCR 기반 선순위 부채 사이징(자금조달 입력 방식 3번째 모드).
// 기준 발전량(현재 적용 / P50 / P75 / P90)의 CFADS ÷ 목표 DSCR로 연간 원리금 한도를 잡고,
// 그 원리금을 감당하는 원금을 선순위 한도로 삼는다(자기자본 = 총사업비 − 선순위 − 주민채권).
// prototypes/src/offshore-wind.html을 제자리에서 고친다(한 번만 적용). 실행 후 npm run build:prototypes
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(HERE, "../../src/offshore-wind.html");
const S = {};
readFileSync(resolve(HERE, "wind-9-dscr-snippets.txt"), "utf8").replace(/\r\n/g, "\n").split(/^\/\/@@ /m).slice(1).forEach((block) => {
  const i = block.indexOf("\n");
  S[block.slice(0, i).trim()] = block.slice(i + 1).replace(/\n+$/, "");
});

let s = readFileSync(TARGET, "utf8").replace(/\r\n/g, "\n");
const once = (from, to, label) => {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`${label}: expected 1, found ${n}`);
  s = s.replace(from, () => to);
};

// ── 입력 UI — 방식 선택 · DSCR 칸 · 결과 표 ─────────────────────
once(`                  <option value="amount">금액 (억원) 직접 입력</option>`, S.HTML_MODE_OPTION, "mode option");
const amountWrap = `              <div class="field-grid" id="fundingAmountWrap" style="display:none;">
                <div class="field"><label for="equityAmount">자기자본 금액</label><div class="iw"><input id="equityAmount" type="number" value="1860" step="0.1"><span class="unit">억원</span></div></div>
                <div class="field"><label for="bondAmount">주민참여채권 금액</label><div class="iw"><input id="bondAmount" type="number" value="370" step="0.1"><span class="unit">억원</span></div></div>
              </div>`;
once(amountWrap, `${amountWrap}\n${S.HTML_DSCR_WRAP}`, "dscr wrap");
once(`              <p class="hint" style="margin:8px 0 6px;">선순위 대출 = 총사업비 − 자기자본 − 주민참여채권(자동). 금액 방식으로 바꾸면 지금 비율로 나오는 금액이 채워집니다.</p>
              <table class="kv"><tbody id="fundingBreakdownBody"></tbody></table>`, S.HTML_HINT_KV, "hint kv");

// ── 엔진 — 자금조달 분배 · 사이징 · 총사업비를 쓰는 렌더 ─────────
once(`  // 자금조달 — 비율 모드: 총사업비 × 자기자본·주민채권 비율 / 금액 모드: 자기자본·주민채권을 억원으로 고정.
  // 두 모드 모두 선순위 대출 = 총사업비 − 자기자본 − 주민채권(총사업비가 금융비용 때문에 반복 수렴하는 동안 선순위가 흡수한다).
  function fundingSplit(model, total) {
    const f = model.finance;
    if (f.fundingMode === 'amount') return { equity: Math.max(0, f.equityAmount || 0), bond: Math.max(0, f.bondAmount || 0) };
    return { equity: total * rate(f.equityPct), bond: total * rate(f.residentBondPct) };
  }`, S.JS_FUNDING_SPLIT, "fundingSplit");
once(`  function analyzeEss(model) {
    const cal = buildCalendar(model.project);
    const investment = solveInvestment(model, cal);`, `${S.JS_SIZING}\n\n${S.JS_ANALYZE_HEAD}`, "analyze head");
once(`  function renderCapexBreakdown(model) {
    const body = $('capexBreakdownBody');
    const inv = solveInvestment(model, buildCalendar(model.project));`, S.JS_CAPEX_HEAD, "capex head");
once(`  function renderFundingBreakdown(model) {
    const inv = solveInvestment(model, buildCalendar(model.project));`, S.JS_FUND_HEAD, "funding head");

// ── 모델 읽기 — 사이징 기준 발전량 · 입력값 ─────────────────────
once(`    const operatingRatesPct = Array.from(document.querySelectorAll('#opRateGrid [data-oprate-index]')).map((el) => +el.value);`,
  S.JS_READMODEL_RATES, "readModel rates");
once(`        fundingMode: $('fundingMode').value, equityAmount: +$('equityAmount').value, bondAmount: +$('bondAmount').value,`,
  S.JS_FINANCE_OBJ, "finance obj");
once(`    if ($('fundingMode').value !== 'amount' && capitalStructureSum > 100) { // 금액 모드 점검은 renderFundingBreakdown()(총사업비가 필요)`,
  S.JS_WARN_COND, "warn cond");

// ── 화면 전환 · 역산 직후 결과 표시 ─────────────────────────────
once(`  function syncFundingModeVisibility() {
    const amount = $('fundingMode').value === 'amount';
    $('fundingRatioWrap').style.display = amount ? 'none' : '';
    $('fundingAmountWrap').style.display = amount ? '' : 'none';`, S.JS_SYNC_VIS, "sync visibility");
// 앞뒤 줄까지 묶어 유일하게 — 사례 탭의 같은 호출(들여쓰기만 다름)과 겹치지 않게 한다
once(`\n    const solved = solveCurrentModel(model);\n\n    if (!solved.ok) {`,
  `\n${S.JS_RECALC_CALL}\n\n    if (!solved.ok) {`, "recalc call");

// ── 확정 필요 항목 ─────────────────────────────────────────────
const caveatsAt = s.indexOf('id="modelCaveatsFull"');
if (caveatsAt < 0) throw new Error("caveats: anchor not found");
const listEnd = s.indexOf("            </ul>", caveatsAt);
if (listEnd < 0) throw new Error("caveats: list end not found");
s = s.slice(0, listEnd) + S.CAVEAT + s.slice(listEnd + "            </ul>".length);
once(`전체 17개 항목 상세 보기 →`, S.CAVEAT_COUNT, "caveat count");

writeFileSync(TARGET, s, "utf8");
console.log(`wind-9-dscr: ${s.split("\n").length} lines`);
