// 육상풍력 1 — 해상풍력 프로토타입(prototypes/src/offshore-wind.html)을 읽어 육상 조건의 새 페이지
// prototypes/src/onshore-wind.html을 만든다. 원본은 고치지 않는다(해상풍력을 고친 뒤 다시 돌리면 육상도 따라온다).
//
// 바꾸는 것: REC 가중치 1.2(연계거리·수심 가중치 제거) · 공공주도형 트랙·우대가격 제거 · 육상 터빈 6종 · 40MW CAPEX/OPEX
// (에너지경제연구원 기본연구 24-22 표 3-11·5-1) · 육상 상한가 163.846원(2025년 하반기) · 육상 입찰 사례 13건 · 문구 · 저장 키.
// 유지하는 것: 재무 엔진 · 터빈 비교 · 터빈사 제공값 · 풍황 확률수준 · 목표 DSCR 사이징 · 보증·LD · 시나리오 · KCH 개발수수료.
//
// 의도적으로 "해상"을 남기는 문구는 스니펫에 @@SEA@@로 적어 두고, 해상풍력 → 육상풍력 일괄 치환과 "해상" 잔존 검사가 끝난 뒤 되돌린다.
// 실행 후 npm run build:prototypes
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(HERE, "../../src/offshore-wind.html");
const TARGET = resolve(HERE, "../../src/onshore-wind.html");
const S = {};
readFileSync(resolve(HERE, "onshore-1-snippets.txt"), "utf8").replace(/\r\n/g, "\n").split(/^\/\/@@ /m).slice(1).forEach((block) => {
  const i = block.indexOf("\n");
  S[block.slice(0, i).trim()] = block.slice(i + 1).replace(/\n+$/, "");
});

let s = readFileSync(SOURCE, "utf8").replace(/\r\n/g, "\n");
const sub = (from, to, n, label) => {
  const found = s.split(from).length - 1;
  if (found !== n) throw new Error(`${label}: expected ${n}, found ${found}`);
  s = s.split(from).join(to);
};
const once = (from, to, label) => sub(from, to, 1, label);
// 앞부분(들여쓰기 뺀)이 prefix로 시작하는 줄이 정확히 하나여야 한다.
const lineIndex = (L, prefix, label, from = 0) => {
  const hits = [];
  L.forEach((l, i) => { if (i >= from && l.trimStart().startsWith(prefix)) hits.push(i); });
  if (hits.length !== 1) throw new Error(`${label}: expected 1 line starting "${prefix.slice(0, 50)}", found ${hits.length}`);
  return hits[0];
};
const replaceLine = (prefix, next, label) => {
  const L = s.split("\n");
  L[lineIndex(L, prefix, label)] = next;
  s = L.join("\n");
};
// startPrefix 줄부터, 그 뒤 처음 나오는 endPrefix 줄까지(포함)를 바꾼다.
const replaceBlock = (startPrefix, endPrefix, next, label) => {
  const L = s.split("\n");
  const a = lineIndex(L, startPrefix, `${label} start`);
  const b = L.findIndex((l, i) => i > a && l.trimStart().startsWith(endPrefix));
  if (b < 0) throw new Error(`${label}: end "${endPrefix}" not found`);
  L.splice(a, b - a + 1, ...next.split("\n"));
  s = L.join("\n");
};

// ── 1) 데이터 블록 ─────────────────────────────────────────────
once(`  const TURBINE_CATALOG_UPDATED = '2026-09-14';`, `  const TURBINE_CATALOG_UPDATED = '2026-09-18';`, "catalog date");
replaceBlock("const TURBINE_CATALOG = [", "];", S.TURBINE_CATALOG, "turbine catalog");
replaceBlock("const CASE_LIST = [", "];", S.CASE_LIST, "case list");
replaceLine("const CASE_TRACK_LABEL = {", `  const CASE_TRACK_LABEL = { general: '육상풍력', public: '육상풍력', floating: '육상풍력' };`, "case track label");
replaceBlock("// 입찰 트랙별 비가격 배점", "general: { label: '② 일반형 + 외산 터빈'", S.TRACK_BLOCK + "\n@@DROP@@", "tracks/combos");
// COMBOS 원본의 마지막 두 줄(general 항목의 fields 줄 · 닫는 괄호)을 지운다
{
  const L = s.split("\n");
  const at = L.indexOf("@@DROP@@");
  if (at < 0 || !L[at + 1].trimStart().startsWith("fields: { salesStructure: 'fixed', tenderTrack: 'general'") || L[at + 2].trim() !== "};") {
    throw new Error("combos tail: unexpected layout");
  }
  L.splice(at, 3);
  s = L.join("\n");
}
replaceBlock("// ---------- CAPEX / OPEX item definitions", "];", S.CAPEX_OPEX.split("\n").slice(0, S.CAPEX_OPEX.split("\n").findIndex((l) => l.trim() === "];") + 1).join("\n"), "capex items");
replaceBlock("const OPEX_ITEMS = [", "];", S.CAPEX_OPEX.split("\n").slice(S.CAPEX_OPEX.split("\n").findIndex((l) => l.startsWith("  // 고정비 합계"))).join("\n"), "opex items");

// ── 2) 화면 — 제목 · 조합 · 기본값 ─────────────────────────────
replaceLine("<title>해상풍력 적정 입찰가격 프로토타입</title>", "<title>육상풍력 적정 입찰가격 프로토타입</title>", "title");
replaceLine('<span class="brand-sub">KCH그룹 · 초안 · 풍력 고정가격계약', '      <span class="brand-sub">KCH그룹 · 초안 · 육상풍력 고정가격계약 경쟁입찰</span>', "brand sub");
replaceBlock('<button type="button" class="combo-btn" data-combo="public">', '<p class="hint" style="margin:8px 0 0;">버튼을 누르면', S.COMBO_BUTTONS, "combo buttons");
once(`value="해상풍력 100MW 입찰사업 (고정식)"`, `value="육상풍력 40MW 입찰사업"`, "project name");
once(`id="endYear" type="number" value="2050"`, `id="endYear" type="number" value="2048"`, "end year");
once(`id="constructionYears" type="number" value="3"`, `id="constructionYears" type="number" value="2"`, "construction years");
once(`id="codDate" type="date" value="2030-07-01"`, `id="codDate" type="date" value="2028-07-01"`, "cod");
once(`<input id="contractCapacityMW" type="number" value="100"`, `<input id="contractCapacityMW" type="number" value="40"`, "capacity");
once(`id="siteBaseRatePct" type="number" value="40"`, `id="siteBaseRatePct" type="number" value="26"`, "site base rate");
once(`id="wakeLossPct" type="number" value="8"`, `id="wakeLossPct" type="number" value="5"`, "wake loss");
once(`id="degradationPct" type="number" value="0.2"`, `id="degradationPct" type="number" value="0.3"`, "degradation");
once(`id="refSpecificPower" type="number" value="320"`, `id="refSpecificPower" type="number" value="240"`, "ref specific power");
// 기본 터빈(Vestas V150-4.2) 파생값 — 페이지의 turbineDerived()와 같은 식이어야 "터빈 값 적용 중"으로 뜬다.
const V150 = { mw: 4.2, rotor: 150, avail: 97, price: 11.5 };
const spPower = (V150.mw * 1e6) / (Math.PI * (V150.rotor / 2) ** 2);
const curveF = (240 / spPower) ** 0.25;
const y1 = Math.round(26 * curveF * (1.0 * 0.97 * 0.99) * ((1 - 0.05) * (1 - 0.03)) * 100) / 100;
const bos = 10, epc = Math.round((V150.price + bos) * 10) / 10;
once(`id="year1RatePct" type="number" value="34.03"`, `id="year1RatePct" type="number" value="${y1}"`, "year1 rate");
once(`id="bosUnitPrice" type="number" value="48"`, `id="bosUnitPrice" type="number" value="${bos}"`, "bos unit price");
once(`id="epcUnitPrice" type="number" value="72"`, `id="epcUnitPrice" type="number" value="${epc}"`, "epc unit price");
once(`id="capexLumpSum" type="number" value="7200"`, `id="capexLumpSum" type="number" value="${Math.round(epc * 40)}"`, "capex lump sum");

// ── 3) 판매 조건 · REC 가중치 ──────────────────────────────────
once(`                  <option value="public" selected>공공주도형</option>
                  <option value="general">일반형</option>`, `                  <option value="general" selected>육상풍력 (일반)</option>`, "track options");
once(`                <div class="field" id="foundationField"><label for="foundationType">하부구조</label><div class="iw"><select id="foundationType">
                  <option value="fixed" selected>고정식 (상한 171.229)</option>
                  <option value="floating">부유식 (상한 175.100)</option>
                </select></div></div>`,
  `                <div class="field" id="foundationField" style="display:none;"><label for="foundationType">구분</label><div class="iw"><select id="foundationType">
                  <option value="fixed" selected>육상</option>
                </select></div></div>`, "foundation field");
once(`id="priceCapPerKWh" type="number" value="171.229"`, `id="priceCapPerKWh" type="number" value="163.846"`, "price cap");
replaceBlock('<div class="subhead">REC 가중치 · 우대가격 (계약단가 환산)</div>', '<p class="hint">계약단가(수령단가) ≈', S.REC_BLOCK, "rec block");
// 하부구조 칸은 육상에 없으니 판매 구조에 따라 다시 보이지 않게 한다
once(`['tenderTrackField', 'foundationField', 'priceCapField', 'recWeightWrap']`, `['tenderTrackField', 'priceCapField', 'recWeightWrap']`, "sales field toggle");
once(`$('salesFlag').textContent = isFixed ? (isPublic ? '공공주도형' : '일반형') : '기업PPA';`, `$('salesFlag').textContent = isFixed ? '고정가격계약' : '기업PPA';`, "sales flag");
once("고정가격계약 경쟁입찰(${isPublic ? '공공주도형' : '일반형'})", "고정가격계약 경쟁입찰", "sales hint");

// ── 4) CAPEX · OPEX 안내 ───────────────────────────────────────
replaceLine('<p class="hint" style="margin:0;">EPC 단가 = 터빈 단가 + BOP·시공 단가(하부구조물', S.BOP_HINT, "bop hint");
replaceLine('<p class="hint">전력거래수수료는 실제 판매 발전량에 비례합니다. 해상풍력 O&amp;M은', S.OPEX_HINT, "opex hint");
once(`<label for="communityRevenuePct">어업인·지역 상생</label>`, `<label for="communityRevenuePct">주민·지역 상생 (바람소득)</label>`, "community label");
// 보증·LD 탭 — EPC(BOP)가 보증하는 설비를 육상 설비명으로
once(`BOP·계통 가동률(해상변전소·해저케이블) 보증`, `BOP·계통 가동률(단지 변전설비·송전선로) 보증`, "warranty bop assets");

// ── 5) 상단 한계 안내 · 선정평가 · 입찰 사례 · 푸터 ──────────────
replaceBlock("<li>ESS·태양광 프로토타입의 재무 엔진에 발전매출·터빈만 해상풍력으로 바꾼", "<li>CAPEX·OPEX·터빈 단가는 100MW 고정식", S.NOTICE_ITEMS, "notice items");
once(`<span id="trackLabel">공공주도형</span>`, `<span id="trackLabel">육상풍력</span>`, "track label");
replaceLine('<p class="hint">배점은 2025년 상반기 풍력 공고 보도 기준입니다', S.SCORE_HINT, "score hint");
once(`<tr class="strong"><th>정부 R&amp;D 실증 터빈 우대 27.84원`, `<tr class="strong" style="display:none;"><th>정부 R&amp;D 실증 터빈 우대 27.84원`, "rnd row hidden");
once(`id="scoreSecurity" type="number" value="7"`, `id="scoreSecurity" type="number" value="4"`, "score security");
once(`id="scoreIndustry" type="number" value="19"`, `id="scoreIndustry" type="number" value="14"`, "score industry");
once(`id="scoreProgress" type="number" value="2"`, `id="scoreProgress" type="number" value="3"`, "score progress");
once(`id="scoreOther" type="number" value="13"`, `id="scoreOther" type="number" value="10"`, "score other");
once(`2026년 상반기 풍력 공고 — 1단계`, `육상풍력 경쟁입찰 — 1단계`, "price tab note");
once(`같은 수령단가를 더 낮은 입찰가격으로 받을 수 있고, 공공주도형 우대가격도 입찰가격을 낮춥니다. 비가격 배점은 2025년 상반기 보도 기준, 예상 점수는 가정입니다.`,
  `같은 수령단가를 더 낮은 입찰가격으로 받을 수 있습니다(육상풍력 1.2). 비가격 배점 틀은 2024년 이후 공고 보도 기준, 예상 점수는 가정입니다.`, "price tab note body");
// 입찰 사례 탭 안내 — 가중치·부유식 문장은 해상 전용이라 육상 문장으로
once(`REC 가중치: 이안거리·수심이 모두 보도된 사례만 구간 산정으로 추정(실제 연계거리와 다를 수 있음). 부유식은 고정식보다 사업비가 크게 높아, 사업비를 넣지 않으면 사업성이 과대평가됩니다.`,
  `REC 가중치: 육상풍력은 모두 1.2라 비워 두면 페이지 값을 씁니다. 사업비를 넣지 않으면 모든 사례가 현재 페이지 사업비(MW당)를 쓰므로, 산지 토목·진입로가 큰 단지는 사업성이 과대평가될 수 있습니다.`, "cases hint");
replaceLine('<p class="callout-sm"><strong>사업별 낙찰가는 공개되지 않습니다.</strong>', S.CASES_CALLOUT, "cases callout");
replaceBlock("<p>사업개요·발전매출·CAPEX·OPEX·금융세무 입력값으로", "<p>참고: <code>PRD_사업성분석_프로토타입.md</code>", S.FOOTER, "footer");

// ── 6) 확정 필요 항목 — 공용 6개(8·9·13·14·16·17)는 원문을 그대로 쓰고 나머지는 육상용으로 ──
{
  const at = s.indexOf('id="modelCaveatsFull"');
  const ulStart = s.indexOf('<ul class="todo-list">', at);
  const ulEnd = s.indexOf("            </ul>", ulStart);
  if (at < 0 || ulStart < 0 || ulEnd < 0) throw new Error("caveats: anchors not found");
  const items = s.slice(ulStart, ulEnd).split("\n").filter((l) => l.trimStart().startsWith("<li>"));
  if (items.length !== 18) throw new Error(`caveats: expected 18 items, found ${items.length}`);
  const keep = (i) => items[i];
  const fin = keep(8).replace("해상풍력 PF(장기 선순위·공사기간 3년", "육상풍력 PF(장기 선순위·공사기간 2년");
  if (fin === keep(8)) throw new Error("caveats: finance item anchor changed");
  const list = [S.CAVEAT_0, S.CAVEAT_1, S.CAVEAT_2, S.CAVEAT_3, S.CAVEAT_4, S.CAVEAT_5, S.CAVEAT_6, fin, keep(9),
    S.CAVEAT_10, S.CAVEAT_11, S.CAVEAT_12, keep(13), keep(14), S.CAVEAT_15, keep(16), keep(17), S.CAVEAT_18];
  s = s.slice(0, ulStart) + '<ul class="todo-list">\n' + list.join("\n") + "\n" + s.slice(ulEnd);
}

// ── 7) KCH 민감도 축 · 기본 터빈 · 저장 키 ─────────────────────
once(`60~200MW 눈금에 현재 용량(해상풍력 설비용량, 기본 100MW)`, `20~100MW 눈금에 현재 용량(육상풍력 설비용량, 기본 40MW)`, "kch axis comment");
once(`const capacities = [...new Set([60, 80, 100, 120, 150, 200, `, `const capacities = [...new Set([20, 30, 40, 50, 60, 80, 100, `, "kch axis");
sub(`'doosan10'`, `'vestas150'`, 2, "default turbine");
once(`선택 터빈은 두산 DS205-10MW로 바뀌었습니다`, `선택 터빈은 Vestas V150-4.2MW로 바뀌었습니다`, "removed turbine fallback message");
once(`'windCustomTurbines.v1'`, `'onshoreWindCustomTurbines.v1'`, "custom turbine key");
once(`'windBidPriceScenarios.v1'`, `'onshoreWindBidPriceScenarios.v1'`, "scenario key");
once(`'windBidPriceActiveTab.v1'`, `'onshoreWindBidPriceActiveTab.v1'`, "tab key");

// ── 8) 남은 표기 일괄 치환 → "해상" 잔존 검사 → 의도한 표기 되돌리기 ──
s = s.split("해상풍력").join("육상풍력");
const leftovers = s.split("\n").map((l, i) => [i + 1, l]).filter(([, l]) => l.includes("해상"));
if (leftovers.length) {
  throw new Error(`"해상" remains on ${leftovers.length} line(s):\n` + leftovers.slice(0, 12).map(([n, l]) => `  ${n}: ${l.trim().slice(0, 140)}`).join("\n"));
}
s = s.split("@@SEA@@").join("해상");

// 검토용 — 해상 전용 개념이 남은 곳(숨긴 칸·코드 호환용 정의)은 목록으로만 보여준다.
const review = ["수심", "이안거리", "공공주도형", "doosan", "Mingyang", "V236", "하부구조"];
review.forEach((w) => {
  const hits = s.split("\n").map((l, i) => [i + 1, l]).filter(([, l]) => l.includes(w));
  console.log(`  검토 "${w}": ${hits.length}곳${hits.length ? " — " + hits.slice(0, 4).map(([n]) => n).join(", ") : ""}`);
});

writeFileSync(TARGET, s, "utf8");
console.log(`onshore-1-derive: ${s.split("\n").length} lines · 기본 1년차 순이용률 ${y1}% · EPC ${epc}억원/MW`);
