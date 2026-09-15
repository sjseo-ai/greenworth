// 산정 진입점 — 시나리오 JSON의 inputs 전체(fields + capexItems + opexItems + opRates)로 모델을 만든다.
// (예전에는 fields만 넘겨 모델을 다시 만들어, 시나리오에서 고친 CAPEX 항목·연차별 가동률이 기본값으로 바뀌어 계산됐다.)
function solveCurrentModelNode(inputs) {
  const { model, fields } = buildModelFromInputs(inputs);
  if (model.project.delayStage === 3) return { ok: false, reason: "준공지연 3단계 — 계약 해지 (매출 없음)" };
  if (fields.solveMode === "irr") {
    return solveBidPriceForTarget(model, rate(num(fields, "targetIrrPct", 8)), fields.irrKind || "projectIrr");
  }
  const targetProfit = num(fields, "targetCompanyProfit", 100);
  const profitKind = fields.companyProfitKind || "companyProfitPreTax";
  return solveBidPriceForCompanyProfitTarget(model, targetProfit, profitKind);
}

function computeFloorPriceNode(inputs) {
  if (buildModelFromInputs(inputs).model.project.delayStage === 3) return { ok: false };
  const irrResult = solveBidPriceForTarget(buildModelFromInputs(inputs).model, 0.06, "projectIrr");
  const profitResult = solveBidPriceForCompanyProfitTarget(buildModelFromInputs(inputs).model, 100, "companyProfitPreTax");
  if (!irrResult.ok && !profitResult.ok) return { ok: false };
  if (!irrResult.ok) return { ok: true, price: profitResult.price, binding: "당사이익 100억" };
  if (!profitResult.ok) return { ok: true, price: irrResult.price, binding: "P-IRR 6%" };
  return irrResult.price >= profitResult.price
    ? { ok: true, price: irrResult.price, binding: "P-IRR 6%" }
    : { ok: true, price: profitResult.price, binding: "당사이익 100억" };
}

// ============================================================================
// 민감도 — 아티팩트 민감도 탭(computeSensitivity)과 같은 알고리즘. 화면은 적정 입찰단가 "표시값"(소수 둘째 자리)을
// 고정하므로 여기서도 toFixed(2)로 고정한다. 셀마다 지표 3종(E-IRR 배당세전/배당세후·당사 누적 순이익 세전)을 담는다.
// ============================================================================
const SENS_RATE_DELTAS = [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5];
const SENS_OPEX_DELTAS = [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5];
const SENS_EPC_DELTAS = [-15, -10, -5, 0, 5, 10, 15];
const sensPick = (r) => (r.errors && r.errors.length ? null
  : { equityIrr: r.equityIrr, equityIrrAfterInvestorTax: r.equityIrrAfterInvestorTax, companyProfitPreTax: r.companyProfitPreTax });

function computeSensitivityNode(inputs, price) {
  const baseModel = buildModelFromInputs(inputs).model;
  baseModel.revenue.bidPricePerKWh = Number(price.toFixed(2));
  const baseRate = baseModel.finance.seniorRatePct, baseOpex = baseModel.opex.escalationPct;
  const baseEpc = sum(baseModel.capex.items.map((it) => it.value));
  const withRate = (rd) => ({ ...baseModel, finance: { ...baseModel.finance, seniorRatePct: Math.max(0, baseRate + rd) } });
  const macro = SENS_RATE_DELTAS.map((rd) => SENS_OPEX_DELTAS.map((od) => {
    const m = withRate(rd);
    m.opex = { ...baseModel.opex, escalationPct: Math.max(0, baseOpex + od) };
    return sensPick(analyzeEss(m));
  }));
  const epc = SENS_RATE_DELTAS.map((rd) => SENS_EPC_DELTAS.map((ed) => {
    const m = withRate(rd);
    m.capex = { ...baseModel.capex, items: baseModel.capex.items.map((it) => ({ ...it, value: it.value * (1 + ed / 100) })) };
    return sensPick(analyzeEss(m));
  }));
  return { bidPrice: baseModel.revenue.bidPricePerKWh, baseRate, baseOpex, baseEpc, macro, epc };
}

// 입력 점검 — 아티팩트 readModel()이 화면에 띄우는 경고와 같은 조건(파일만 받은 사람도 알 수 있게 요약 시트에 싣는다).
function collectWarnings(c) {
  const { built, fields, solved, floor, kch } = c;
  const pj = built.model.project, w = [];
  if (built.calendarMismatch) w.push(`사업종료연도(${pj.endYear})가 COD연도+운영기간(${pj.codYear + pj.operationYears})과 다릅니다.`);
  if (pj.codYear - pj.constructionYears + 1 < pj.startYear) w.push(`공사기간(${pj.constructionYears}년)이 길어 착공연도가 사업 시작연도(${pj.startYear})보다 빠릅니다 — 개발기간 0년으로 계산됩니다.`);
  if (built.capacityOverInstalled) w.push(`계약용량(${num(fields, "contractCapacityMW")}MW)이 설치용량(${pj.totalPowerMW.toFixed(1)}MW)을 초과합니다.`);
  const cap = num(fields, "contractCapacityMW");
  if (cap > 0 && (cap <= 10 || cap >= 100)) w.push(`계약용량(${cap}MW)이 공고 신고 범위(10MW 초과~100MW 미만)를 벗어났습니다.`);
  const badRates = built.operatingRatesPct.map((v, i) => ({ i, v })).filter((x) => x.v < 0 || x.v > 100);
  if (badRates.length) w.push(`가동률이 0~100%를 벗어난 연차가 있습니다(${badRates.map((x) => `${x.i + 1}년차 ${x.v}%`).join(", ")}).`);
  if (pj.delayStage === 3) w.push("준공지연 3단계(2년 초과) — 계약 해지로 매출이 발생하지 않습니다.");
  else if (pj.delayStage > 0) w.push(`준공지연 ${pj.delayStage}단계가 적용되었습니다(지연 ${pj.delayDays}일).`);
  if (num(fields, "equityPct") + num(fields, "residentBondPct") > 100) w.push("자기자본 비율+주민참여채권 비율이 100%를 초과합니다 — 선순위 대출이 음수가 됩니다.");
  if (num(fields, "seniorGraceYears") >= num(fields, "seniorTermYears")) w.push("원금 거치기간이 선순위 상환기간 이상입니다 — 만기 일시상환으로 처리됩니다.");
  const share = num(fields, "kchSharePct");
  if (share < 0 || share > 100) w.push(`당사(KCH) 지분율(${share}%)이 0~100%를 벗어났습니다.`);
  const negCapex = built.capexItems.filter((i) => i.value < 0), negOpex = built.opexItems.filter((i) => i.value < 0);
  if (negCapex.length) w.push(`CAPEX 항목 중 음수 값이 있습니다(${negCapex.map((i) => i.label).join(", ")}).`);
  if (negOpex.length) w.push(`OPEX 항목 중 음수 값이 있습니다(${negOpex.map((i) => i.label).join(", ")}).`);
  if (!solved.ok) w.push(`적정 입찰단가 산정 실패 — ${solved.reason}`);
  if (solved.ok && floor.ok && floor.price > solved.price + 1e-9) w.push(`적정 입찰단가(${solved.price.toFixed(2)})가 최저단가(${floor.price.toFixed(2)}원/kWh, ${floor.binding} 기준)에 못 미칩니다 — 목표를 하한 이상으로 높여야 합니다.`);
  if (!kch.ok) w.push(`KCH 개발수수료 산정 실패 — ${kch.reason} (가격환산 입찰가격에 KCH 환산분 0 반영)`);
  return w;
}

/** 시나리오 한 건을 계산한다 — 내보내기(buildExportSheets)는 이 결과를 옮기기만 하고 계산하지 않는다. */
export function computeScenario(inputs, meta = {}) {
  const built = buildModelFromInputs(inputs ?? {});
  const fields = built.fields;
  const solved = solveCurrentModelNode(inputs ?? {});
  const floor = computeFloorPriceNode(inputs ?? {});
  const kch = kchCompute(fields);
  const totalGenKWh = totalLifetimeGenerationKWh(built.model);
  const kchIncrementPerKWh = (kch.ok && Number.isFinite(kch.lifetimeTotal) && totalGenKWh > 0) ? (kch.lifetimeTotal * HUNDRED_MILLION) / totalGenKWh : 0;
  // 아티팩트는 가격환산 입찰가격 칸에 (적정 입찰단가 + 환산분).toFixed(2)를 써넣고 그 값으로 점수를 계산한다 — 같은 순서로 반올림.
  const bidPrice65 = solved.ok ? Number((solved.price + kchIncrementPerKWh).toFixed(2)) : NaN;
  const link = { totalGenKWh, kchIncrementPerKWh, bidPrice65, savedBidPrice: fields.bidPrice };
  const ps = priceScoreCompute(num(fields, "minPrice", 18), bidPrice65, num(fields, "priceCap", 50));
  const sens = solved.ok ? computeSensitivityNode(inputs ?? {}, solved.price) : null;
  const c = { label: meta.label || "아티팩트 기본값 (96MW 기본안)", savedAt: meta.savedAt || null, built, fields, solved, floor, kch, link, ps, sens };
  c.warnings = collectWarnings(c);
  return c;
}

// ============================================================================
// 계층 3 — 도메인 → 시트 (excel-export-spec.md 8장). 계산은 하지 않는다: computeScenario() 결과를 옮기기만 한다.
// 숫자는 숫자로(비율 0~1 + 0.00% 서식, 금액 + #,##0.0 서식, 음수는 [Red] 서식), 계산 불가 값은 빈 셀.
// 시트 순서 = 결론 → 근거 → 원자료:
//   요약 · 입력값 · 연도별 현금흐름 · 민감도 · (시나리오 비교) · 가격환산 · KCH 개발수수료 · 부록1 손익계산서 · 부록2 부채상환 · 부록3 현금흐름 전체
// ============================================================================

const C = COLORS;
const TAB = { 요약: C.ACCENT, 입력값: C.INK2, 현금흐름: C.REV, 민감도: C.OPEX, 시나리오: C.MUTED, 가격환산: C.ACCENT, KCH: C.REV, 부록: "FFCBD2DA" };

// ── 셀 헬퍼 — 시트 정의가 한 줄에 한 행으로 읽히도록 짧은 이름을 쓴다 ──
const cell = (v, s) => ({ v, s });
/** 소수 자릿수를 맞추고, 유한하지 않은 값은 빈 셀로 떨어뜨린다('—'·'N/A' 문자열을 넣으면 그 칼럼이 텍스트로 오염된다) */
const fin = (v, d) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d)));
const title = (v) => cell(v, "TITLE");
const sub = (v) => cell(v, "SUBTITLE");
const head = (v) => cell(v, "HEADER");
const lab = (v) => cell(v, "LABEL");
const labB = (v) => cell(v, "LABEL_B");
const labIn = (v) => cell(v, "LABEL_IN");
const txt = (v) => cell(v, "TEXT");
const note = (v) => cell(v, "NOTE");
const rem = (v) => cell(v || null, "REMARK");
const n1 = (v) => cell(fin(v, 1), "NUM1");
const n2 = (v) => cell(fin(v, 2), "NUM2");
const n3 = (v) => cell(fin(v, 3), "NUM3");
const n4 = (v) => cell(fin(v, 4), "NUM4");
const dec3 = (v) => cell(fin(v, 3), "DEC3");
const sgn = (v) => cell(fin(v, 1), "SIGNED");
const sgn3 = (v) => cell(fin(v, 3), "SIGNED3");
const int = (v) => cell(fin(v, 0), "INT");
const yrv = (v) => cell(fin(v, 0), "YEAR_V");
const pc = (v) => cell(v == null || !Number.isFinite(v) ? null : Number(v.toFixed(6)), "PCT"); // 원값 6자리 보존, 표시는 2자리
const pctIn = (p) => pc(Number.isFinite(p) ? p / 100 : null); // 화면 입력 %(5.2) → 0~1(0.052)
const yr = (v) => cell(v, "YEAR");
const ctr = (v) => cell(v, "CENTER");

/** 섹션 머리 — 배경색이 시트 폭 전체에 깔리도록 빈 칸까지 채운다 */
const section = (label, width) => [cell(label, "SECTION"), ...Array.from({ length: width - 1 }, () => cell(null, "SECTION"))];
const headerRow = (labels) => labels.map(head);
const blank = () => [];
/** 항목 | 값 | 단위 | 비고 — 비고는 테두리 없이 오른쪽 빈 칸으로 흘려 쓴다 */
const kv = (label, valueCell, unit = "", remark = "", labelCell = lab) => [labelCell(label), valueCell, ctr(unit), rem(remark)];

const pad2 = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
const dateTime = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const pct2 = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(2)}%` : "—"); // 비고(설명 문구) 전용 — 숫자 칸에는 쓰지 않는다
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");

const SOLVE_MODE_LABEL = { companyProfit: "당사 이익 목표", irr: "목표 IRR" };
const PROFIT_KIND_LABEL = { companyProfitPreTax: "누적 순이익 (세전)", companyProfitAfterTax: "누적 순이익 (세후)", companyDividendPlusRecovery: "누적 배당+최종회수" };
const IRR_KIND_LABEL = { projectIrr: "P-IRR (프로젝트)", equityIrr: "E-IRR (지분, 배당세전)", equityIrrAfterInvestorTax: "E-IRR (지분, 배당세후)" };
const CAPEX_MODE_LABEL = { itemized: "항목별 입력 (13개)", lumpsum: "EPC 총액 직접 입력" };
// 열거형은 한글로 풀고, 모르는 값이면 원값을 그대로 보인다
const label = (map, v) => map[v] || v || "";

const SHEET_GUIDE = [
  ["요약", "결론 한 장 — 적정 입찰단가·수익성·재원·당사 손익·확인 필요 사항"],
  ["입력값", "재현용 — 이 시트 값을 화면(A~F)에 넣으면 같은 결과가 나온다"],
  ["연도별 현금흐름", "원자료 — 매출·비용·조달·상환·배당·현금흐름 18칼럼 + 합계"],
  ["민감도", "무엇이 흔드나 — 대출금리 × OPEX 상승률 / EPC 총액, 지표 3종"],
  ["시나리오 비교", "여러 JSON을 함께 넣었을 때만 — 열 = 시나리오"],
  ["가격환산", "입찰가격(KCH 수수료 환산 포함) → 가격평가점수·한계 가격"],
  ["KCH 개발수수료", "SPC가 KCH에 지급하는 4개 수수료 — 생애주기 누적 수취액"],
  ["부록1 손익계산서", "검산용 — 현금흐름과 같은 원천값을 손익계산서 순서로(소수 3자리)"],
  ["부록2 부채상환", "검산용 — 선순위·주민채권 기초/이자/원금/기말 + DSCR 게이트"],
  ["부록3 현금흐름 전체", "검산용 — 계산 엔진의 연도별 중간값 43칼럼 전부"],
];

function summarySheet(c, now, hasScenarioSheet) {
  const W = 4, f = c.fields, pj = c.built.model.project, r = c.solved.ok ? c.solved.result : null;
  const rows = [
    [title("ESS 적정 입찰단가 산정 결과")],
    [sub(`${f.projectName || "(사업명 미입력)"} · ${c.label}`)],
    blank(),
    section("사업 개요", W),
    kv("사업명", txt(f.projectName || "(미입력)")),
    kv("시나리오", txt(c.label), "", c.savedAt ? `화면 저장 시각 ${String(c.savedAt).replace("T", " ").slice(0, 16)}` : "시나리오 파일 없이 기본값으로 계산"),
    kv("작성일시", txt(dateTime(now)), "", "이 파일을 만든 시각 — 파일만 따로 돌아다녀도 언제 숫자인지 알 수 있게"),
    kv("산정 기준", txt(label(SOLVE_MODE_LABEL, f.solveMode)), "", "이분탐색(Excel Goal Seek과 같은 원리)으로 목표를 만족하는 최소 단가를 역산"),
    f.solveMode === "irr"
      ? kv("목표 IRR", pctIn(num(f, "targetIrrPct", 8)), "", label(IRR_KIND_LABEL, f.irrKind || "projectIrr"))
      : kv("목표 당사 이익", n1(num(f, "targetCompanyProfit", 100)), "억원", label(PROFIT_KIND_LABEL, f.companyProfitKind || "companyProfitPreTax")),
    kv("계약용량 (입찰물량)", int(num(f, "contractCapacityMW")), "MW", "매출·방전량은 설치용량이 아니라 이 값 기준"),
    kv("설치용량 (참고)", n2(pj.totalPowerMW), "MW", "PCS 정격 합계"),
    blank(),
    section("적정 입찰단가", W),
    [cell("적정 입찰단가", "KPI_LABEL"), cell(c.solved.ok ? fin(c.solved.price, 2) : null, "KPI_PRICE"), ctr("원/kWh"),
      rem(c.solved.ok ? (f.solveMode === "irr" ? "목표 IRR 도달" : "목표 당사 이익 도달") : `산정 실패 — ${c.solved.reason}`)],
    kv("최저단가", n2(c.floor.ok ? c.floor.price : null), "원/kWh", c.floor.ok ? `P-IRR 6%·당사 이익 100억(15년 누적) 동시충족 최소 단가 — ${c.floor.binding} 기준` : "산정 불가"),
    kv("가격환산 입찰가격", n2(c.link.bidPrice65), "원/kWh", `적정 입찰단가 + KCH 개발수수료 환산분 ${f2(c.link.kchIncrementPerKWh)}원/kWh`),
    kv("가격평가점수", n2(c.ps.ok ? c.ps.score : null), "점", c.ps.ok ? `최저입찰가격 ${c.ps.min} ÷ 입찰가격 × 가격배점 ${c.ps.cap}` : "계산 불가"),
  ];
  if (r) {
    const fu = r.funding;
    rows.push(blank(), section("수익성 지표", W),
      [cell("달성 P-IRR", "KPI_LABEL"), cell(fin(r.projectIrr, 6), "KPI_PCT"), ctr(""), rem("법인세 차감 후 프로젝트 현금흐름 기준")],
      [cell("달성 E-IRR (배당세전)", "KPI_LABEL"), cell(fin(r.equityIrr, 6), "KPI_PCT"), ctr(""), rem("SPC 지분 현금흐름 — 대출금리가 원리금으로 직접 반영")],
      [cell("달성 E-IRR (배당세후)", "KPI_LABEL"), cell(fin(r.equityIrrAfterInvestorTax, 6), "KPI_PCT"), ctr(""), rem(`투자자 배당소득세 ${ASSUMPTIONS.investorDividendTaxPct}% 차감 후`)],
      [cell("NPV", "KPI_LABEL"), cell(fin(r.projectNpv, 1), "KPI_NUM"), ctr("억원"), rem(`할인율 ${ASSUMPTIONS.waccPct}% · ${pj.startYear}년(사업 시작연도)으로 할인`)],
      blank(), section("규모 · 매출", W),
      kv("연간 방전전력량 (환산)", n2(r.annualGenerationMWh / 1000), "GWh", "가동일수가 온전한 첫 운영연도 기준"),
      kv("연간 매출 (환산)", n2(r.annualRevenue), "억원", "같은 연도 기준 · 입찰단가 × 방전량 × 정산 배율"),
      kv("생애주기 총 방전량", int(c.link.totalGenKWh / 1000), "MWh", `운영 ${pj.operationYears}년 합계(첫해·마지막 해 일할)`),
      blank(), section("사업비 · 재원", W),
      kv("총투자비", n1(fu.totalInvestment), "억원", "", labB),
      kv("직접공사비 (명목)", n1(fu.nominalDirectCapex), "억원", "건설비 물가상승 반영 · 감가상각 대상", labIn),
      kv("예비비", n1(fu.contingency), "억원", "감가상각 대상", labIn),
      kv("건설기간 이자 (IDC)", n1(fu.constructionInterest), "억원", "", labIn),
      kv("금융수수료", n1(fu.financeFee), "억원", "", labIn),
      kv("DSRA", n1(fu.dsra), "억원", "사업 종료 시 회수", labIn),
      kv("자금조달 합계", n1(fu.equityPrincipal + fu.seniorPrincipal + fu.bondPrincipal), "억원", "", labB),
      kv(`자기자본 (${num(f, "equityPct")}%)`, n1(fu.equityPrincipal), "억원", "", labIn),
      kv(`선순위대출 (금리 ${num(f, "seniorRatePct")}%)`, n1(fu.seniorPrincipal), "억원", "", labIn),
      kv(`주민참여채권 (${num(f, "residentBondPct")}%)`, n1(fu.bondPrincipal), "억원", "", labIn),
      kv("검증: 총투자비 − 자금조달 합계", n2(fu.totalInvestment - (fu.equityPrincipal + fu.seniorPrincipal + fu.bondPrincipal)), "억원", "0.00 이어야 함"),
      blank(), section("당사(KCH 지분) 손익", W),
      kv("당사 지분율", pctIn(num(f, "kchSharePct")), "", "금액에만 곱함 — IRR은 지분율과 무관"),
      kv("당사 누적 출자금", n1(r.companyEquityInjected), "억원"),
      kv("당사 누적 배당+최종회수", n1(r.companyDividendPlusRecovery), "억원"),
      kv("당사 누적 순이익 (세전)", n1(r.companyProfitPreTax), "억원", "", labB),
      kv("당사 누적 순이익 (세후)", n1(r.companyProfitAfterTax), "억원"),
      kv("투자배수 MOIC", n2(r.companyProfitMultiple), "배", "(배당+최종회수) ÷ 출자금"),
      blank(), section("사업 기간", W),
      kv("사업 시작연도", yrv(pj.startYear), "년"),
      kv("상업운전개시일 (COD)", txt(`${pj.codYear}-${pad2(pj.codMonth)}-${pad2(pj.codDay)}`)),
      kv("운영기간", int(pj.operationYears), "년", "첫해·마지막 해는 가동일수만큼 일할 — 달력 연도로는 1개 더 걸친다"),
      kv("사업 종료연도", yrv(r.detail[r.detail.length - 1].calendarYear), "년"));
  }
  if (c.warnings.length) {
    rows.push(blank(), section("확인 필요", W));
    for (const w of c.warnings) rows.push([cell(`· ${w}`, "WARN")]);
  }
  rows.push(blank(), section("시트 안내", W));
  for (const [name, role] of SHEET_GUIDE) {
    if (name === "시나리오 비교" && !hasScenarioSheet) continue;
    if (!r && ["연도별 현금흐름", "민감도", "부록1 손익계산서", "부록2 부채상환", "부록3 현금흐름 전체"].includes(name)) continue;
    rows.push([labB(name), cell(null, "LABEL"), cell(null, "LABEL"), rem(role)]);
  }
  rows.push(blank(),
    [note("사전 검토용 개략 계산입니다 — 금융약정용 정식 재무모델을 대체하지 않습니다. 재무 프리셋·CAPEX·OPEX는 초안값이며 확정이 필요합니다.")],
    [note("모든 수치는 ESS 적정 입찰단가 프로토타입(화면)과 같은 계산 엔진으로 다시 계산한 값입니다. 금액 단위는 억원(별도 표기 제외).")],
    [note("계산할 수 없는 값은 빈 칸입니다 — 숫자 칸에 문자를 넣지 않아 정렬·차트·수식을 그대로 쓸 수 있습니다.")]);
  return { name: "요약", rows, colWidths: [34, 16, 9, 64], merges: ["A1:D1", "A2:D2"], freeze: { row: 2 }, tabColor: TAB.요약, fit: "width" };
}

function inputSheet(c) {
  const W = 4, f = c.fields, b = c.built, pj = b.model.project;
  const calcNote = "계산값";
  const rows = [
    [title("입력값 — 이 시트만으로 같은 결과를 재현할 수 있게")],
    [sub(`${f.projectName || "(사업명 미입력)"} · ${c.label} · 화면 좌측 A~F 구역과 같은 순서`)],
    blank(),
    section("A. 산정 기준", W),
    kv("산정 기준", txt(label(SOLVE_MODE_LABEL, f.solveMode))),
  ];
  if (f.solveMode === "irr") rows.push(kv("기준 IRR", txt(label(IRR_KIND_LABEL, f.irrKind || "projectIrr"))), kv("목표 IRR", pctIn(num(f, "targetIrrPct", 8))));
  else rows.push(kv("당사 이익 구성 기준", txt(label(PROFIT_KIND_LABEL, f.companyProfitKind || "companyProfitPreTax"))), kv("목표 당사 이익", n1(num(f, "targetCompanyProfit", 100)), "억원"));
  rows.push(blank(), section("B. 사업개요", W),
    kv("사업명", txt(f.projectName || "")),
    kv("배터리 유닛 대수", int(num(f, "unitCount")), "대"),
    kv("대당 저장용량", dec3(num(f, "unitStorageMWh")), "MWh/대"),
    kv("설치 저장용량", n1(pj.totalStorageMWh), "MWh", calcNote, labIn),
    kv("PCS 대수", int(num(f, "pcsUnitCount")), "대"),
    kv("대당 PCS 출력", n2(num(f, "unitPowerMW")), "MW/대"),
    kv("설치 출력용량 (PCS 정격 합계)", n2(pj.totalPowerMW), "MW", calcNote, labIn),
    kv("저장시간 (설치 기준)", n2(b.model.revenue.durationHours), "h", calcNote, labIn),
    kv("사업 시작연도", yrv(pj.startYear), "년"),
    kv("사업 종료연도", yrv(pj.endYear), "년", b.calendarMismatch ? "COD연도+운영기간과 다름 — 확인 필요" : "COD연도+운영기간과 일치"),
    kv("공사기간", int(pj.constructionYears), "년"),
    kv("운영기간", int(pj.operationYears), "년"),
    kv("상업운전개시일 (COD)", txt(f.codDate || "")),
    kv("개발기간", int(b.developmentYears), "년", calcNote, labIn),
    blank(), section("C. 발전매출", W),
    kv("계약용량 (입찰물량)", int(num(f, "contractCapacityMW")), "MW", "공고 신고 범위 10MW 초과~100MW 미만"),
    kv("1년차 가동률", pctIn(num(f, "year1RatePct"))),
    kv("2년차 가동률", pctIn(num(f, "year2RatePct"))),
    kv("기본 가동률 (3년차~)", pctIn(num(f, "operatingRatePct")), "", "아래 연차별 표가 실제 계산에 쓰인 값"),
    kv("계획 대비 준공지연일수", int(pj.delayDays), "일", ["정상준공", "1단계 (180일 이하, 계약가격 감액)", "2단계 (180일 초과~2년, 거래기간 단축)", "3단계 (2년 초과, 계약 해지)"][pj.delayStage]),
    kv("연평균 미이행률", pctIn(b.model.revenue.avgNonCompliancePct), "", "정산금에만 일괄 할인(공고 Ⅴ.가 근사)"),
    kv("정산금 적용 배율", n4(pj.delayStage === 3 ? 0 : b.model.revenue.priceAdjustmentFactor * (1 - b.model.revenue.avgNonCompliancePct / 100)), "배", calcNote, labIn),
    blank(), headerRow(["운영연차", "가동률", "연도", "비고"]));
  const opYears = c.solved.ok ? c.solved.result.detail.filter((d) => d.operatingDays > 0) : [];
  b.operatingRatesPct.forEach((v, i) => rows.push([ctr(`${i + 1}년차`), pctIn(v), opYears[i] ? yr(opYears[i].calendarYear) : ctr(""), rem(i === 0 ? "첫해는 COD부터 일할" : "")]));
  rows.push(blank(), section("D. CAPEX", W),
    kv("건설비 물가상승률", pctIn(num(f, "constructionInflationPct")), "/년"),
    kv("예비비", pctIn(num(f, "contingencyPct")), "", "직접공사비 대비"),
    kv("개발기간 집행 비중", pctIn(num(f, "developmentSharePct"))),
    kv("CAPEX 입력 방식", txt(label(CAPEX_MODE_LABEL, f.capexInputMode || "itemized"))));
  if (f.capexInputMode === "lumpsum") rows.push(kv("EPC 총액 (수기 입력)", n1(num(f, "capexLumpSum")), "억원", "이 값 하나가 계산에 쓰인다"));
  rows.push(blank(), headerRow(["항목", "금액 (억원)", "분류", "비고"]));
  const capexForTable = f.capexInputMode === "lumpsum"
    ? CAPEX_ITEMS.map((it, i) => ({ ...it, value: +((c.inputsRaw?.capexItems ?? [])[i] ?? it.value) || 0 }))
    : b.capexItems;
  capexForTable.forEach((it) => rows.push([lab(it.label), n2(it.value), ctr(it.category || ""), rem(f.capexInputMode === "lumpsum" ? "총액 모드 — 계산에 쓰이지 않음" : "")]));
  rows.push([cell("합계", "TOTAL_LABEL"), cell(fin(sum(capexForTable.map((i) => i.value)), 2), "TOTAL_NUM2"), cell(null, "TOTAL_LABEL"), rem("")]);
  rows.push(blank(), section("E. OPEX", W),
    kv("변동 O&M", int(num(f, "variableOMPerMWh")), "원/MWh"),
    kv("전력거래수수료", n4(num(f, "powerTradingFeePerKWh")), "원/kWh", "실제 방전량 비례"),
    kv("연간 운영보험료율", pctIn(num(f, "insurancePct")), "", "총투자비 대비"),
    kv("주민·지역 기여", pctIn(num(f, "communityRevenuePct")), "", "매출 대비"),
    kv("OPEX 물가상승률", pctIn(num(f, "opexEscalationPct")), "/년"),
    kv("LTSA 단가 변경 시점", int(num(f, "ltsaStepAfterYear")), "년차 후"),
    kv("LTSA 변경 후 단가 배율", pctIn(num(f, "ltsaStepMultiplierPct")), "", "배터리·PCS LTSA 항목에만"),
    blank(), headerRow(["고정비 항목", "금액 (억원/년)", "", "비고"]));
  b.opexItems.forEach((it) => rows.push([lab(it.label), n2(it.value), ctr(""), rem("")]));
  rows.push([cell("합계", "TOTAL_LABEL"), cell(fin(sum(b.opexItems.map((i) => i.value)), 2), "TOTAL_NUM2"), cell(null, "TOTAL_LABEL"), rem("")]);
  rows.push(blank(), section("F. 금융 · 세무", W),
    kv("자기자본 비율", pctIn(num(f, "equityPct")), "", "총투자비 대비"),
    kv("주민참여채권 비율", pctIn(num(f, "residentBondPct")), "", "총투자비 대비"),
    kv("선순위 대출금리", pctIn(num(f, "seniorRatePct"))),
    kv("선순위 상환기간", int(num(f, "seniorTermYears")), "년", "원리금균등"),
    kv("원금 거치기간", int(num(f, "seniorGraceYears")), "년"),
    kv("주민참여채권 금리", pctIn(num(f, "bondRatePct"))),
    kv("주민참여채권 만기", int(num(f, "bondTermYears")), "년", "만기 일시상환"),
    kv("금융부대비용", pctIn(num(f, "financeFeePct")), "", "타인자본 대비"),
    kv("건설기간 적용금리", pctIn(num(f, "constructionRatePct"))),
    kv("DSRA", int(num(f, "dsraMonths")), "개월", "부채상환액 기준"),
    kv("당사(KCH) 지분율", pctIn(num(f, "kchSharePct")), "", "보통주 — 당사 손익 금액에만 곱함"),
    blank(), headerRow(["세무 · 배당 프리셋 (읽기 전용)", "값", "단위", "비고"]),
    kv("WACC · 할인율", pctIn(ASSUMPTIONS.waccPct)),
    kv("정액 감가상각 기간", int(ASSUMPTIONS.depreciationYears), "년", "직접공사비+예비비 대상"),
    kv("이월결손금 공제기간", int(ASSUMPTIONS.nolCarryforwardYears), "년"),
    kv("연간 DSCR 임계치", n2(ASSUMPTIONS.annualDscrThreshold), "배", "미달 시 배당 유보"),
    kv("누적 DSCR 임계치", n2(ASSUMPTIONS.cumulativeDscrThreshold), "배", "미달 시 배당 유보"),
    kv("법정준비금 적립률", pctIn(ASSUMPTIONS.legalReserveContributionPct), "", "배당가능액 대비"),
    kv("법정준비금 상한", pctIn(ASSUMPTIONS.legalReserveCapPctOfEquity), "", "자기자본 대비"),
    kv("투자자 배당소득세", pctIn(ASSUMPTIONS.investorDividendTaxPct)),
    blank(), headerRow(["법인세 누진구간 (지방소득세 포함)", "과세표준 상한 (억원)", "세율", "비고"]));
  let lower = 0;
  TAX_BRACKETS.forEach((t) => {
    rows.push([lab(t.upTo === null ? `${lower.toLocaleString("ko-KR")}억 초과` : `${lower.toLocaleString("ko-KR")}억 초과 ~ ${t.upTo.toLocaleString("ko-KR")}억 이하`), n1(t.upTo), pctIn(t.ratePct), rem(t.upTo === null ? "상한 없음(빈 칸)" : "")]);
    lower = t.upTo ?? lower;
  });
  rows.push(blank(), section("가격환산 입력", W),
    kv("최저입찰가격", n2(num(f, "minPrice", 18)), "원/kWh"),
    kv("가격배점 (만점)", int(num(f, "priceCap", 50)), "점"),
    blank(), [note("KCH 개발수수료 입력은 'KCH 개발수수료' 시트에 있습니다. 비율은 0~1 값에 % 서식을 입혔습니다(5.20% = 0.052).")]);
  return { name: "입력값", rows, colWidths: [34, 16, 10, 48], merges: ["A1:D1", "A2:D2"], freeze: { row: 2 }, tabColor: TAB.입력값, fit: "width" };
}

// 연도별 현금흐름 — 원자료. t=합계 대상(흐름 변수). 잔액·DSCR·누적·가동률 같은 스톡·비율은 더하지 않는다(빈 칸, 서식은 유지).
function cashflowSheet(c) {
  const d = c.solved.result.detail;
  let run = 0;
  const cum = d.map((x) => (run += x.projectFlow));
  const COLS = [
    { h: "연도", v: (x) => x.calendarYear, s: "YEAR", w: 8 },
    { h: "단계", v: (x) => x.phase, s: "CENTER", w: 11 },
    { h: "가동률", v: (x) => (x.ratePct == null ? null : x.ratePct / 100), s: "PCT", w: 8 },
    { h: "방전량\n(MWh)", v: (x) => x.generationMWh, s: "INT", t: "TOTAL_INT", w: 11 },
    { h: "매출", v: (x) => x.revenue, s: "NUM1", t: "TOTAL_NUM" },
    { h: "OPEX", v: (x) => x.opex, s: "NUM1", t: "TOTAL_NUM" },
    { h: "EBITDA", v: (x) => x.ebitda, s: "SIGNED", t: "TOTAL_SIGNED" },
    { h: "CAPEX\n집행", v: (x) => x.capexDraw, s: "NUM1", t: "TOTAL_NUM" },
    { h: "자기자본\n조달", v: (x) => x.equityDraw, s: "NUM1", t: "TOTAL_NUM" },
    { h: "타인자본\n조달", v: (x) => x.seniorDraw + x.bondDraw, s: "NUM1", t: "TOTAL_NUM" },
    { h: "원리금\n상환", v: (x) => x.debtService, s: "NUM1", t: "TOTAL_NUM" },
    { h: "DSCR\n(연간)", v: (x) => x.dscr, s: "DEC3", w: 8 },
    { h: "법인세", v: (x) => x.corporateTax, s: "NUM1", t: "TOTAL_NUM" },
    { h: "배당", v: (x) => x.dividend, s: "NUM1", t: "TOTAL_NUM" },
    { h: "최종\n회수", v: (x) => x.terminalRecovery, s: "NUM1", t: "TOTAL_NUM" },
    { h: "프로젝트 CF\n(세후)", v: (x) => x.projectFlow, s: "SIGNED", t: "TOTAL_SIGNED" },
    { h: "누적\n프로젝트 CF", v: (_, i) => cum[i], s: "SIGNED" },
    { h: "당사 지분 CF\n(세전)", v: (x) => x.companyEquityFlow, s: "SIGNED", t: "TOTAL_SIGNED" },
  ];
  const DIGITS = { NUM1: 1, SIGNED: 1, INT: 0, DEC3: 3, YEAR: 0 };
  const valueCell = (col, v) => (col.s === "PCT" ? pc(v) : col.s === "CENTER" ? ctr(v) : cell(fin(v, DIGITS[col.s] ?? 1), col.s));
  const rows = [
    [title("연도별 현금흐름")],
    [sub(`금액 단위 억원 · 적정 입찰단가 ${f2(c.solved.price)}원/kWh 기준 · 음수는 빨강 · 합계 행은 흐름 변수만(DSCR·누적은 더하지 않음)`)],
    headerRow(COLS.map((col) => col.h)),
    ...d.map((x, i) => COLS.map((col) => valueCell(col, col.v(x, i)))),
    COLS.map((col, j) => (j === 0 ? cell("합계", "TOTAL_LABEL") : col.t ? cell(fin(sum(d.map((x, i) => col.v(x, i) || 0)), col.s === "INT" ? 0 : 1), col.t) : cell(null, "TOTAL_LABEL"))),
    blank(),
    [note("CAPEX 집행에는 예비비·건설기간 이자·금융수수료·DSRA가 포함됩니다(총투자비와 같은 합). 최종 회수 = DSRA + 법정준비금 + 유보현금.")],
    [note("DSCR 게이트·법정준비금·NOL 등 모든 중간값은 '부록3 현금흐름 전체' 시트에 있습니다.")],
  ];
  return { name: "연도별 현금흐름", rows, colWidths: COLS.map((col) => col.w || 10.5), merges: [`A1:${colName(COLS.length - 1)}1`, `A2:${colName(COLS.length - 1)}2`],
    freeze: { row: 3, col: 1 }, tabColor: TAB.현금흐름, fit: "width", printTitles: { rows: "1:3" } };
}

// 화면 heatClass()와 같은 5단계 — 기준값의 8%를 임계로, 중간(3)은 칠하지 않는다
function heatLevel(value, base) {
  if (!Number.isFinite(value) || !Number.isFinite(base)) return 3;
  const diff = value - base, scale = Math.abs(base) > 1e-9 ? Math.abs(base) * 0.08 : 1;
  if (diff > scale) return 5;
  if (diff > scale * 0.25) return 4;
  if (diff < -scale) return 1;
  if (diff < -scale * 0.25) return 2;
  return 3;
}
const SENS_METRICS_X = [
  { id: "equityIrr", label: "E-IRR (배당세전)", kind: "pct" },
  { id: "equityIrrAfterInvestorTax", label: "E-IRR (배당세후)", kind: "pct" },
  { id: "companyProfitPreTax", label: "당사 누적 순이익 (세전, 억원)", kind: "num" },
];
const deltaLabel = (v, unit, d) => (v === 0 ? "기준" : `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(d)}${unit}`);

function sensitivitySheet(c) {
  const s = c.sens, W = 9;
  const bi = SENS_RATE_DELTAS.indexOf(0), bj = SENS_OPEX_DELTAS.indexOf(0), bk = SENS_EPC_DELTAS.indexOf(0);
  const val = (cellObj, id) => (cellObj ? cellObj[id] : NaN);
  const rateOf = (rd) => Math.max(0, s.baseRate + rd), opexOf = (od) => Math.max(0, s.baseOpex + od), epcOf = (ed) => s.baseEpc * (1 + ed / 100);
  const rows = [
    [title("민감도 — 적정 입찰단가 고정")],
    [sub(`적정 입찰단가 ${f2(s.bidPrice)}원/kWh 고정 · 표에 적힌 두 변수 외 가정은 입력값 그대로 · 화면 민감도 탭과 같은 계산`)],
    blank(),
    section("변수별 영향 범위 — E-IRR (배당세전), 변수 하나만 표 양 끝까지 움직였을 때", W),
    headerRow(["변수", "변동폭", "낮은 쪽 입력", "낮은 쪽 E-IRR", "기준 E-IRR", "높은 쪽 입력", "높은 쪽 E-IRR", "범위 (%p)", ""]),
  ];
  const base = val(s.macro[bi][bj], "equityIrr");
  const last = SENS_RATE_DELTAS.length - 1;
  const tornado = [
    { name: "선순위 대출금리", span: "±1.5%p", a: val(s.macro[0][bj], "equityIrr"), b: val(s.macro[last][bj], "equityIrr"), aIn: pctIn(rateOf(SENS_RATE_DELTAS[0])), bIn: pctIn(rateOf(SENS_RATE_DELTAS[last])) },
    { name: "OPEX 물가상승률", span: "±1.5%p", a: val(s.macro[bi][0], "equityIrr"), b: val(s.macro[bi][last], "equityIrr"), aIn: pctIn(opexOf(SENS_OPEX_DELTAS[0])), bIn: pctIn(opexOf(SENS_OPEX_DELTAS[last])) },
    { name: "EPC 총액", span: "±15%", a: val(s.epc[bi][0], "equityIrr"), b: val(s.epc[bi][last], "equityIrr"), aIn: n1(epcOf(SENS_EPC_DELTAS[0])), bIn: n1(epcOf(SENS_EPC_DELTAS[last])) },
  ].sort((p, q) => Math.abs(q.b - q.a) - Math.abs(p.b - p.a));
  for (const t of tornado) {
    const lowFirst = t.a <= t.b;
    rows.push([labB(t.name), ctr(t.span), lowFirst ? t.aIn : t.bIn, pc(Math.min(t.a, t.b)), cell(fin(base, 6), "TOTAL_PCT"), lowFirst ? t.bIn : t.aIn, pc(Math.max(t.a, t.b)), n2(Math.abs(t.b - t.a) * 100), rem("")]);
  }
  const MATRICES = [
    { key: "macro", title: "1) 선순위 대출금리 × OPEX 물가상승률", colName: "OPEX 상승률", cols: SENS_OPEX_DELTAS, colLabel: (v) => deltaLabel(v, "%p", 1), colActual: (v) => pctIn(opexOf(v)), colStyle: "AXIS_PCT" },
    { key: "epc", title: "2) 선순위 대출금리 × EPC 총액", colName: "EPC 총액(억원)", cols: SENS_EPC_DELTAS, colLabel: (v) => deltaLabel(v, "%", 0), colActual: (v) => n1(epcOf(v)), colStyle: "AXIS_NUM1" },
  ];
  for (const m of MATRICES) {
    const grid = s[m.key], bc = m.cols.indexOf(0);
    for (const metric of SENS_METRICS_X) {
      const baseV = val(grid[bi][bc], metric.id);
      rows.push(blank(), section(`${m.title} — ${metric.label}`, W),
        headerRow(["대출금리 변동", "실제 금리", ...m.cols.map(m.colLabel)]),
        [cell(`${m.colName} 실제값 →`, "AXIS_LABEL"), cell(null, "AXIS_LABEL"), ...m.cols.map((v) => ({ ...m.colActual(v), s: m.colStyle }))]);
      SENS_RATE_DELTAS.forEach((rd, i) => {
        const cells = m.cols.map((_, j) => {
          const v = val(grid[i][j], metric.id);
          if (i === bi && j === bc) return cell(metric.kind === "pct" ? fin(v, 6) : fin(v, 1), metric.kind === "pct" ? "TOTAL_PCT" : "TOTAL_NUM");
          const lvl = heatLevel(v, baseV);
          const st = metric.kind === "pct" ? (lvl === 3 ? "PCT" : `PCT_H${lvl}`) : (lvl === 3 ? "NUM1" : `NUM1_H${lvl}`);
          return cell(metric.kind === "pct" ? fin(v, 6) : fin(v, 1), st);
        });
        rows.push([labB(deltaLabel(rd, "%p", 1)), { ...pctIn(rateOf(rd)), s: "AXIS_PCT" }, ...cells]);
      });
    }
  }
  rows.push(blank(),
    [note("읽는 법 — 색은 기준 칸(굵게, 회색 바탕) 대비입니다: 기준값의 8% 이상 차이면 진한 초록·빨강, 2%~8%는 옅은 색, 그 안쪽은 무색.")],
    [note("두 표는 각각 두 변수만 함께 움직인 결과입니다 — 금리·OPEX 상승률·EPC 총액이 동시에 나빠지는 경우는 담지 않습니다(시나리오로 비교).")],
    [note("P-IRR 대신 E-IRR을 쓰는 이유 — 본 모델의 P-IRR은 원리금 상환이 현금흐름에서 빠지는 정의라, 대출금리가 오히려 P-IRR을 올리는 역설이 있습니다.")],
    [note("화면은 한 칸에 두 줄(값·기준 대비 차이)로 보여주지만, 엑셀은 계산에 쓰도록 값만 넣고 변수의 실제 값을 행·열 머리에 따로 적었습니다.")]);
  return { name: "민감도", rows, colWidths: [16, 11, 11, 11, 11, 11, 11, 11, 11], merges: ["A1:I1", "A2:I2"], freeze: { row: 2 }, tabColor: TAB.민감도, fit: "width" };
}

// 시나리오 비교 — 열 = 시나리오(사용자가 붙인 이름 그대로). 마지막 열에 결과 행의 "가장 유리한" 시나리오 이름을 적는다.
function scenarioSheet(cs) {
  const n = cs.length, W = n + 2;
  const R = (c) => (c.solved.ok ? c.solved.result : null);
  const ROWS = [
    ["가정"],
    ["사업명", (c) => txt(c.fields.projectName || "")],
    ["산정 기준", (c) => txt(label(SOLVE_MODE_LABEL, c.fields.solveMode))],
    ["목표", (c) => txt(c.fields.solveMode === "irr" ? `${num(c.fields, "targetIrrPct", 8)}% (${label(IRR_KIND_LABEL, c.fields.irrKind || "projectIrr")})` : `${num(c.fields, "targetCompanyProfit", 100)}억원 (${label(PROFIT_KIND_LABEL, c.fields.companyProfitKind || "companyProfitPreTax")})`)],
    ["계약용량 (MW)", (c) => int(num(c.fields, "contractCapacityMW"))],
    ["CAPEX 합계 (억원)", (c) => n1(sum(c.built.capexItems.map((i) => i.value)))],
    ["OPEX 고정비 합계 (억원/년)", (c) => n1(sum(c.built.opexItems.map((i) => i.value)))],
    ["선순위 대출금리", (c) => pctIn(num(c.fields, "seniorRatePct"))],
    ["자기자본 비율", (c) => pctIn(num(c.fields, "equityPct"))],
    ["OPEX 물가상승률", (c) => pctIn(num(c.fields, "opexEscalationPct"))],
    ["운영기간 (년)", (c) => int(num(c.fields, "operationYears"))],
    ["결과"],
    ["적정 입찰단가 (원/kWh)", (c) => n2(c.solved.ok ? c.solved.price : null), false],
    ["달성 상태", (c) => txt(c.solved.ok ? "목표 도달" : `실패 — ${c.solved.reason}`)],
    ["달성 P-IRR", (c) => pc(R(c)?.projectIrr), true],
    ["달성 E-IRR (배당세전)", (c) => pc(R(c)?.equityIrr), true],
    ["달성 E-IRR (배당세후)", (c) => pc(R(c)?.equityIrrAfterInvestorTax), true],
    ["NPV (억원)", (c) => sgn(R(c)?.projectNpv), true],
    ["총투자비 (억원)", (c) => n1(R(c)?.totalInvestment)],
    ["연간 매출 (환산, 억원)", (c) => n2(R(c)?.annualRevenue)],
    ["당사 누적 출자금 (억원)", (c) => n1(R(c)?.companyEquityInjected)],
    ["당사 누적 배당+최종회수 (억원)", (c) => n1(R(c)?.companyDividendPlusRecovery), true],
    ["당사 누적 순이익 세전 (억원)", (c) => n1(R(c)?.companyProfitPreTax), true],
    ["당사 누적 순이익 세후 (억원)", (c) => n1(R(c)?.companyProfitAfterTax), true],
    ["투자배수 MOIC (배)", (c) => n2(R(c)?.companyProfitMultiple), true],
    ["가격환산 입찰가격 (원/kWh)", (c) => n2(c.link.bidPrice65)],
    ["가격평가점수 (점)", (c) => n2(c.ps.ok ? c.ps.score : null), true],
  ];
  const rows = [
    [title("시나리오 비교")],
    [sub("열 = 시나리오 · 각 시나리오 JSON의 입력값으로 따로 다시 계산 · '가장 유리' 열은 결과 행만(적정 입찰단가는 낮을수록 유리)")],
    blank(),
    headerRow(["항목", ...cs.map((c) => c.label), "가장 유리"]),
  ];
  for (const [lbl, pick, higher] of ROWS) {
    if (!pick) { rows.push(section(lbl, W)); continue; }
    const cells = cs.map(pick);
    let best = "";
    if (higher !== undefined) {
      const vals = cells.map((x) => (typeof x.v === "number" ? x.v : null));
      const valid = vals.filter((v) => v != null);
      if (valid.length > 1 && Math.max(...valid) !== Math.min(...valid)) {
        const target = higher ? Math.max(...valid) : Math.min(...valid);
        best = cs.filter((_, i) => vals[i] === target).map((c) => c.label).join(", ");
      }
    }
    rows.push([lab(lbl), ...cells, cell(best || null, "GOOD_TEXT")]);
  }
  rows.push(blank(), [note("같은 목표를 더 낮은 단가로 달성할수록 입찰 경쟁력이 높다고 보고 적정 입찰단가는 낮은 쪽을 유리로 표시했습니다. 총투자비·매출 등 참고값은 비교하지 않습니다.")]);
  const last = colName(W - 1);
  return { name: "시나리오 비교", rows, colWidths: [30, ...cs.map(() => 18), 20], merges: [`A1:${last}1`, `A2:${last}2`], freeze: { row: 4, col: 1 }, tabColor: TAB.시나리오, fit: "width" };
}

function priceSheet(c) {
  const W = 5, ps = c.ps, lk = c.link, f = c.fields;
  const saved = f.bidPrice !== undefined && f.bidPrice !== "" ? +f.bidPrice : null;
  const mismatch = saved != null && Number.isFinite(saved) && Number.isFinite(lk.bidPrice65) && Math.abs(saved - lk.bidPrice65) > 0.01;
  const rows = [
    [title("가격환산 — 입찰가격과 가격평가점수")],
    [sub("전력거래소 공고 제2025-05호 Ⅲ.5 산식 · 입찰가격 = 적정 입찰단가 + KCH 개발수수료 원/kWh 환산분")],
    blank(),
    section("입찰가격 구성", W),
    kv("적정 입찰단가 (단가산정 원값)", n4(c.solved.ok ? c.solved.price : null), "원/kWh"),
    kv("생애주기 총 방전량", int(lk.totalGenKWh), "kWh", "계약용량 × 24h × 365 × 연차별 가동률, 운영기간 합계"),
    kv("KCH 생애주기 누적 수취액", n2(c.kch.ok ? c.kch.lifetimeTotal : null), "억원", c.kch.ok ? "'KCH 개발수수료' 시트" : "KCH 산정 실패 → 환산분 0"),
    kv("KCH 수수료 원/kWh 환산분", n4(lk.kchIncrementPerKWh), "원/kWh", "= 수취액 × 1억 ÷ 총 방전량 — SPC의 IRR·NPV·당사이익에는 영향 없음"),
    [cell("가격환산 입찰가격", "KPI_LABEL"), cell(fin(lk.bidPrice65, 2), "KPI_PRICE"), ctr("원/kWh"), rem("화면처럼 소수 둘째 자리로 반올림한 값으로 점수를 계산")],
  ];
  if (saved != null) rows.push(kv("화면 저장 당시 입찰가격", n2(saved), "원/kWh", mismatch ? "위 값과 다름 — 저장 당시 입찰가격을 직접 입력해 자동연동이 끊겼을 수 있음(이 시트는 자동연동 값 기준)" : "위 값과 같음"));
  rows.push(blank(), section("가격평가점수 = 최저입찰가격 ÷ 입찰가격 × 가격배점", W));
  if (!ps.ok) rows.push(kv("상태", txt("계산 불가 — 입찰가격이 없거나 0")));
  else {
    rows.push(
      kv("최저입찰가격", n2(ps.min), "원/kWh"),
      kv("입찰가격 (평가대상)", n2(ps.bid), "원/kWh"),
      kv("가격배점 (만점)", int(ps.cap), "점"),
      [cell("가격평가점수", "KPI_LABEL"), cell(fin(ps.score, 2), "KPI_NUM2"), ctr("점"), rem("소수 둘째 자리 반올림")],
      kv("방법 A. 한계(미분) 근사값", n4(ps.A), "원/kWh", "1점당 가격 = 입찰가격² ÷ (최저입찰가격 × 배점)"),
      kv("방법 B-1. +1점 상승에 필요한 가격 인하폭", n4(ps.B1), "원/kWh"),
      kv("방법 B-2. −1점 하락을 유발하는 가격 인상폭", n4(ps.B2), "원/kWh"),
      kv("방법 B 평균값 (권장)", n4(ps.Bavg), "원/kWh", "", labB),
      blank(), section("점수 변동별 목표 입찰가격", W),
      headerRow(["Δ점", "목표점수", "목표 입찰가격 (원/kWh)", "가격 변동 (원/kWh)", "비고"]));
    for (const d of ps.deltaRows) {
      const cur = d.d === 0, ok = d.targetScore > 0;
      rows.push([cell(d.d, cur ? "TOTAL_DELTA" : "DELTA"), cell(fin(d.targetScore, 2), cur ? "TOTAL_NUM2" : "NUM2"),
        cell(ok ? fin(d.targetPrice, 2) : null, cur ? "TOTAL_NUM2" : "NUM2"), cell(ok ? (cur ? 0 : fin(d.priceDelta, 2)) : null, cur ? "TOTAL_SIGNED_PRICE" : "SIGNED_PRICE"),
        cell(d.note, cur ? "TOTAL_LABEL" : "LABEL")]);
    }
  }
  return { name: "가격환산", rows, colWidths: [40, 16, 20, 18, 30], merges: ["A1:E1", "A2:E2"], freeze: { row: 2 }, tabColor: TAB.가격환산, fit: "width" };
}

function kchSheet(c) {
  const k = c.kch, km = k.m, W = 10;
  const rows = [
    [title("KCH 개발수수료 — 생애주기 누적 수취액")],
    [sub("SPC가 KCH(개발자)에게 지급하는 4개 수수료 · ESS 발전매출과 별개 · 입찰가격에는 원/kWh로 환산해 더한다('가격환산' 시트)")],
    blank(),
    section("산정 방식 · 사업 기본정보", W),
    kv("산정 방식", txt(k.directMode ? "총액 직접 입력 (권장)" : "목표 IRR 역산 (레거시)")),
    kv("설비용량", n1(km.capacityMW), "MW"),
    kv("저장용량", n1(km.storageMWh), "MWh"),
    kv("저장시간", n2(km.durationHours), "h", "계산값", labIn),
    kv("사업 시작연도", yrv(km.startYear), "년"),
    kv("개발기간", int(km.devYears), "년"),
    kv("공사기간", int(km.conYears), "년"),
    kv("운영기간", int(km.opYears), "년"),
    kv("COD 연도", yrv(km.codYear), "년", "계산값", labIn),
    blank(), section("KCH 비용 (현금유출)", W),
    kv("용지 매입·옵션 비용", n2(km.landCost), "억원", "최초 1회"),
    kv("개발·인허가비", n2(km.devCostAnnual), "억원/년", "개발+공사 기간"),
    kv("자체 관리비", n2(km.omCostAnnual), "억원/년", "운영기간"),
    blank(), section("수익원 4종 (기준총액 — 현재 설비용량 기준)", W),
    kv("① 부지 임대료", n2(km.leaseBase), "억원/년"),
    kv("① 연간 상승률", pctIn(km.leaseEsc)),
    kv("② 사전개발비", n2(km.devFeeBase), "억원", "COD 1회"),
    kv("③ 공동접속료 발생방식", txt(km.connMode === "일시금" ? "일시금 (COD 1회)" : "연간")),
    kv("③ 공동접속료 기준총액", n2(km.connBase), "억원"),
    kv("③ 연간 상승률", pctIn(km.connEsc), "", "연간 방식일 때"),
    kv("④ 운영수익", n2(km.omBase), "억원/년"),
    kv("④ 연간 상승률", pctIn(km.omEsc)),
    kv(k.directMode ? "목표 IRR (민감도표 색 기준)" : "목표 IRR", pc(km.targetIrr)),
    kv("할인율 (WACC, NPV용)", pc(km.wacc)),
    blank(), section("결과", W),
  ];
  if (!k.ok) {
    rows.push(kv("상태", txt(`산정 실패 — ${k.reason}`)));
    return { name: "KCH 개발수수료", rows, colWidths: [34, 14, 10, 12, 12, 12, 12, 12, 12, 12], merges: ["A1:J1", "A2:J2"], freeze: { row: 2 }, tabColor: TAB.KCH, fit: "width" };
  }
  if (!k.directMode) rows.push(kv("공통 가격배율 (자동 역산)", n4(k.sf), "배"));
  rows.push(
    kv("달성 IRR (참고)", pc(k.achievedIrr)),
    kv("NPV", sgn(k.npv), "억원"),
    kv("총수익 (운영기간 합계)", n2(k.totalRevenue), "억원"),
    kv("KCH 총비용", n2(k.totalCost), "억원"),
    [cell("생애주기 누적 총 수취액", "KPI_LABEL"), cell(fin(k.lifetimeTotal, 2), "KPI_NUM2"), ctr("억원"), rem("4개 수익원 합산(운영기간·상승률 반영)")],
    blank(), section("실제 적용 금액", W),
    kv("① 부지 임대료", n2(k.out.lease), "억원/년"),
    kv("② 사전개발비", n2(k.out.devFee), "억원"),
    kv("③ 공동접속료", n2(k.out.conn), "억원"),
    kv("④ 운영수익", n2(k.out.om), "억원/년"),
    blank(), section("연차별 현금흐름 (억원) — ①~④ 수익원 − KCH 비용 = 순현금흐름", W),
    headerRow(["연차 (n)", "연도", "단계", "① 부지임대료", "② 사전개발비", "③ 공동접속료", "④ 운영수익", "수익 합계", "KCH 비용", "순현금흐름"]));
  const flows = k.rows.filter((x) => x.phase !== "-");
  for (const x of flows) rows.push([int(x.n), yr(x.year), ctr(x.phase), n2(x.lease), n2(x.devFee), n2(x.conn), n2(x.om), n2(x.revenue), n2(x.cost), cell(fin(x.net, 2), "SIGNED2")]);
  const tot = (key) => cell(fin(sum(flows.map((x) => x[key])), 2), "TOTAL_NUM2");
  rows.push([cell("합계", "TOTAL_LABEL"), cell(null, "TOTAL_LABEL"), cell(null, "TOTAL_LABEL"), tot("lease"), tot("devFee"), tot("conn"), tot("om"), tot("revenue"), tot("cost"), tot("net")]);
  rows.push(blank(), section(`민감도 — 가격배율 × 설비용량 → 달성 IRR (목표 ${pct2(km.targetIrr)} 대비 색)`, W),
    headerRow(["가격배율 ＼ 설비용량", ...KCH_SENS_CAPACITIES.map((cp) => `${cp} MW${cp === km.capacityMW ? " (현재)" : ""}`), "", ""]));
  for (const srow of k.sensitivity) {
    rows.push([cell(`${srow.mult.toFixed(1)}배${srow.mult === 1 ? " (입력 총액)" : ""}`, "AXIS_LABEL"), ...srow.cells.map((cc) => {
      if (srow.mult === 1 && cc.cap === km.capacityMW) return cell(fin(cc.irr, 6), "TOTAL_PCT");
      const lvl = heatLevel(cc.irr, km.targetIrr);
      return cell(fin(cc.irr, 6), lvl === 3 ? "PCT" : `PCT_H${lvl}`);
    })]);
  }
  rows.push(blank(), [note("민감도표는 4개 수익원 총액을 설비용량 비율로 스케일링했습니다(KCH 비용은 고정). 굵은 회색 칸이 현재 가정입니다.")]);
  return { name: "KCH 개발수수료", rows, colWidths: [34, 12, 10, 12, 12, 12, 12, 12, 12, 12], merges: ["A1:J1", "A2:J2"], freeze: { row: 2 }, tabColor: TAB.KCH, fit: "width" };
}

// 부록 공통 — 연도별 표. cols: { h, v(row, i), s, t } — t 가 있으면 합계 대상(스타일 이름)
function yearlyTable(name, titleText, subText, d, cols, extraNotes = []) {
  const DIG = { NUM3: 3, SIGNED3: 3, INT: 0, DEC3: 3, YEAR: 0, NUM1: 1, SIGNED: 1 };
  const vcell = (col, v) => (col.s === "PCT" ? pc(v) : col.s === "CENTER" || col.s === "CENTER_BAD" ? cell(v, col.s) : cell(fin(v, DIG[col.s] ?? 3), col.s));
  const rows = [
    [title(titleText)],
    [sub(subText)],
    headerRow(cols.map((c) => c.h)),
    ...d.map((x, i) => cols.map((col) => {
      const v = col.v(x, i);
      return col.gate ? cell(v, v && v.startsWith("N") ? "CENTER_BAD" : "CENTER") : vcell(col, v);
    })),
    cols.map((col, j) => (j === 0 ? cell("합계", "TOTAL_LABEL") : col.t ? cell(fin(sum(d.map((x, i) => col.v(x, i) || 0)), DIG[col.s] ?? 3), col.t) : cell(null, "TOTAL_LABEL"))),
    blank(),
    ...extraNotes.map((t) => [note(t)]),
  ];
  const last = colName(cols.length - 1);
  return { name, rows, colWidths: cols.map((c) => c.w || 12), merges: [`A1:${last}1`, `A2:${last}2`], freeze: { row: 3, col: 2 }, tabColor: TAB.부록, printTitles: { cols: "A:B", rows: "1:3" } };
}
const gateText = (v) => (v == null ? "" : v ? "Y" : "N — 배당 유보");

function incomeSheet(c) {
  const r = c.solved.result, fu = r.funding, ppe = fu.nominalDirectCapex + fu.contingency;
  let acc = 0;
  const accDep = r.detail.map((x) => (acc += x.depreciation));
  const cols = [
    { h: "연도", v: (x) => x.calendarYear, s: "YEAR", w: 8 },
    { h: "단계", v: (x) => x.phase, s: "CENTER", w: 11 },
    { h: "매출", v: (x) => x.revenue, s: "NUM3", t: "TOTAL_NUM3" },
    { h: "OPEX", v: (x) => x.opex, s: "NUM3", t: "TOTAL_NUM3" },
    { h: "EBITDA", v: (x) => x.ebitda, s: "SIGNED3", t: "TOTAL_SIGNED3" },
    { h: "감가상각", v: (x) => x.depreciation, s: "NUM3", t: "TOTAL_NUM3" },
    { h: "EBIT\n(영업이익)", v: (x) => x.ebitda - x.depreciation, s: "SIGNED3", t: "TOTAL_SIGNED3" },
    { h: "이자비용\n(선순위+채권)", v: (x) => x.seniorInterest + x.bondInterest, s: "NUM3", t: "TOTAL_NUM3" },
    { h: "EBT\n(세전이익)", v: (x) => x.ebitda - x.depreciation - x.seniorInterest - x.bondInterest, s: "SIGNED3", t: "TOTAL_SIGNED3" },
    { h: "과세표준\n(NOL 반영 후)", v: (x) => x.taxableIncome, s: "NUM3", t: "TOTAL_NUM3" },
    { h: "법인세", v: (x) => x.corporateTax, s: "NUM3", t: "TOTAL_NUM3" },
    { h: "당기순이익", v: (x) => x.ebitda - x.depreciation - x.seniorInterest - x.bondInterest - x.corporateTax, s: "SIGNED3", t: "TOTAL_SIGNED3" },
    { h: "누적\n감가상각", v: (_, i) => accDep[i], s: "NUM3" },
    { h: "PP&E\n순장부가액", v: (_, i) => ppe - accDep[i], s: "NUM3" },
  ];
  return yearlyTable("부록1 손익계산서", "부록1 — 손익계산서 (검산용)",
    `금액 단위 억원(소수 3자리) · 연도별 현금흐름과 같은 원천값을 손익계산서 순서로 재배열 · 감가상각 대상 원가(직접공사비+예비비) ${ppe.toFixed(1)}억원`,
    r.detail, cols, ["EBT는 부록3의 '과세표준 (NOL 반영 전)'과 항상 같아야 합니다(대사용). 누적 감가상각·순장부가액은 잔액이라 합계를 비웁니다."]);
}

function debtSheet(c) {
  const r = c.solved.result, fu = r.funding;
  let so = fu.seniorPrincipal, bo = fu.bondPrincipal;
  const opens = r.detail.map((x) => { const o = { s: so, b: bo }; so = x.seniorBalanceEnd; bo = x.bondBalanceEnd; return o; });
  const cols = [
    { h: "연도", v: (x) => x.calendarYear, s: "YEAR", w: 8 },
    { h: "단계", v: (x) => x.phase, s: "CENTER", w: 11 },
    { h: "선순위\n기초잔액", v: (_, i) => opens[i].s, s: "NUM3" },
    { h: "선순위\n이자", v: (x) => x.seniorInterest, s: "NUM3", t: "TOTAL_NUM3" },
    { h: "선순위 원금\n(만기일시 포함)", v: (x) => x.seniorPrincipal, s: "NUM3", t: "TOTAL_NUM3", w: 13 },
    { h: "선순위\n기말잔액", v: (x) => x.seniorBalanceEnd, s: "NUM3" },
    { h: "채권\n기초잔액", v: (_, i) => opens[i].b, s: "NUM3" },
    { h: "채권\n이자", v: (x) => x.bondInterest, s: "NUM3", t: "TOTAL_NUM3" },
    { h: "채권 원금\n(만기일시 포함)", v: (x) => x.bondPrincipal, s: "NUM3", t: "TOTAL_NUM3", w: 13 },
    { h: "채권\n기말잔액", v: (x) => x.bondBalanceEnd, s: "NUM3" },
    { h: "원리금\n상환 합계", v: (x) => x.debtService, s: "NUM3", t: "TOTAL_NUM3" },
    { h: "DSCR\n(연간)", v: (x) => x.dscr, s: "DEC3", w: 9 },
    { h: `연간 게이트\n(${ASSUMPTIONS.annualDscrThreshold}배)`, v: (x) => gateText(x.annualDscrGatePass), gate: true, w: 13 },
    { h: "DSCR\n(누적)", v: (x) => x.cumDscr, s: "DEC3", w: 9 },
    { h: `누적 게이트\n(${ASSUMPTIONS.cumulativeDscrThreshold}배)`, v: (x) => gateText(x.cumDscrGatePass), gate: true, w: 13 },
  ];
  return yearlyTable("부록2 부채상환", "부록2 — 부채상환 스케줄 (검산용)",
    `금액 단위 억원(소수 3자리) · 선순위 ${fu.seniorPrincipal.toFixed(1)}억원 원리금균등 · 주민참여채권 ${fu.bondPrincipal.toFixed(1)}억원 만기 일시상환 · 기초잔액 = 직전 연도 기말잔액`,
    r.detail, cols, ["게이트가 N이면 그 해 배당을 하지 않고 전액 사내유보합니다(빨간 칸). 잔액·DSCR은 합계를 비웁니다."]);
}

function detailSheet(c) {
  const r = c.solved.result;
  const F = (h, key, s = "NUM3", t = "TOTAL_NUM3", w) => ({ h, v: (x) => x[key], s, t, w });
  const cols = [
    { h: "연도", v: (x) => x.calendarYear, s: "YEAR", w: 8 },
    { h: "단계", v: (x) => x.phase, s: "CENTER", w: 11 },
    { h: "가동일수", v: (x) => x.operatingDays, s: "INT", w: 8 },
    { h: "연간일수", v: (x) => x.daysInYear, s: "INT", w: 8 },
    { h: "가동률", v: (x) => (x.ratePct == null ? null : x.ratePct / 100), s: "PCT", w: 8 },
    { h: "방전량\n(MWh)", v: (x) => x.generationMWh, s: "INT", t: "TOTAL_INT" },
    F("매출", "revenue"), F("OPEX", "opex"), F("EBITDA", "ebitda", "SIGNED3", "TOTAL_SIGNED3"),
    F("CAPEX\n집행", "capexDraw"), F("자기자본\n조달", "equityDraw"), F("선순위\n조달", "seniorDraw"), F("주민채권\n조달", "bondDraw"),
    F("감가상각", "depreciation"),
    F("선순위\n이자", "seniorInterest"), F("선순위\n원금상환", "seniorPrincipal"), F("선순위\n기말잔액", "seniorBalanceEnd", "NUM3", null),
    F("채권\n이자", "bondInterest"), F("채권\n원금상환", "bondPrincipal"), F("채권\n기말잔액", "bondBalanceEnd", "NUM3", null),
    F("원리금\n상환 합계", "debtService"),
    { h: "DSCR\n(연간)", v: (x) => x.dscr, s: "DEC3", w: 9 },
    { h: "연간\n게이트", v: (x) => gateText(x.annualDscrGatePass), gate: true, w: 13 },
    { h: "DSCR\n(누적)", v: (x) => x.cumDscr, s: "DEC3", w: 9 },
    { h: "누적\n게이트", v: (x) => gateText(x.cumDscrGatePass), gate: true, w: 13 },
    F("과세표준\n(NOL 반영 전)", "taxableBeforeNol", "SIGNED3", "TOTAL_SIGNED3"), F("과세표준\n(NOL 반영 후)", "taxableIncome"), F("법인세", "corporateTax"),
    F("CFADS", "cfads", "SIGNED3", "TOTAL_SIGNED3"), F("배당가능 현금\n(상환 후)", "availableCash", "SIGNED3", null, 13), F("배당가능\n재원 상한", "distributable", "NUM3", null),
    F("추가 출자\n(현금 부족)", "additionalEquity"), F("배당", "dividend"), F("법정준비금\n당해 적립", "legalReserveContribution"), F("법정준비금\n기말잔액", "legalReserveBalanceEnd", "NUM3", null),
    F("투자자\n배당소득세", "investorDividendTax"), F("최종 회수\n(DSRA+준비금+유보)", "terminalRecovery", "NUM3", "TOTAL_NUM3", 15),
    F("프로젝트 CF\n(세전)", "projectFlowPreTax", "SIGNED3", "TOTAL_SIGNED3"), F("프로젝트 CF\n(세후)", "projectFlow", "SIGNED3", "TOTAL_SIGNED3"),
    F("SPC 지분 CF\n(세전)", "equityFlow", "SIGNED3", "TOTAL_SIGNED3"), F("SPC 지분 CF\n(세후)", "equityFlowAfterTax", "SIGNED3", "TOTAL_SIGNED3"),
    F("당사 지분 CF\n(세전)", "companyEquityFlow", "SIGNED3", "TOTAL_SIGNED3"), F("당사 지분 CF\n(세후)", "companyEquityFlowAfterTax", "SIGNED3", "TOTAL_SIGNED3"),
  ];
  return yearlyTable("부록3 현금흐름 전체", "부록3 — 연도별 현금흐름 전체 (계산 엔진 중간값)",
    "금액 단위 억원(소수 3자리) · DSCR 게이트·법정준비금·NOL을 반영한 실제 배당 로직 그대로 · 인쇄 시 연도·단계 열과 머리 3행이 매 쪽 반복",
    r.detail, cols, ["잔액·재원 상한·배당가능 현금은 합계를 비웁니다(더하면 의미가 없는 값). 연간 모델입니다 — 분기·월 단위는 담지 않습니다."]);
}

/** 시트 묶음을 만든다 — 순수 함수(파일·DOM 없이 테스트 가능). cs[0] 이 본 시나리오, 2건 이상이면 비교 시트를 더한다. */
export function buildExportSheets(cs, now = new Date()) {
  const c = cs[0], ok = c.solved.ok, multi = cs.length > 1;
  const sheets = [summarySheet(c, now, multi), inputSheet(c)];
  if (ok) sheets.push(cashflowSheet(c), sensitivitySheet(c));
  if (multi) sheets.push(scenarioSheet(cs));
  sheets.push(priceSheet(c), kchSheet(c));
  if (ok) sheets.push(incomeSheet(c), debtSheet(c), detailSheet(c));
  return sheets;
}

/** 파일명 — 접두어(ESS_적정입찰단가_모델)는 .gitignore 규칙과 맞춰 둔다. 사업명 + YYYYMMDD(이름순 = 날짜순). */
export function exportFileName(projectName, now = new Date(), count = 1) {
  const name = String(projectName || "").replace(/[\\/:*?"<>|]/g, "").trim();
  return `ESS_적정입찰단가_모델${name ? `_${name}` : ""}${count > 1 ? `_시나리오${count}개` : ""}_${ymd(now)}.xlsx`;
}

// ============================================================================
// 진입점 — node ess-bidprice-xlsx.mjs [시나리오1.json 시나리오2.json …] [출력.xlsx] [--out-dir=폴더] [--no-open]
// ============================================================================
function loadScenarioFile(p) {
  const raw = JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, ""));
  const inputs = raw.inputs ?? raw;
  return { inputs, label: raw.scenarioName || path.basename(p, path.extname(p)), savedAt: raw.savedAt || null };
}

function writeWithFallback(outPath, bytes) {
  try { fs.writeFileSync(outPath, bytes); return outPath; }
  catch (e) {
    if (!["EBUSY", "EPERM", "EACCES"].includes(e.code)) throw e;
    // 같은 이름 파일이 Excel에서 열려 있으면 잠겨 있다 — 시각을 붙여 새 이름으로 저장
    const d = new Date(), alt = outPath.replace(/\.xlsx$/i, `_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}.xlsx`);
    fs.writeFileSync(alt, bytes);
    console.log(`(같은 이름 파일이 열려 있어 새 이름으로 저장했습니다)`);
    return alt;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const jsons = argv.filter((a) => /\.json$/i.test(a));
  const outArg = argv.find((a) => /\.xlsx$/i.test(a));
  const outDirArg = argv.find((a) => a.startsWith("--out-dir="))?.slice("--out-dir=".length);
  const open = !argv.includes("--no-open") && !process.env.ESS_NO_OPEN;
  const cases = jsons.length ? jsons.map(loadScenarioFile) : [{ inputs: {}, label: "아티팩트 기본값 (96MW 기본안)", savedAt: null }];
  if (!jsons.length) console.log("시나리오 파일 없음 — 아티팩트 기본값(96MW/576MWh 기본안)으로 계산합니다.");
  const t0 = Date.now();
  const cs = cases.map((k) => { const c = computeScenario(k.inputs, k); c.inputsRaw = k.inputs; return c; });
  const now = new Date();
  const sheets = buildExportSheets(cs, now);
  const bytes = buildXlsx(sheets);
  const dir = outDirArg || (jsons[0] ? path.dirname(path.resolve(jsons[0])) : process.cwd());
  const outPath = writeWithFallback(outArg ? path.resolve(outArg) : path.join(dir, exportFileName(cs[0].fields.projectName, now, cs.length)), bytes);
  const c = cs[0];
  console.log(`완료: ${outPath}`);
  console.log(`  시트 ${sheets.length}개 (${sheets.map((s) => s.name).join(" · ")}) · ${(bytes.length / 1024).toFixed(1)} KB · ${Date.now() - t0} ms`);
  cs.forEach((k) => console.log(`  [${k.label}] 적정 입찰단가 ${k.solved.ok ? k.solved.price.toFixed(2) + "원/kWh" : "산정 실패 — " + k.solved.reason}` +
    `${k.ps.ok ? ` · 가격환산 입찰가격 ${k.link.bidPrice65.toFixed(2)}원/kWh · 가격평가점수 ${k.ps.score.toFixed(2)}점` : ""}`));
  if (c.warnings.length) console.log(`  확인 필요 ${c.warnings.length}건 — 요약 시트 참고`);
  if (open) spawn("explorer.exe", [outPath], { detached: true, stdio: "ignore" }).unref();
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
