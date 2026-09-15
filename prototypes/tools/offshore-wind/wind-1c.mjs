// 해상풍력 1c — 선정평가 패널 · KCH 문구 · 확정 필요 항목 · 푸터
import { open, OUT } from "./wind-lib.mjs";
const f = open(OUT);

f.between(`      <!-- 가격환산 -->`, `      <!-- KCH 개발수수료 -->`, `      <!-- 선정평가 -->
      <div class="tabpanel" role="tabpanel" id="panel-price" aria-labelledby="tab-price" hidden>
        <section class="panel">
          <h2>선정평가 — 해상풍력 고정가격계약 경쟁입찰</h2>
          <div class="panel-body">
            <p class="callout-sm" id="priceTabNote"></p>

            <div class="subtotal strong"><span>1단계 사업내역서 (비가격 50점) — 예상 점수</span><span></span></div>
            <div class="table-wrap">
              <table class="module-table carbon-rule">
                <thead><tr><th class="mk-name">평가지표</th><th>배점 (<span id="trackLabel">공공주도형</span>)</th><th>예상 점수</th></tr></thead>
                <tbody>
                  <tr><th class="mk-name">안보<span class="sub">국가자원안보 · 정보보안 · 사이버·물리보안</span></th><td id="maxSecurity">—</td><td><input id="scoreSecurity" type="number" value="7" step="0.5" min="0" aria-label="안보 예상 점수"></td></tr>
                  <tr><th class="mk-name">산업·경제효과</th><td id="maxIndustry">—</td><td><input id="scoreIndustry" type="number" value="19" step="0.5" min="0" aria-label="산업·경제효과 예상 점수"></td></tr>
                  <tr><th class="mk-name">사업진행도</th><td id="maxProgress">—</td><td><input id="scoreProgress" type="number" value="2" step="0.5" min="0" aria-label="사업진행도 예상 점수"></td></tr>
                  <tr><th class="mk-name">기타<span class="sub">공급망 세부 · 주민수용성 · 계통 · 거점·유지보수 등</span></th><td id="maxOther">—</td><td><input id="scoreOther" type="number" value="13" step="0.5" min="0" aria-label="기타 비가격 예상 점수"></td></tr>
                </tbody>
              </table>
            </div>
            <div class="warn" role="status" id="nonPriceWarn"></div>
            <p class="hint">배점은 2025년 상반기 풍력 공고 보도 기준입니다 — 안보 공공주도형 8 · 일반형 6(국가자원안보 5 · 3, 정보보안 2, 사이버·물리보안 1), 산업·경제효과 22 · 26, 사업진행도 2 · 4. 공개 보도에서 확인하지 못한 나머지(공급망 세부 · 주민수용성 · 계통 · 거점·유지보수 등)는 50점에 맞춰 "기타"로 묶었습니다. 2026년 상반기 공고(2026-03-30)는 1단계 사업내역서 50점과 2단계 입찰가격 50점을 합산해 최종 선정합니다(1차 선정용량 기준 삭제). 예상 점수는 조합 버튼이 채우는 <strong>가정값</strong>입니다.</p>

            <div class="subtotal strong"><span>2단계 입찰가격 (50점)</span><span></span></div>
            <div class="calc-grid" style="margin-top:0;">
              <div class="field"><label for="bidPrice">우리 입찰가격 (SMP+1REC)</label><div class="iw"><input id="bidPrice" type="number" value="160" step="0.1"><span class="unit">원/kWh</span></div></div>
              <div class="field calc"><label for="priceCapDisplay">상한가격 (C. 판매 조건)</label><div class="iw"><input id="priceCapDisplay" disabled><span class="unit">원/kWh</span></div></div>
              <div class="field"><label for="priceCap">입찰가격 배점</label><div class="iw"><input id="priceCap" type="number" value="50" step="1"><span class="unit">점</span></div></div>
              <div class="field calc"><label for="weightUsedDisplay">적용 REC 가중치</label><div class="iw"><input id="weightUsedDisplay" disabled></div></div>
            </div>
            <div class="calc-grid">
              <div class="field calc"><label for="bidPriceBaseDisplay">적정 수령단가 (산정 결과)</label><div class="iw"><input id="bidPriceBaseDisplay" disabled><span class="unit">원/kWh</span></div></div>
              <div class="field calc"><label for="prefDeductDisplay">우대가격 (차감)</label><div class="iw"><input id="prefDeductDisplay" disabled><span class="unit">원/kWh</span></div></div>
              <div class="field calc"><label for="kchFeeEquivalentDisplay">KCH 수수료 환산 반영분</label><div class="iw"><input id="kchFeeEquivalentDisplay" disabled><span class="unit">원/kWh</span></div></div>
            </div>
            <div class="warn" role="status" id="priceCapWarn"></div>
            <p class="callout-sm" style="margin:12px 0 4px;"><strong>입찰가격 기본값 = 기준 SMP + (적정 수령단가 + KCH 수수료 환산분 − 우대가격 − 기준 SMP) ÷ REC 가중치. </strong>계약단가(수령단가)에는 가중치를 곱한 REC 몫과 우대가격이 붙어 들어오므로, SMP+1REC 기준으로 써내는 입찰가격은 그만큼 낮습니다. KCH 개발수수료 생애주기 누적 총 수취액을 이 프로젝트의 생애주기 총 발전량으로 나눈 값을 수령단가에 얹어 환산합니다(SPC 자체의 P-IRR·NPV·당사이익 결과에는 영향 없음). 값을 직접 입력하면 연동이 끊기고 수동 모드로 전환됩니다 (<button id="relinkBtn" type="button" class="link-btn">다시 연동</button>).</p>

            <div class="subtotal strong"><span>선정평가 점수 (100점 만점)</span><span></span></div>
            <table class="kv">
              <tbody>
                <tr><th>비가격 점수 (1단계) <span class="sub">= 안보 + 산업·경제효과 + 사업진행도 + 기타</span></th><td id="outNonPrice">—</td></tr>
                <tr><th>입찰가격 점수 (2단계) <span class="sub">= (상한가격 − 입찰가격) ÷ 상한가격 × 배점 — 태양광 공고 산식을 준용한 가정</span></th><td id="outScore">—</td></tr>
                <tr class="strong"><th>합계</th><td id="outTotal">—</td></tr>
              </tbody>
            </table>
            <div class="subtotal strong"><span>입찰가격 · 가중치 · 우대가격의 점수 환산</span><span></span></div>
            <table class="kv">
              <tbody>
                <tr><th>입찰가격 1원/kWh 인하 <span class="sub">= 배점 ÷ 상한가격</span></th><td id="outPerWon">—</td></tr>
                <tr><th>입찰가격 점수 1점 올리려면 <span class="sub">= 상한가격 ÷ 배점</span></th><td id="outPerPoint">—</td></tr>
                <tr><th>수령단가 1원/kWh 절감 <span class="sub" id="outWeightSub">= 입찰가격 1 ÷ 가중치 원 인하</span></th><td id="outWeightValue">—</td></tr>
                <tr class="strong"><th>정부 R&amp;D 실증 터빈 우대 27.84원 <span class="sub" id="outRndSub">= 입찰가격 인하폭 → 점수</span></th><td id="outRndValue">—</td></tr>
              </tbody>
            </table>

            <div class="subtotal strong"><span>점수 변동별 목표 입찰가격</span><span></span></div>
            <div class="table-wrap">
              <table class="compact">
                <thead><tr><th>Δ점</th><th>목표 입찰가격 점수</th><th>목표 입찰가격</th><th>가격 변동</th><th>비고</th></tr></thead>
                <tbody id="sensBody"></tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      `, false);

f.rep("태양광 프로젝트 자체의 발전매출과는 별개로", "해상풍력 프로젝트 자체의 발전매출과는 별개로");
f.rep(`<input id="kchCapacityMW" disabled value="50">`, `<input id="kchCapacityMW" disabled value="100">`);

// 터빈 비교 탭에도 todo-list가 있어, 확정 필요 항목 목록은 첫 항목까지 포함해 유일하게 찾는다.
f.between(`<ul class="todo-list">
              <li><strong>초안 범위</strong>`, `</ul>`, `<ul class="todo-list">
              <li><strong>초안 범위</strong> — ESS·태양광 적정 입찰가격 프로토타입의 재무 엔진(총투자비 반복수렴·원리금균등·누진세+이월결손금·DSCR 게이트 배당·KCH 개발수수료)을 그대로 쓰고 <strong>발전매출·터빈·CAPEX·OPEX·선정평가만 해상풍력으로 바꾼 1차 초안</strong>. 해상 시공·기상 리스크, 해저케이블 고장, 대체계약, 해체·원상복구 충당금, 해역 점사용료 체계는 미반영</li>
              <li>C. 발전매출 — <strong>계약단가</strong>: "SMP+1REC×가중치" 가격에 공공주도형 우대가격을 더하는 공고 방식을 기준 SMP + (입찰가격 − 기준 SMP) × 가중치 + 우대가격으로 근사. 수익고정형 계약의 실제 SMP·REC 정산 방식 확인 필요</li>
              <li>C. 발전매출 — <strong>REC 가중치</strong>: 연계거리·수심 복합가중치(각 2.5 · 2.9 · 3.3 · 3.7, 합산 − 2.5)는 2021년 고시 근사로 경계·상한 확인 필요. RPS 개편안(2026-05 상임위 의결)이 시행되면 REC 가중치가 폐지되고 정부 계약시장으로 바뀌어 환산식이 달라짐 — "가중치 없음(1.0)"으로 민감도 확인 권장</li>
              <li>입찰 기준 — 2026년 상반기 풍력 공고(2026-03-30): 고정식 상한 171.229 · 부유식 175.100원/kWh, 기준 SMP 86.35원/kWh, 물량 공공주도형 400 · 일반 고정식 1,000 · 부유식 400MW, 1단계 사업내역서 50점 + 2단계 입찰가격 50점 합산. <strong>비가격 세부 배점은 2025년 상반기 보도 기준이고 가격 점수 산식은 태양광 공고 산식 준용 가정</strong> — 2026년 공고문 원문 확인 필요</li>
              <li>공공주도형 — 우대가격 기본(공급망·안보 기여) 3,660원/MWh, 정부 R&amp;D 실증 터빈 추가 27,840원/MWh(2025년 상반기 공고), 지분 요건 공공 합동 50% 초과 · 단독 34% 이상(R&amp;D 실증 터빈 20% · 10%). KCH 지분 구조로 요건을 충족하는지와 2026년 우대가격 확인 필요</li>
              <li><strong>터빈 비교</strong> — 정격·로터는 제조사 사양·보도, 터빈 단가(억원/MW) · 가용률 · 외산 국산화율은 예시값, 출력곡선 보정((320 ÷ 비출력)<sup>0.25</sup>)은 근사. 풍황 계측·터빈별 출력곡선·후류 해석으로 교체 필요. 유니슨 U210은 형식인증 전(실증 중)</li>
              <li>이용률·손실 — 부지 총이용률 40% · 후류 손실 8% · 전기 손실 3% · 출력제어 2% · 성능저하 0.2%/년은 예시값. 국내 실측 참고: 한림(두산 5.56MW) 27~29%, 전남1(SGRE 9.6MW급) 30~38%</li>
              <li>D·E. CAPEX·OPEX — 100MW 고정식 예시(EPC 72억원/MW = 터빈 24 + BOP 48, 항목별 합계 7,200억, 간접비 500억, 예비비 5%, O&amp;M 연 150억 · 보험 0.4% → 총사업비 MW당 약 93억). 보도 기준 총사업비 MW당 약 70~90억 — 실제 견적·해역 조건으로 교체 필요</li>
              <li>F. 재무 프리셋 — DSCR 임계치·할인율·법인세 누진구간·감가상각 20년·선순위 15년은 ESS 참고자료 기준을 옮긴 초안. 해상풍력 PF(장기 선순위·공사기간 3년 이자·예비 한도) 조건으로 재확인 필요</li>
              <li>반영하지 않은 구조적 차이 — 목표 DSCR 기반 부채 사이징(사이즈컬핑)·원금불균등 상환 미반영. 선순위 금리 고정·변동(CD 91일물) 혼합은 연 단위 근사, CD금리는 직접 입력</li>
              <li>KCH 개발수수료 — 4개 수수료 기준총액·할인율은 ESS 예시값 그대로(설비용량만 연동). 100MW 해상풍력 규모에 맞게 교체 필요</li>
              <li>단가산정 목표 — 해상풍력 초안은 기본 산정 기준을 <strong>목표 P-IRR 6%</strong>로 둠(ESS의 "당사 이익 100억원"은 총사업비 9천억원대 사업에서 수익률이 지나치게 낮게 역산됨). 목표 수익률·당사 지분 20%는 KCH 내부 기준 확인 필요</li>
              <li>엑셀(.xlsx) 회신 변환기(<code>ESS_엑셀변환.bat</code>)는 ESS 전용 — 해상풍력 시나리오 JSON은 변환할 수 없음(CSV로 확인)</li>
            </ul>`);

f.between(`<footer>`, `</footer>`, `<footer>
    <p>사업개요·발전매출·CAPEX·OPEX·금융세무 입력값으로 목표 당사 이익(또는 목표 IRR)을 만족하는 해상풍력 적정 수령단가를 역산하고, REC 가중치·우대가격으로 입찰가격(SMP+1REC)을 환산합니다.</p>
    <p>ESS·태양광 적정 입찰가격 프로토타입과 같은 재무 엔진·화면 구성으로 만든 <strong>해상풍력 1차 초안</strong>입니다. 터빈 단가·이용률·CAPEX·OPEX는 예시값이며 확정이 필요합니다.</p>
    <p>참고: <code>PRD_사업성분석_프로토타입.md</code> · 2026년 상반기 풍력 고정가격계약 경쟁입찰 공고(2026-03-30) · 작성 서신준(인프라사업2 본부)</p>
  </footer>`);

f.save("wind-1c");
