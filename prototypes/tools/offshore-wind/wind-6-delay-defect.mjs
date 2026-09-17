// 해상풍력 6 — 준공지연 LD(EPC 도급)와 하자보수 보증(터빈사 · EPC) 반영.
// 하자보수 보증은 보증기간 동안 SPC 고정 O&M을 줄이는 것으로 엔진에 반영하고, 준공지연 LD는 "보증·LD" 탭에서 계산한다.
// prototypes/src/offshore-wind.html을 제자리에서 고친다(한 번만 적용). 실행 후 npm run build:prototypes
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(HERE, "../../src/offshore-wind.html");
const S = {};
readFileSync(resolve(HERE, "wind-6-delay-defect-snippets.txt"), "utf8").replace(/\r\n/g, "\n").split(/^\/\/@@ /m).slice(1).forEach((block) => {
  const i = block.indexOf("\n");
  S[block.slice(0, i).trim()] = block.slice(i + 1).replace(/\n+$/, "");
});

let s = readFileSync(TARGET, "utf8").replace(/\r\n/g, "\n");
const once = (from, to, label) => {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`${label}: expected 1, found ${n}`);
  s = s.replace(from, () => to);
};

// ── 엔진 — 하자보수 보증기간 동안 고정 O&M 경감 ───────────────
once(`    const fixed = sum(model.opex.items.map((it) => stepAdjustedOpex(model, it, row))) * esc * row.operationFraction;`,
  `    // 하자보수(결함) 보증 — 보증기간에는 해당 범위의 수리·교체를 터빈사·EPC가 부담하므로 SPC 고정 O&M에서 뺀다.\n`
  + `    const dw = model.opex.defectWarranty;\n`
  + `    const defectRelief = dw ? Math.max(0, 1 - (row.operationSequence <= dw.turbineYears ? rate(dw.turbinePct) : 0) - (row.operationSequence <= dw.epcYears ? rate(dw.epcPct) : 0)) : 1;\n`
  + `    const fixed = sum(model.opex.items.map((it) => stepAdjustedOpex(model, it, row))) * esc * row.operationFraction * defectRelief;`, "engine opex");
once(`      opex: { items: opexItems, variableOMPerMWh:`,
  `      opex: { items: opexItems, defectWarranty: { turbineYears: +$('defectTurbineYears').value || 0, turbinePct: +$('defectTurbinePct').value || 0, epcYears: +$('defectEpcYears').value || 0, epcPct: +$('defectEpcPct').value || 0 }, variableOMPerMWh:`, "readModel opex");

// ── E. OPEX — 하자보수 보증 입력 ──────────────────────────────
const opexSubhead = `              <div class="subhead">항목별 고정비`;
once(opexSubhead, `${S.OPEX_FIELDS}\n${opexSubhead}`, "opex fields");

// ── 보증·LD 탭 — 준공지연 LD · 하자보수 효과 블록 ─────────────
const scenarioHead = `            <div class="subtotal strong"><span>시나리오 비교</span><span></span></div>`;
once(scenarioHead, `${S.PANEL_BLOCKS}\n${scenarioHead}`, "panel blocks");
once(`    // 시나리오 비교 — 보증 기준 / 실적 / 실적 + LD 보전(보전액을 같은 단가로 발전량에 환산)`,
  `${S.JS_DELAY_DEFECT}\n\n    // 시나리오 비교 — 보증 기준 / 실적 / 실적 + LD 보전(보전액을 같은 단가로 발전량에 환산)`, "render blocks");
once(`  $('resetWarrantyAct').addEventListener('click', () => {`, `${S.JS_LISTENERS}\n  $('resetWarrantyAct').addEventListener('click', () => {`, "listeners");
once(`/^(act|ld)[A-Z]/.test(el.id) ||`, `/^(act|ld)[A-Z]/.test(el.id) || /^delay(Weeks|LdRatePct|LdCapPct)$/.test(el.id) ||`, "generic listener");

// ── 기존 안내 문구 — 이제 반영됐으므로 갱신 ───────────────────
once(`준공지연 LD(계약금액의 일정 %/일, 총액 상한)와 하자보수 보증은 이 표에 넣지 않았습니다.`,
  `준공지연 LD와 하자보수 보증은 아래 블록에서 따로 봅니다.`, "panel hint");
once(`"보증·LD" 탭의 LD 보전율 100% · 연간 상한 10%도 예시이며, <strong>준공지연 LD와 하자보수 보증은 반영하지 않았습니다</strong>`,
  `"보증·LD" 탭의 LD 보전율 100% · 연간 상한 10%도 예시입니다`, "caveat update");

// ── 확정 필요 항목 ────────────────────────────────────────────
const lastCaveat = `              <li>엑셀(.xlsx) 회신 변환기`;
once(lastCaveat, `${S.CAVEAT}\n${lastCaveat}`, "caveat");
once(`전체 15개 항목`, `전체 16개 항목`, "caveat count");

writeFileSync(TARGET, s, "utf8");
console.log(`wind-6-delay-defect: ${s.split("\n").length} lines`);
