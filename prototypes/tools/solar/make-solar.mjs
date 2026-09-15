// ESS 적정 입찰단가 페이지 → 태양광 초안 페이지. 원본은 건드리지 않고 복사본에 교체를 적용한다.
// 모든 교체는 "정확히 기대한 횟수만큼" 매칭될 때만 적용하고, 하나라도 어긋나면 멈춘다(조용히 틀린 파일을 만들지 않게).
import { readFileSync, writeFileSync } from "node:fs";
const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
let s = readFileSync(`${SP}/ess-bid-price-prototype.html`, "utf8");

const count = (hay, needle) => hay.split(needle).length - 1;
function rep(from, to, n = 1) {
  const c = count(s, from);
  if (c !== n) throw new Error(`rep: expected ${n} match(es), found ${c}: ${from.slice(0, 90)}`);
  s = s.split(from).join(to);
}
// start ~ end 구간 교체(end 포함 여부 선택). start·end 는 각각 유일해야 한다.
function between(start, end, to, { includeEnd = true } = {}) {
  if (count(s, start) !== 1) throw new Error(`between: start not unique (${count(s, start)}): ${start.slice(0, 90)}`);
  const a = s.indexOf(start);
  const b = s.indexOf(end, a);
  if (b < 0) throw new Error(`between: end not found: ${end.slice(0, 90)}`);
  s = s.slice(0, a) + to + s.slice(includeEnd ? b + end.length : b);
}
function reRep(re, to) {
  const m = s.match(re);
  if (!m) throw new Error(`reRep: no match ${re}`);
  s = s.replace(re, to);
}

// ── 머리 · 제목 ──────────────────────────────────────────────
rep("<title>ESS 적정 입찰단가 프로토타입</title>", "<title>태양광 적정 입찰가격 프로토타입</title>");
rep("<h1>ESS 적정 입찰단가</h1>", "<h1>태양광 적정 입찰가격</h1>");
rep('<span class="brand-sub">KCH그룹 · 이터레이션 1~3 · ESS 전용</span>', '<span class="brand-sub">KCH그룹 · 초안 · 태양광 고정가격계약</span>');

// ── B. 사업개요 — 배터리·PCS 칸을 빼고 사업기간만 ──────────────
between('<div class="field span-2"><label for="projectName">', '<div class="warn" role="status" id="calendarWarn"></div>', `<div class="field span-2"><label for="projectName">사업명</label><div class="iw"><input id="projectName" type="text" value="태양광 50MW 입찰사업"></div></div>
                <div class="field"><label for="startYear">사업 시작연도</label><div class="iw"><input id="startYear" type="number" value="2026" step="1"><span class="unit">년</span></div></div>
                <div class="field"><label for="endYear">사업 종료연도</label><div class="iw"><input id="endYear" type="number" value="2047" step="1"><span class="unit">년</span></div></div>
                <div class="field"><label for="constructionYears">공사기간</label><div class="iw"><input id="constructionYears" type="number" value="1" step="1"><span class="unit">년</span></div></div>
                <div class="field"><label for="operationYears">운영기간</label><div class="iw"><input id="operationYears" type="number" value="20" step="1"><span class="unit">년</span></div></div>
                <div class="field span-2"><label for="codDate">상업운전개시일(COD)</label><div class="iw"><input id="codDate" type="date" value="2027-07-01"></div></div>
                <div class="field calc" style="display:none;"><label for="developmentYears">개발기간</label><div class="iw"><input id="developmentYears" disabled><span class="unit">년</span></div></div>
              </div>
              <p class="hint">설비용량·이용률·판매 조건은 C. 발전매출에서 입력합니다.</p>
              `, { includeEnd: false });

// ── C. 발전매출 — 태양광 고정가격계약 ─────────────────────────
between('<summary><span class="acc-badge">C</span>', '<div class="warn" role="status" id="nonComplianceRangeWarn"></div>', `<summary><span class="acc-badge">C</span><span class="acc-title">발전매출</span><span class="flag">고정가격계약</span><span class="acc-chev" aria-hidden="true" style="margin-left:auto;">▶</span></summary>
            <div class="acc-body">
              <p class="hint" style="margin-top:0;">태양광 <strong>고정가격계약 경쟁입찰</strong>을 가정합니다 — 입찰가격은 <strong>SMP + REC를 합친 고정 단가(원/kWh)</strong>로 계약기간 동안 적용되고, 계약이 끝난 뒤 남은 운영기간은 SMP + REC × 가중치 시장가로 팝니다. 발전량 = 설비용량 × 8,760h × 연차별 이용률 × (1 − 출력제어·손실률).</p>
              <div class="field-grid">
                <div class="field"><label for="contractCapacityMW">설비용량 (AC)</label><div class="iw"><input id="contractCapacityMW" type="number" value="50" step="1" min="0"><span class="unit">MW</span></div></div>
                <div class="field calc"><label for="bidPriceDisplay">적정 입찰가격</label><div class="iw"><input id="bidPriceDisplay" disabled><span class="unit">원/kWh</span></div></div>
                <div class="field"><label for="year1RatePct">1년차 이용률</label><div class="iw"><input id="year1RatePct" type="number" value="15" step="0.1"><span class="unit">%</span></div></div>
                <div class="field"><label for="degradationPct">연간 열화율</label><div class="iw"><input id="degradationPct" type="number" value="0.5" step="0.05"><span class="unit">%/년</span></div></div>
                <div class="field span-2"><label for="curtailmentPct">출력제어·가용 손실률</label><div class="iw"><input id="curtailmentPct" type="number" value="3" step="0.5" min="0" max="100"><span class="unit">발전량 %</span></div></div>
              </div>
              <div class="subhead subhead-row">
                <span>운영연차별 이용률 (직접 수정 가능)</span>
                <button id="applyRateBtn" type="button" class="btn btn-soft">1년차·열화율 규칙 일괄 적용</button>
              </div>
              <p class="hint" style="margin:0 0 6px;">n년차 이용률 = 1년차 이용률 × (1 − 열화율)<sup>n−1</sup>. 1년차 이용률·열화율을 바꾸면 표 전체가 규칙대로 다시 채워지고, 표의 칸은 따로 고칠 수 있습니다.</p>
              <div id="opRateGrid" class="field-grid" style="grid-template-columns:repeat(auto-fill,minmax(88px,1fr));margin-top:0;"></div>
              <div class="warn" role="status" id="opRateRangeWarn"></div>

              <div class="subhead">판매 조건</div>
              <div class="field-grid" style="margin-top:0;">
                <div class="field"><label for="contractYears">고정가격 계약기간</label><div class="iw"><input id="contractYears" type="number" value="20" step="1" min="0"><span class="unit">년 (COD부터)</span></div></div>
                <div class="field"><label for="smpPrice">계약 종료 후 SMP 전망</label><div class="iw"><input id="smpPrice" type="number" value="120" step="1"><span class="unit">원/kWh</span></div></div>
                <div class="field"><label for="recPrice">REC 단가</label><div class="iw"><input id="recPrice" type="number" value="70000" step="1000"><span class="unit">원/REC</span></div></div>
                <div class="field"><label for="recWeight">REC 가중치</label><div class="iw"><input id="recWeight" type="number" value="1.0" step="0.1"><span class="unit">배</span></div></div>
              </div>
              <p class="hint">계약 종료 후 판매단가 = SMP + REC 단가 ÷ 1,000 × 가중치(1 REC = 1MWh). 운영기간이 계약기간 이하면 쓰이지 않습니다. SMP·REC 단가·가중치는 예시값 — 부지 유형·최신 시장가로 바꿔 주세요.</p>

              <div class="subhead">연차별 발전량</div>
              <div class="table-wrap">
                <table>
                  <thead><tr><th>연차</th><th>연도</th><th>이용률</th><th>가동 비중</th><th>발전량 (MWh, 손실 반영)</th><th>판매 단가</th></tr></thead>
                  <tbody id="supplyTableBody"></tbody>
                </table>
              </div>`);

// ── D. CAPEX — 태양광 문구·EPC 총액 기본값 ────────────────────
rep('항목별 금액 (억원, 프로젝트 총액 — 배터리·PCS 대수와는 별개)', '항목별 금액 (억원, 프로젝트 총액 직접 입력 — 50MW 지상형 예시)');
rep('<input id="capexLumpSum" type="number" value="960" step="1">', '<input id="capexLumpSum" type="number" value="545" step="1">');
rep('<input id="contingencyPct" type="number" value="7" step="0.1">', '<input id="contingencyPct" type="number" value="5" step="0.1">');

// ── E. OPEX — LTSA 빼고 태양광 문구 ───────────────────────────
between('<div class="field"><label for="variableOMPerMWh">', '방전량(연간 방전전력량)에 비례해 계산됩니다.</p>', `<div class="field"><label for="variableOMPerMWh">변동 O&amp;M</label><div class="iw"><input id="variableOMPerMWh" type="number" value="0" step="10"><span class="unit">원/MWh</span></div></div>
                <div class="field"><label for="powerTradingFeePerKWh">전력거래수수료</label><div class="iw"><input id="powerTradingFeePerKWh" type="number" value="0.1193" step="0.001"><span class="unit">원/kWh</span></div></div>
                <div class="field"><label for="insurancePct">연간 운영보험료율</label><div class="iw"><input id="insurancePct" type="number" value="0.3" step="0.01"><span class="unit">총투자비%</span></div></div>
                <div class="field"><label for="communityRevenuePct">주민·지역 기여</label><div class="iw"><input id="communityRevenuePct" type="number" value="0.5" step="0.1"><span class="unit">매출%</span></div></div>
                <div class="field span-2"><label for="opexEscalationPct">OPEX 물가상승률</label><div class="iw"><input id="opexEscalationPct" type="number" value="2" step="0.1"><span class="unit">%/년</span></div></div>
              </div>
              <p class="hint">전력거래수수료는 실제 판매 발전량에 비례합니다. 변동 O&amp;M은 태양광에서 보통 작아 기본 0으로 두었습니다(인버터 교체 등은 고정비·예비비로 반영).</p>`);

// ── F. 금융 — 태양광 PF 예시 조건 ─────────────────────────────
rep('<input id="seniorTermYears" type="number" value="10" step="1">', '<input id="seniorTermYears" type="number" value="15" step="1">');
rep('<input id="equityAmount" type="number" value="339" step="0.1">', '<input id="equityAmount" type="number" value="210" step="0.1">');
rep('<input id="bondAmount" type="number" value="56.5" step="0.1">', '<input id="bondAmount" type="number" value="35" step="0.1">');
rep('<input id="presetDep" value="15 년" disabled>', '<input id="presetDep" value="20 년" disabled>');

// ── 결과 머리 · 카드 · 안내 ──────────────────────────────────
rep('<section class="card hero" aria-label="적정 입찰단가">', '<section class="card hero" aria-label="적정 입찰가격">');
rep('<div class="k hero-label">적정 입찰단가</div>', '<div class="k hero-label">적정 입찰가격 <span style="font-weight:500;color:var(--muted);">(SMP+REC 합산 고정가)</span></div>');
rep('입찰단가 범위 — 최저단가는 P-IRR 6%·당사 이익 100억(15년 누적) 동시충족 최소 입찰단가(Q1/Q2 로직), 최고단가는 A. 산정 기준으로 구한 현재 적정 입찰단가',
  '입찰가격 범위 — 최저는 P-IRR 6%·당사 이익 100억(운영기간 누적) 동시충족 최소 가격, 최고는 A. 산정 기준으로 구한 현재 적정 입찰가격');
rep('<div class="s">방전량 <span id="kpiGeneration">—</span></div>', '<div class="s">발전량 <span id="kpiGeneration">—</span></div>');
between('<aside class="notice"', '</aside>', `<aside class="notice" aria-label="태양광 모델링 한계">
        <strong class="t">⚠ 태양광 초안 — 이 결과에 항상 적용되는 한계</strong>
        <ul>
          <li>ESS 프로토타입의 재무 엔진에 발전매출만 태양광으로 바꾼 <strong>1차 초안</strong> — 판매 구조·발전량 가정 확정 필요</li>
          <li>발전량은 이용률 × 열화율 × 손실률의 연 단위 근사 — 일사량 분석(PVsyst 등)·시간대별 발전 곡선·출력제어 패턴 <strong>미반영</strong></li>
          <li>CAPEX·OPEX·재무 프리셋은 50MW 지상형 <strong>예시값</strong> — 실제 견적·PF 조건으로 교체 필요</li>
          <li>가격환산 탭은 ESS 공고의 가격평가 산식을 <strong>준용한 초안</strong> — 태양광 경쟁입찰 평가 산식 확인 필요</li>
          <li>부채 규모는 비율·금액 입력만 지원, 변동금리는 연 단위 근사, CD금리는 직접 입력</li>
        </ul>
        <p style="margin:6px 0 0;font-size:12.5px;"><button type="button" class="link-btn" data-goto-tab="tab-caveats">전체 10개 항목 상세 보기 →</button></p>
      </aside>`);

// ── 가격환산 탭 — ESS 산식 준용 표시 ───────────────────────────
rep('<h2>가격평가점수 — 공고 제2025-05호 Ⅲ.5</h2>', '<h2>가격평가점수 — ESS 공고 산식 준용 (초안)</h2>');
rep('<p class="hint-block">입찰가격은 적정 입찰단가 결과값으로 자동 채워지며, 직접 바꿔볼 수도 있습니다.</p>',
  '<p class="callout-sm"><strong>초안 — 태양광 경쟁입찰 공고의 가격평가 산식·배점으로 바꿔야 합니다. </strong>지금은 ESS 공고 제2025-05호의 "최저입찰가격 ÷ 입찰가격 × 가격배점" 산식과 예시 최저가를 그대로 씁니다. 입찰가격은 적정 입찰가격 결과로 자동 채워지며 직접 바꿔볼 수도 있습니다.</p>');
rep('<input id="minPrice" type="number" value="18" step="0.1">', '<input id="minPrice" type="number" value="140" step="0.1">');
rep('<input id="bidPrice" type="number" value="20" step="0.1">', '<input id="bidPrice" type="number" value="150" step="0.1">');

// ── KCH 탭 — 저장용량 칸 제거, 문구 ───────────────────────────
rep('ESS 프로젝트 자체의 발전매출과는 별개로', '태양광 프로젝트 자체의 발전매출과는 별개로');
rep('설비용량·저장용량은 C. 발전매출의 계약용량에 연동되고, 사업기간은 ESS 입찰단가 계산부와 별도로 여기서 입력합니다.', '설비용량은 C. 발전매출의 설비용량에 연동되고, 사업기간은 입찰가격 계산부와 별도로 여기서 입력합니다.');
rep('설비용량·저장용량은 <strong>C. 발전매출의 계약용량(입찰물량)</strong>을 그대로 씁니다(저장용량 = 계약용량 × 6h). 용량을 바꾸려면 계약용량 한 곳만 고치면 됩니다.', '설비용량은 <strong>C. 발전매출의 설비용량</strong>을 그대로 씁니다. 용량을 바꾸려면 설비용량 한 곳만 고치면 됩니다.');
rep('<div class="field calc"><label for="kchCapacityMW">설비용량</label><div class="iw"><input id="kchCapacityMW" disabled value="96"><span class="unit">MW</span></div></div>', '<div class="field calc"><label for="kchCapacityMW">설비용량</label><div class="iw"><input id="kchCapacityMW" disabled value="50"><span class="unit">MW</span></div></div>');
rep('            <div class="field calc"><label for="kchStorageMWh">저장용량</label><div class="iw"><input id="kchStorageMWh" disabled value="576"><span class="unit">MWh</span></div></div>\n', '');
rep('            <div class="field calc"><label for="kchDurationHours">저장시간</label><div class="iw"><input id="kchDurationHours" disabled><span class="unit">h</span></div></div>\n', '');
rep('<input id="kchOpYears" type="number" value="15" step="1">', '<input id="kchOpYears" type="number" value="20" step="1">');

// ── 확정 필요 항목 · 푸터 ──────────────────────────────────────
between('<ul class="todo-list">', '</ul>', `<ul class="todo-list">
              <li><strong>초안 범위</strong> — ESS 적정 입찰단가 프로토타입의 재무 엔진(총투자비 반복수렴·원리금균등·누진세+이월결손금·DSCR 게이트 배당·법정준비금·KCH 개발수수료)을 그대로 쓰고 <strong>발전매출·CAPEX·OPEX만 태양광으로 바꾼 1차 초안</strong>. 발전원별 차이(모듈 교체·인버터 교체 주기, 해체·원상복구 충당금 등)는 아직 미반영</li>
              <li>C. 발전매출 — <strong>판매 구조</strong>: 한국에너지공단 고정가격계약 경쟁입찰(SMP+REC 합산 고정가, 계약기간 20년)을 가정. 실제 공고의 계약기간·상한가격·REC 가중치(부지 유형별)·계약 종료 후 판매 방식 확인 필요. 계약 종료 후 SMP 120원/kWh·REC 70,000원/REC·가중치 1.0은 예시값</li>
              <li>C. 발전매출 — <strong>발전량</strong>: 1년차 이용률 15%·연간 열화율 0.5%·출력제어·가용 손실률 3%는 예시값. 실제 일사량·음영·계통 제약 분석(PVsyst 등) 결과로 교체 필요. 연 단위 근사라 계절·시간대 발전 곡선과 출력제어 발생 패턴은 반영하지 않음</li>
              <li>가격환산 탭 — ESS 공고 제2025-05호의 가격평가 산식(최저입찰가격 ÷ 입찰가격 × 배점)과 예시 최저가 140원/kWh를 그대로 준용함. 태양광 경쟁입찰의 가격·비가격 평가 산식과 배점으로 교체 필요</li>
              <li>D·E. CAPEX·OPEX — 50MW(AC) 지상형 예시 규모(모듈·인버터·구조물·전기·토목·계통연계·인허가·부지, O&amp;M 위탁·관제·부지 임차). 실제 견적·부지 조건으로 교체 필요</li>
              <li>F. 재무 프리셋 — DSCR 임계치(1.15/1.30배)·할인율 4.5%·법인세 누진구간·감가상각 20년·선순위 15년 원리금균등은 ESS 참고자료 기준을 옮긴 초안 — 태양광 PF 조건으로 재확인 필요</li>
              <li>반영하지 않은 구조적 차이 — 목표 DSCR 기반 부채 사이징(사이즈컬핑)·원금불균등 상환은 미반영(자기자본·주민채권 비율 또는 금액, 선순위는 나머지). 선순위 금리 고정·변동(CD 91일물) 혼합은 연 단위 근사, CD금리는 직접 입력(기본 2.80% 예시)</li>
              <li>KCH 개발수수료 — 4개 수수료 기준총액·할인율은 ESS 예시값을 그대로 둠(설비용량만 태양광 설비용량에 연동). 태양광 사업 기준으로 교체 필요</li>
              <li>단가산정 목표 — "당사 이익 목표" 100억원(누적 순이익 세전, 당사 지분 20%)·목표 IRR은 초안 설정값 — KCH 내부 기준 확인 필요</li>
              <li>엑셀(.xlsx) 회신 변환기(<code>ESS_엑셀변환.bat</code>)는 아직 ESS 전용 — 태양광 시나리오 JSON은 변환할 수 없음. 필요하면 변환기에 태양광 엔진을 추가해야 함</li>
            </ul>`);
between('<footer>', '</footer>', `<footer>
    <p>사업개요·발전매출·CAPEX·OPEX·금융세무 입력값으로 목표 당사 이익(또는 목표 IRR)을 만족하는 태양광 고정가격계약 적정 입찰가격(SMP+REC 합산, 원/kWh)을 역산합니다.</p>
    <p>이 페이지는 ESS 적정 입찰단가 프로토타입과 같은 재무 엔진·화면 구성으로 만든 <strong>태양광 1차 초안</strong>입니다. 발전량·판매 구조·CAPEX·OPEX는 예시값이며 확정이 필요합니다.</p>
    <p>참고: <code>PRD_사업성분석_프로토타입.md</code> · ESS 적정 입찰단가 프로토타입 · 디자인 기준 <code>web-app-blueprint.md</code> · <code>result-tabs-design-spec.md</code> · 작성 서신준(인프라사업2 본부)</p>
  </footer>`);

// ── 시나리오 비교 탭 도움말의 엑셀 안내 ──────────────────────
reRep(/<p style="margin:0;"><b>서식이 적용된 다중 시트 엑셀\(\.xlsx\)이 필요하면<\/b>[\s\S]*?<\/p>/,
  '<p style="margin:0;"><b>서식이 적용된 엑셀(.xlsx) 회신</b> — ESS용 변환기(<code>ESS_엑셀변환.bat</code>)는 아직 태양광 시나리오를 변환하지 못합니다. 지금은 CSV로 확인해 주세요(태양광 변환기는 다음 단계).</p>');

// ═══════════════════ 스크립트(계산) ═══════════════════
reRep(/  \/\/ group: construction = ① 공사비\(EPC\)[\s\S]*?  const CAPEX_ITEMS = \[[\s\S]*?\n  \];/, `  // group: construction = ① 공사비(EPC) · soft = ② 개발·간접비 · ancillary = ③ 부대비용(보험·기타). 태양광 50MW(AC) 지상형 예시(초안).
  // 배열 순서 = data-capex-index = 시나리오 JSON의 capexItems 순서.
  const CAPEX_ITEMS = [
    { id: "module", label: "태양광 모듈", value: 250, category: "기자재", group: "construction" },
    { id: "inverter", label: "인버터", value: 45, category: "기자재", group: "construction" },
    { id: "structure", label: "구조물·기초", value: 90, category: "시공-토목", group: "construction" },
    { id: "electrical", label: "전기공사 (케이블·수배전)", value: 70, category: "시공-전기", group: "construction" },
    { id: "civil", label: "토목·부지정지", value: 40, category: "시공-토목", group: "construction" },
    { id: "grid", label: "계통연계 (선로·변전)", value: 45, category: "시공-선로·계통", group: "construction" },
    { id: "monitoring", label: "모니터링·보안설비", value: 5, category: "시공-전기", group: "construction" },
    { id: "development", label: "인허가·개발비", value: 15, category: "간접비", group: "soft" },
    { id: "design", label: "설계비", value: 6, category: "간접비", group: "soft" },
    { id: "supervision", label: "감리비", value: 5, category: "간접비", group: "soft" },
    { id: "community", label: "민원·주민수용성", value: 10, category: "간접비", group: "soft" },
    { id: "insurance", label: "건설보험·보증", value: 4, category: "부대비용", group: "ancillary" },
    { id: "land", label: "부지 매입·임차권", value: 40, category: "토지", group: "soft" },
    { id: "otherAncillary", label: "기타 부대비용 (취득세·PM·법인설립 등)", value: 0, category: "부대비용", group: "ancillary" },
  ];`);
reRep(/  const OPEX_ITEMS = \[[\s\S]*?\n  \];/, `  const OPEX_ITEMS = [
    { id: "om", label: "O&M 위탁 (점검·세정·제초)", value: 4.5 },
    { id: "staff", label: "인건비·관제", value: 1.0 },
    { id: "lease", label: "부지 임차료", value: 1.5 },
    { id: "admin", label: "일반관리·수수료", value: 0.8 },
  ];`);
rep("waccPct: 4.5, depreciationYears: 15, nolCarryforwardYears: 10,", "waccPct: 4.5, depreciationYears: 20, nolCarryforwardYears: 10,");

// 매출 — 계약기간과 겹치는 날 비율만큼 고정가(입찰가), 나머지는 시장가(SMP + REC × 가중치)
between("  function salesForRow(model, capacityMW, row) {", "  function stepAdjustedOpex(model, item, row) {", `  // 이 해 가동일수 중 고정가격 계약기간(COD ~ COD + 계약기간)에 드는 비율 — 첫해·마지막 해 일할까지 날짜로 맞춘다
  function contractShareForRow(model, row) {
    if (row.operatingDays === 0) return 0;
    const p = model.project, years = model.revenue.contractYears || 0;
    const cod = utcDate(p.codYear, p.codMonth - 1, p.codDay), end = utcDate(p.codYear + years, p.codMonth - 1, p.codDay);
    const days = overlapDays(utcDate(row.calendarYear, 0, 1), utcDate(row.calendarYear + 1, 0, 1), cod, end);
    return Math.min(1, days / row.operatingDays);
  }
  function salesForRow(model, capacityMW, row) {
    if (row.operatingDays === 0) return { generationMWh: 0, chargedMWh: 0, revenue: 0 };
    // 태양광 발전량(MWh) = 설비용량(MW) × 8,760h × 그해 이용률 × (1 − 출력제어·손실률), 부분연도는 operationFraction으로 안분
    // 판매단가 = 계약기간 비율 × 입찰가격(SMP+REC 합산 고정가) + 나머지 × 시장가(SMP + REC ÷ 1,000 × 가중치)
    const ratePct = operatingRatePctForSequence(model, row.operationSequence);
    const generationMWh = capacityMW * 24 * 365 * rate(ratePct) * row.operationFraction * (1 - rate(model.revenue.curtailmentPct || 0));
    const share = contractShareForRow(model, row);
    const price = share * model.revenue.bidPricePerKWh + (1 - share) * (model.revenue.marketPricePerKWh || 0);
    const revenue = generationMWh * 1000 * price / HUNDRED_MILLION;
    return { generationMWh, chargedMWh: 0, revenue };
  }

`, { includeEnd: false });

// readModel — ESS 설치용량 계산 제거
between("    const unitCount = +$('unitCount').value", "$('durationHours').value = fmt(durationHours, 2);\n", "");
// readModel — 계약용량 경고·준공지연·이행률 제거, 태양광 판매 조건
between("    // 계약용량(입찰물량)은 설치용량(PCS 정격출력 합계)과 별개", '    } else nonComplianceWarnEl.className = "warn";\n', `    // 태양광 설비용량(AC) — 발전량·매출은 이 값 기준
    const contractCapacityMW = Math.max(0, +$('contractCapacityMW').value || 0);

    const operatingRatesPct = Array.from(document.querySelectorAll('#opRateGrid [data-oprate-index]')).map((el) => +el.value);
    const opRateWarnEl = $('opRateRangeWarn');
    const outOfRangeYears = operatingRatesPct.map((v, i) => ({ year: i + 1, v })).filter((r) => r.v < 0 || r.v > 100);
    if (outOfRangeYears.length > 0) {
      opRateWarnEl.className = "warn show";
      opRateWarnEl.textContent = \`이용률이 0~100% 범위를 벗어난 연차가 있습니다(\${outOfRangeYears.map((r) => \`\${r.year}년차 \${fmt(r.v, 1)}%\`).join(', ')}) — 물리적으로 불가능한 값입니다.\`;
    } else opRateWarnEl.className = "warn";

    const curtailmentPct = Math.min(100, Math.max(0, +$('curtailmentPct').value || 0));
    const contractYears = Math.max(0, +$('contractYears').value || 0);
    // 계약 종료 후 시장가(원/kWh) = SMP + REC 단가(원/REC) ÷ 1,000 × 가중치 (1 REC = 1MWh)
    const marketPricePerKWh = (+$('smpPrice').value || 0) + (+$('recPrice').value || 0) / 1000 * (+$('recWeight').value || 0);
    // ESS의 준공지연·이행률 페널티는 태양광 초안에서 쓰지 않는다(엔진 호환을 위해 중립값)
    const delayDays = 0, delayStage = 0, priceAdjustmentFactor = 1, avgNonCompliancePct = 0;
`);
rep("      project: { projectName: $('projectName').value, startYear, endYear, constructionYears, codYear, codMonth, codDay, operationYears, totalStorageMWh, totalPowerMW, installedCapacityMW, degradationPct: DEGRADATION_PCT, delayDays, delayStage },",
  "      project: { projectName: $('projectName').value, startYear, endYear, constructionYears, codYear, codMonth, codDay, operationYears, delayDays, delayStage },");
rep("      revenue: { durationHours, operatingRatesPct, bidPricePerKWh: 0, priceAdjustmentFactor, avgNonCompliancePct, contractCapacityMW },",
  "      revenue: { operatingRatesPct, bidPricePerKWh: 0, priceAdjustmentFactor, avgNonCompliancePct, contractCapacityMW, curtailmentPct, contractYears, marketPricePerKWh },");
rep("escalationPct: +$('opexEscalationPct').value, ltsaStepAfterYear: +$('ltsaStepAfterYear').value, ltsaStepMultiplierPct: +$('ltsaStepMultiplierPct').value },",
  "escalationPct: +$('opexEscalationPct').value, ltsaStepAfterYear: 0, ltsaStepMultiplierPct: 100 },");

// 연차별 이용률 규칙 — 1년차 × (1 − 열화율)^(n−1)
between("  function defaultRatePctForYear(seq) {", "  function syncOperatingRateRows() {", `  function defaultRatePctForYear(seq) {
    const y1 = +$('year1RatePct').value || 0, d = rate(+$('degradationPct').value || 0);
    return Number((y1 * (1 - d) ** (seq - 1)).toFixed(3));
  }
`, { includeEnd: false });

// 공급량 산정표 → 연차별 발전량 표
between("  // ---------- 공급량 산정표", "  // 총사업비 구성 — ① 공사비", `  // ---------- 연차별 발전량 표 (물리량 기준이라 입찰가격과 무관) ----------
  function buildSupplyScheduleRows(model) {
    const cal = buildCalendar(model.project);
    const capacityMW = model.revenue.contractCapacityMW;
    return cal.rows.filter((row) => row.operationSequence > 0).map((row) => {
      const ratePct = operatingRatePctForSequence(model, row.operationSequence);
      const gen = capacityMW * 24 * 365 * rate(ratePct) * row.operationFraction * (1 - rate(model.revenue.curtailmentPct || 0));
      return { seq: row.operationSequence, year: row.calendarYear, ratePct, fraction: row.operationFraction, gen, share: contractShareForRow(model, row) };
    });
  }
  function renderSupplyTable(model) {
    const rows = buildSupplyScheduleRows(model);
    const priceLabel = (sh) => (sh >= 0.999 ? '고정가격(입찰가)' : sh <= 0.001 ? '시장가(SMP+REC)' : \`혼합 · 고정 \${fmt(sh * 100, 0)}%\`);
    $('supplyTableBody').innerHTML = rows.map((r) => \`
      <tr>
        <td>\${r.seq}년차</td>
        <td>\${r.year}</td>
        <td>\${fmt(r.ratePct, 2)}%</td>
        <td>\${fmt(r.fraction * 100, 0)}%</td>
        <td>\${fmt(r.gen, 0)}</td>
        <td>\${priceLabel(r.share)}</td>
      </tr>\`).join('') || \`<tr><td colspan="6" style="text-align:center;color:var(--ink-faint);">운영기간이 없습니다</td></tr>\`;
  }

`, { includeEnd: false });

// 생애 발전량(KCH 수수료 원/kWh 환산용) — 손실 반영
between("  // 6.4(KCH 개발수수료) → 6.5(가격환산계산기) 직접 자동연결용", "  let linked = true;", `  // KCH 수수료 → 가격환산 입찰가격 원/kWh 환산용 생애주기 총 발전량(kWh, 출력제어·손실 반영) — 이 프로젝트의 실제 판매량 기준
  function totalLifetimeGenerationKWh(model) {
    const cal = buildCalendar(model.project);
    const capacityMW = model.revenue.contractCapacityMW;
    let totalMWh = 0;
    cal.rows.forEach((row) => {
      if (row.operationSequence <= 0) return;
      const ratePct = operatingRatePctForSequence(model, row.operationSequence);
      totalMWh += capacityMW * 24 * 365 * rate(ratePct) * row.operationFraction * (1 - rate(model.revenue.curtailmentPct || 0));
    });
    return totalMWh * 1000;
  }

`, { includeEnd: false });

// 이용률 규칙 입력을 바꾸면 표 전체를 규칙대로 다시 채운다(공통 recalcAll 리스너보다 먼저 등록)
rep("  $('applyRateBtn').addEventListener('click', () => {", `  ['year1RatePct', 'degradationPct'].forEach((id) => $(id).addEventListener('input', () => {
    document.querySelectorAll('#opRateGrid [data-oprate-index]').forEach((el, i) => { el.value = defaultRatePctForYear(i + 1); });
  }));
  $('applyRateBtn').addEventListener('click', () => {`);

// 요약 탭 산출 근거
rep("      ['계약용량 (입찰물량)', `${fmt(model.revenue.contractCapacityMW, 0)} MW`, '매출·방전량은 설치용량이 아니라 이 값 기준'],",
  "      ['설비용량 (AC)', `${fmt(model.revenue.contractCapacityMW, 0)} MW`, `1년차 이용률 ${fmt(model.revenue.operatingRatesPct[0] || 0, 1)}% · 손실 ${fmt(model.revenue.curtailmentPct, 1)}% · 고정가격 ${fmt(model.revenue.contractYears, 0)}년`],");

// KCH 모델 — 저장용량 제거
between("    const capacityMW = Math.max(0, +$('contractCapacityMW').value || 0), storageMWh = capacityMW * 6;", "    const startYear = +$('kchStartYear').value", `    const capacityMW = Math.max(0, +$('contractCapacityMW').value || 0), storageMWh = 0; // 태양광: 설비용량만 연동(저장용량 없음)
    $('kchCapacityMW').value = String(Number(capacityMW.toFixed(2)));
`, { includeEnd: false });

// 시나리오 스냅샷·비교 라벨
rep("      installedCapacityMW: $('installedCapacityDisplay').value,\n", "");
rep("    ['계약용량(MW)', (s) => s.kpi.contractCapacityMW],\n    ['설치용량(MW, 참고)', (s) => s.kpi.installedCapacityMW],\n", "    ['설비용량(MW)', (s) => s.kpi.contractCapacityMW],\n");
rep("const SCENARIO_ASSUMPTION_LABELS = ['산정 기준', '계약용량(MW)', '설치용량(MW, 참고)', 'CAPEX 합계', 'OPEX 합계'];", "const SCENARIO_ASSUMPTION_LABELS = ['산정 기준', '설비용량(MW)', 'CAPEX 합계', 'OPEX 합계'];");
rep("['적정 입찰단가(원/kWh)', (s) => s.kpi.heroBidPrice],", "['적정 입찰가격(원/kWh)', (s) => s.kpi.heroBidPrice],");
rep("'적정 입찰단가(원/kWh)': false,", "'적정 입찰가격(원/kWh)': false,");

// 저장 키 · 내보내기 이름
rep("const SCENARIO_STORAGE_KEY = 'essBidPriceScenarios.v1';", "const SCENARIO_STORAGE_KEY = 'solarBidPriceScenarios.v1';");
rep("const TAB_STORAGE_KEY = 'essBidPriceActiveTab.v2';", "const TAB_STORAGE_KEY = 'solarBidPriceActiveTab.v1';");
rep("tool: 'ESS 적정 입찰단가 프로토타입',", "tool: '태양광 적정 입찰가격 프로토타입 (초안)',");
rep("const filename = `ESS_시나리오_${safeFileNamePart(scenario.name)}", "const filename = `태양광_시나리오_${safeFileNamePart(scenario.name)}");
rep("const filename = `ESS_시나리오_비교_", "const filename = `태양광_시나리오_비교_");
rep("table.push(['ESS 적정 입찰단가 프로토타입 — 시나리오 검증용 데이터 내보내기']);", "table.push(['태양광 적정 입찰가격 프로토타입(초안) — 시나리오 검증용 데이터 내보내기']);");

writeFileSync(`${SP}/solar-bid-price-prototype.html`, s, "utf8");
console.log("solar page written:", s.split("\n").length, "lines");
