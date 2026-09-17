// 해상풍력 2a — 계산 전반부: 터빈·트랙·조합 상수, REC 가중치, 입찰가격 환산, CAPEX·OPEX 항목, readModel 판매 조건, 입찰가격 연동
import { open, OUT, TURBINES } from "./wind-lib.mjs";
const f = open(OUT);

const turbinesJs = JSON.stringify(TURBINES.map(({ id, origin, maker, model }) => ({ id, origin, maker, model })));
f.between(`  // ---------- 탄소배출량 검증 등급 (2026년 1차 태양광 고정가격계약 경쟁입찰 · 신규설비 기준) ----------`,
  `  // ---------- CAPEX / OPEX item definitions (태양광 50MW 예시, 프로젝트 총액, 억원) ----------`,
  `  // ---------- 터빈 · 입찰 트랙 · 조합 ----------
  // 터빈 스펙·단가 기본값은 "터빈 비교" 탭 표의 입력 칸(HTML value)에 있고, 여기엔 식별 정보만 둔다.
  const TURBINE_LIST = ${turbinesJs};
  const TURBINE_BY_ID = Object.fromEntries(TURBINE_LIST.map((t) => [t.id, t]));
  // 입찰 트랙별 비가격 배점 — 2025년 상반기 공고 보도(안보·산업경제·사업진행도), 확인하지 못한 나머지는 50점에 맞춘 "기타".
  const TRACKS = {
    public: { label: '공공주도형', max: { scoreSecurity: 8, scoreIndustry: 22, scoreProgress: 2, scoreOther: 18 } },
    general: { label: '일반형', max: { scoreSecurity: 6, scoreIndustry: 26, scoreProgress: 4, scoreOther: 14 } },
  };
  // 공공주도형 우대가격(원/kWh) — 기본 3,660원/MWh, 정부 R&D 실증 터빈 추가 27,840원/MWh(2025년 상반기 공고)
  const PREF_PRICES = { base: 3.66, rnd: 3.66 + 27.84, none: 0 };
  // 2026년 상반기 공고 상한가격(SMP+1REC, 원/kWh)
  const PRICE_CAPS = { fixed: 171.229, floating: 175.1 };
  // 조합 = 입찰 트랙 + 터빈 원산지. 버튼을 누르면 그 원산지의 기본 터빈 값과 비가격 예상 점수(가정)까지 주입한다.
  const COMBOS = {
    public: { label: '① 공공주도형 + 국산 터빈', origin: 'domestic', defaultTurbine: 'doosan10',
      fields: { salesStructure: 'fixed', tenderTrack: 'public', prefMode: 'base', contractYears: '20', scoreSecurity: '7', scoreIndustry: '19', scoreProgress: '2', scoreOther: '13' } },
    general: { label: '② 일반형 + 외산 터빈', origin: 'foreign', defaultTurbine: 'vestas15',
      fields: { salesStructure: 'fixed', tenderTrack: 'general', prefMode: 'none', contractYears: '20', scoreSecurity: '4', scoreIndustry: '14', scoreProgress: '3', scoreOther: '10' } },
  };
  // REC 가중치 — 연계거리·수심 각각 구간별 2.5 · 2.9 · 3.3 · 3.7을 받아 합산하고 2.5를 뺀다(2021년 고시 근사). RPS 개편 시 1.0.
  function bandWeight(v, first, step) { return v <= first ? 2.5 : v <= first + step ? 2.9 : v <= first + 2 * step ? 3.3 : 3.7; }
  function recWeightOf() {
    const mode = $('weightMode').value;
    if (mode === 'none') return 1;
    if (mode === 'manual') return Math.max(0.1, +$('weightManual').value || 1);
    return bandWeight(+$('connectDistanceKm').value || 0, 5, 5) + bandWeight(+$('waterDepthM').value || 0, 20, 5) - 2.5;
  }
  // 수령단가 R ↔ 입찰가격 P(SMP+1REC): R = SMP + (P − SMP) × 가중치 + 우대가격  ⇒  P = SMP + (R − 우대가격 − SMP) ÷ 가중치
  function bidFromReceived(R, rv) { return rv.smpRefPerKWh + (R - rv.preferentialPerKWh - rv.smpRefPerKWh) / rv.recWeightApplied; }

  // ---------- CAPEX / OPEX item definitions (해상풍력 100MW 고정식 예시, 프로젝트 총액, 억원) ----------`);

f.rep("태양광 50MW(AC) 지상형 예시(초안).", "해상풍력 100MW 고정식 예시(초안).");
f.reRep(/  const CAPEX_ITEMS = \[[\s\S]*?\n  \];/, `  const CAPEX_ITEMS = [
    { id: "turbine", label: "풍력터빈 (나셀·블레이드·타워)", value: 2400, category: "기자재", group: "construction" },
    { id: "foundation", label: "하부구조물 (모노파일·자켓)", value: 1650, category: "시공-토목", group: "construction" },
    { id: "arrayCable", label: "내부망 해저케이블", value: 350, category: "시공-전기", group: "construction" },
    { id: "exportSubstation", label: "외부망 케이블·해상변전소", value: 950, category: "시공-선로·계통", group: "construction" },
    { id: "installation", label: "해상 운송·설치", value: 1600, category: "시공-토목", group: "construction" },
    { id: "onshoreGrid", label: "육상 계통연계", value: 250, category: "시공-선로·계통", group: "construction" },
    { id: "development", label: "개발·인허가 (풍황 계측 포함)", value: 150, category: "간접비", group: "soft" },
    { id: "design", label: "해양조사·설계", value: 100, category: "간접비", group: "soft" },
    { id: "supervision", label: "감리·PM", value: 80, category: "간접비", group: "soft" },
    { id: "community", label: "어업인 상생·주민수용성", value: 170, category: "간접비", group: "soft" },
    { id: "insurance", label: "건설보험·보증", value: 150, category: "부대비용", group: "ancillary" },
    { id: "land", label: "항만·배후부지 임차", value: 0, category: "토지", group: "soft" },
    { id: "otherAncillary", label: "기타 부대비용 (취득세·법인설립 등)", value: 0, category: "부대비용", group: "ancillary" },
  ];`, 1);
f.reRep(/  const OPEX_ITEMS = \[[\s\S]*?\n  \];/, `  const OPEX_ITEMS = [
    { id: "om", label: "터빈 장기유지보수 (LTSA)", value: 75 },
    { id: "bop", label: "BOP·하부구조물·케이블 점검", value: 30 },
    { id: "marine", label: "해상 운영 (선박·헬기)", value: 20 },
    { id: "staff", label: "인건비·관제", value: 10 },
    { id: "lease", label: "해역 점사용료", value: 8 },
    { id: "admin", label: "일반관리·수수료", value: 7 },
  ];`, 1);

// ── readModel — ① 공사비 단가(억원/MW) ────────────────────────
f.rep(`    // 단가 방식: ① 공사비(억원) = 단가(원/W) × 설비용량(MW) ÷ 100  (1원/W × 1MW = 100만원 = 0.01억원)`, `    // 단가 방식: ① 공사비(억원) = EPC 단가(억원/MW) × 설비용량(MW)`);
f.rep(`      ? (+$('epcUnitPrice').value || 0) * Math.max(0, +$('contractCapacityMW').value || 0) / 100`, `      ? (+$('epcUnitPrice').value || 0) * Math.max(0, +$('contractCapacityMW').value || 0)`);
f.rep(`    else if (mode === 'unitprice' && mw > 0) $('epcUnitPrice').value = String(Math.round(prev * 100 / mw));`, `    else if (mode === 'unitprice' && mw > 0) $('epcUnitPrice').value = String(Math.round(prev / mw * 10) / 10);`);

// ── readModel — 판매 조건 ─────────────────────────────────────
f.rep(`    // 판매 구조 — 고정가격계약(경쟁입찰)이면 탄소 우대가격·상한가격이 있고, 기업PPA면 단가 상승률만 있다.
    // 모델이 푸는 bidPricePerKWh는 SPC가 실제로 받는 "수령단가"다. 고정가격계약의 입찰가격은 수령단가 − 우대가격.
    const salesStructure = $('salesStructure').value, isFixedSale = salesStructure === 'fixed';
    const carbonPremiumPerKWh = isFixedSale ? (carbonGradeTable()[$('carbonGrade').value]?.premium || 0) : 0;`,
  `    // 판매 구조 — 풍력 고정가격계약이면 입찰가격(SMP+1REC)을 REC 가중치·우대가격으로 수령단가에 환산하고, 기업PPA면 단가 상승률만 있다.
    // 모델이 푸는 bidPricePerKWh는 SPC가 실제로 받는 "수령단가"다(입찰가격 환산은 bidFromReceived).
    const salesStructure = $('salesStructure').value, isFixedSale = salesStructure === 'fixed';
    const tenderTrack = $('tenderTrack').value;
    const preferentialPerKWh = isFixedSale && tenderTrack === 'public' ? (PREF_PRICES[$('prefMode').value] || 0) : 0;
    const recWeightApplied = isFixedSale ? recWeightOf() : 1;
    const smpRefPerKWh = +$('smpRefPrice').value || 0;`);
f.rep(`salesStructure, carbonPremiumPerKWh, contractEscalationPct, priceCapPerKWh },`, `salesStructure, tenderTrack, preferentialPerKWh, recWeightApplied, smpRefPerKWh, contractEscalationPct, priceCapPerKWh },`);

// ── recalcAllCore — 수령단가 → 입찰가격 연동 ──────────────────
f.rep(`    const carbonPremium = model.revenue.carbonPremiumPerKWh || 0;
    $('carbonPremiumDisplay').value = (carbonPremium > 0 ? '−' : '') + fmt(carbonPremium, 0);`,
  `    const rvNow = model.revenue;
    $('prefDeductDisplay').value = (rvNow.preferentialPerKWh > 0 ? '−' : '') + fmt(rvNow.preferentialPerKWh, 2);
    $('weightUsedDisplay').value = fmt(rvNow.recWeightApplied, 2);`);
f.rep(`    // 고정가격계약은 우대가격이 최종 고정가격에 더해져 들어오므로, 써낼 입찰가격은 그만큼 낮아진다.
    if (linked) $('bidPrice').value = Math.max(0, solved.price - carbonPremium + kchIncrementPerKWh).toFixed(2);`,
  `    // 수령단가(+KCH 수수료 환산분)를 REC 가중치·우대가격으로 SMP+1REC 입찰가격에 환산한다. 기업PPA는 환산 없이 그대로.
    const receivedWithKch = solved.price + kchIncrementPerKWh;
    if (linked) $('bidPrice').value = Math.max(0, rvNow.salesStructure === 'fixed' ? bidFromReceived(receivedWithKch, rvNow) : receivedWithKch).toFixed(2);`);

f.rep(`  let moduleLinked = true; // 직전 계산 시점에 모듈사 값이 C·D에 적용 중이었는지 — 사별 스펙을 고칠 때 다시 주입할지 판단`,
  `  let turbineLinked = true; // 직전 계산 시점에 터빈 값이 C·D에 적용 중이었는지 — 터빈 스펙을 고칠 때 다시 주입할지 판단`);
f.rep(`    syncTenderPreset(); syncSalesStructure(); syncModuleState(); syncComboState(); // 입력이 바뀔 때마다 공고 회차·라벨·경고·모듈사·조합 표시를 현재 값에 맞춘다`,
  `    syncSalesStructure(); syncTurbineState(); syncComboState(); // 입력이 바뀔 때마다 라벨·가중치·경고·터빈·조합 표시를 현재 값에 맞춘다`);

f.save("wind-2a");
