// 해상풍력 7 — 터빈사 제공 1년차 순이용률 · EPC 단가를 터빈 비교 탭에서 직접 지정할 수 있게 한다.
// 비워 두면 지금까지처럼 모델이 계산하고(자동), 값을 넣으면 그 값이 우선한다(비교표에 "직접" 표시).
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
const S = load("wind-7-turbine-override-snippets.txt"); // 바꾼 뒤
const F = load("wind-7-turbine-override-from.txt");     // 바꾸기 전(소스에서 그대로 떼어낸 원문)

let s = readFileSync(TARGET, "utf8").replace(/\r\n/g, "\n");
const once = (from, to, label) => {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`${label}: expected 1, found ${n}`);
  s = s.replace(from, () => to);
};

// ── 스타일 — 자동/직접 지정 상태를 칸 테두리와 태그로 구분 ──────
once(`  .module-table td.over { color: var(--danger); font-weight: 700; }`, S.CSS, "css");

// ── 스펙 표 — 열 2개 추가 · 제목 · 설명 ────────────────────────
once(`<th>국산화율<br>(%, 참고)</th><th></th></tr></thead>`, S.SPEC_HEAD, "spec head");
once(`            <div class="subtotal strong"><span>터빈 스펙 · 단가 (직접 수정)</span><span></span></div>`, S.SPEC_TITLE, "spec title");
once(`            <p class="hint">터빈 단가 · 가용률 · 외산 국산화율은 공개 자료가 없어 <strong>예시값</strong>입니다. 운영 실적이 없는 신규 모델(유니슨 U210 등)은 가용률을 보수적으로 두었습니다.</p>`, S.SPEC_HINT, "spec hint");
once(`            <p class="hint">초록 굵은 글씨 = 같은 열에서 가장 낮은 단가. 입찰가격이 빨간색이면 상한가격을 넘습니다. 가격만 본 비교이므로 실제 선정은 비가격 50점(안보·산업·경제효과 등)에서 국산 터빈이 유리할 수 있습니다 — "선정평가" 탭 참고. "선택"을 누르면 그 터빈이 C·D 입력에 적용됩니다.</p>`, S.COMPARE_HINT, "compare hint");

// ── 스펙 표 행 렌더 · 파생값 계산 · 비교표 셀 ───────────────────
once(F.FROM_UI_ROWS, S.UI_ROWS, "spec rows");
once(F.FROM_DERIVED, S.DERIVED, "turbineDerived");
once(F.FROM_COMPARE_CELLS, S.COMPARE_CELLS, "compare cells");
once(F.FROM_BUILDUP_ROW, S.BUILDUP_ROW, "generation buildup");
once(F.FROM_WARRANTY_CF, S.WARRANTY_CF, "warranty cf");
once(F.FROM_FACTOR_DISPLAY, S.FACTOR_DISPLAY, "factor display");

// ── 안내 문구 — C. 발전매출 · 확정 필요 항목 ────────────────────
once(`출력제어는 발전량 단계에서 따로 뺍니다.</p>`, S.REVENUE_HINT, "revenue hint");
once(`기본 목록 기준일 2026-09-14 — 새 터빈은 터빈 비교 탭 "새 터빈 등록"으로 추가하거나 코드의 TURBINE_CATALOG에 항목을 더하면 됨</li>`, S.CAVEAT, "caveat");

writeFileSync(TARGET, s, "utf8");
console.log(`wind-7-turbine-override: ${s.split("\n").length} lines`);
