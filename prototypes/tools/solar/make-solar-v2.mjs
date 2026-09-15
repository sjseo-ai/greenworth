// 태양광 초안 v2 — 계약기간 30년까지, EPC 일괄계약 단가, 사업 구성 2개 조합(국산+고정가격계약 / 중국산+PPA).
// v1 백업에서 읽어 본 파일로 쓴다(재실행 가능). 교체는 기대한 횟수만큼 맞을 때만 적용하고 아니면 멈춘다.
import { readFileSync, writeFileSync } from "node:fs";
const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
let s = readFileSync(`${SP}/solar-v1-backup.html`, "utf8");
const count = (hay, needle) => hay.split(needle).length - 1;
function rep(from, to, n = 1) {
  const c = count(s, from);
  if (c !== n) throw new Error(`rep: expected ${n}, found ${c}: ${from.slice(0, 90)}`);
  s = s.split(from).join(to);
}

// ── 헤더 ──────────────────────────────────────────────────────
rep('<span class="brand-sub">KCH그룹 · 초안 · 태양광 고정가격계약</span>', '<span class="brand-sub">KCH그룹 · 초안 · 고정가격계약 / 기업PPA 2개 조합</span>');

// ── CSS ───────────────────────────────────────────────────────
rep(`  .flag { font-size: 11px;`, `  .combo-card { border: 1px solid var(--line); border-radius: var(--radius); padding: 10px; margin-bottom: 12px; background: var(--panel-alt); }
  .combo-head { display: flex; align-items: baseline; gap: 8px; font-size: 13px; font-weight: 700; margin-bottom: 8px; }
  .combo-head .combo-now { margin-left: auto; font-size: 11.5px; font-weight: 500; color: var(--muted); text-align: right; }
  .combo-btns { display: grid; gap: 6px; }
  .combo-btn { display: block; width: 100%; text-align: left; min-height: 44px; padding: 8px 10px; border: 1px solid var(--line-strong); border-radius: 8px; background: var(--panel); color: var(--ink); cursor: pointer; }
  .combo-btn .cb-t { display: block; font-size: 13px; font-weight: 600; }
  .combo-btn .cb-s { display: block; font-size: 11.5px; color: var(--muted); margin-top: 2px; line-height: 1.45; }
  .combo-btn.is-on { border-color: var(--accent); background: var(--accent-soft); }
  .combo-btn.is-on .cb-t { color: var(--accent); }
  .hero-note { margin-top: 8px; font-size: 12.5px; color: var(--ink-2); line-height: 1.55; }
  .hero-note strong { color: var(--ink); }
  .hero-note.bad, .hero-note.bad strong { color: var(--danger); }
  .flag { font-size: 11px;`);

// ── 사업 구성 조합 카드 ───────────────────────────────────────
rep(`        <div class="panel-body" id="form">
`, `        <div class="panel-body" id="form">
          <div class="combo-card">
            <div class="combo-head"><span>사업 구성 조합</span><span class="combo-now" id="comboActive">—</span></div>
            <div class="combo-btns">
              <button type="button" class="combo-btn" data-combo="domestic">
                <span class="cb-t">① 국산 기자재 + 고정가격계약</span>
                <span class="cb-s">EPC 1,150원/W · 탄소 1등급(우대 +16원/kWh) · 계약 20년 · 상한가 147.686원/kWh</span>
              </button>
              <button type="button" class="combo-btn" data-combo="china">
                <span class="cb-t">② 중국산 기자재 + 기업PPA</span>
                <span class="cb-s">EPC 950원/W · 탄소 우대 없음 · 계약기간 자유(20~30년) · 상한가 없음</span>
              </button>
            </div>
            <p class="hint" style="margin:8px 0 0;">버튼을 누르면 <strong>EPC 단가 · 판매 구조 · 탄소 등급 · 계약기간</strong>이 한 번에 바뀝니다. 이후 개별 입력을 고치면 "사용자 조정"으로 표시되고, 다시 누르면 조합 값으로 돌아갑니다. EPC 단가·탄소 등급 차이는 <strong>예시값</strong>이니 실제 견적·모듈 스펙으로 바꿔 주세요.</p>
          </div>
`);

// ── C. 발전매출 — 판매 조건 ───────────────────────────────────
rep('<span class="flag">고정가격계약</span>', '<span class="flag" id="salesFlag">고정가격계약</span>');
rep(`              <p class="hint" style="margin-top:0;">태양광 <strong>고정가격계약 경쟁입찰</strong>을 가정합니다 — 입찰가격은 <strong>SMP + REC를 합친 고정 단가(원/kWh)</strong>로 계약기간 동안 적용되고, 계약이 끝난 뒤 남은 운영기간은 SMP + REC × 가중치 시장가로 팝니다. 발전량 = 설비용량 × 8,760h × 연차별 이용률 × (1 − 출력제어·손실률).</p>`,
  `              <p class="hint" style="margin-top:0;" id="salesHint"></p>`);
rep('<div class="field calc"><label for="bidPriceDisplay">적정 입찰가격</label>', '<div class="field calc"><label for="bidPriceDisplay" id="bidPriceDisplayLabel">적정 수령단가</label>');
rep(`              <div class="subhead">판매 조건</div>
              <div class="field-grid" style="margin-top:0;">
                <div class="field"><label for="contractYears">고정가격 계약기간</label><div class="iw"><input id="contractYears" type="number" value="20" step="1" min="0"><span class="unit">년 (COD부터)</span></div></div>
                <div class="field"><label for="smpPrice">계약 종료 후 SMP 전망</label><div class="iw"><input id="smpPrice" type="number" value="120" step="1"><span class="unit">원/kWh</span></div></div>
                <div class="field"><label for="recPrice">REC 단가</label><div class="iw"><input id="recPrice" type="number" value="70000" step="1000"><span class="unit">원/REC</span></div></div>
                <div class="field"><label for="recWeight">REC 가중치</label><div class="iw"><input id="recWeight" type="number" value="1.0" step="0.1"><span class="unit">배</span></div></div>
              </div>
              <p class="hint">계약 종료 후 판매단가 = SMP + REC 단가 ÷ 1,000 × 가중치(1 REC = 1MWh). 운영기간이 계약기간 이하면 쓰이지 않습니다. SMP·REC 단가·가중치는 예시값 — 부지 유형·최신 시장가로 바꿔 주세요.</p>`,
  `              <div class="subhead">판매 조건</div>
              <div class="field-grid one" style="margin-top:0;">
                <div class="field"><label for="salesStructure">판매 구조</label><div class="iw"><select id="salesStructure">
                  <option value="fixed" selected>고정가격계약 (경쟁입찰 · SMP+REC 합산)</option>
                  <option value="ppa">기업PPA (직접전력거래 · 전력+REC 합산)</option>
                </select></div></div>
              </div>
              <div class="field-grid">
                <div class="field"><label for="contractYears" id="contractYearsLabel">고정가격 계약기간</label><div class="iw"><input id="contractYears" type="number" value="20" step="1" min="0" max="30"><span class="unit">년 (COD부터)</span></div></div>
                <div class="field" id="carbonGradeField"><label for="carbonGrade">탄소배출량 검증 등급</label><div class="iw"><select id="carbonGrade">
                  <option value="1" selected>1등급 · 우대 +16원</option>
                  <option value="2">2등급 · 우대 +7원</option>
                  <option value="3">3등급 · 우대 없음</option>
                  <option value="4">4등급·미검증 · 없음</option>
                </select></div></div>
                <div class="field" id="priceCapField"><label for="priceCapPerKWh">입찰 상한가격</label><div class="iw"><input id="priceCapPerKWh" type="number" value="147.686" step="0.001"><span class="unit">원/kWh</span></div></div>
                <div class="field" id="ppaEscalationField" style="display:none;"><label for="ppaEscalationPct">PPA 단가 상승률</label><div class="iw"><input id="ppaEscalationPct" type="number" value="0" step="0.1"><span class="unit">%/년</span></div></div>
              </div>
              <div class="warn" role="status" id="contractYearsWarn"></div>
              <p class="hint" id="salesTermHint"></p>

              <div class="subhead">계약 종료 후 (잔여 운영기간)</div>
              <div class="field-grid" style="margin-top:0;">
                <div class="field"><label for="smpPrice">SMP 전망</label><div class="iw"><input id="smpPrice" type="number" value="120" step="1"><span class="unit">원/kWh</span></div></div>
                <div class="field"><label for="recPrice">REC 단가</label><div class="iw"><input id="recPrice" type="number" value="70000" step="1000"><span class="unit">원/REC</span></div></div>
                <div class="field"><label for="recWeight">REC 가중치</label><div class="iw"><input id="recWeight" type="number" value="1.0" step="0.1"><span class="unit">배</span></div></div>
              </div>
              <p class="hint">계약 종료 후 판매단가 = SMP + REC 단가 ÷ 1,000 × 가중치(1 REC = 1MWh). 운영기간이 계약기간 이하면 쓰이지 않습니다. SMP·REC 단가·가중치는 예시값 — 부지 유형·최신 시장가로 바꿔 주세요.</p>`);

// ── D. CAPEX — EPC 단가(일괄계약) 모드 ────────────────────────
rep(`                  <option value="itemized">항목별 입력 (7개)</option>
                  <option value="lumpsum">EPC 총액 직접 입력</option>`,
  `                  <option value="itemized">항목별 입력 (7개)</option>
                  <option value="unitprice" selected>EPC 단가 × 설비용량 (일괄계약)</option>
                  <option value="lumpsum">EPC 총액 직접 입력 (일괄계약)</option>`);
rep(`              <div id="capexLumpSumWrap" class="field-grid one" style="display:none;">
                <div class="field"><label for="capexLumpSum">EPC 총액 (수기 입력)</label><div class="iw"><input id="capexLumpSum" type="number" value="545" step="1"><span class="unit">억원</span></div></div>
                <p class="hint" style="margin:0;">① 공사비만 이 값으로 대체합니다 — ② 개발·간접비와 ③ 부대비용은 그대로 더해집니다.</p>
              </div>`,
  `              <div id="capexUnitPriceWrap">
                <div class="field-grid">
                  <div class="field"><label for="epcUnitPrice">EPC 단가 (일괄계약)</label><div class="iw"><input id="epcUnitPrice" type="number" value="1150" step="10"><span class="unit">원/W</span></div></div>
                  <div class="field calc"><label for="epcUnitPriceTotal">= ① 공사비</label><div class="iw"><input id="epcUnitPriceTotal" disabled><span class="unit">억원</span></div></div>
                </div>
                <p class="hint" style="margin:0;">① 공사비 = EPC 단가(원/W) × 설비용량(MW) ÷ 100. 설비용량을 바꾸면 공사비가 따라 움직입니다. 국산 모듈 1,150원/W · 중국산 950원/W는 <strong>예시값</strong>입니다.</p>
              </div>
              <div id="capexLumpSumWrap" class="field-grid one" style="display:none;">
                <div class="field"><label for="capexLumpSum">EPC 총액 (수기 입력)</label><div class="iw"><input id="capexLumpSum" type="number" value="545" step="1"><span class="unit">억원</span></div></div>
                <p class="hint" style="margin:0;">① 공사비만 이 값으로 대체합니다 — ② 개발·간접비와 ③ 부대비용은 그대로 더해집니다.</p>
              </div>`);

// ── 히어로 ────────────────────────────────────────────────────
rep(`          <div class="k hero-label">적정 입찰가격 <span style="font-weight:500;color:var(--muted);">(SMP+REC 합산 고정가)</span></div>`,
  `          <div class="k hero-label" id="heroLabel">적정 수령단가 <span style="font-weight:500;color:var(--muted);" id="heroLabelSub">(SMP+REC 합산 고정가)</span></div>`);
rep(`          <div class="status-pill" id="solveStatus">계산 중</div>`,
  `          <div class="status-pill" id="solveStatus">계산 중</div>
          <div class="hero-note" id="heroBidNote"></div>`);
rep('<p class="cap">입찰가격 범위 — 최저는 P-IRR 6%·당사 이익 100억(운영기간 누적) 동시충족 최소 가격, 최고는 A. 산정 기준으로 구한 현재 적정 입찰가격</p>',
  '<p class="cap">수령단가 범위 — 최저는 P-IRR 6%·당사 이익 100억(운영기간 누적) 동시충족 최소 단가, 최고는 A. 산정 기준으로 구한 현재 적정 수령단가</p>');

// ── 안내(모델링 한계) ─────────────────────────────────────────
rep('<li>가격환산 탭은 ESS 공고의 가격평가 산식을 <strong>준용한 초안</strong> — 태양광 경쟁입찰 평가 산식 확인 필요</li>',
  '<li>선정평가 탭은 <strong>2026년 1차 공고(신규설비)</strong> 기준 — 회차마다 배점·상한가·우대가격이 바뀌므로 최신 공고 확인 필요</li>');

// ── 선정평가 탭 ───────────────────────────────────────────────
rep('<h2>가격평가점수 — ESS 공고 산식 준용 (초안)</h2>', '<h2>선정평가 점수 — 태양광 고정가격계약 경쟁입찰 (신규설비)</h2>');
rep(`            <p class="callout-sm"><strong>초안 — 태양광 경쟁입찰 공고의 가격평가 산식·배점으로 바꿔야 합니다. </strong>지금은 ESS 공고 제2025-05호의 "최저입찰가격 ÷ 입찰가격 × 가격배점" 산식과 예시 최저가를 그대로 씁니다. 입찰가격은 적정 입찰가격 결과로 자동 채워지며 직접 바꿔볼 수도 있습니다.</p>
            <div class="calc-grid" style="margin-top:0;">
              <div class="field"><label for="minPrice">최저입찰가격</label><div class="iw"><input id="minPrice" type="number" value="140" step="0.1"><span class="unit">원/kWh</span></div></div>
              <div class="field"><label for="bidPrice">입찰가격 (평가대상)</label><div class="iw"><input id="bidPrice" type="number" value="150" step="0.1"><span class="unit">원/kWh</span></div></div>
              <div class="field"><label for="priceCap">가격배점 (만점)</label><div class="iw"><input id="priceCap" type="number" value="50" step="1"><span class="unit">점</span></div></div>
            </div>
            <div class="calc-grid">
              <div class="field calc"><label for="bidPriceBaseDisplay">단가산정 적정 입찰단가 (원값)</label><div class="iw"><input id="bidPriceBaseDisplay" disabled><span class="unit">원/kWh</span></div></div>
              <div class="field calc"><label for="kchFeeEquivalentDisplay">KCH 수수료 원/kWh 환산 반영분</label><div class="iw"><input id="kchFeeEquivalentDisplay" disabled><span class="unit">원/kWh</span></div></div>
            </div>`,
  `            <p class="callout-sm" id="priceTabNote"></p>
            <div class="calc-grid" style="margin-top:0;">
              <div class="field"><label for="minPrice">최저입찰가격 (예시)</label><div class="iw"><input id="minPrice" type="number" value="135" step="0.1"><span class="unit">원/kWh</span></div></div>
              <div class="field"><label for="bidPrice">우리 입찰가격</label><div class="iw"><input id="bidPrice" type="number" value="140" step="0.1"><span class="unit">원/kWh</span></div></div>
              <div class="field"><label for="priceCap">입찰가격 배점</label><div class="iw"><input id="priceCap" type="number" value="70" step="1"><span class="unit">점</span></div></div>
              <div class="field"><label for="readinessScore">사업준비도</label><div class="iw"><input id="readinessScore" type="number" value="10" step="0.5" min="0" max="10"><span class="unit">점 / 10</span></div></div>
            </div>
            <div class="calc-grid">
              <div class="field calc"><label for="bidPriceBaseDisplay">적정 수령단가 (산정 결과)</label><div class="iw"><input id="bidPriceBaseDisplay" disabled><span class="unit">원/kWh</span></div></div>
              <div class="field calc"><label for="carbonPremiumDisplay">탄소 우대가격 (차감)</label><div class="iw"><input id="carbonPremiumDisplay" disabled><span class="unit">원/kWh</span></div></div>
              <div class="field calc"><label for="kchFeeEquivalentDisplay">KCH 수수료 환산 반영분</label><div class="iw"><input id="kchFeeEquivalentDisplay" disabled><span class="unit">원/kWh</span></div></div>
              <div class="field calc"><label for="carbonScoreDisplay">탄소배출 점수</label><div class="iw"><input id="carbonScoreDisplay" disabled><span class="unit">점 / 20</span></div></div>
            </div>
            <div class="warn" role="status" id="priceCapWarn"></div>`);
rep(`            <p class="callout-sm" style="margin:12px 0 4px;"><strong>입찰가격 기본값 = 적정 입찰단가 + KCH 개발수수료 원/kWh 환산값. </strong>`,
  `            <p class="callout-sm" style="margin:12px 0 4px;"><strong>입찰가격 기본값 = 적정 수령단가 − 탄소 우대가격 + KCH 개발수수료 원/kWh 환산값. </strong>최종 고정가격에 우대가격이 더해져 들어오므로 우리가 써내는 입찰가격은 그만큼 낮게 쓸 수 있습니다. `);
rep(`            <div class="subtotal strong"><span>점수와 한계 가격</span><span></span></div>
            <table class="kv">
              <tbody>
                <tr class="strong"><th>가격평가점수 <span class="sub">= 최저입찰가격 ÷ 입찰가격 × 가격배점</span></th><td id="outScore">—</td></tr>`,
  `            <div class="subtotal strong"><span>선정평가 점수 (100점 만점)</span><span></span></div>
            <table class="kv">
              <tbody>
                <tr><th>입찰가격 점수 <span class="sub">= 최저입찰가격 ÷ 입찰가격 × 배점</span></th><td id="outScore">—</td></tr>
                <tr><th>탄소배출 점수 <span class="sub">= 검증 등급별 배점 (1등급 20 · 2등급 15 · 3등급 5 · 4등급 1)</span></th><td id="outCarbon">—</td></tr>
                <tr><th>사업준비도 점수</th><td id="outReadiness">—</td></tr>
                <tr class="strong"><th>합계</th><td id="outTotal">—</td></tr>
              </tbody>
            </table>
            <div class="subtotal strong"><span>입찰가격 1점의 가치</span><span></span></div>
            <table class="kv">
              <tbody>`);

// ── 확정 필요 항목 ────────────────────────────────────────────
rep(`              <li>C. 발전매출 — <strong>판매 구조</strong>: 한국에너지공단 고정가격계약 경쟁입찰(SMP+REC 합산 고정가, 계약기간 20년)을 가정. 실제 공고의 계약기간·상한가격·REC 가중치(부지 유형별)·계약 종료 후 판매 방식 확인 필요. 계약 종료 후 SMP 120원/kWh·REC 70,000원/REC·가중치 1.0은 예시값</li>`,
  `              <li>C. 발전매출 — <strong>판매 구조 2개 조합</strong>: ① 국산 기자재 + 고정가격계약(경쟁입찰), ② 중국산 기자재 + 기업PPA. 조합별 EPC 단가(1,150 / 950원/W)와 탄소 등급은 <strong>예시값</strong>이니 실제 견적·모듈 탄소배출량 성적서로 교체 필요. 기업PPA는 상대방·계약조건(단가 상승률·REC 포함 여부·중도해지)이 사업마다 달라 단가 하나로만 단순화함. 계약 종료 후 SMP 120원/kWh·REC 70,000원/REC·가중치 1.0도 예시값</li>
              <li>C. 발전매출 — <strong>계약기간</strong>: 고정가격계약은 제도상 20년이며, 30년까지 입력할 수 있게 열어 둔 것은 기업PPA·장기계약 검토용. 30년으로 늘릴 때는 B. 사업개요의 운영기간·종료연도와 감가상각 20년·선순위 15년도 함께 재검토 필요</li>`);
rep(`              <li>가격환산 탭 — ESS 공고 제2025-05호의 가격평가 산식(최저입찰가격 ÷ 입찰가격 × 배점)과 예시 최저가 140원/kWh를 그대로 준용함. 태양광 경쟁입찰의 가격·비가격 평가 산식과 배점으로 교체 필요</li>`,
  `              <li>선정평가 탭 — <strong>2026년 1차 태양광 고정가격계약 경쟁입찰(신규설비)</strong> 기준으로 입찰가격 70점 + 탄소배출 20점 + 사업준비도 10점, 탄소 우대가격 1등급 16,000원/MWh·2등급 7,000원/MWh(입찰가격에 합산), 상한가격 육지 147,686원/MWh를 반영함. <strong>최저입찰가격 135원/kWh·사업준비도 10점은 예시 가정</strong>이고 배점·상한가·우대가격은 회차마다 바뀌므로 응찰 전 해당 회차 공고로 반드시 다시 확인 필요</li>`);

// ── 탭 이름 · 안내 링크 ───────────────────────────────────────
rep('aria-selected="false">가격환산</button>', 'aria-selected="false">선정평가</button>');
rep('"가격환산" 탭', '"선정평가" 탭');
rep('전체 10개 항목 상세 보기', '전체 11개 항목 상세 보기');

writeFileSync(`${SP}/solar-bid-price-prototype.html`, s, "utf8");
console.log("markup done:", s.split("\n").length, "lines");
