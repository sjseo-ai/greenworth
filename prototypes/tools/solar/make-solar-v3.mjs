// 태양광 초안 v3 — 모듈 제조사 7개사(국산 4 · 중국산 3) 가격·스펙 입력, 사별 이용률 보정, 모듈사 비교 탭.
// v2 백업(solar-v2-backup.html)에서 읽어 본 파일로 쓴다(재실행 가능). 교체는 기대한 횟수만큼 맞을 때만 적용한다.
import { readFileSync, writeFileSync } from "node:fs";
const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
let s = readFileSync(`${SP}/solar-v2-backup.html`, "utf8");
const count = (hay, needle) => hay.split(needle).length - 1;
function rep(from, to, n = 1) {
  const c = count(s, from);
  if (c !== n) throw new Error(`rep: expected ${n}, found ${c}: ${from.slice(0, 90)}`);
  s = s.split(from).join(to);
}
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ── 모듈사 데이터 (스펙 출처는 source에, 확인 수준은 specLabel에) ──
// 가격: 사별 공개 자료 없음 — 전기신문(2024-09) 탄소 등급별 시공사 매입가 범위 안의 예시값
//   1등급 320~425원/Wp · 2등급 255~340원/Wp · 무등급(중국산) 190~220원/Wp
const MAKERS = [
  { id: "hanwha", origin: "domestic", name: "한화큐셀", model: "Q.TRON XL-G2.3/BFG", specLabel: "데이터시트", price: 400, gamma: "-0.29", bif: 80, deg1: "1.5", degA: "0.33", grade: "1",
    source: "한화큐셀 — Q.TRON XL-G2.3/BFG 데이터시트(2026-02 Rev10): N형 Q.ANTUM NEO 양면, 효율 최대 23.1%, Pmpp 온도계수 −0.29%/K, 양면율 80±5%, 1년차 98.5% 보증 후 연 0.33% 이하(30년 88.93%)" },
  { id: "hyundai", origin: "domestic", name: "HD현대에너지솔루션", model: "HiN-T (NI 시리즈)", specLabel: "판매처 사양", price: 400, gamma: "-0.30", bif: 80, deg1: "1.0", degA: "0.40", grade: "1",
    source: "HD현대에너지솔루션 — HiN-T N형 TOPCon 양면(판매처 사양 기준): 효율 22.5%, 온도계수 −0.30%/℃, 양면율 80%, 1년차 1% · 이후 연 0.4%(30년 87.4%). 제조사 원문 데이터시트는 확인하지 못함" },
  { id: "shinsung", origin: "domestic", name: "신성이엔지", model: "SS-DM550BD 양면", specLabel: "가정(미확인)", price: 330, gamma: "-0.30", bif: 80, deg1: "1.0", degA: "0.40", grade: "2",
    source: "신성이엔지 — 공개 데이터시트 수치를 찾지 못해 N형 TOPCon 양면 일반값(−0.30%/℃ · 80% · 1%/0.4%)으로 가정. 판매처에 SS-DM550BD(M10 132셀 양면) 탄소 2등급 표기, 2023년 N형 TOPCon 양면 모듈 출시 보도 확인" },
  { id: "hansol", origin: "domestic", name: "한솔테크닉스", model: "양면 N-TOPCon", specLabel: "가정(미확인)", price: 400, gamma: "-0.30", bif: 80, deg1: "1.0", degA: "0.40", grade: "1",
    source: "한솔테크닉스 — 공개 데이터시트 수치를 찾지 못해 N형 TOPCon 양면 일반값으로 가정. 오창공장 연 600MW, 양면 N형 TOPCon 제품군 운영, 탄소 1·2등급 제품 보유(2022 보도), 2026년 모듈 사업 자회사 분리" },
  { id: "jinko", origin: "china", name: "진코솔라", model: "Tiger Neo 3.0", specLabel: "공식 페이지", price: 205, gamma: "-0.26", bif: 85, deg1: "1.0", degA: "0.40", grade: "4",
    source: "진코솔라 — Tiger Neo 3.0 공식 페이지: 효율 최대 24.8%, 온도계수 −0.26%/℃, 양면율 85±5%. 1년차 1% · 연 0.4%는 검색 요약 기준(원문 미확인). 탄소검증 미적용(무등급) 가정" },
  { id: "trina", origin: "china", name: "트리나솔라", model: "Vertex N (NEG21C.20)", specLabel: "데이터시트", price: 205, gamma: "-0.30", bif: 80, deg1: "1.0", degA: "0.40", grade: "4",
    source: "트리나솔라 — Vertex N TSM-NEG21C.20 데이터시트(2023): i-TOPCon 양면 이중유리, 효율 최대 22.4%, 온도계수 −0.30%/℃, 양면율 80±5%, 1년차 1% · 연 0.4%(30년 87.4%). 탄소검증 미적용(무등급) 가정" },
  { id: "ja", origin: "china", name: "자솔라", model: "DeepBlue 5.0", specLabel: "리뷰 페이지", price: 205, gamma: "-0.26", bif: 85, deg1: "1.0", degA: "0.35", grade: "4",
    source: "자솔라 — DeepBlue 5.0(리뷰 페이지 기준): Bycium+ 5.0 N형 TOPCon, 온도계수 −0.26%/℃, 1년차 1% · 연 0.35%. 양면율 85%는 검색 요약 기준(원문 미확인). 탄소검증 미적용(무등급) 가정" },
];

// ── CSS ───────────────────────────────────────────────────────
rep(`  .hero-note { margin-top: 8px;`, `  .module-link { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 14px; margin-top: 10px; font-size: 12.5px; }
  .module-state { font-weight: 600; color: var(--muted); }
  .module-state.on { color: var(--pos); }
  .module-link .link-btn { min-height: 44px; }
  table.module-table { min-width: 720px; }
  .module-table th.mk-name { text-align: left; position: sticky; left: 0; background: var(--panel); z-index: 1; min-width: 190px; }
  .module-table th.mk-name .sub { display: block; font-size: 11.5px; font-weight: 400; color: var(--muted); }
  .module-table input, .module-table select { width: 76px; height: 44px; padding: 0 8px; border: 1px solid var(--line-strong); border-radius: 6px; background: var(--panel); color: var(--ink); font: inherit; font-variant-numeric: tabular-nums; text-align: right; }
  .module-table select { width: 118px; text-align: left; }
  .module-table input:focus, .module-table select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); outline: none; }
  .module-table tr.is-picked td, .module-table tr.is-picked th.mk-name { background: var(--accent-soft); }
  .module-table td.best { color: var(--pos); font-weight: 700; }
  .module-table td.over { color: var(--danger); font-weight: 700; }
  .mk-origin { display: inline-block; margin-right: 6px; padding: 1px 7px; border-radius: 999px; font-size: 11px; font-weight: 600; vertical-align: 1px; }
  .mk-origin.domestic { background: var(--accent-soft); color: var(--accent); }
  .mk-origin.china { background: var(--panel-alt); color: var(--ink-2); }
  .hero-note { margin-top: 8px;`);

// ── 조합 카드 — 원산지 + 판매 구조로 ─────────────────────────
rep(`                <span class="cb-t">① 국산 기자재 + 고정가격계약</span>
                <span class="cb-s">EPC 1,150원/W · 탄소 1등급(우대 +16원/kWh) · 계약 20년 · 상한가 147.686원/kWh</span>`,
  `                <span class="cb-t">① 국산 모듈 + 고정가격계약</span>
                <span class="cb-s">한화큐셀 · HD현대에너지솔루션 · 신성이엔지 · 한솔테크닉스 — 탄소 1~2등급 우대 · 계약 20년 · 상한가 147.686원/kWh</span>`);
rep(`                <span class="cb-t">② 중국산 기자재 + 기업PPA</span>
                <span class="cb-s">EPC 950원/W · 탄소 우대 없음 · 계약기간 자유(20~30년) · 상한가 없음</span>`,
  `                <span class="cb-t">② 중국산 모듈 + 기업PPA</span>
                <span class="cb-s">진코솔라 · 트리나솔라 · 자솔라 — 탄소 우대 없음 · 계약기간 자유(20~30년) · 상한가 없음</span>`);
rep(`버튼을 누르면 <strong>EPC 단가 · 판매 구조 · 탄소 등급 · 계약기간</strong>이 한 번에 바뀝니다. 이후 개별 입력을 고치면 "사용자 조정"으로 표시되고, 다시 누르면 조합 값으로 돌아갑니다. EPC 단가·탄소 등급 차이는 <strong>예시값</strong>이니 실제 견적·모듈 스펙으로 바꿔 주세요.`,
  `버튼을 누르면 <strong>판매 구조 · 계약기간</strong>과 해당 원산지 모듈사(기본 한화큐셀 / 진코솔라)의 <strong>모듈 단가 · 탄소 등급 · 이용률 · 열화율</strong>이 한 번에 적용됩니다. 같은 원산지 안에서 모듈사를 바꾸려면 C. 발전매출의 "모듈 제조사"를 고르세요. 이후 개별 입력을 고치면 "사용자 조정"으로 표시되고, 다시 누르면 조합 값으로 돌아갑니다.`);

// ── C. 발전매출 — 모듈 제조사 · 부지 기준 이용률 ─────────────
const makerOptions = (origin) => MAKERS.filter((m) => m.origin === origin)
  .map((m) => `                    <option value="${m.id}"${m.id === "hanwha" ? " selected" : ""}>${esc(m.name)} · ${esc(m.model)}</option>`).join("\n");
rep(`                <div class="field"><label for="year1RatePct">1년차 이용률</label><div class="iw"><input id="year1RatePct" type="number" value="15" step="0.1"><span class="unit">%</span></div></div>
                <div class="field"><label for="degradationPct">연간 열화율</label><div class="iw"><input id="degradationPct" type="number" value="0.5" step="0.05"><span class="unit">%/년</span></div></div>`,
  `                <div class="field span-2"><label for="moduleMaker">모듈 제조사</label><div class="iw"><select id="moduleMaker">
                  <optgroup label="국산 (탄소검증 우대 대상)">
${makerOptions("domestic")}
                  </optgroup>
                  <optgroup label="중국산">
${makerOptions("china")}
                  </optgroup>
                </select></div></div>
                <div class="field"><label for="siteBaseRatePct">부지 기준 이용률</label><div class="iw"><input id="siteBaseRatePct" type="number" value="15" step="0.1"><span class="unit">%</span></div></div>
                <div class="field calc"><label for="moduleFactorDisplay">모듈 성능 보정</label><div class="iw"><input id="moduleFactorDisplay" disabled><span class="unit">× 기준</span></div></div>
                <div class="field"><label for="year1RatePct">1년차 이용률 (모듈 반영)</label><div class="iw"><input id="year1RatePct" type="number" value="14.95" step="0.01"><span class="unit">%</span></div></div>
                <div class="field"><label for="degradationPct">연간 열화율 (모듈 보증)</label><div class="iw"><input id="degradationPct" type="number" value="0.33" step="0.01"><span class="unit">%/년</span></div></div>`);
rep(`                <div class="field span-2"><label for="curtailmentPct">출력제어·가용 손실률</label><div class="iw"><input id="curtailmentPct" type="number" value="3" step="0.5" min="0" max="100"><span class="unit">발전량 %</span></div></div>
              </div>`,
  `                <div class="field span-2"><label for="curtailmentPct">출력제어·가용 손실률</label><div class="iw"><input id="curtailmentPct" type="number" value="3" step="0.5" min="0" max="100"><span class="unit">발전량 %</span></div></div>
              </div>
              <div class="module-link">
                <span class="module-state" id="moduleLinkState">—</span>
                <button type="button" class="link-btn" id="applyModuleBtn">모듈사 값 다시 적용</button>
                <button type="button" class="link-btn" id="gotoModuleTab">7개사 비교 보기 →</button>
              </div>
              <p class="hint" style="margin:2px 0 0;">모듈사를 고르면 <strong>모듈 단가(D) · 탄소 등급 · 1년차 이용률 · 연간 열화율</strong>이 함께 바뀝니다. 1년차 이용률 = 부지 기준 이용률 × 온도계수 보정 × 양면율 보정 × 초기열화 보정(기준 모듈 대비), 연간 열화율 = 사별 출력보증 값. 사별 스펙·단가와 보정 기준은 "모듈사 비교" 탭에서 고칠 수 있습니다.</p>`);

// ── D. CAPEX — EPC 단가 = 모듈 단가 + BOS·시공 단가 ──────────
rep(`                <div class="field-grid">
                  <div class="field"><label for="epcUnitPrice">EPC 단가 (일괄계약)</label><div class="iw"><input id="epcUnitPrice" type="number" value="1150" step="10"><span class="unit">원/W</span></div></div>
                  <div class="field calc"><label for="epcUnitPriceTotal">= ① 공사비</label><div class="iw"><input id="epcUnitPriceTotal" disabled><span class="unit">억원</span></div></div>
                </div>
                <p class="hint" style="margin:0;">① 공사비 = EPC 단가(원/W) × 설비용량(MW) ÷ 100. 설비용량을 바꾸면 공사비가 따라 움직입니다. 국산 모듈 1,150원/W · 중국산 950원/W는 <strong>예시값</strong>입니다.</p>`,
  `                <div class="field-grid">
                  <div class="field calc"><label for="modulePriceDisplay">모듈 단가 (선택 모듈사)</label><div class="iw"><input id="modulePriceDisplay" disabled><span class="unit">원/W</span></div></div>
                  <div class="field"><label for="bosUnitPrice">BOS·시공 단가 (모듈 제외)</label><div class="iw"><input id="bosUnitPrice" type="number" value="750" step="10"><span class="unit">원/W</span></div></div>
                  <div class="field"><label for="epcUnitPrice">EPC 단가 (일괄계약)</label><div class="iw"><input id="epcUnitPrice" type="number" value="1150" step="5"><span class="unit">원/W</span></div></div>
                  <div class="field calc"><label for="epcUnitPriceTotal">= ① 공사비</label><div class="iw"><input id="epcUnitPriceTotal" disabled><span class="unit">억원</span></div></div>
                </div>
                <p class="hint" style="margin:0;">EPC 단가 = 모듈 단가 + BOS·시공 단가(인버터·구조물·전기·토목·계통연계·시공). ① 공사비 = EPC 단가(원/W) × 설비용량(MW) ÷ 100. 모듈사를 바꾸면 EPC 단가가 따라가고, 직접 고치면 "사용자 조정"이 됩니다. 모듈 단가·BOS 단가는 <strong>예시값</strong>입니다.</p>`);

// ── 모듈사 비교 탭 ────────────────────────────────────────────
rep(`        <button type="button" class="tab" role="tab" id="tab-summary" aria-controls="panel-summary" data-panel="panel-summary" aria-selected="true">요약</button>`,
  `        <button type="button" class="tab" role="tab" id="tab-summary" aria-controls="panel-summary" data-panel="panel-summary" aria-selected="true">요약</button>
        <button type="button" class="tab" role="tab" id="tab-module" aria-controls="panel-module" data-panel="panel-module" aria-selected="false">모듈사 비교</button>`);
const gradeSelect = (m) => `<select id="mk-${m.id}-grade" aria-label="${esc(m.name)} 탄소 등급">`
  + [["1", "1등급 (+16원)"], ["2", "2등급 (+7원)"], ["3", "3등급"], ["4", "4등급·미검증"]].map(([v, l]) => `<option value="${v}"${v === m.grade ? " selected" : ""}>${l}</option>`).join("")
  + `</select>`;
const numIn = (m, f, v, step, label) => `<input id="mk-${m.id}-${f}" type="number" value="${v}" step="${step}" aria-label="${esc(m.name)} ${label}">`;
// 결과 표(답)와 스펙·단가 입력 표를 나눠, 결과 열이 가로 스크롤 밖으로 밀리지 않게 한다.
const nameCell = (m) => `<th class="mk-name"><span class="mk-origin ${m.origin}">${m.origin === "domestic" ? "국산" : "중국산"}</span>${esc(m.name)}<span class="sub">${esc(m.model)} · ${esc(m.specLabel)}</span></th>`;
const resultRowsHtml = MAKERS.map((m) => `                  <tr data-mk-row="${m.id}">
                    ${nameCell(m)}
                    <td id="mk-${m.id}-y1">—</td>
                    <td id="mk-${m.id}-avg">—</td>
                    <td id="mk-${m.id}-epc">—</td>
                    <td id="mk-${m.id}-solve">—</td>
                    <td id="mk-${m.id}-bid">—</td>
                    <td><button type="button" class="btn btn-soft" data-mk-pick="${m.id}">선택</button></td>
                  </tr>`).join("\n");
const specRowsHtml = MAKERS.map((m) => `                  <tr data-mk-row="${m.id}">
                    ${nameCell(m)}
                    <td>${numIn(m, "price", m.price, 5, "모듈 단가")}</td>
                    <td>${numIn(m, "gamma", m.gamma, 0.01, "온도계수")}</td>
                    <td>${numIn(m, "bif", m.bif, 1, "양면율")}</td>
                    <td>${numIn(m, "deg1", m.deg1, 0.1, "1년차 열화")}</td>
                    <td>${numIn(m, "degA", m.degA, 0.01, "연간 열화")}</td>
                    <td>${gradeSelect(m)}</td>
                  </tr>`).join("\n");
rep(`      <div class="tabpanel" role="tabpanel" id="panel-sens" aria-labelledby="tab-sens" hidden>`,
  `      <!-- 모듈사 비교 -->
      <div class="tabpanel" role="tabpanel" id="panel-module" aria-labelledby="tab-module" hidden>
        <section class="panel">
          <h2>모듈사 비교 — 국산 4사 · 중국산 3사</h2>
          <div class="panel-body">
            <p class="callout-sm"><strong>사별 스펙 → 이용률 → 적정 단가를 같은 사업 조건에서 비교합니다. </strong>표의 입력 칸(모듈 단가·온도계수·양면율·열화율·탄소 등급)은 직접 고칠 수 있고, 지금 선택한 모듈사의 값을 고치면 C·D 입력에도 바로 반영됩니다. 각 사마다 현재 조건(용량·금융·목표 수익·판매 구조)에서 <strong>① 공사비만 EPC 단가 방식으로, 연차별 이용률만 1년차 × 열화율 규칙으로</strong> 바꿔 다시 역산합니다(C에서 연차별 이용률 칸을 직접 고친 값은 비교에 쓰지 않습니다).</p>
            <div class="subtotal strong"><span>비교 결과</span><span></span></div>
            <div class="table-wrap">
              <table class="module-table">
                <thead><tr><th class="mk-name">모듈사 · 대표 모델</th><th>1년차<br>이용률</th><th>운영기간<br>평균 이용률</th><th>EPC 단가</th><th id="mkPriceHead">적정<br>수령단가</th><th>입찰가격<br>(수령 − 우대)</th><th></th></tr></thead>
                <tbody id="moduleTableBody">
${resultRowsHtml}
                </tbody>
              </table>
            </div>
            <div class="warn" role="status" id="moduleCompareWarn"></div>
            <p class="hint">초록 굵은 글씨 = 같은 열에서 가장 낮은 단가. 입찰가격이 빨간색이면 상한가격을 넘어 고정가격계약에 응찰할 수 없습니다. "선택"을 누르면 그 모듈사가 C·D 입력에 적용됩니다.</p>

            <div class="subtotal strong"><span>사별 스펙 · 모듈 단가 (직접 수정)</span><span></span></div>
            <div class="table-wrap">
              <table class="module-table">
                <thead><tr><th class="mk-name">모듈사 · 대표 모델</th><th>모듈 단가<br>(원/W)</th><th>온도계수<br>(%/℃)</th><th>양면율<br>(%)</th><th>1년차 열화<br>(%)</th><th>연간 열화<br>(%/년)</th><th>탄소 등급</th></tr></thead>
                <tbody id="moduleSpecBody">
${specRowsHtml}
                </tbody>
              </table>
            </div>
            <p class="hint">모듈 단가는 사별 공개 자료가 없어 <strong>탄소 등급별 시공사 매입가 범위</strong>(1등급 320~425 · 2등급 255~340 · 무등급 190~220원/Wp, 전기신문 2024-09) 안의 예시값입니다. 실제 견적으로 바꿔 주세요.</p>

            <div class="subtotal strong"><span>이용률 보정 기준 — "부지 기준 이용률"이 나오는 기준 모듈</span><span></span></div>
            <div class="calc-grid" style="margin-top:0;">
              <div class="field"><label for="refTempCoef">기준 온도계수</label><div class="iw"><input id="refTempCoef" type="number" value="-0.30" step="0.01"><span class="unit">%/℃</span></div></div>
              <div class="field"><label for="refBifaciality">기준 양면율</label><div class="iw"><input id="refBifaciality" type="number" value="80" step="1"><span class="unit">%</span></div></div>
              <div class="field"><label for="refFirstYearDeg">기준 1년차 열화</label><div class="iw"><input id="refFirstYearDeg" type="number" value="1.0" step="0.1"><span class="unit">%</span></div></div>
              <div class="field"><label for="tempDeltaC">발전가중 셀온도 − 25℃</label><div class="iw"><input id="tempDeltaC" type="number" value="20" step="1"><span class="unit">℃</span></div></div>
              <div class="field"><label for="rearGainPct">후면 일사 비율</label><div class="iw"><input id="rearGainPct" type="number" value="8" step="0.5"><span class="unit">% (전면 대비)</span></div></div>
            </div>
            <p class="hint">온도 보정 = 1 + (모듈 온도계수 − 기준 온도계수) × 셀온도 상승분 · 양면 보정 = (1 + 양면율 × 후면 일사 비율) ÷ (1 + 기준 양면율 × 후면 일사 비율) · 초기열화 보정 = (1 − 1년차 열화) ÷ (1 − 기준 1년차 열화). 셀온도 +20℃·후면 일사 8%(잔디·흙 바닥 지상형)는 예시 가정이며, 저조도 특성·음영·실측 발전 실적은 반영하지 않습니다.</p>
            <div class="subtotal strong"><span>사별 스펙 출처와 확인 수준</span><span></span></div>
            <ul class="todo-list">
${MAKERS.map((m) => `              <li>${esc(m.source)}</li>`).join("\n")}
            </ul>
          </div>
        </section>
      </div>

      <div class="tabpanel" role="tabpanel" id="panel-sens" aria-labelledby="tab-sens" hidden>`);

// ── 확정 필요 항목 · 안내 링크 ────────────────────────────────
rep(`조합별 EPC 단가(1,150 / 950원/W)와 탄소 등급은 <strong>예시값</strong>이니 실제 견적·모듈 탄소배출량 성적서로 교체 필요.`,
  `조합별 모듈사·모듈 단가·탄소 등급은 아래 "모듈사 비교" 항목 참고.`);
rep(`              <li>D·E. CAPEX·OPEX — 50MW(AC) 지상형 예시 규모`,
  `              <li><strong>모듈사 비교</strong> — 사별 스펙은 한화큐셀(Q.TRON XL-G2.3/BFG)·트리나솔라(Vertex N)는 데이터시트 원문, HD현대에너지솔루션·진코솔라·자솔라는 판매처·공식 페이지·리뷰 기준이고, <strong>신성이엔지·한솔테크닉스는 공개 수치를 찾지 못해 N형 TOPCon 양면 일반값으로 가정</strong>. 사별 모듈 가격은 공개 자료가 없어 탄소 등급별 매입가 범위 안의 <strong>예시값</strong>. 이용률 차이는 온도계수·양면율·초기열화만으로 근사(저조도·음영·실측 실적 미반영) — 실제 견적·데이터시트·운영 실적으로 교체 필요. BOS·시공 단가 750원/W도 예시값</li>
              <li>D·E. CAPEX·OPEX — 50MW(AC) 지상형 예시 규모`);
rep('전체 11개 항목 상세 보기', '전체 12개 항목 상세 보기');

// ═══════════════════ 스크립트(계산) ═══════════════════
const makersJs = JSON.stringify(MAKERS.map(({ id, origin, name, model }) => ({ id, origin, name, model })));
rep(`  const COMBOS = {
    domestic: { label: '① 국산 기자재 + 고정가격계약', fields: { capexInputMode: 'unitprice', epcUnitPrice: '1150', salesStructure: 'fixed', carbonGrade: '1', contractYears: '20' } },
    china: { label: '② 중국산 기자재 + 기업PPA', fields: { capexInputMode: 'unitprice', epcUnitPrice: '950', salesStructure: 'ppa', carbonGrade: '4', contractYears: '20' } },
  };`,
  `  // 모듈사 — 사별 스펙·단가 기본값은 "모듈사 비교" 탭 표의 입력 칸(HTML value)에 있고, 여기엔 식별 정보만 둔다.
  const MODULE_MAKERS = ${makersJs};
  const MAKER_BY_ID = Object.fromEntries(MODULE_MAKERS.map((m) => [m.id, m]));
  // 조합 = 모듈 원산지 + 판매 구조. 버튼을 누르면 그 원산지의 기본 모듈사 값까지 C·D 입력에 주입한다.
  const COMBOS = {
    domestic: { label: '① 국산 모듈 + 고정가격계약', origin: 'domestic', defaultMaker: 'hanwha', fields: { salesStructure: 'fixed', contractYears: '20' } },
    china: { label: '② 중국산 모듈 + 기업PPA', origin: 'china', defaultMaker: 'jinko', fields: { salesStructure: 'ppa', contractYears: '20' } },
  };`);

rep(`  // 지금 입력값이 어느 조합과 일치하는지 표시한다(일치하지 않으면 "사용자 조정").
  function syncComboState() {
    const on = Object.keys(COMBOS).find((k) => Object.entries(COMBOS[k].fields).every(([id, v]) => $(id).value === v)) || null;
    document.querySelectorAll('[data-combo]').forEach((b) => b.classList.toggle('is-on', b.dataset.combo === on));
    $('comboActive').textContent = on ? COMBOS[on].label : '사용자 조정';
  }
  document.querySelectorAll('[data-combo]').forEach((btn) => btn.addEventListener('click', () => {
    Object.entries(COMBOS[btn.dataset.combo].fields).forEach(([id, v]) => { $(id).value = v; });
    syncCapexModeVisibility(); syncSalesStructure(); syncComboState();
    recalcAll();
  }));`,
  `  // ---------- 모듈 제조사 → 이용률·열화율·모듈 단가·탄소 등급 ----------
  function makerSpec(id) {
    const g = (f) => +$(\`mk-\${id}-\${f}\`).value;
    return { price: g('price'), gamma: g('gamma'), bif: g('bif'), deg1: g('deg1'), degA: g('degA'), grade: $(\`mk-\${id}-grade\`).value };
  }
  // 기준 모듈(부지 기준 이용률이 나오는 모듈) 대비 사별 성능 보정. 셋 다 곱으로 1년차 이용률에 적용한다.
  //  온도: 온도계수가 덜 음수일수록 더운 시간대 출력 손실이 적다 → 1 + (γ − γ기준) × 셀온도 상승분
  //  양면: 후면 이득 = 양면율 × 후면 일사 비율 → (1 + 양면율 × 후면) ÷ (1 + 기준 양면율 × 후면)
  //  초기열화: 1년차 보증 열화(LID 등)가 클수록 첫해부터 낮다 → (1 − 1년차 열화) ÷ (1 − 기준 1년차 열화)
  function moduleDerived(id) {
    const sp = makerSpec(id);
    const dT = +$('tempDeltaC').value || 0, rear = rate(+$('rearGainPct').value || 0);
    const tempF = 1 + rate((sp.gamma - (+$('refTempCoef').value || 0)) * dT);
    const bifF = (1 + rate(sp.bif) * rear) / (1 + rate(+$('refBifaciality').value || 0) * rear);
    const degF = (1 - rate(sp.deg1)) / (1 - rate(+$('refFirstYearDeg').value || 0));
    const factor = tempF * bifF * degF;
    return { ...sp, factor, y1: Math.round((+$('siteBaseRatePct').value || 0) * factor * 100) / 100, epc: sp.price + (+$('bosUnitPrice').value || 0) };
  }
  // 지금 C·D 입력이 선택 모듈사의 파생값과 그대로 일치하는지(= 모듈사 값 적용 중). 상태를 따로 저장하지 않아 복원·되돌리기와 자동으로 맞는다.
  function moduleLinkActive() {
    const d = moduleDerived($('moduleMaker').value), near = (a, b) => Math.abs(a - b) < 1e-6;
    return $('capexInputMode').value === 'unitprice' && near(+$('epcUnitPrice').value, d.epc) && $('carbonGrade').value === d.grade
      && near(+$('year1RatePct').value, d.y1) && near(+$('degradationPct').value, d.degA);
  }
  function applyModuleDerived() {
    const d = moduleDerived($('moduleMaker').value);
    $('capexInputMode').value = 'unitprice';
    $('epcUnitPrice').value = String(d.epc);
    $('carbonGrade').value = d.grade;
    $('year1RatePct').value = String(d.y1);
    $('degradationPct').value = String(d.degA);
    document.querySelectorAll('#opRateGrid [data-oprate-index]').forEach((el, i) => { el.value = defaultRatePctForYear(i + 1); });
    syncCapexModeVisibility();
  }
  function syncModuleState() {
    const id = $('moduleMaker').value, d = moduleDerived(id);
    moduleLinked = moduleLinkActive();
    $('modulePriceDisplay').value = fmt(d.price, 0);
    $('moduleFactorDisplay').value = fmt(d.factor, 4);
    const el = $('moduleLinkState');
    el.textContent = moduleLinked ? \`● \${MAKER_BY_ID[id].name} 값 적용 중\` : '○ 사용자 조정 (모듈사 값에서 벗어남)';
    el.className = moduleLinked ? 'module-state on' : 'module-state';
    document.querySelectorAll('[data-mk-row]').forEach((tr) => tr.classList.toggle('is-picked', tr.dataset.mkRow === id));
  }
  // 지금 입력값이 어느 조합과 일치하는지 표시한다(판매 구조·계약기간 + 모듈 원산지 + 모듈사 값 적용 중).
  function syncComboState() {
    const id = $('moduleMaker').value, origin = MAKER_BY_ID[id]?.origin, linked = moduleLinkActive();
    const on = Object.keys(COMBOS).find((k) => COMBOS[k].origin === origin && linked && Object.entries(COMBOS[k].fields).every(([f, v]) => $(f).value === v)) || null;
    document.querySelectorAll('[data-combo]').forEach((b) => b.classList.toggle('is-on', b.dataset.combo === on));
    $('comboActive').textContent = on ? \`\${COMBOS[on].label} · \${MAKER_BY_ID[id].name}\` : '사용자 조정';
  }
  document.querySelectorAll('[data-combo]').forEach((btn) => btn.addEventListener('click', () => {
    const c = COMBOS[btn.dataset.combo];
    Object.entries(c.fields).forEach(([f, v]) => { $(f).value = v; });
    if (MAKER_BY_ID[$('moduleMaker').value]?.origin !== c.origin) $('moduleMaker').value = c.defaultMaker; // 같은 원산지면 고른 모듈사 유지
    applyModuleDerived();
    syncSalesStructure(); syncComboState();
    recalcAll();
  }));`);

rep(`  let lastEpcTotal = NaN;`, `  let moduleLinked = true; // 직전 계산 시점에 모듈사 값이 C·D에 적용 중이었는지 — 사별 스펙을 고칠 때 다시 주입할지 판단
  let lastEpcTotal = NaN;`);
rep(`    syncSalesStructure(); syncComboState(); // 입력이 바뀔 때마다 라벨·경고·조합 표시를 현재 값에 맞춘다`,
  `    syncSalesStructure(); syncModuleState(); syncComboState(); // 입력이 바뀔 때마다 라벨·경고·모듈사·조합 표시를 현재 값에 맞춘다`);

// ── 지연 렌더 — 모듈사 비교 탭 ────────────────────────────────
rep(`  function markResultsDirty() { resultsDirty.summary = true; resultsDirty.sens = true; }
  function renderActiveTab() {
    if (activeTabId === 'tab-summary' && resultsDirty.summary) { resultsDirty.summary = false; renderSummaryTab(); }
    else if (activeTabId === 'tab-sens' && resultsDirty.sens) { resultsDirty.sens = false; computeSensitivity(); renderSensitivityView(); }
  }`,
  `  function markResultsDirty() { resultsDirty.summary = true; resultsDirty.sens = true; resultsDirty.module = true; }
  function renderActiveTab() {
    if (activeTabId === 'tab-summary' && resultsDirty.summary) { resultsDirty.summary = false; renderSummaryTab(); }
    else if (activeTabId === 'tab-sens' && resultsDirty.sens) { resultsDirty.sens = false; computeSensitivity(); renderSensitivityView(); }
    else if (activeTabId === 'tab-module' && resultsDirty.module) { resultsDirty.module = false; renderModuleCompare(); }
  }

  // ---------- 모듈사 비교 탭 — 7개사를 같은 조건에서 각각 역산(탭이 보일 때만 7회 역산) ----------
  function renderModuleCompare() {
    const base = readModel();
    const n = Math.max(1, Math.round(+$('operationYears').value) || 1), mw = base.revenue.contractCapacityMW;
    const isFixed = base.revenue.salesStructure === 'fixed', cap = isFixed ? (+$('priceCapPerKWh').value || 0) : 0;
    const premiumOf = (grade) => (isFixed ? (CARBON_GRADES[grade]?.premium || 0) : 0);
    $('mkPriceHead').innerHTML = isFixed ? '적정<br>수령단가' : '적정<br>PPA 단가';
    const rows = MODULE_MAKERS.map((mk) => {
      const d = moduleDerived(mk.id);
      const rates = Array.from({ length: n }, (_, i) => Math.round(d.y1 * (1 - rate(d.degA)) ** i * 100) / 100);
      const m = readModel();
      m.capex = { ...m.capex, items: [{ id: 'epcLumpSum', label: \`EPC 일괄계약 (\${mk.name})\`, value: d.epc * mw / 100, category: '기자재', group: 'construction' },
        ...m.capex.items.filter((it) => it.group !== 'construction')] };
      m.revenue = { ...m.revenue, operatingRatesPct: rates };
      const solved = solveCurrentModel(m);
      const ok = solved.ok && Number.isFinite(solved.price);
      return { mk, d, avg: sum(rates) / rates.length, ok, price: ok ? solved.price : NaN, bid: ok ? solved.price - premiumOf(d.grade) : NaN };
    });
    const minOf = (arr) => (arr.length ? Math.min(...arr) : NaN);
    const bestPrice = minOf(rows.filter((r) => r.ok).map((r) => r.price));
    const bestBid = minOf(rows.filter((r) => r.ok && !(cap > 0 && r.bid > cap)).map((r) => r.bid));
    rows.forEach((r) => {
      const id = r.mk.id, sEl = $(\`mk-\${id}-solve\`), bEl = $(\`mk-\${id}-bid\`);
      $(\`mk-\${id}-y1\`).textContent = \`\${fmt(r.d.y1, 2)}%\`;
      $(\`mk-\${id}-avg\`).textContent = \`\${fmt(r.avg, 2)}%\`;
      $(\`mk-\${id}-epc\`).textContent = \`\${fmt(r.d.epc, 0)}원/W\`;
      if (!r.ok) { sEl.textContent = '산정 불가'; bEl.textContent = '—'; sEl.className = ''; bEl.className = ''; return; }
      sEl.textContent = \`\${fmt(r.price, 2)}원\`;
      sEl.className = Math.abs(r.price - bestPrice) < 0.005 ? 'best' : '';
      if (!isFixed) { bEl.textContent = '해당 없음(PPA)'; bEl.className = ''; bEl.title = ''; return; }
      const prem = premiumOf(r.d.grade), over = cap > 0 && r.bid > cap;
      bEl.textContent = \`\${fmt(r.bid, 2)}원\${prem ? \` (−\${fmt(prem, 0)})\` : ''}\`;
      bEl.className = over ? 'over' : (Math.abs(r.bid - bestBid) < 0.005 ? 'best' : '');
      bEl.title = over ? \`상한가 \${fmt(cap, 3)}원/kWh 초과\` : '';
    });
    const warn = $('moduleCompareWarn'), overRows = rows.filter((r) => r.ok && cap > 0 && r.bid > cap);
    if (overRows.length) {
      warn.className = 'warn show';
      warn.textContent = \`상한가격 \${fmt(cap, 3)}원/kWh를 넘는 모듈사: \${overRows.map((r) => r.mk.name).join(', ')} — 이 조건으로는 고정가격계약에 응찰할 수 없습니다.\`;
    } else warn.className = 'warn';
  }`);

// ── 리스너 — 공통 recalcAll 리스너보다 먼저 등록 ──────────────
rep(`
  document.querySelectorAll('.wrap input, .wrap select').forEach((el) => {
    if (el.id === 'bidPrice'`,
  `
  // 모듈사 선택 → 모듈 단가·탄소 등급·1년차 이용률·열화율을 C·D 입력에 주입(공통 recalcAll 리스너보다 먼저 등록해 주입값으로 재계산)
  $('moduleMaker').addEventListener('input', applyModuleDerived);
  // 사별 스펙·보정 기준·BOS·부지 기준 이용률을 고치면, 직전까지 모듈사 값이 적용 중이었을 때만 다시 주입한다
  // (사용자가 C·D를 직접 조정한 상태는 덮어쓰지 않는다). 선택하지 않은 모듈사의 스펙은 비교 탭에만 영향.
  const MODULE_UPSTREAM_IDS = ['siteBaseRatePct', 'bosUnitPrice', 'refTempCoef', 'refBifaciality', 'refFirstYearDeg', 'tempDeltaC', 'rearGainPct'];
  [...MODULE_UPSTREAM_IDS.map((id) => $(id)), ...document.querySelectorAll('input[id^="mk-"], select[id^="mk-"]')].forEach((el) => el.addEventListener('input', () => {
    const own = el.id.startsWith('mk-') ? el.id.split('-')[1] : null;
    if (moduleLinked && (!own || own === $('moduleMaker').value)) applyModuleDerived();
  }));
  $('applyModuleBtn').addEventListener('click', () => { applyModuleDerived(); recalcAll(); });
  $('gotoModuleTab').addEventListener('click', () => $('tab-module').click());
  document.querySelectorAll('[data-mk-pick]').forEach((b) => b.addEventListener('click', () => {
    $('moduleMaker').value = b.dataset.mkPick;
    applyModuleDerived();
    recalcAll();
  }));

  document.querySelectorAll('.wrap input, .wrap select').forEach((el) => {
    if (el.id === 'bidPrice'`);

// ── 시나리오 비교에 모듈사 ────────────────────────────────────
rep(`heroBidPrice: $('heroBidPrice').textContent,`, `moduleMaker: MAKER_BY_ID[$('moduleMaker').value]?.name || '',
      heroBidPrice: $('heroBidPrice').textContent,`);
rep(`    ['설비용량(MW)', (s) => s.kpi.contractCapacityMW],`, `    ['설비용량(MW)', (s) => s.kpi.contractCapacityMW],
    ['모듈사', (s) => s.kpi.moduleMaker || '—'],`);
rep(`const SCENARIO_ASSUMPTION_LABELS = ['산정 기준', '설비용량(MW)', 'CAPEX 합계', 'OPEX 합계'];`, `const SCENARIO_ASSUMPTION_LABELS = ['산정 기준', '설비용량(MW)', '모듈사', 'CAPEX 합계', 'OPEX 합계'];`);

writeFileSync(`${SP}/solar-bid-price-prototype.html`, s, "utf8");
console.log("v3 done:", s.split("\n").length, "lines");
