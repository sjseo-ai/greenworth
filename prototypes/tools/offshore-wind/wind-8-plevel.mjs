// 해상풍력 8 — ① 풍황 확률수준(P50·P75·P90) 수기 입력 + 확률수준별 비교표(민감도 탭),
//                ② 적정 단가 역산 상한을 500 → 3,000원/kWh로 올리고 실패 사유를 구체적으로 표시.
//                (해상풍력 수령단가는 400원/kWh 안팎이라 목표 IRR을 10%로만 올려도 "—"로 끊겼다)
// prototypes/src/offshore-wind.html을 제자리에서 고친다(한 번만 적용). 실행 후 npm run build:prototypes
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(HERE, "../../src/offshore-wind.html");
const load = (name) => {
  const out = {};
  readFileSync(resolve(HERE, name), "utf8").replace(/\r\n/g, "\n").split(/^\/\/@@ /m).slice(1).forEach((block) => {
    const i = block.indexOf("\n");
    out[block.slice(0, i).trim()] = block.slice(i + 1).replace(/\n+$/, "");
  });
  return out;
};
const S = load("wind-8-plevel-snippets.txt"); // 바꾼 뒤
const F = load("wind-8-plevel-from.txt");     // 바꾸기 전(소스에서 그대로 떼어낸 원문)

let s = readFileSync(TARGET, "utf8").replace(/\r\n/g, "\n");
const times = (from, to, n, label) => {
  const found = s.split(from).length - 1;
  if (found !== n) throw new Error(`${label}: expected ${n}, found ${found}`);
  s = s.split(from).join(to);
};
const once = (from, to, label) => times(from, to, 1, label);

// ── ① 확률수준 — 입력(C. 발전매출) · 비교표 패널(민감도 탭) ────
once(`              <div class="subhead subhead-row">\n                <span>발전량 구성 — 보증 주체별</span>`, S.P_INPUT_HTML, "p input html");
once(`        <section class="panel">\n          <h2>민감도 — 입찰단가 고정</h2>`, S.P_PANEL_HTML, "p panel html");

// ── 파생값 — 터빈 기준값 × 확률수준 계수 ───────────────────────
once(F.FROM_DERIVED, S.DERIVED, "turbineDerived");
once(F.FROM_FACTOR, S.FACTOR, "factor display");
once(F.FROM_BUILDUP, S.BUILDUP, "generation buildup");

// ── 렌더 함수 · 탭 배선 · 상류 입력 ────────────────────────────
once(`  // ---------- 보증·LD 탭 — 보증 미달 시 귀책별 손실과 LD 보전(탭이 보일 때만 역산) ----------`,
  `${S.SYNC_PLEVEL}\n\n  // ---------- 보증·LD 탭 — 보증 미달 시 귀책별 손실과 LD 보전(탭이 보일 때만 역산) ----------`, "render fns");
once(F.FROM_SENS_BRANCH, S.SENS_BRANCH, "sens branch");
once(`  const TURBINE_UPSTREAM_IDS = ['siteBaseRatePct', 'wakeLossPct', 'electricalLossPct', 'powerCurveWarrantyPct', 'bopAvailPct', 'bosUnitPrice', 'refSpecificPower', 'powerCurveExp'];`,
  S.UPSTREAM, "upstream ids");

// ── ② 역산 상한 · 실패 사유 ────────────────────────────────────
once(`  function solveBidPriceForTarget(model, targetIrr, kind) {`, S.SOLVE_CONST, "solve const");
times(`    let low = 0, high = 500;`, `    let low = 0, high = PRICE_SOLVE_MAX;`, 2, "solve bound");
once(`    if (!Number.isFinite(irrHigh) || irrHigh < targetIrr) return { ok: false, reason: "500원/kWh까지도 목표 IRR에 도달하지 못합니다 (비용이 너무 크거나 목표 IRR이 너무 높음)." };`,
  S.SOLVE_IRR_MSG, "solve irr msg");
once(`    if (!Number.isFinite(profitHigh) || profitHigh < targetProfit) return { ok: false, reason: "500원/kWh까지도 목표 당사 이익에 도달하지 못합니다 (비용이 너무 크거나 목표 이익이 너무 높음)." };`,
  S.SOLVE_PROFIT_MSG, "solve profit msg");
once(`    if (!irrResult.ok && !profitResult.ok) return { ok: false, reason: 'P-IRR 6%·당사 이익 100억 모두 500원/kWh까지도 도달하지 못합니다.' };`,
  S.SOLVE_FLOOR_MSG, "solve floor msg");

// ── 확정 필요 항목 ─────────────────────────────────────────────
const caveatsAt = s.indexOf('id="modelCaveatsFull"');
if (caveatsAt < 0) throw new Error("caveats: anchor not found");
const listEnd = s.indexOf("            </ul>", caveatsAt);
if (listEnd < 0) throw new Error("caveats: list end not found");
s = s.slice(0, listEnd) + S.CAVEAT + s.slice(listEnd + "            </ul>".length);
once(`전체 16개 항목 상세 보기 →`, S.CAVEAT_COUNT, "caveat count");

writeFileSync(TARGET, s, "utf8");
console.log(`wind-8-plevel: ${s.split("\n").length} lines`);
