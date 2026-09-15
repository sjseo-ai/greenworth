// 해상풍력 1b — D. CAPEX 단가(억원/MW) · E·F 기본값 · 모델링 한계 안내 · 탭 이름 · 터빈 비교 패널
import { open, OUT, TURBINES, esc, specificPower } from "./wind-lib.mjs";
const f = open(OUT);

// ── D. CAPEX ──────────────────────────────────────────────────
f.rep("항목별 금액 (억원, 프로젝트 총액 직접 입력 — 50MW 지상형 예시)", "항목별 금액 (억원, 프로젝트 총액 직접 입력 — 100MW 고정식 예시)");
f.rep(`<option value="itemized">항목별 입력 (7개)</option>`, `<option value="itemized">항목별 입력 (6개)</option>`);
f.between(`<div id="capexUnitPriceWrap">`, `<div id="capexLumpSumWrap"`, `<div id="capexUnitPriceWrap">
                <div class="field-grid">
                  <div class="field calc"><label for="turbinePriceDisplay">터빈 단가 (선택 터빈)</label><div class="iw"><input id="turbinePriceDisplay" disabled><span class="unit">억원/MW</span></div></div>
                  <div class="field"><label for="bosUnitPrice">BOP·시공 단가 (터빈 제외)</label><div class="iw"><input id="bosUnitPrice" type="number" value="48" step="0.5"><span class="unit">억원/MW</span></div></div>
                  <div class="field"><label for="epcUnitPrice">EPC 단가 (일괄계약)</label><div class="iw"><input id="epcUnitPrice" type="number" value="72" step="0.5"><span class="unit">억원/MW</span></div></div>
                  <div class="field calc"><label for="epcUnitPriceTotal">= ① 공사비</label><div class="iw"><input id="epcUnitPriceTotal" disabled><span class="unit">억원</span></div></div>
                </div>
                <p class="hint" style="margin:0;">EPC 단가 = 터빈 단가 + BOP·시공 단가(하부구조물 · 내부망/외부망 해저케이블 · 해상변전소 · 해상 설치 · 육상 계통연계). ① 공사비 = EPC 단가(억원/MW) × 설비용량(MW). 터빈을 바꾸면 EPC 단가가 따라가고, 직접 고치면 "사용자 조정"이 됩니다. 국내 보도 기준 총사업비는 MW당 약 70~90억(한림 약 70억 · 전남1 약 90억)이고, 터빈·BOP 단가는 <strong>예시값</strong>입니다.</p>
              </div>
              `, false);
f.rep(`<input id="capexLumpSum" type="number" value="545" step="1">`, `<input id="capexLumpSum" type="number" value="7200" step="10">`);

// ── E. OPEX · F. 금융 ─────────────────────────────────────────
f.rep(`<input id="insurancePct" type="number" value="0.3" step="0.01">`, `<input id="insurancePct" type="number" value="0.4" step="0.01">`);
f.rep(`<label for="communityRevenuePct">주민·지역 기여</label><div class="iw"><input id="communityRevenuePct" type="number" value="0.5" step="0.1">`,
  `<label for="communityRevenuePct">어업인·지역 상생</label><div class="iw"><input id="communityRevenuePct" type="number" value="1.0" step="0.1">`);
f.rep(`<p class="hint">전력거래수수료는 실제 판매 발전량에 비례합니다. 변동 O&amp;M은 태양광에서 보통 작아 기본 0으로 두었습니다(인버터 교체 등은 고정비·예비비로 반영).</p>`,
  `<p class="hint">전력거래수수료는 실제 판매 발전량에 비례합니다. 해상풍력 O&amp;M은 터빈 장기유지보수(LTSA)·선박·하부구조물 점검이 대부분이라 고정비 항목으로 두었고, 변동 O&amp;M은 기본 0입니다. 어업인·지역 상생은 매출 비례 예시값입니다.</p>`);
f.rep(`<input id="equityAmount" type="number" value="210" step="0.1">`, `<input id="equityAmount" type="number" value="1860" step="0.1">`);
f.rep(`<input id="bondAmount" type="number" value="35" step="0.1">`, `<input id="bondAmount" type="number" value="370" step="0.1">`);

// ── 모델링 한계 안내 ──────────────────────────────────────────
f.between(`<aside class="notice"`, `</aside>`, `<aside class="notice" aria-label="해상풍력 모델링 한계">
        <strong class="t">⚠ 해상풍력 초안 — 이 결과에 항상 적용되는 한계</strong>
        <ul>
          <li>ESS·태양광 프로토타입의 재무 엔진에 발전매출·터빈만 해상풍력으로 바꾼 <strong>1차 초안</strong> — 해상 시공·해저케이블 리스크, 해체 충당금 미반영</li>
          <li>이용률은 부지 총이용률 × 출력곡선·가용률·손실 보정의 연 단위 근사 — 풍황 계측·후류 해석 <strong>미반영</strong></li>
          <li>계약단가는 "SMP+1REC×가중치 + 우대가격" 근사 — <strong>RPS 개편 시 가중치 폐지</strong>로 달라짐</li>
          <li>선정평가 비가격 세부 배점은 2025년 상반기 보도 기준 — 2026년 공고문 확인 필요</li>
          <li>CAPEX·OPEX·터빈 단가는 100MW 고정식 <strong>예시값</strong></li>
        </ul>
        <p style="margin:6px 0 0;font-size:12.5px;"><button type="button" class="link-btn" data-goto-tab="tab-caveats">전체 13개 항목 상세 보기 →</button></p>
      </aside>`);

// ── 탭 · 터빈 비교 패널 ───────────────────────────────────────
f.rep(`<button type="button" class="tab" role="tab" id="tab-module" aria-controls="panel-module" data-panel="panel-module" aria-selected="false">모듈사 비교</button>`,
  `<button type="button" class="tab" role="tab" id="tab-turbine" aria-controls="panel-turbine" data-panel="panel-turbine" aria-selected="false">터빈 비교</button>`);
const nameCell = (t) => `<th class="mk-name"><span class="mk-origin ${t.origin === "domestic" ? "domestic" : "china"}">${t.origin === "domestic" ? "국산" : "외산"}</span>${esc(t.maker)}<span class="sub">${esc(t.model)} · ${esc(t.specLabel)}</span></th>`;
const resultRows = TURBINES.map((t) => `                  <tr data-tb-row="${t.id}">
                    ${nameCell(t)}
                    <td id="tb-${t.id}-rated">—</td>
                    <td id="tb-${t.id}-sp">—</td>
                    <td id="tb-${t.id}-y1">—</td>
                    <td id="tb-${t.id}-epc">—</td>
                    <td id="tb-${t.id}-solve">—</td>
                    <td id="tb-${t.id}-bid">—</td>
                    <td><button type="button" class="btn btn-soft" data-tb-pick="${t.id}">선택</button></td>
                  </tr>`).join("\n");
const numIn = (t, fld, v, step, label) => `<input id="tb-${t.id}-${fld}" type="number" value="${v}" step="${step}" aria-label="${esc(t.maker)} ${label}">`;
const specRows = TURBINES.map((t) => `                  <tr data-tb-row="${t.id}">
                    ${nameCell(t)}
                    <td>${numIn(t, "price", t.price, 0.5, "터빈 단가")}</td>
                    <td>${numIn(t, "mw", t.mw, 0.1, "정격출력")}</td>
                    <td>${numIn(t, "rotor", t.rotor, 1, "로터 직경")}</td>
                    <td>${numIn(t, "avail", t.avail, 0.5, "가용률")}</td>
                    <td>${numIn(t, "degA", t.degA, 0.05, "성능저하")}</td>
                    <td>${numIn(t, "local", t.local, 5, "국산화율")}</td>
                  </tr>`).join("\n");
f.between(`      <!-- 모듈사 비교 -->`, `      <div class="tabpanel" role="tabpanel" id="panel-sens"`, `      <!-- 터빈 비교 -->
      <div class="tabpanel" role="tabpanel" id="panel-turbine" aria-labelledby="tab-turbine" hidden>
        <section class="panel">
          <h2>터빈 비교 — 국산 2 · 외산 4</h2>
          <div class="panel-body">
            <p class="callout-sm"><strong>터빈별 스펙 → 순이용률 → 적정 단가를 같은 사업 조건에서 비교합니다. </strong>터빈마다 현재 조건(용량·금융·목표 수익·판매 구조·가중치·손실)에서 <strong>① 공사비만 EPC 단가 방식으로, 연차별 이용률만 1년차 × 성능저하 규칙으로</strong> 바꿔 다시 역산합니다. 입찰가격 열은 지금 입찰 트랙의 우대가격과 REC 가중치로 환산한 값입니다.</p>
            <div class="subtotal strong"><span>비교 결과</span><span></span></div>
            <div class="table-wrap">
              <table class="module-table">
                <thead><tr><th class="mk-name">터빈</th><th>정격 · 대수</th><th>비출력<br>(W/m²)</th><th>1년차<br>순이용률</th><th>EPC 단가<br>(억원/MW)</th><th id="tbPriceHead">적정<br>수령단가</th><th>입찰가격<br>(SMP+1REC)</th><th></th></tr></thead>
                <tbody id="turbineTableBody">
${resultRows}
                </tbody>
              </table>
            </div>
            <div class="warn" role="status" id="turbineCompareWarn"></div>
            <p class="hint">초록 굵은 글씨 = 같은 열에서 가장 낮은 단가. 입찰가격이 빨간색이면 상한가격을 넘습니다. 가격만 본 비교이므로 실제 선정은 비가격 50점(안보·산업·경제효과 등)에서 국산 터빈이 유리할 수 있습니다 — "선정평가" 탭 참고. "선택"을 누르면 그 터빈이 C·D 입력에 적용됩니다.</p>

            <div class="subtotal strong"><span>터빈 스펙 · 단가 (직접 수정)</span><span></span></div>
            <div class="table-wrap">
              <table class="module-table">
                <thead><tr><th class="mk-name">터빈</th><th>터빈 단가<br>(억원/MW)</th><th>정격<br>(MW)</th><th>로터 직경<br>(m)</th><th>가용률<br>(%)</th><th>성능저하<br>(%/년)</th><th>국산화율<br>(%, 참고)</th></tr></thead>
                <tbody id="turbineSpecBody">
${specRows}
                </tbody>
              </table>
            </div>
            <p class="hint">터빈 단가 · 가용률 · 외산 국산화율은 공개 자료가 없어 <strong>예시값</strong>입니다. 운영 실적이 없는 신규 모델(유니슨 U210 등)은 가용률을 보수적으로 두었습니다.</p>

            <div class="subtotal strong"><span>출력곡선 보정 기준</span><span></span></div>
            <div class="calc-grid" style="margin-top:0;">
              <div class="field"><label for="refSpecificPower">기준 비출력</label><div class="iw"><input id="refSpecificPower" type="number" value="320" step="5"><span class="unit">W/m²</span></div></div>
              <div class="field"><label for="powerCurveExp">보정 지수</label><div class="iw"><input id="powerCurveExp" type="number" value="0.25" step="0.05" min="0"></div></div>
            </div>
            <p class="hint">출력곡선 보정 = (기준 비출력 ÷ 터빈 비출력)<sup>지수</sup>, 비출력 = 정격출력 ÷ 로터 소풍면적. 기준 320W/m²(SG 14-236급) · 지수 0.25는 근사 가정이며, 실제로는 단지 풍황 자료와 터빈별 출력곡선·후류 해석으로 산정해야 합니다. 국내 실측 참고: 한림(두산 5.56MW) 이용률 27~29% vs 전남1(SGRE 9.6MW급) 30~38% — 단지·풍황 차이도 섞여 있습니다.</p>

            <div class="subtotal strong"><span>터빈별 근거와 확인 수준</span><span></span></div>
            <ul class="todo-list">
${TURBINES.map((t) => `              <li>${esc(t.source)} 비출력 약 ${Math.round(specificPower(t))}W/m².</li>`).join("\n")}
            </ul>
          </div>
        </section>
      </div>

      `, false);

f.save("wind-1b");
