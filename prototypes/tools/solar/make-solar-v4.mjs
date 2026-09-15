// 태양광 초안 v4 — 사별 탄소검증 제품(에너지공단 검증 목록) → 등급·배점·우대가격, 모듈 혼용 규정,
// 공고 기준값(구간·배점·우대가격) 편집·회차 프리셋, 선정평가 산식을 공단 설명회(2026-05-26) 평가기준으로 교정.
// v3 백업(solar-v3-backup.html)에서 읽어 본 파일로 쓴다(재실행 가능).
import { readFileSync, writeFileSync } from "node:fs";
const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
let s = readFileSync(`${SP}/solar-v3-backup.html`, "utf8");
const count = (hay, needle) => hay.split(needle).length - 1;
function rep(from, to, n = 1) {
  const c = count(s, from);
  if (c !== n) throw new Error(`rep: expected ${n}, found ${c}: ${from.slice(0, 90)}`);
  s = s.split(from).join(to);
}
function between(start, end, to) {
  if (count(s, start) !== 1) throw new Error(`between: start not unique (${count(s, start)}): ${start.slice(0, 90)}`);
  const a = s.indexOf(start), b = s.indexOf(end, a);
  if (b < 0) throw new Error(`between: end not found: ${end.slice(0, 90)}`);
  s = s.slice(0, a) + to + s.slice(b + end.length);
}
function reRep(re, to, n) {
  const m = s.match(re);
  if (!m || m.length !== n) throw new Error(`reRep: expected ${n}, found ${m ? m.length : 0}: ${re}`);
  s = s.replace(re, to);
}
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ── 사별 탄소검증 제품 (한국에너지공단 태양광 모듈 탄소검증 제품 정보, 공공데이터포털 15085909, 2026-06-10 수정) ──
// 인증 만료 전(2026-09-14 기준) 제품만. 등급 분포는 2026년 구간(630/655/710)으로 다시 분류한 건수.
const MAKERS = [
  { id: "hanwha", origin: "domestic", name: "한화큐셀", registered: "한화솔루션(주) · 음성·진천", dist: "10 · 81 · 123 · 54 (268건)",
    products: [["q-peak-g10", "Q.PEAK DUO XL-G10.7/BFG KR1 495 (음성) · 611.89", 611.89], ["q-tron-min", "Q.TRON 계열 국내 검증 최저 · 648.47", 648.47], ["q-tron-med", "Q.TRON 계열 검증 중앙값 · 658.70", 658.7], ["all-med", "유효 인증 전체 중앙값 · 663.80", 663.8]], def: "q-peak-g10" },
  { id: "hyundai", origin: "domestic", name: "HD현대에너지솔루션", registered: "에이치디현대에너지솔루션(주) · 음성", dist: "17 · 40 · 37 · 40 (134건)",
    products: [["his-s490", "HiS-S490YJ-ON (음성) · 548.76", 548.76], ["all-med", "유효 인증 전체 중앙값 · 664.50", 664.5]], def: "his-s490" },
  { id: "shinsung", origin: "domestic", name: "신성이엔지", registered: "(주)신성이엔지 · 김제", dist: "0 · 1 · 18 · 4 (23건)",
    products: [["ss-cm610", "SS-CM610TE (김제) · 649.10", 649.1], ["ss-dm550bl", "SS-DM550BL (김제) · 665.79", 665.79], ["all-med", "유효 인증 전체 중앙값 · 681.10", 681.1]], def: "ss-cm610" },
  { id: "hansol", origin: "domestic", name: "한솔테크닉스", registered: "한솔에너지온 · 오창", dist: "19 · 23 · 57 · 60 (159건)",
    products: [["hs505-ghd30", "HS505WE-GHD30 (오창) · 560.18", 560.18], ["all-med", "유효 인증 전체 중앙값 · 669.00", 669]], def: "hs505-ghd30" },
  { id: "jinko", origin: "china", name: "진코솔라", registered: "국내 검증 등록 없음", dist: "검증 제품 0건", products: [], def: "none" },
  { id: "trina", origin: "china", name: "트리나솔라", registered: "국내 검증 등록 없음", dist: "검증 제품 0건", products: [], def: "none" },
  { id: "ja", origin: "china", name: "자솔라", registered: "국내 검증 등록 없음", dist: "검증 제품 0건", products: [], def: "none" },
];
const defCo2 = (m) => (m.products.find(([v]) => v === m.def)?.[2] ?? "");

// ── CSS ───────────────────────────────────────────────────────
rep(`  .mk-origin { display: inline-block;`, `  .module-table select.mk-product { width: 270px; text-align: left; }
  table.module-table.carbon-rule { min-width: 0; }
  .carbon-rule td { white-space: nowrap; }
  .module-table.carbon-rule th.mk-name { min-width: 56px; }
  .module-table.carbon-rule input { width: 64px; }
  .mk-origin { display: inline-block;`);

// ── 모듈사 비교 탭 — 스펙 표에서 등급 열 제거(등급은 검증 배출량에서 파생) ──
rep(`<th>연간 열화<br>(%/년)</th><th>탄소 등급</th></tr></thead>`, `<th>연간 열화<br>(%/년)</th></tr></thead>`);
reRep(/\n\s*<td><select id="mk-\w+-grade"[^\n]*<\/select><\/td>/g, "", 7);

// ── 모듈사 비교 탭 — 사별 탄소검증 제품 표 ────────────────────
const carbonRowsHtml = MAKERS.map((m) => {
  const opts = [...m.products.map(([v, l]) => [v, l]), ["none", m.origin === "china" ? "국내 탄소검증 등록 제품 없음 (미검증)" : "미검증 제품 사용"], ["custom", "직접 입력"]]
    .map(([v, l]) => `<option value="${v}"${v === m.def ? " selected" : ""}>${esc(l)}</option>`).join("");
  return `                  <tr data-mk-row="${m.id}">
                    <th class="mk-name"><span class="mk-origin ${m.origin}">${m.origin === "domestic" ? "국산" : "중국산"}</span>${esc(m.name)}<span class="sub">${esc(m.registered)}</span></th>
                    <td style="text-align:left;"><select id="mk-${m.id}-product" class="mk-product" aria-label="${esc(m.name)} 탄소검증 제품">${opts}</select></td>
                    <td><input id="mk-${m.id}-co2" type="number" value="${defCo2(m)}" step="0.01" min="0" placeholder="미검증" aria-label="${esc(m.name)} 탄소배출량"></td>
                    <td id="mk-${m.id}-cgrade">—</td>
                    <td id="mk-${m.id}-cscore">—</td>
                    <td id="mk-${m.id}-cprem">—</td>
                    <td>${esc(m.dist)}</td>
                  </tr>`;
}).join("\n");
rep(`"선택"을 누르면 그 모듈사가 C·D 입력에 적용됩니다.</p>`,
  `"선택"을 누르면 그 모듈사가 C·D 입력에 적용됩니다.</p>

            <div class="subtotal strong"><span>사별 탄소검증 제품 · 등급 · 우대가격</span><span></span></div>
            <div class="table-wrap">
              <table class="module-table">
                <thead><tr><th class="mk-name">모듈사 · 검증 등록명</th><th style="text-align:left;">탄소검증 제품 (에너지공단 검증 목록)</th><th>탄소배출량<br>(kg·CO2/kW)</th><th>등급</th><th>배점</th><th>우대가격</th><th>유효 인증 등급 분포<br>1 · 2 · 3 · 4등급</th></tr></thead>
                <tbody id="moduleCarbonBody">
${carbonRowsHtml}
                </tbody>
              </table>
            </div>
            <p class="hint"><strong>같은 회사라도 공장·셀 원산지·제품별로 검증 배출량이 달라 등급이 갈립니다.</strong> 제품 목록은 한국에너지공단 「태양광 모듈 탄소검증 제품 정보」(공공데이터포털, 2026-06-10 수정, 전체 1,832건 중 인증 만료 전 제품)에서 사별 대표값을 뽑은 것이고, 등급 분포는 2026년 구간(630 · 655 · 710)으로 다시 분류한 건수입니다. 기본값은 사별 최저 배출량 제품입니다. 위 성능 스펙은 대표 모델 데이터시트라 실제 납품 모델의 검증 배출량과 같은 제품인지 맞춰 봐야 합니다 — 예) 한화 Q.TRON 계열의 국내 검증 최저값은 648.47(2등급)이고 1등급 제품은 Q.PEAK DUO XL-G10 계열, HD현대 1등급 제품은 HiS-S…YJ-ON 계열(HiN-T는 검증 목록에 없음), 신성이엔지는 1등급 제품이 없습니다. 진코·트리나·자솔라는 국내 탄소검증 등록 제품이 없어 미검증(1점 · 우대 없음)입니다.</p>`);

// ── C. 발전매출 — 혼용 모듈사 · 적용 탄소배출량 ───────────────
const secOptions = MAKERS.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join("");
rep(`                </select></div></div>
                <div class="field"><label for="siteBaseRatePct">부지 기준 이용률</label>`,
  `                </select></div></div>
                <div class="field"><label for="secondaryMaker">혼용 모듈사 (선택)</label><div class="iw"><select id="secondaryMaker"><option value="" selected>혼용 없음</option>${secOptions}</select></div></div>
                <div class="field calc"><label for="carbonAppliedDisplay">적용 탄소배출량 → 등급</label><div class="iw"><input id="carbonAppliedDisplay" disabled></div></div>
                <div class="field"><label for="siteBaseRatePct">부지 기준 이용률</label>`);
rep(`이 함께 바뀝니다. 1년차 이용률 = `,
  `이 함께 바뀝니다. 탄소 등급은 "모듈사 비교" 탭에서 고른 <strong>탄소검증 제품의 배출량</strong>으로 정해지고, 두 모듈사를 섞어 쓰면 공고 규정대로 <strong>용량 가중평균이 아니라 배출량이 많은 제품</strong> 기준입니다(성능·단가는 주 모듈사 기준). 1년차 이용률 = `);
rep(`<label for="carbonGrade">탄소배출량 검증 등급</label>`, `<label for="carbonGrade">적용 탄소 등급</label>`);

// ── 선정평가 탭 — 공고 기준값 · 산식 교정 · 비계량 ────────────
between(`<h2>선정평가 점수 — 태양광 고정가격계약 경쟁입찰 (신규설비)</h2>`, `<tbody id="sensBody"></tbody>
              </table>
            </div>`,
  `<h2>선정평가 — 태양광 고정가격계약 경쟁입찰 (신규설비)</h2>
          <div class="panel-body">
            <p class="callout-sm" id="priceTabNote"></p>

            <div class="subtotal strong"><span>공고 기준값 — 탄소배출량 구간 · 배점 · 우대가격</span><span></span></div>
            <div class="calc-grid" style="margin-top:0;">
              <div class="field"><label for="tenderPreset">공고 회차</label><div class="iw"><select id="tenderPreset">
                <option value="2026h1" selected>2026년 상반기 공고 (1등급 16원 · 2등급 7원)</option>
                <option value="2025h1">2025년 상반기 공고 (1등급 12원 · 2등급 9원)</option>
                <option value="custom">직접 입력</option>
              </select></div></div>
            </div>
            <div class="table-wrap">
              <table class="module-table carbon-rule">
                <thead><tr><th class="mk-name">등급</th><th>탄소배출량 구간<br>(kg·CO2/kW)</th><th>배점<br>(점)</th><th>우대가격<br>(원/kWh)</th></tr></thead>
                <tbody>
                  <tr><th class="mk-name">1등급</th><td>이하 <input id="carbonT1" type="number" value="630" step="1" aria-label="1등급 배출량 상한"></td><td><input id="carbonS1" type="number" value="20" step="1" aria-label="1등급 배점"></td><td><input id="carbonP1" type="number" value="16" step="0.5" aria-label="1등급 우대가격"></td></tr>
                  <tr><th class="mk-name">2등급</th><td>이하 <input id="carbonT2" type="number" value="655" step="1" aria-label="2등급 배출량 상한"></td><td><input id="carbonS2" type="number" value="15" step="1" aria-label="2등급 배점"></td><td><input id="carbonP2" type="number" value="7" step="0.5" aria-label="2등급 우대가격"></td></tr>
                  <tr><th class="mk-name">3등급</th><td>이하 <input id="carbonT3" type="number" value="710" step="1" aria-label="3등급 배출량 상한"></td><td><input id="carbonS3" type="number" value="5" step="1" aria-label="3등급 배점"></td><td><input id="carbonP3" type="number" value="0" step="0.5" aria-label="3등급 우대가격"></td></tr>
                  <tr><th class="mk-name">4등급</th><td>초과 또는 미검증</td><td><input id="carbonS4" type="number" value="1" step="1" aria-label="4등급 배점"></td><td><input id="carbonP4" type="number" value="0" step="0.5" aria-label="4등급 우대가격"></td></tr>
                </tbody>
              </table>
            </div>
            <p class="hint">구간·배점: 한국에너지공단 「2026년 상반기 태양광 고정가격계약 경쟁입찰 종합설명회」(2026-05-26) 평가기준(안). 우대가격 16 · 7원은 7월 입찰공고 발표값(보도), 2025년 상반기 12 · 9원은 "1등급 4원 인상 · 2등급 2원 인하" 보도에서 역산한 값입니다. <strong>2026년부터 '24년 12월 31일 이전 제조 모듈에 옛 구간(670 · 730)과 옛 우대가격을 적용하던 기준이 삭제되어, 제조 시점과 관계없이 모든 탄소검증 모듈에 해당 회차 우대가격이 일괄 적용</strong>됩니다. 2종 이상 모듈을 혼용하면 배출량이 많은 제품 기준으로 배점합니다. 미준공 사업은 검증인정서 또는 납품의향서(배출량 구간 기재 필수)로 평가하고, 실제 설치 모듈이 다르면 선정 취소 사유입니다(효율·배출량 동등 이상 제품으로 승인받은 경우 제외).</p>

            <div class="subtotal strong"><span>입찰가격</span><span></span></div>
            <div class="calc-grid" style="margin-top:0;">
              <div class="field"><label for="bidPrice">우리 입찰가격</label><div class="iw"><input id="bidPrice" type="number" value="140" step="0.1"><span class="unit">원/kWh</span></div></div>
              <div class="field calc"><label for="priceCapDisplay">상한가격 (C. 판매 조건)</label><div class="iw"><input id="priceCapDisplay" disabled><span class="unit">원/kWh</span></div></div>
              <div class="field"><label for="priceCap">입찰가격 배점</label><div class="iw"><input id="priceCap" type="number" value="70" step="1"><span class="unit">점</span></div></div>
              <div class="field calc"><label for="carbonScoreDisplay">탄소배출 점수</label><div class="iw"><input id="carbonScoreDisplay" disabled><span class="unit">점 / 20</span></div></div>
            </div>
            <div class="calc-grid">
              <div class="field calc"><label for="bidPriceBaseDisplay">적정 수령단가 (산정 결과)</label><div class="iw"><input id="bidPriceBaseDisplay" disabled><span class="unit">원/kWh</span></div></div>
              <div class="field calc"><label for="carbonPremiumDisplay">탄소 우대가격 (차감)</label><div class="iw"><input id="carbonPremiumDisplay" disabled><span class="unit">원/kWh</span></div></div>
              <div class="field calc"><label for="kchFeeEquivalentDisplay">KCH 수수료 환산 반영분</label><div class="iw"><input id="kchFeeEquivalentDisplay" disabled><span class="unit">원/kWh</span></div></div>
            </div>
            <div class="warn" role="status" id="priceCapWarn"></div>
            <p class="callout-sm" style="margin:12px 0 4px;"><strong>입찰가격 기본값 = 적정 수령단가 − 탄소 우대가격 + KCH 개발수수료 원/kWh 환산값. </strong>최종 고정가격에 우대가격이 더해져 들어오므로 우리가 써내는 입찰가격은 그만큼 낮게 쓸 수 있습니다. KCH 개발수수료 생애주기 누적 총 수취액을 이 프로젝트의 생애주기 총 발전량으로 나눈 값입니다(KCH 수수료를 걷으려면 입찰단가에 그만큼을 더 얹어야 한다는 기계적 환산 — SPC 자체의 P-IRR·NPV·당사이익 결과에는 영향 없음). 값을 직접 입력하면 연동이 끊기고 수동 모드로 전환됩니다 (<button id="relinkBtn" type="button" class="link-btn">다시 연동</button>).</p>

            <div class="subtotal strong"><span>비계량 — 사업내역서 (10점)</span><span></span></div>
            <div class="calc-grid" style="margin-top:0;">
              <div class="field"><label for="devProgress">개발 진행도</label><div class="iw"><select id="devProgress">
                <option value="2">사용전검사 확인증 (2점)</option>
                <option value="1">개발행위·공사계획신고필증 (1점)</option>
                <option value="0" selected>발전사업 허가증 (0점)</option>
              </select></div></div>
              <div class="field"><label for="insuranceScore">보험 가입</label><div class="iw"><select id="insuranceScore">
                <option value="2">종합보험·종합공제 증서 (2점)</option>
                <option value="1">화재·CMI보험 증서 (1점)</option>
                <option value="0" selected>미가입 (0점)</option>
              </select></div></div>
              <div class="field"><label for="communityScore">농축산·주민참여</label><div class="iw"><select id="communityScore">
                <option value="3">농·축산·어업인 보유 / 주민참여형 (3점)</option>
                <option value="0" selected>그 외 (0점)</option>
              </select></div></div>
              <div class="field"><label for="operatingMonths">발전소 가동기간</label><div class="iw"><input id="operatingMonths" type="number" value="0" step="1" min="0"><span class="unit">개월</span></div></div>
            </div>
            <p class="hint">설비 가동기간 점수 = (60 − 가동기간) ÷ 60 × 3 (설비확인서 최초 발급월부터, 60개월 초과는 60개월). 신규 건설 사업은 0개월이라 3점. 기본값은 입찰 시점에 허가증만 있고 보험 증서가 없는 신규 개발 사업을 가정했습니다(비계량 3점) — 실제 서류 단계에 맞게 고르세요.</p>

            <div class="subtotal strong"><span>선정평가 점수 (100점 만점)</span><span></span></div>
            <table class="kv">
              <tbody>
                <tr><th>입찰가격 점수 <span class="sub">= (상한가격 − 입찰가격) ÷ 상한가격 × 배점, 소수 둘째자리</span></th><td id="outScore">—</td></tr>
                <tr><th>탄소배출 점수 <span class="sub" id="outCarbonSub">= 적용 탄소배출량 구간별 배점</span></th><td id="outCarbon">—</td></tr>
                <tr><th>비계량 점수 <span class="sub">= 개발 진행도 + 보험 + 농축산·주민참여 + 가동기간</span></th><td id="outNonQuant">—</td></tr>
                <tr class="strong"><th>합계</th><td id="outTotal">—</td></tr>
              </tbody>
            </table>
            <div class="subtotal strong"><span>입찰가격 · 탄소 등급의 점수 환산</span><span></span></div>
            <table class="kv">
              <tbody>
                <tr><th>입찰가격 1원/kWh 인하 <span class="sub">= 배점 ÷ 상한가격</span></th><td id="outPerWon">—</td></tr>
                <tr><th>입찰가격 점수 1점 올리려면 <span class="sub">= 상한가격 ÷ 배점</span></th><td id="outPerPoint">—</td></tr>
                <tr class="strong"><th>탄소 1등급이 2등급보다 유리한 폭 <span class="sub" id="outGradeGapSub">= 배점 차를 입찰가 인하폭으로 환산 + 우대가격 차</span></th><td id="outGradeGap">—</td></tr>
              </tbody>
            </table>

            <div class="subtotal strong"><span>점수 변동별 목표 입찰가격</span><span></span></div>
            <div class="table-wrap">
              <table class="compact">
                <thead><tr><th>Δ점</th><th>목표 입찰가격 점수</th><th>목표 입찰가격</th><th>가격 변동</th><th>비고</th></tr></thead>
                <tbody id="sensBody"></tbody>
              </table>
            </div>`);

// ── 확정 필요 항목 ────────────────────────────────────────────
rep(`              <li>선정평가 탭 — <strong>2026년 1차 태양광 고정가격계약 경쟁입찰(신규설비)</strong> 기준으로 입찰가격 70점 + 탄소배출 20점 + 사업준비도 10점, 탄소 우대가격 1등급 16,000원/MWh·2등급 7,000원/MWh(입찰가격에 합산), 상한가격 육지 147,686원/MWh를 반영함. <strong>최저입찰가격 135원/kWh·사업준비도 10점은 예시 가정</strong>이고 배점·상한가·우대가격은 회차마다 바뀌므로 응찰 전 해당 회차 공고로 반드시 다시 확인 필요</li>`,
  `              <li>선정평가 탭 — 한국에너지공단 2026년 상반기 종합설명회(2026-05-26) <strong>평가기준(안)</strong> 기준: 입찰가격 점수 = (상한가격 − 입찰가격) ÷ 상한가격 × 70, 탄소배출 20 · 15 · 5 · 1점(630 · 655 · 710kg·CO2/kW), 비계량 10점(개발 진행도 2 · 보험 2 · 농축산·주민참여 3 · 가동기간 3). 우대가격 1등급 16 · 2등급 7원/kWh는 입찰공고 보도값, 상한가격 육지 147.686원/kWh. 비계량 기본값(허가증 0 · 보험 미가입 0 · 그 외 0 · 가동 0개월 3점)은 가정이고, 설명회 자료가 "안"이므로 <strong>응찰 전 해당 회차 공고문 원문으로 다시 확인</strong> 필요</li>
              <li><strong>사별 탄소검증 제품</strong> — 에너지공단 탄소검증 제품 목록(2026-06-10) 기준 사별 최저 배출량 제품을 기본값으로 둠(한화 611.89 · HD현대 548.76 · 한솔 560.18 → 1등급, 신성 649.10 → 2등급, 중국 3사 미검증). 실제 납품 모델·공장·인증 만료일과 성능 스펙 모델이 같은지 확인 필요. 혼용 시 "배출량이 많은 제품 기준"은 공고의 배점 규정이며, 같은 규정을 우대가격에도 적용한 것은 가정</li>`);
rep('전체 12개 항목 상세 보기', '전체 13개 항목 상세 보기');

// ═══════════════════ 스크립트(계산) ═══════════════════
const productsJs = JSON.stringify(Object.fromEntries(MAKERS.map((m) => [m.id, [...m.products.map(([v, , co2]) => ({ v, co2 })), { v: "none", co2: 0 }]])));
between(`  const CARBON_GRADES = {`, `  };`,
  `  // 공고 기준값(구간·배점·우대가격)은 "선정평가" 탭 표의 입력 칸(HTML value = 2026년 상반기)에서 읽는다 — 회차마다 바꿔 넣을 수 있게.
  function carbonGradeTable() {
    const g = (id) => +$(id).value || 0;
    return { '1': { score: g('carbonS1'), premium: g('carbonP1') }, '2': { score: g('carbonS2'), premium: g('carbonP2') },
      '3': { score: g('carbonS3'), premium: g('carbonP3') }, '4': { score: g('carbonS4'), premium: g('carbonP4') } };
  }
  // 검증 탄소배출량(kg·CO2/kW) → 등급. 값이 없으면(미검증) 4등급. 경계값은 "이하"라 아래 등급에 포함된다.
  function gradeOfCo2(v) {
    if (!(v > 0)) return '4';
    return v <= (+$('carbonT1').value || 0) ? '1' : v <= (+$('carbonT2').value || 0) ? '2' : v <= (+$('carbonT3').value || 0) ? '3' : '4';
  }
  // 공고 회차 프리셋 — 구간·배점은 2025년 개정 이후 동일, 우대가격만 회차별로 다르다.
  const TENDER_PRESETS = {
    '2026h1': { carbonT1: 630, carbonT2: 655, carbonT3: 710, carbonS1: 20, carbonS2: 15, carbonS3: 5, carbonS4: 1, carbonP1: 16, carbonP2: 7, carbonP3: 0, carbonP4: 0 },
    '2025h1': { carbonT1: 630, carbonT2: 655, carbonT3: 710, carbonS1: 20, carbonS2: 15, carbonS3: 5, carbonS4: 1, carbonP1: 12, carbonP2: 9, carbonP3: 0, carbonP4: 0 },
  };
  // 사별 탄소검증 제품 프리셋(값 = 검증 배출량, none = 미검증) — 선택 목록 문구는 비교 탭 HTML에 있다.
  const CARBON_PRODUCTS = ${productsJs};`);
rep(`(CARBON_GRADES[$('carbonGrade').value]?.premium || 0)`, `(carbonGradeTable()[$('carbonGrade').value]?.premium || 0)`);
rep(`(CARBON_GRADES[grade]?.premium || 0)`, `(carbonGradeTable()[grade]?.premium || 0)`);

// makerSpec / moduleDerived — 등급을 검증 배출량에서, 혼용이면 배출량이 많은 쪽에서
rep(`    return { price: g('price'), gamma: g('gamma'), bif: g('bif'), deg1: g('deg1'), degA: g('degA'), grade: $(\`mk-\${id}-grade\`).value };`,
  `    const co2 = g('co2') || 0;
    return { price: g('price'), gamma: g('gamma'), bif: g('bif'), deg1: g('deg1'), degA: g('degA'), co2, co2Applied: co2, grade: gradeOfCo2(co2), mixed: '' };`);
rep(`  function moduleDerived(id) {
    const sp = makerSpec(id);`,
  `  function moduleDerived(id, withSecondary = false) {
    const sp = makerSpec(id);
    // 모듈 혼용 — 공고: 2종 이상 혼용 시 "탄소배출량이 많은 제품" 기준으로 배점(용량 가중평균이 아님). 미검증이 섞이면 미검증.
    const sec = withSecondary ? $('secondaryMaker').value : '';
    if (sec && sec !== id) {
      const b = +$(\`mk-\${sec}-co2\`).value || 0;
      sp.co2Applied = sp.co2 > 0 && b > 0 ? Math.max(sp.co2, b) : 0;
      sp.grade = gradeOfCo2(sp.co2Applied);
      sp.mixed = MAKER_BY_ID[sec].name;
    }`);
rep(`    const d = moduleDerived($('moduleMaker').value), near = (a, b) => Math.abs(a - b) < 1e-6;`,
  `    const d = moduleDerived($('moduleMaker').value, true), near = (a, b) => Math.abs(a - b) < 1e-6;`);
rep(`    const d = moduleDerived($('moduleMaker').value);
    $('capexInputMode').value = 'unitprice';`,
  `    const d = moduleDerived($('moduleMaker').value, true);
    $('capexInputMode').value = 'unitprice';`);
rep(`    const id = $('moduleMaker').value, d = moduleDerived(id);
    moduleLinked = moduleLinkActive();`,
  `    const id = $('moduleMaker').value, d = moduleDerived(id, true), table = carbonGradeTable();
    moduleLinked = moduleLinkActive();
    $('carbonAppliedDisplay').value = \`\${d.co2Applied > 0 ? fmt(d.co2Applied, 2) : '미검증'} → \${d.grade}등급\${d.mixed ? \` (\${d.mixed} 혼용)\` : ''}\`;
    const wonTxt = (v) => (v ? \`+\${fmt(v, v % 1 ? 1 : 0)}원\` : '없음');
    Array.from($('carbonGrade').options).forEach((o) => { o.textContent = \`\${o.value}등급 · 우대 \${wonTxt(table[o.value]?.premium || 0)}\`; });
    // 사별 탄소검증 표 — 등급·배점·우대가격, 배출량을 직접 고쳐 프리셋과 달라지면 "직접 입력"으로 표시
    MODULE_MAKERS.forEach((mk) => {
      const co2 = +$(\`mk-\${mk.id}-co2\`).value || 0, g = gradeOfCo2(co2), sel = $(\`mk-\${mk.id}-product\`);
      const preset = (CARBON_PRODUCTS[mk.id] || []).find((p) => p.v === sel.value);
      if (sel.value !== 'custom' && (!preset || Math.abs(preset.co2 - co2) > 1e-6)) sel.value = 'custom';
      $(\`mk-\${mk.id}-cgrade\`).textContent = co2 > 0 ? \`\${g}등급\` : '미검증 (4등급)';
      $(\`mk-\${mk.id}-cscore\`).textContent = \`\${fmt(table[g].score, 0)}점\`;
      $(\`mk-\${mk.id}-cprem\`).textContent = wonTxt(table[g].premium);
    });`);

// 공고 회차 표시 동기화 + recalcAllCore 진입
rep(`    syncSalesStructure(); syncModuleState(); syncComboState(); // 입력이 바뀔 때마다 라벨·경고·모듈사·조합 표시를 현재 값에 맞춘다`,
  `    syncTenderPreset(); syncSalesStructure(); syncModuleState(); syncComboState(); // 입력이 바뀔 때마다 공고 회차·라벨·경고·모듈사·조합 표시를 현재 값에 맞춘다`);

// ── 선정평가 점수 — 공고 산식 ────────────────────────────────
between(`  function recalcPriceScore() {`, `        <td style="text-align:left;color:var(--ink-faint);font-size:11px;">\${r.note}</td>
      </tr>\`).join('');
  }`,
  `  // 공고 회차 선택 칸 — 지금 기준값이 어느 회차 프리셋과 같은지 표시(아니면 "직접 입력")
  function syncTenderPreset() {
    const on = Object.keys(TENDER_PRESETS).find((k) => Object.entries(TENDER_PRESETS[k]).every(([f, v]) => +$(f).value === v));
    $('tenderPreset').value = on || 'custom';
  }

  function recalcPriceScore() {
    const bid = +$('bidPrice').value, pts = +$('priceCap').value, capPrice = +$('priceCapPerKWh').value || 0;
    const isFixed = $('salesStructure').value === 'fixed';
    const table = carbonGradeTable(), gradeKey = $('carbonGrade').value, grade = table[gradeKey] || { score: 0, premium: 0 };
    const carbonScore = isFixed ? grade.score : 0;
    const months = Math.min(60, Math.max(0, +$('operatingMonths').value || 0));
    const nonQuant = (+$('devProgress').value || 0) + (+$('insuranceScore').value || 0) + (+$('communityScore').value || 0) + (60 - months) / 60 * 3;
    $('priceCapDisplay').value = fmt(capPrice, 3);
    $('carbonScoreDisplay').value = isFixed ? fmt(carbonScore, 0) : '0 (PPA)';
    const d = moduleDerived($('moduleMaker').value, true);
    $('outCarbonSub').textContent = moduleLinked
      ? \`= \${gradeKey}등급 배점 (적용 배출량 \${d.co2Applied > 0 ? fmt(d.co2Applied, 2) : '미검증'} · \${MAKER_BY_ID[$('moduleMaker').value].name}\${d.mixed ? \` + \${d.mixed} 혼용\` : ''})\`
      : \`= \${gradeKey}등급 배점 (C. 판매 조건에서 직접 고른 등급)\`;
    $('priceTabNote').innerHTML = isFixed
      ? '<strong>공단 설명회(2026-05-26) 평가기준 — 계량 90점(입찰가격 70 + 탄소배출 20) + 비계량 10점. </strong>입찰가격 점수는 최저가 대비가 아니라 <strong>상한가격 대비 인하율</strong>로 매깁니다. 최종 고정가격 = 입찰가격 + 탄소 우대가격이라, 우대가격을 받는 만큼 입찰가격을 낮게 써서 가격 점수를 더 받습니다. 구간·배점·우대가격은 아래 표에서 회차별로 바꿀 수 있습니다.'
      : '<strong>지금 조합은 기업PPA라 경쟁입찰 선정평가가 적용되지 않습니다. </strong>아래는 같은 사업을 고정가격계약으로 응찰한다고 가정했을 때의 참고 계산입니다(탄소 우대가격·탄소 점수는 0으로 둡니다).';
    // 상한가격 경고 — 써낼 입찰가격이 공고 상한을 넘으면 응찰 자체가 불가능하다.
    const warnEl = $('priceCapWarn');
    if (isFixed && capPrice > 0 && Number.isFinite(bid) && bid > capPrice) {
      warnEl.className = 'warn show';
      // 연동 상태면 입찰가격에 KCH 개발수수료 환산분이 얹혀 있다 — SPC 자체는 상한 안인데 수수료 때문에 넘는지 구분해 알려준다.
      const kchAdd = parseFloat(String($('kchFeeEquivalentDisplay').value).replace(/[,+]/g, '')) || 0, spcBid = bid - kchAdd;
      warnEl.textContent = linked && kchAdd > 0 && spcBid <= capPrice
        ? \`입찰가격 \${fmt(bid, 2)}원/kWh가 상한가격 \${fmt(capPrice, 3)}원/kWh를 \${fmt(bid - capPrice, 2)}원 초과합니다 — SPC 자체(\${fmt(spcBid, 2)}원)로는 \${fmt(capPrice - spcBid, 2)}원 여유가 있지만, KCH 개발수수료 환산분 \${fmt(kchAdd, 2)}원을 모두 얹으면 넘습니다. 수수료 규모를 줄이거나 일부만 입찰가에 반영하는 방안을 검토하세요.\`
        : \`입찰가격 \${fmt(bid, 2)}원/kWh가 상한가격 \${fmt(capPrice, 3)}원/kWh를 \${fmt(bid - capPrice, 2)}원 초과합니다 — 이 조건으로는 응찰할 수 없습니다(EPC·이용률·목표 수익 재검토 필요).\`;
    } else warnEl.className = 'warn';
    if (!(capPrice > 0) || !Number.isFinite(bid) || !(pts > 0)) {
      ['outScore', 'outCarbon', 'outNonQuant', 'outTotal', 'outPerWon', 'outPerPoint', 'outGradeGap'].forEach((id) => { $(id).textContent = '—'; });
      $('sensBody').innerHTML = '';
      return;
    }
    // 공고 산식: [(상한가격 − 입찰가격) ÷ 상한가격] × 배점, 소수점 셋째자리 반올림. 상한 초과는 응찰 불가라 0점 처리.
    const priceScore = Math.round(Math.max(0, (capPrice - bid) / capPrice * pts) * 100) / 100;
    $('outScore').textContent = fmt(priceScore, 2) + ' 점';
    $('outCarbon').textContent = fmt(carbonScore, 0) + ' 점';
    $('outNonQuant').textContent = fmt(nonQuant, 2) + ' 점';
    $('outTotal').textContent = fmt(priceScore + carbonScore + nonQuant, 2) + ' 점';
    const perPoint = capPrice / pts;
    $('outPerWon').textContent = \`+\${fmt(pts / capPrice, 3)} 점\`;
    $('outPerPoint').textContent = \`\${fmt(perPoint, 2)} 원/kWh 인하\`;
    // 1등급 ↔ 2등급: 배점 차만큼 입찰가격을 덜 깎아도 같은 총점 + 최종 고정가격에 붙는 우대가격 차
    const gapScore = (table['1'].score - table['2'].score) * perPoint, gapPremium = table['1'].premium - table['2'].premium;
    // 값 칸은 줄바꿈이 안 돼 좁은 화면에서 표를 밀어내므로 합계만 두고, 내역은 줄바꿈되는 설명 줄로 보낸다.
    $('outGradeGap').textContent = \`\${fmt(gapScore + gapPremium, 2)} 원/kWh\`;
    $('outGradeGapSub').textContent = \`= 배점 차 \${fmt(table['1'].score - table['2'].score, 0)}점 × \${fmt(perPoint, 2)}원 = \${fmt(gapScore, 2)}원 + 우대가격 차 \${fmt(gapPremium, 1)}원\`;
    const rows = [];
    for (let dp = 5; dp >= -5; dp--) {
      const target = priceScore + dp, ok = target >= 0 && target <= pts;
      const targetPrice = ok ? capPrice * (1 - target / pts) : NaN;
      const note = dp === 0 ? '현재 입찰가격' : dp > 0 ? '점수 상승 → 가격 인하 필요' : '점수 하락 → 가격 인상 시 발생';
      rows.push({ dp, target, ok, targetPrice, delta: targetPrice - bid, note });
    }
    $('sensBody').innerHTML = rows.map((r) => \`
      <tr class="\${r.dp === 0 ? 'current-row' : ''}">
        <td>\${r.dp > 0 ? '+' + r.dp : r.dp}</td><td>\${fmt(r.target, 2)}</td>
        <td>\${r.ok ? fmt(r.targetPrice, 2) : '—'}</td>
        <td>\${r.ok ? (r.dp === 0 ? '0.00' : (r.delta >= 0 ? '+' : '') + fmt(r.delta, 2)) : '—'}</td>
        <td style="text-align:left;color:var(--ink-faint);font-size:11px;">\${r.note}</td>
      </tr>\`).join('');
  }`);

// ── 리스너 ────────────────────────────────────────────────────
rep(`  ['minPrice','priceCap','readinessScore'].forEach((id) => $(id).addEventListener('input', recalcPriceScore));`,
  `  ['priceCap', 'devProgress', 'insuranceScore', 'communityScore', 'operatingMonths'].forEach((id) => $(id).addEventListener('input', recalcPriceScore));`);
rep(`el.id === 'minPrice' || el.id === 'priceCap' || el.id === 'readinessScore' ||`,
  `el.id === 'priceCap' || ['devProgress', 'insuranceScore', 'communityScore', 'operatingMonths'].includes(el.id) ||`);
rep(`  // 모듈사 선택 → 모듈 단가·탄소 등급·1년차 이용률·열화율을 C·D 입력에 주입(공통 recalcAll 리스너보다 먼저 등록해 주입값으로 재계산)`,
  `  // 공고 회차 선택 → 구간·배점·우대가격 칸을 채운다(모듈사 재주입·공통 recalcAll 리스너보다 먼저 등록)
  $('tenderPreset').addEventListener('input', () => {
    const p = TENDER_PRESETS[$('tenderPreset').value];
    if (p) Object.entries(p).forEach(([f, v]) => { $(f).value = String(v); });
  });
  // 탄소검증 제품 선택 → 그 제품의 검증 배출량을 칸에 채운다(직접 입력이면 그대로)
  MODULE_MAKERS.forEach((mk) => $(\`mk-\${mk.id}-product\`).addEventListener('input', () => {
    const p = (CARBON_PRODUCTS[mk.id] || []).find((x) => x.v === $(\`mk-\${mk.id}-product\`).value);
    if (p) $(\`mk-\${mk.id}-co2\`).value = p.co2 > 0 ? String(p.co2) : '';
  }));
  // 모듈사 선택 → 모듈 단가·탄소 등급·1년차 이용률·열화율을 C·D 입력에 주입(공통 recalcAll 리스너보다 먼저 등록해 주입값으로 재계산)`);
rep(`  const MODULE_UPSTREAM_IDS = ['siteBaseRatePct', 'bosUnitPrice', 'refTempCoef', 'refBifaciality', 'refFirstYearDeg', 'tempDeltaC', 'rearGainPct'];`,
  `  const MODULE_UPSTREAM_IDS = ['siteBaseRatePct', 'bosUnitPrice', 'refTempCoef', 'refBifaciality', 'refFirstYearDeg', 'tempDeltaC', 'rearGainPct', 'secondaryMaker', 'tenderPreset',
    'carbonT1', 'carbonT2', 'carbonT3', 'carbonS1', 'carbonS2', 'carbonS3', 'carbonS4', 'carbonP1', 'carbonP2', 'carbonP3', 'carbonP4'];`);

// ── 시나리오 비교에 탄소 등급 ────────────────────────────────
rep(`moduleMaker: MAKER_BY_ID[$('moduleMaker').value]?.name || '',`, `moduleMaker: MAKER_BY_ID[$('moduleMaker').value]?.name || '',
      carbonGrade: \`\${$('carbonGrade').value}등급 (우대 \${fmt(carbonGradeTable()[$('carbonGrade').value]?.premium || 0, 0)}원)\`,`);
rep(`    ['모듈사', (s) => s.kpi.moduleMaker || '—'],`, `    ['모듈사', (s) => s.kpi.moduleMaker || '—'],
    ['탄소 등급', (s) => s.kpi.carbonGrade || '—'],`);
rep(`const SCENARIO_ASSUMPTION_LABELS = ['산정 기준', '설비용량(MW)', '모듈사', 'CAPEX 합계', 'OPEX 합계'];`, `const SCENARIO_ASSUMPTION_LABELS = ['산정 기준', '설비용량(MW)', '모듈사', '탄소 등급', 'CAPEX 합계', 'OPEX 합계'];`);

writeFileSync(`${SP}/solar-bid-price-prototype.html`, s, "utf8");
console.log("v4 done:", s.split("\n").length, "lines");
