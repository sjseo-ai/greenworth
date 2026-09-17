// 해상풍력 1a — 헤더 · 조합 카드 · B. 사업개요 기본값 · C. 발전매출(터빈·이용률·판매 조건·REC 가중치·우대가격)
import { open, SOLAR, TURBINES, esc } from "./wind-lib.mjs";
const f = open(SOLAR);

f.rep("<title>태양광 적정 입찰가격 프로토타입</title>", "<title>해상풍력 적정 입찰가격 프로토타입</title>");
f.rep("<h1>태양광 적정 입찰가격</h1>", "<h1>해상풍력 적정 입찰가격</h1>");
f.rep('<span class="brand-sub">KCH그룹 · 초안 · 고정가격계약 / 기업PPA 2개 조합</span>', '<span class="brand-sub">KCH그룹 · 초안 · 풍력 고정가격계약 (공공주도형 / 일반형)</span>');

f.between(`          <div class="combo-card">`, `          <details class="acc" open>`, `          <div class="combo-card">
            <div class="combo-head"><span>사업 구성 조합</span><span class="combo-now" id="comboActive">—</span></div>
            <div class="combo-btns">
              <button type="button" class="combo-btn" data-combo="public">
                <span class="cb-t">① 공공주도형 + 국산 터빈</span>
                <span class="cb-s">두산에너빌리티 · 유니슨 — 안보 8점 · 우대가격 3.66원/kWh(정부 R&amp;D 실증 터빈 +27.84원) · 공공 지분 요건</span>
              </button>
              <button type="button" class="combo-btn" data-combo="general">
                <span class="cb-t">② 일반형 + 외산 터빈</span>
                <span class="cb-s">Vestas · Siemens Gamesa · GE Vernova · Mingyang — 안보 6점 · 우대가격 없음 · 산업·경제효과 26점</span>
              </button>
            </div>
            <p class="hint" style="margin:8px 0 0;">버튼을 누르면 <strong>입찰 트랙 · 우대가격 · 비가격 예상 점수</strong>와 해당 원산지 터빈(기본 두산 DS205-10MW / Vestas V236)의 <strong>터빈 단가 · 이용률</strong>이 한 번에 적용됩니다. 같은 원산지 안에서 터빈을 바꾸려면 C. 발전매출의 "터빈"을 고르세요. 이후 개별 입력을 고치면 "사용자 조정"으로 표시됩니다.</p>
          </div>

`, false);

f.rep('<input id="projectName" type="text" value="태양광 50MW 입찰사업">', '<input id="projectName" type="text" value="해상풍력 100MW 입찰사업 (고정식)">');
f.rep('<input id="endYear" type="number" value="2047" step="1">', '<input id="endYear" type="number" value="2050" step="1">');
f.rep('<input id="constructionYears" type="number" value="1" step="1">', '<input id="constructionYears" type="number" value="3" step="1">');
f.rep('<input id="codDate" type="date" value="2027-07-01">', '<input id="codDate" type="date" value="2030-07-01">');

const turbineOptions = (origin) => TURBINES.filter((t) => t.origin === origin)
  .map((t) => `                    <option value="${t.id}"${t.id === "doosan10" ? " selected" : ""}>${esc(t.maker)} · ${esc(t.model)}</option>`).join("\n");
f.between(`<summary><span class="acc-badge">C</span>`, `<summary><span class="acc-badge">D</span>`, `<summary><span class="acc-badge">C</span><span class="acc-title">발전매출</span><span class="flag" id="salesFlag">고정가격계약</span><span class="acc-chev" aria-hidden="true" style="margin-left:auto;">▶</span></summary>
            <div class="acc-body">
              <p class="hint" style="margin-top:0;" id="salesHint"></p>
              <div class="field-grid">
                <div class="field"><label for="contractCapacityMW">설비용량</label><div class="iw"><input id="contractCapacityMW" type="number" value="100" step="1" min="0"><span class="unit">MW</span></div></div>
                <div class="field calc"><label for="bidPriceDisplay" id="bidPriceDisplayLabel">적정 수령단가</label><div class="iw"><input id="bidPriceDisplay" disabled><span class="unit">원/kWh</span></div></div>
                <div class="field span-2"><label for="turbineMaker">터빈</label><div class="iw"><select id="turbineMaker">
                  <optgroup label="국산">
${turbineOptions("domestic")}
                  </optgroup>
                  <optgroup label="외산">
${turbineOptions("foreign")}
                  </optgroup>
                </select></div></div>
                <div class="field calc"><label for="turbineCountDisplay">터빈 대수</label><div class="iw"><input id="turbineCountDisplay" disabled><span class="unit">기</span></div></div>
                <div class="field calc"><label for="turbineFactorDisplay">출력곡선 보정 × 가용률</label><div class="iw"><input id="turbineFactorDisplay" disabled></div></div>
                <div class="field"><label for="siteBaseRatePct">부지 총이용률 (기준 터빈)</label><div class="iw"><input id="siteBaseRatePct" type="number" value="40" step="0.1"><span class="unit">%</span></div></div>
                <div class="field"><label for="wakeLossPct">후류(웨이크) 손실</label><div class="iw"><input id="wakeLossPct" type="number" value="8" step="0.5" min="0" max="50"><span class="unit">%</span></div></div>
                <div class="field"><label for="electricalLossPct">전기·송전 손실</label><div class="iw"><input id="electricalLossPct" type="number" value="3" step="0.5" min="0" max="30"><span class="unit">%</span></div></div>
                <div class="field"><label for="curtailmentPct">출력제어·계통 제약</label><div class="iw"><input id="curtailmentPct" type="number" value="2" step="0.5" min="0" max="100"><span class="unit">발전량 %</span></div></div>
                <div class="field"><label for="year1RatePct">1년차 순이용률 (터빈 반영)</label><div class="iw"><input id="year1RatePct" type="number" value="34.38" step="0.01"><span class="unit">%</span></div></div>
                <div class="field"><label for="degradationPct">연간 성능저하</label><div class="iw"><input id="degradationPct" type="number" value="0.2" step="0.05"><span class="unit">%/년</span></div></div>
              </div>
              <div class="module-link">
                <span class="module-state" id="turbineLinkState">—</span>
                <button type="button" class="link-btn" id="applyTurbineBtn">터빈 값 다시 적용</button>
                <button type="button" class="link-btn" id="gotoTurbineTab">터빈 비교 보기 →</button>
              </div>
              <p class="hint" style="margin:2px 0 0;">터빈을 고르면 <strong>터빈 단가(D) · 1년차 순이용률 · 성능저하</strong>가 함께 바뀝니다. 1년차 순이용률 = 부지 총이용률 × 출력곡선 보정 × 가용률 × (1 − 후류 손실) × (1 − 전기 손실). 출력곡선 보정 = (기준 비출력 ÷ 터빈 비출력)<sup>지수</sup> — 같은 풍황이면 로터가 클수록(비출력이 낮을수록) 이용률이 높다는 근사입니다. 출력제어는 발전량 단계에서 따로 뺍니다.</p>
              <div class="subhead subhead-row">
                <span>운영연차별 순이용률 (직접 수정 가능)</span>
                <button id="applyRateBtn" type="button" class="btn btn-soft">1년차·성능저하 규칙 일괄 적용</button>
              </div>
              <p class="hint" style="margin:0 0 6px;">n년차 = 1년차 × (1 − 성능저하)<sup>n−1</sup>. 1년차·성능저하를 바꾸면 표 전체가 규칙대로 다시 채워지고, 칸은 따로 고칠 수 있습니다.</p>
              <div id="opRateGrid" class="field-grid" style="grid-template-columns:repeat(auto-fill,minmax(88px,1fr));margin-top:0;"></div>
              <div class="warn" role="status" id="opRateRangeWarn"></div>

              <div class="subhead">판매 조건</div>
              <div class="field-grid" style="margin-top:0;">
                <div class="field"><label for="salesStructure">판매 구조</label><div class="iw"><select id="salesStructure">
                  <option value="fixed" selected>풍력 고정가격계약 (경쟁입찰)</option>
                  <option value="ppa">기업PPA (직접전력거래)</option>
                </select></div></div>
                <div class="field" id="tenderTrackField"><label for="tenderTrack">입찰 트랙</label><div class="iw"><select id="tenderTrack">
                  <option value="public" selected>공공주도형</option>
                  <option value="general">일반형</option>
                </select></div></div>
                <div class="field" id="foundationField"><label for="foundationType">하부구조</label><div class="iw"><select id="foundationType">
                  <option value="fixed" selected>고정식 (상한 171.229)</option>
                  <option value="floating">부유식 (상한 175.100)</option>
                </select></div></div>
                <div class="field" id="priceCapField"><label for="priceCapPerKWh">입찰 상한가격 (SMP+1REC)</label><div class="iw"><input id="priceCapPerKWh" type="number" value="171.229" step="0.001"><span class="unit">원/kWh</span></div></div>
                <div class="field"><label for="contractYears" id="contractYearsLabel">고정가격 계약기간</label><div class="iw"><input id="contractYears" type="number" value="20" step="1" min="0" max="30"><span class="unit">년 (COD부터)</span></div></div>
                <div class="field" id="ppaEscalationField" style="display:none;"><label for="ppaEscalationPct">PPA 단가 상승률</label><div class="iw"><input id="ppaEscalationPct" type="number" value="0" step="0.1"><span class="unit">%/년</span></div></div>
              </div>
              <div class="warn" role="status" id="contractYearsWarn"></div>
              <p class="hint" id="salesTermHint"></p>

              <div id="recWeightWrap">
                <div class="subhead">REC 가중치 · 우대가격 (계약단가 환산)</div>
                <div class="field-grid" style="margin-top:0;">
                  <div class="field span-2"><label for="weightMode">가중치 산정</label><div class="iw"><select id="weightMode">
                    <option value="calc" selected>연계거리 · 수심으로 산정</option>
                    <option value="manual">직접 입력</option>
                    <option value="none">RPS 개편 — 가중치 없음 (1.0)</option>
                  </select></div></div>
                  <div class="field" id="connectDistanceField"><label for="connectDistanceKm">연계거리</label><div class="iw"><input id="connectDistanceKm" type="number" value="15" step="0.5" min="0"><span class="unit">km</span></div></div>
                  <div class="field" id="waterDepthField"><label for="waterDepthM">평균 수심</label><div class="iw"><input id="waterDepthM" type="number" value="25" step="1" min="0"><span class="unit">m</span></div></div>
                  <div class="field" id="weightManualField" style="display:none;"><label for="weightManual">가중치 (직접)</label><div class="iw"><input id="weightManual" type="number" value="2.9" step="0.1" min="0"></div></div>
                  <div class="field calc"><label for="recWeightDisplay">적용 REC 가중치</label><div class="iw"><input id="recWeightDisplay" disabled></div></div>
                  <div class="field"><label for="smpRefPrice">기준 SMP (공고)</label><div class="iw"><input id="smpRefPrice" type="number" value="86.35" step="0.01"><span class="unit">원/kWh</span></div></div>
                  <div class="field span-2" id="prefModeField"><label for="prefMode">공공주도형 우대가격</label><div class="iw"><select id="prefMode">
                    <option value="base" selected>기본 (공급망·안보 기여) 3.66원</option>
                    <option value="rnd">기본 + 정부 R&amp;D 실증 터빈 +27.84원</option>
                    <option value="none">없음</option>
                  </select></div></div>
                  <div class="field calc span-2"><label for="preferentialDisplay">적용 우대가격</label><div class="iw"><input id="preferentialDisplay" disabled><span class="unit">원/kWh</span></div></div>
                </div>
                <p class="hint">계약단가(수령단가) ≈ 기준 SMP + (입찰가격 − 기준 SMP) × REC 가중치 + 우대가격 — "SMP+1REC×가중치" 가격에 공공주도형 우대가격을 더하는 공고 방식의 근사입니다. 가중치: 연계거리·수심 각각 구간별(거리 ≤5 · ≤10 · ≤15 · 초과 km, 수심 ≤20 · ≤25 · ≤30 · 초과 m) 2.5 · 2.9 · 3.3 · 3.7을 받아 둘을 더하고 2.5를 뺍니다(2021년 가중치 고시 근사 — 경계·상한은 고시 확인). <strong>RPS 개편안이 시행되면 REC 가중치가 없어지고 정부 계약단가로 바뀌어</strong> 이 환산이 달라집니다. 공공주도형 요건: 공공기관·지방공기업 합동출자 50% 초과 또는 단독 34% 이상(정부 R&amp;D 실증 터빈 사용 시 20% · 10% 이상).</p>
              </div>

              <div class="subhead">계약 종료 후 (잔여 운영기간)</div>
              <div class="field-grid" style="margin-top:0;">
                <div class="field"><label for="smpPrice">SMP 전망</label><div class="iw"><input id="smpPrice" type="number" value="120" step="1"><span class="unit">원/kWh</span></div></div>
                <div class="field"><label for="recPrice">REC 단가</label><div class="iw"><input id="recPrice" type="number" value="0" step="1000"><span class="unit">원/REC</span></div></div>
                <div class="field"><label for="recWeight">REC 가중치</label><div class="iw"><input id="recWeight" type="number" value="1.0" step="0.1"><span class="unit">배</span></div></div>
              </div>
              <p class="hint">계약 종료 후 판매단가 = SMP + REC 단가 ÷ 1,000 × 가중치. RPS 개편으로 계약 종료 후 REC 판매가 불확실해 기본은 REC 0원(SMP만)입니다. 운영기간이 계약기간 이하면 쓰이지 않습니다.</p>

              <div class="subhead">연차별 발전량</div>
              <div class="table-wrap">
                <table class="gen-table">
                  <thead><tr><th>연차 · 연도</th><th>순이용률</th><th>발전량 (MWh)</th><th>판매</th></tr></thead>
                  <tbody id="supplyTableBody"></tbody>
                </table>
              </div>
            </div>
          </details>

          <details class="acc">
            `, false);

f.save("wind-1a");
