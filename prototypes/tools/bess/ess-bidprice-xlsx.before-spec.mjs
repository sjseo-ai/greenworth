// ESS 적정 입찰단가 프로토타입 — 진짜 .xlsx(다중 시트) 워크북 생성기.
//
// 이 스크립트는 그 아티팩트(claude.ai/code/artifact/fea66d24-...)의 <script> 안에 있는 계산 엔진 함수를
// "그대로" 복사해 왔다 — 새로 재구현한 게 아니라 동일 코드이므로 결과는 아티팩트 화면 수치와 100% 일치해야 한다.
// 아티팩트의 downloads 캡ability는 파일 확장자를 gif png jpg jpeg webp mp4 webm txt json md docx pptx epub csv
// ttf html svg pdf 로만 허용하고 xlsx/xls는 막혀 있어(플랫폼 하드 제한), 진짜 다중 시트 .xlsx가 필요하면
// 이렇게 로컬(Node + SheetJS)에서 만드는 것이 유일한 방법이다.
//
// 사용법:
//   node ess-bidprice-xlsx.mjs [scenario.json] [output.xlsx]
//   - scenario.json: 아티팩트의 "가정 불러오기"/시나리오 다운로드로 받은 JSON(.json은 허용 확장자라 다운로드 가능)
//     의 { inputs: {...} } 부분과 같은 모양. 생략하면 아티팩트의 기본값(안좌 96MW/576MWh 기본안)을 사용한다.
//   - output.xlsx: 생략하면 ESS_적정입찰단가_모델_<타임스탬프>.xlsx 로 현재 폴더에 저장.

import ExcelJS from "exceljs";
import fs from "node:fs";

const HUNDRED_MILLION = 100_000_000;

// ---------- CAPEX / OPEX 항목 기본값 (아티팩트와 동일) ----------
const CAPEX_ITEMS = [
  { id: "battery", label: "배터리·랙·컨테이너", value: 650, category: "기자재" },
  { id: "pcs", label: "PCS", value: 120, category: "기자재" },
  { id: "ems", label: "EMS·SCADA", value: 25, category: "시공-전기" },
  { id: "electrical", label: "변압기·전기공사", value: 60, category: "시공-전기" },
  { id: "civil", label: "토목·건축", value: 35, category: "시공-토목" },
  { id: "fire", label: "소방·안전설비", value: 20, category: "시공-운송·설치" },
  { id: "grid", label: "계통접속", value: 50, category: "시공-선로·계통" },
  { id: "development", label: "인허가·개발비", value: 15, category: "간접비" },
  { id: "design", label: "설계비", value: 8, category: "간접비" },
  { id: "supervision", label: "감리비", value: 6, category: "간접비" },
  { id: "community", label: "민원·주민수용성", value: 5, category: "간접비" },
  { id: "insurance", label: "건설보험·보증", value: 6, category: "간접비" },
  { id: "land", label: "부지·임차권", value: 5, category: "토지" },
];
const OPEX_ITEMS = [
  { id: "om", label: "배터리·PCS LTSA", value: 9 },
  { id: "staff", label: "인건비·관제", value: 1.5 },
  { id: "lease", label: "부지 임차료", value: 1 },
  { id: "admin", label: "일반관리·수수료", value: 1 },
];
const TAX_BRACKETS = [{ upTo: 2, ratePct: 9.9 }, { upTo: 200, ratePct: 20.9 }, { upTo: 3000, ratePct: 23.1 }, { upTo: null, ratePct: 26.4 }];
const ASSUMPTIONS = {
  waccPct: 4.5, depreciationYears: 15, nolCarryforwardYears: 10,
  annualDscrThreshold: 1.15, cumulativeDscrThreshold: 1.3,
  legalReserveContributionPct: 10, legalReserveCapPctOfEquity: 50, investorDividendTaxPct: 15.4,
};
const DEGRADATION_PCT = (1 - 0.7 ** (1 / 15)) * 100;

// ---------- 기본 입력값 (아티팩트 초기 화면과 동일 — 안좌 96MW/576MWh 기본안) ----------
const DEFAULT_FIELDS = {
  projectName: "ESS 96MW/576MWh 입찰사업",
  unitCount: "150", unitStorageMWh: "4.883", pcsUnitCount: "25", unitPowerMW: "3.99",
  startYear: "2026", endYear: "2042", constructionYears: "1", codDate: "2027-07-01", operationYears: "15",
  contractCapacityMW: "96", year1RatePct: "95", year2RatePct: "96", operatingRatePct: "97",
  delayDays: "0", avgNonCompliancePct: "0",
  constructionInflationPct: "0", contingencyPct: "7", developmentSharePct: "8",
  capexInputMode: "itemized", capexLumpSum: "1005",
  variableOMPerMWh: "2500", powerTradingFeePerKWh: "0.1193", insurancePct: "0.45", communityRevenuePct: "0.5",
  opexEscalationPct: "2", ltsaStepAfterYear: "3", ltsaStepMultiplierPct: "190",
  equityPct: "30", residentBondPct: "5", seniorRatePct: "5.2", seniorTermYears: "10", seniorGraceYears: "1",
  bondRatePct: "7", bondTermYears: "7", financeFeePct: "1.5", constructionRatePct: "5.5", dsraMonths: "6",
  kchSharePct: "20",
  solveMode: "companyProfit", companyProfitKind: "companyProfitPreTax", targetCompanyProfit: "100",
  irrKind: "projectIrr", targetIrrPct: "8",
};
const DEFAULT_OP_RATES = Array.from({ length: 15 }, (_, i) => (i === 0 ? 95 : i === 1 ? 96 : 97));

// KCH 개발수수료 절(6.4)·가격환산계산기(6.5) 기본값 — 아티팩트 HTML의 초기값과 동일.
// 아티팩트의 시나리오 JSON(inputs.fields)에는 kch*·minPrice·priceCap 값도 그대로 들어오므로 있으면 그것을 우선 사용한다.
const DEFAULT_KCH_FIELDS = {
  kchCapacityMW: "50", kchStorageMWh: "200", kchStartYear: "2026", kchDevYears: "1", kchConYears: "1", kchOpYears: "15",
  kchLandCost: "10", kchDevCostAnnual: "3", kchOmCostAnnual: "0.5",
  kchCalcMode: "direct",
  kchLeaseBase: "1.5", kchLeaseEsc: "2", kchDevFeeBase: "7.5",
  kchConnMode: "연간", kchConnBase: "2.5", kchConnEsc: "0",
  kchOmBase: "4", kchOmEsc: "1.5",
  kchTargetIrrPct: "9", kchWaccPct: "7.5",
  minPrice: "18", priceCap: "50",
};

// ============================================================================
// 아래부터 solveBidPriceForCompanyProfitTarget()까지: 아티팩트 <script>의 순수 계산 함수를 그대로 복사.
// (DOM에 의존하는 readModel/solveCurrentModel/computeFloorPrice만 이 파일 전용으로 새로 작성했다 — 아래참조)
// ============================================================================

const rate = (p) => p / 100;
const sum = (a) => a.reduce((t, v) => t + v, 0);
const utcDate = (y, m, d) => new Date(Date.UTC(y, m, d));
const daysBetween = (s, e) => Math.round((e.getTime() - s.getTime()) / 86400000);
const overlapDays = (sA, eA, sB, eB) => {
  const s = Math.max(sA.getTime(), sB.getTime()), e = Math.min(eA.getTime(), eB.getTime());
  return e > s ? Math.round((e - s) / 86400000) : 0;
};
function npv(r, flows) { return flows.reduce((t, v, y) => t + v / (1 + r) ** y, 0); }
function irr(flows) {
  const hasPos = flows.some((v) => v > 0), hasNeg = flows.some((v) => v < 0);
  if (!hasPos || !hasNeg) return NaN;
  let low = -0.9999, high = 1;
  while (npv(high, flows) > 0 && high < 1024) high *= 2;
  if (npv(low, flows) * npv(high, flows) > 0) return NaN;
  for (let i = 0; i < 180; i++) {
    const mid = (low + high) / 2;
    if (npv(mid, flows) > 0) low = mid; else high = mid;
  }
  return (low + high) / 2;
}
function levelDebtService(principal, r, periods) {
  if (principal <= 0 || periods <= 0) return 0;
  if (r === 0) return principal / periods;
  return principal * r / (1 - (1 + r) ** -periods);
}
function progressiveTax(income, brackets) {
  if (!(income > 0)) return 0;
  let lower = 0, tax = 0;
  for (const b of brackets) {
    const upper = b.upTo === null ? Infinity : b.upTo;
    const slice = Math.max(0, Math.min(income, upper) - lower);
    tax += slice * rate(b.ratePct);
    if (income <= upper) break;
    lower = upper;
  }
  return tax;
}

function buildCalendar(p) {
  const constructionStartYear = p.codYear - p.constructionYears + 1;
  const codYear = p.codYear;
  const codDate = utcDate(codYear, p.codMonth - 1, p.codDay);
  let operationEnd = utcDate(codYear + p.operationYears, p.codMonth - 1, p.codDay);
  if (p.delayStage === 2) operationEnd = new Date(operationEnd.getTime() - (p.delayDays || 0) * 86400000);
  if (p.delayStage === 3) operationEnd = new Date(codDate.getTime());
  const lastDay = new Date(operationEnd.getTime() - 86400000);
  const rows = []; let opSeq = 0;
  for (let y = p.startYear; y <= lastDay.getUTCFullYear(); y++) {
    const yStart = utcDate(y, 0, 1), yEnd = utcDate(y + 1, 0, 1);
    const daysInYear = daysBetween(yStart, yEnd);
    const operatingDays = overlapDays(yStart, yEnd, codDate, operationEnd);
    if (operatingDays > 0) opSeq++;
    rows.push({
      calendarYear: y, daysInYear, operatingDays,
      operationFraction: operatingDays / daysInYear,
      operationSequence: operatingDays > 0 ? opSeq : 0,
      isTerminalYear: y === lastDay.getUTCFullYear(),
      isConstruction: y >= constructionStartYear && y <= codYear,
    });
  }
  return { rows, constructionStartYear, codYear, codDate, operationEnd };
}

function drawWeights(model, cal) {
  const devShare = rate(model.capex.developmentSharePct);
  const devYears = Math.max(0, cal.constructionStartYear - model.project.startYear);
  const devWeight = devYears > 0 ? devShare / devYears : 0;
  const conYears = model.project.constructionYears;
  return cal.rows.map((row) => {
    if (row.calendarYear < cal.constructionStartYear) return devWeight;
    if (row.calendarYear <= cal.codYear) return (1 - devShare) / conYears;
    return 0;
  });
}

function nominalCapex(model, cal) {
  const weights = drawWeights(model, cal);
  const draws = cal.rows.map(() => 0);
  model.capex.items.forEach((item) => {
    weights.forEach((w, i) => {
      const year = cal.rows[i].calendarYear;
      const infYears = Math.max(0, year - model.project.startYear);
      const infFactor = (1 + rate(model.capex.constructionInflationPct)) ** infYears;
      draws[i] += item.value * w * infFactor;
    });
  });
  return { draws, nominalDirectCapex: sum(draws) };
}

function allocateFunding(draws, principals, order) {
  const remaining = { ...principals };
  return draws.map((draw) => {
    let unfunded = draw;
    const row = { equity: 0, senior: 0, residentBond: 0 };
    order.forEach((src) => {
      const amount = Math.min(unfunded, Math.max(0, remaining[src]));
      row[src] += amount; remaining[src] -= amount; unfunded -= amount;
    });
    return row;
  });
}

function idcFromFunding(model, cal, fundingRows) {
  let openingSenior = 0, openingBond = 0;
  return fundingRows.map((f, i) => {
    if (cal.rows[i].calendarYear > cal.codYear) return 0;
    const seniorInt = (openingSenior + f.senior / 2) * rate(model.finance.constructionRatePct);
    const bondInt = (openingBond + f.residentBond / 2) * rate(model.finance.constructionRatePct);
    openingSenior += f.senior; openingBond += f.residentBond;
    return seniorInt + bondInt;
  });
}

function initialDSRA(model, seniorPrincipal, bondPrincipal) {
  const seniorRate = rate(model.finance.seniorRatePct);
  const seniorService = model.finance.seniorGraceYears > 0
    ? seniorPrincipal * seniorRate
    : levelDebtService(seniorPrincipal, seniorRate, model.finance.seniorTermYears);
  const bondService = bondPrincipal * rate(model.finance.bondRatePct);
  return (seniorService + bondService) * model.finance.dsraMonths / 12;
}

function solveInvestment(model, cal) {
  const nominal = nominalCapex(model, cal);
  const contDraws = nominal.draws.map((v) => v * rate(model.capex.contingencyPct));
  const firstConIdx = cal.rows.findIndex((r) => r.calendarYear === cal.constructionStartYear);
  const lastConIdx = cal.rows.findIndex((r) => r.calendarYear === cal.codYear);
  const equityRatio = rate(model.finance.equityPct), bondRatio = rate(model.finance.residentBondPct);
  let financeFee = 0, dsra = 0, idcDraws = cal.rows.map(() => 0), converged = false;
  for (let iter = 0; iter < 200; iter++) {
    const draws = nominal.draws.map((v, i) => v + contDraws[i] + idcDraws[i]);
    draws[firstConIdx] += financeFee; draws[lastConIdx] += dsra;
    const total = sum(draws);
    const equity = total * equityRatio, bond = total * bondRatio, senior = total - equity - bond;
    const fundingRows = allocateFunding(draws, { equity, senior, residentBond: bond }, ["equity", "senior", "residentBond"]);
    const nextIdc = idcFromFunding(model, cal, fundingRows);
    const nextFee = (senior + bond) * rate(model.finance.financeFeePct);
    const nextDsra = initialDSRA(model, senior, bond);
    const diff = Math.max(Math.abs(nextFee - financeFee), Math.abs(nextDsra - dsra), Math.abs(sum(nextIdc) - sum(idcDraws)));
    financeFee = nextFee; dsra = nextDsra; idcDraws = nextIdc;
    if (diff <= 1e-9) { converged = true; break; }
  }
  const draws = nominal.draws.map((v, i) => v + contDraws[i] + idcDraws[i]);
  draws[firstConIdx] += financeFee; draws[lastConIdx] += dsra;
  const total = sum(draws);
  const equityPrincipal = total * equityRatio, bondPrincipal = total * bondRatio, seniorPrincipal = total - equityPrincipal - bondPrincipal;
  const fundingRows = allocateFunding(draws, { equity: equityPrincipal, senior: seniorPrincipal, residentBond: bondPrincipal }, ["equity", "senior", "residentBond"]);
  return { nominalDirectCapex: nominal.nominalDirectCapex, contingency: sum(contDraws), financeFee, dsra, idcDraws, constructionInterest: sum(idcDraws), draws, totalInvestment: total, equityPrincipal, seniorPrincipal, bondPrincipal, fundingRows, converged };
}

function operatingRatePctForSequence(model, operationSequence) {
  const rates = model.revenue.operatingRatesPct;
  if (!rates || rates.length === 0) return 0;
  const idx = Math.min(Math.max(0, operationSequence - 1), rates.length - 1);
  return rates[idx];
}
function salesForRow(model, capacityMW, row) {
  if (row.operatingDays === 0) return { generationMWh: 0, chargedMWh: 0, revenue: 0 };
  const ratePct = operatingRatePctForSequence(model, row.operationSequence);
  const annualEquivalentMWh = capacityMW * 24 * 365 * rate(ratePct) * row.operationFraction;
  const settlementFactor = (model.revenue.priceAdjustmentFactor ?? 1) * (1 - rate(model.revenue.avgNonCompliancePct ?? 0));
  const revenue = annualEquivalentMWh * 1000 * model.revenue.bidPricePerKWh * settlementFactor / HUNDRED_MILLION;
  return { generationMWh: annualEquivalentMWh, chargedMWh: 0, revenue };
}

function stepAdjustedOpex(model, item, row) {
  const stepAfter = model.opex.ltsaStepAfterYear ?? 0;
  if (stepAfter <= 0 || item.id !== "om" || !(row.operationSequence > stepAfter)) return item.value;
  return item.value * rate(model.opex.ltsaStepMultiplierPct ?? 100);
}
function operatingCosts(model, row, sales, totalInvestment) {
  if (row.operatingDays === 0) return 0;
  const escYears = Math.max(0, row.calendarYear - model.project.startYear);
  const esc = (1 + rate(model.opex.escalationPct)) ** escYears;
  const fixed = sum(model.opex.items.map((it) => stepAdjustedOpex(model, it, row))) * esc * row.operationFraction;
  const variable = sales.generationMWh * model.opex.variableOMPerMWh / HUNDRED_MILLION;
  const insurance = totalInvestment * rate(model.opex.insurancePct) * row.operationFraction;
  const community = sales.revenue * rate(model.opex.communityRevenuePct);
  const tradingFee = sales.generationMWh * 1000 * model.opex.powerTradingFeePerKWh / HUNDRED_MILLION;
  return fixed + variable + insurance + community + tradingFee;
}
function useNol(taxable, lots, opYear, carryYears) {
  const active = lots.filter((l) => l.expiresAfter >= opYear && l.amount > 1e-12);
  if (taxable <= 0) { active.push({ amount: -taxable, expiresAfter: opYear + carryYears }); return { after: 0, lots: active }; }
  let remaining = taxable;
  active.forEach((l) => { const used = Math.min(remaining, l.amount); l.amount -= used; remaining -= used; });
  return { after: remaining, lots: active.filter((l) => l.amount > 1e-12) };
}

function analyzeEss(model) {
  const cal = buildCalendar(model.project);
  const investment = solveInvestment(model, cal);
  if (!investment.converged) return { errors: ["총투자비 반복계산이 수렴하지 않았습니다."] };
  const capacityMW = model.revenue.contractCapacityMW;
  const depTranche = { amount: investment.nominalDirectCapex + investment.contingency, start: cal.codDate, end: utcDate(cal.codDate.getUTCFullYear() + model.assumptions.depreciationYears, cal.codDate.getUTCMonth(), cal.codDate.getUTCDate()) };
  const seniorRate = rate(model.finance.seniorRatePct);
  const seniorPayment = levelDebtService(investment.seniorPrincipal, seniorRate, model.finance.seniorTermYears - model.finance.seniorGraceYears);
  let seniorBalance = investment.seniorPrincipal, bondBalance = investment.bondPrincipal;
  let retainedCash = 0, legalReserveBalance = 0, cumCfads = 0, cumDebtService = 0, nolLots = [];
  let totalEquityInjected = 0, totalDividend = 0, totalTerminalRecovery = 0;
  const projectFlows = [], projectFlowsPreTax = [], equityFlows = [], equityFlowsAfterTax = [];
  const kchShare = rate(model.finance.kchSharePct ?? 100);
  const detailRows = [];

  cal.rows.forEach((row, i) => {
    const funding = investment.fundingRows[i];
    const sales = salesForRow(model, capacityMW, row);
    const opex = operatingCosts(model, row, sales, investment.totalInvestment);
    const ebitda = sales.revenue - opex;
    let seniorInterest = 0, seniorPrincipal = 0, seniorBalloon = 0, bondInterest = 0, bondPrincipal = 0, bondBalloon = 0;
    if (row.operationSequence > 0) {
      const serviceYear = row.operationSequence;
      seniorInterest = seniorBalance * seniorRate * row.operationFraction;
      if (serviceYear > model.finance.seniorGraceYears && serviceYear <= model.finance.seniorTermYears) {
        const service = seniorPayment * row.operationFraction;
        seniorPrincipal = Math.min(seniorBalance, Math.max(0, service - seniorInterest));
      }
      bondInterest = bondBalance * rate(model.finance.bondRatePct) * row.operationFraction;
      if (serviceYear === model.finance.bondTermYears) bondPrincipal = bondBalance;
      seniorBalance -= seniorPrincipal; bondBalance -= bondPrincipal;
      if (serviceYear === model.finance.seniorTermYears && seniorBalance > 1e-9) { seniorBalloon = seniorBalance; seniorPrincipal += seniorBalloon; seniorBalance = 0; }
      if (row.isTerminalYear) {
        if (seniorBalance > 1e-9) { seniorBalloon += seniorBalance; seniorPrincipal += seniorBalance; seniorBalance = 0; }
        if (bondBalance > 1e-9) { bondBalloon = bondBalance; bondPrincipal += bondBalloon; bondBalance = 0; }
      }
    }
    const depDays = overlapDays(utcDate(row.calendarYear, 0, 1), utcDate(row.calendarYear + 1, 0, 1), depTranche.start, depTranche.end);
    const depreciation = (depTranche.amount / model.assumptions.depreciationYears) * depDays / row.daysInYear;
    const taxableBeforeNol = row.operationSequence > 0 ? ebitda - depreciation - seniorInterest - bondInterest : 0;
    let taxableIncome = 0, corporateTax = 0;
    if (row.operationSequence > 0) {
      const nolResult = useNol(taxableBeforeNol, nolLots, row.operationSequence, model.assumptions.nolCarryforwardYears);
      nolLots = nolResult.lots; taxableIncome = nolResult.after;
      corporateTax = progressiveTax(taxableIncome, model.assumptions.taxBrackets);
    }
    const debtService = seniorInterest + seniorPrincipal + bondInterest + bondPrincipal;
    const cfads = row.operationSequence > 0 ? ebitda - corporateTax : 0;
    let dividend = 0, legalReserveContribution = 0, investorDividendTax = 0, terminalRecovery = 0, additionalEquity = 0, distributable = 0;
    let dscr = null, cumDscr = null, annualGate = null, cumGate = null, availableCash = 0, legalReserveBalanceEnd = legalReserveBalance;
    if (row.operationSequence > 0) {
      cumCfads += cfads; cumDebtService += debtService;
      dscr = debtService > 1e-12 ? cfads / debtService : null;
      cumDscr = cumDebtService > 1e-12 ? cumCfads / cumDebtService : null;
      availableCash = retainedCash + cfads - debtService;
      distributable = Math.max(0, ebitda - depreciation - seniorInterest - bondInterest - corporateTax);
      if (availableCash < 0) { additionalEquity = -availableCash; retainedCash = 0; }
      else {
        annualGate = dscr === null || dscr >= model.assumptions.annualDscrThreshold;
        cumGate = cumDscr === null || cumDscr >= model.assumptions.cumulativeDscrThreshold;
        if (annualGate && cumGate) {
          const disposition = Math.min(availableCash, distributable);
          const reserveCap = investment.equityPrincipal * rate(model.assumptions.legalReserveCapPctOfEquity);
          legalReserveContribution = Math.min(Math.max(0, reserveCap - legalReserveBalance), disposition * rate(model.assumptions.legalReserveContributionPct));
          legalReserveBalance += legalReserveContribution;
          dividend = disposition - legalReserveContribution;
          retainedCash = availableCash - disposition;
        } else retainedCash = availableCash;
      }
      legalReserveBalanceEnd = legalReserveBalance;
      investorDividendTax = dividend * rate(model.assumptions.investorDividendTaxPct);
      if (row.isTerminalYear) {
        terminalRecovery = investment.dsra + legalReserveBalance + retainedCash;
        retainedCash = 0; legalReserveBalance = 0;
      }
    }
    const capitalDraw = investment.draws[i];
    const projectFlowPreTax = -capitalDraw + ebitda + (row.isTerminalYear ? investment.dsra : 0);
    const projectFlow = projectFlowPreTax - corporateTax;
    const equityFlow = -funding.equity - additionalEquity + dividend + terminalRecovery;
    const equityFlowAfterTax = equityFlow - investorDividendTax;
    projectFlowsPreTax.push(projectFlowPreTax); projectFlows.push(projectFlow);
    equityFlows.push(equityFlow); equityFlowsAfterTax.push(equityFlowAfterTax);
    totalEquityInjected += funding.equity + additionalEquity;
    totalDividend += dividend;
    totalTerminalRecovery += terminalRecovery;
    row._sales = sales; row._ebitda = ebitda; row._opex = opex;
    detailRows.push({
      calendarYear: row.calendarYear,
      phase: row.operationSequence > 0 ? `운영 ${row.operationSequence}년차` : (row.isConstruction ? '개발·공사' : '개발'),
      operatingDays: row.operatingDays, daysInYear: row.daysInYear,
      ratePct: row.operationSequence > 0 ? operatingRatePctForSequence(model, row.operationSequence) : null,
      generationMWh: sales.generationMWh, revenue: sales.revenue, opex, ebitda,
      capexDraw: capitalDraw, equityDraw: funding.equity, seniorDraw: funding.senior, bondDraw: funding.residentBond,
      depreciation, seniorInterest, seniorPrincipal, seniorBalloon, seniorBalanceEnd: seniorBalance,
      bondInterest, bondPrincipal, bondBalloon, bondBalanceEnd: bondBalance, debtService,
      dscr, cumDscr, annualDscrGatePass: annualGate, cumDscrGatePass: cumGate,
      taxableBeforeNol, taxableIncome, corporateTax, cfads, availableCash, distributable,
      additionalEquity, dividend, legalReserveContribution, legalReserveBalanceEnd, investorDividendTax, terminalRecovery,
      projectFlowPreTax, projectFlow, equityFlow, equityFlowAfterTax,
      companyEquityFlow: equityFlow * kchShare, companyEquityFlowAfterTax: equityFlowAfterTax * kchShare,
    });
  });

  const fullYearRow = cal.rows.find((r) => r.operationFraction === 1) || cal.rows.find((r) => r.operatingDays > 0) || {};
  const companyProfitPreTax = sum(equityFlows) * kchShare, companyProfitAfterTax = sum(equityFlowsAfterTax) * kchShare;
  return {
    errors: [], capacityMW, totalInvestment: investment.totalInvestment,
    annualRevenue: fullYearRow._sales?.revenue ?? 0,
    annualGenerationMWh: fullYearRow._sales?.generationMWh ?? 0,
    projectIrrPreTax: irr(projectFlowsPreTax), projectIrr: irr(projectFlows),
    equityIrr: irr(equityFlows), equityIrrAfterInvestorTax: irr(equityFlowsAfterTax),
    projectNpv: npv(rate(model.assumptions.waccPct), projectFlows),
    companyEquityInjected: totalEquityInjected * kchShare, companyDividend: totalDividend * kchShare, companyTerminalRecovery: totalTerminalRecovery * kchShare,
    companyDividendPlusRecovery: (totalDividend + totalTerminalRecovery) * kchShare,
    companyProfitPreTax, companyProfitAfterTax,
    companyProfitMultiple: totalEquityInjected > 1e-9 ? (totalDividend + totalTerminalRecovery) / totalEquityInjected : NaN,
    detail: detailRows,
    funding: {
      nominalDirectCapex: investment.nominalDirectCapex, contingency: investment.contingency,
      financeFee: investment.financeFee, dsra: investment.dsra, constructionInterest: investment.constructionInterest,
      totalInvestment: investment.totalInvestment,
      equityPrincipal: investment.equityPrincipal, seniorPrincipal: investment.seniorPrincipal, bondPrincipal: investment.bondPrincipal,
    },
  };
}

function solveBidPriceForTarget(model, targetIrr, kind) {
  function irrAt(price) {
    model.revenue.bidPricePerKWh = price;
    const r = analyzeEss(model);
    return r.errors && r.errors.length ? NaN : r[kind];
  }
  let low = 0, high = 500;
  const irrHigh = irrAt(high);
  if (!Number.isFinite(irrHigh) || irrHigh < targetIrr) return { ok: false, reason: "500원/kWh까지도 목표 IRR에 도달하지 못합니다 (비용이 너무 크거나 목표 IRR이 너무 높음)." };
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    const midIrr = irrAt(mid);
    if (!Number.isFinite(midIrr)) { low = mid; continue; }
    if (midIrr < targetIrr) low = mid; else high = mid;
  }
  model.revenue.bidPricePerKWh = high;
  const result = analyzeEss(model);
  return { ok: true, price: high, result };
}

function solveBidPriceForCompanyProfitTarget(model, targetProfit, kind) {
  function profitAt(price) {
    model.revenue.bidPricePerKWh = price;
    const r = analyzeEss(model);
    return r.errors && r.errors.length ? NaN : r[kind];
  }
  let low = 0, high = 500;
  const profitHigh = profitAt(high);
  if (!Number.isFinite(profitHigh) || profitHigh < targetProfit) return { ok: false, reason: "500원/kWh까지도 목표 당사 이익에 도달하지 못합니다 (비용이 너무 크거나 목표 이익이 너무 높음)." };
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    const midProfit = profitAt(mid);
    if (!Number.isFinite(midProfit)) { low = mid; continue; }
    if (midProfit < targetProfit) low = mid; else high = mid;
  }
  model.revenue.bidPricePerKWh = high;
  const result = analyzeEss(model);
  return { ok: true, price: high, result };
}

// ============================================================================
// KCH 개발수수료 단가산정(6.4) 엔진 — 아티팩트의 kchBuildCashflow/kchIrrAt/kchSolveScaleFactor를 그대로 복사.
// 6.4→6.5 자동연결에 쓰는 totalLifetimeGenerationKWh와 가격환산계산기(6.5) 점수 산식도 아티팩트 원본 그대로.
// ============================================================================

function kchBuildCashflow(m, scaleFactor, revenueCapacityScale = 1) {
  const rows = [];
  const horizon = Math.max(30, m.devYears + m.conYears + m.opYears + 2);
  for (let n = 0; n < horizon; n++) {
    const year = m.startYear + n;
    const phase = n < m.devYears ? '개발' : n < m.devYears + m.conYears ? '공사' : n < m.devYears + m.conYears + m.opYears ? '운영' : '-';
    const opIdx = n - (m.devYears + m.conYears);
    const scale = scaleFactor * revenueCapacityScale;
    const lease = phase === '운영' ? m.leaseBase * (1 + rate(m.leaseEsc)) ** opIdx * scale : 0;
    const devFee = n === (m.devYears + m.conYears - 1) ? m.devFeeBase * scale : 0;
    const conn = m.connMode === '일시금'
      ? (n === (m.devYears + m.conYears - 1) ? m.connBase * scale : 0)
      : (phase === '운영' ? m.connBase * (1 + rate(m.connEsc)) ** opIdx * scale : 0);
    const om = phase === '운영' ? m.omBase * (1 + rate(m.omEsc)) ** opIdx * scale : 0;
    const revenue = lease + devFee + conn + om;
    const cost = (n === 0 ? m.landCost : 0) + ((phase === '개발' || phase === '공사') ? m.devCostAnnual : 0) + (phase === '운영' ? m.omCostAnnual : 0);
    rows.push({ n, year, phase, lease, devFee, conn, om, revenue, cost, net: revenue - cost });
  }
  return rows;
}
function kchIrrAt(m, scaleFactor, revenueCapacityScale = 1) { return irr(kchBuildCashflow(m, scaleFactor, revenueCapacityScale).map((r) => r.net)); }

function kchSolveScaleFactor(m, targetIrr) {
  let low = 0, high = 5;
  const irrHigh = kchIrrAt(m, high);
  if (!Number.isFinite(irrHigh) || irrHigh < targetIrr) return { ok: false, reason: '가격배율 5.00배까지도 목표 IRR에 도달하지 못합니다.' };
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    const v = kchIrrAt(m, mid);
    if (!Number.isFinite(v)) { low = mid; continue; }
    if (v < targetIrr) low = mid; else high = mid;
  }
  return { ok: true, scaleFactor: high };
}

function totalLifetimeGenerationKWh(model) {
  const cal = buildCalendar(model.project);
  const capacityMW = model.revenue.contractCapacityMW;
  let totalMWh = 0;
  cal.rows.forEach((row) => {
    if (row.operationSequence <= 0) return;
    const ratePct = operatingRatePctForSequence(model, row.operationSequence);
    totalMWh += capacityMW * 24 * 365 * rate(ratePct) * row.operationFraction;
  });
  return totalMWh * 1000;
}

// 아티팩트 kchReadModel()(DOM 의존)의 순수 함수판 — fields는 시나리오 JSON의 inputs.fields(없는 키는 기본값).
function kchReadModelFromFields(fields) {
  const f = { ...DEFAULT_KCH_FIELDS, ...fields };
  const capacityMW = num(f, "kchCapacityMW"), storageMWh = num(f, "kchStorageMWh");
  const durationHours = capacityMW > 0 ? storageMWh / capacityMW : 0;
  const startYear = num(f, "kchStartYear"), devYears = num(f, "kchDevYears"), conYears = num(f, "kchConYears"), opYears = num(f, "kchOpYears");
  const codYear = startYear + devYears + conYears - 1;
  return {
    capacityMW, storageMWh, durationHours, startYear, devYears, conYears, opYears, codYear,
    landCost: num(f, "kchLandCost"), devCostAnnual: num(f, "kchDevCostAnnual"), omCostAnnual: num(f, "kchOmCostAnnual"),
    leaseBase: num(f, "kchLeaseBase"), leaseEsc: num(f, "kchLeaseEsc"),
    devFeeBase: num(f, "kchDevFeeBase"),
    connMode: f.kchConnMode || "연간", connBase: num(f, "kchConnBase"), connEsc: num(f, "kchConnEsc"),
    omBase: num(f, "kchOmBase"), omEsc: num(f, "kchOmEsc"),
    calcMode: f.kchCalcMode || "direct",
    targetIrr: rate(num(f, "kchTargetIrrPct", 9)), wacc: rate(num(f, "kchWaccPct", 7.5)),
  };
}

// 아티팩트 kchRecalc()의 계산 부분만(DOM 갱신 제외) — 결과·실제 적용 금액·민감도표(가격배율 × 설비용량)까지 한 번에.
const KCH_SENS_MULTIPLIERS = [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6];
const KCH_SENS_CAPACITIES = [20, 30, 40, 50, 60, 70, 80];
function kchCompute(fields) {
  const m = kchReadModelFromFields(fields);
  const directMode = m.calcMode === "direct";
  let sf = 1;
  if (!directMode) {
    const solved = kchSolveScaleFactor(m, m.targetIrr);
    if (!solved.ok) return { m, ok: false, directMode, reason: solved.reason, lifetimeTotal: NaN };
    sf = solved.scaleFactor;
  }
  const rows = kchBuildCashflow(m, sf);
  const netFlows = rows.map((r) => r.net);
  const totalRevenue = sum(rows.map((r) => r.revenue));
  const sensitivity = KCH_SENS_MULTIPLIERS.map((mult) => ({
    mult,
    cells: KCH_SENS_CAPACITIES.map((cap) => {
      const capScale = m.capacityMW > 0 ? cap / m.capacityMW : 1;
      return { cap, irr: kchIrrAt(m, mult, capScale) };
    }),
  }));
  return {
    m, ok: true, directMode, sf, rows,
    achievedIrr: irr(netFlows), npv: npv(m.wacc, netFlows),
    totalRevenue, totalCost: sum(rows.map((r) => r.cost)), lifetimeTotal: totalRevenue,
    out: { lease: m.leaseBase * sf, devFee: m.devFeeBase * sf, conn: m.connBase * sf, om: m.omBase * sf },
    sensitivity,
  };
}

// 가격환산계산기(6.5) — 아티팩트 recalcPriceScore()의 산식 그대로(전력거래소 공고 제2025-05호 Ⅲ.5).
function priceScoreCompute(min, bid, cap) {
  if (!Number.isFinite(min) || !Number.isFinite(bid) || !Number.isFinite(cap) || bid === 0) return { ok: false };
  const score = Math.round((min / bid * cap) * 100) / 100;
  const A = (bid * bid) / (min * cap);
  const B1 = bid - (min * cap / (score + 1));
  const B2 = (score - 1) !== 0 ? (min * cap / (score - 1)) - bid : NaN;
  const validB = [B1, B2].filter(Number.isFinite);
  const Bavg = validB.length ? validB.reduce((a, b) => a + b, 0) / validB.length : NaN;
  const deltaRows = [];
  for (let d = 5; d >= -5; d--) {
    const targetScore = score + d;
    let targetPrice = NaN, priceDelta = NaN;
    if (targetScore > 0) { targetPrice = min * cap / targetScore; priceDelta = targetPrice - bid; }
    deltaRows.push({ d, targetScore, targetPrice, priceDelta, note: d === 0 ? '현재 입찰가격' : d > 0 ? '점수 상승 → 가격 인하 필요' : '점수 하락 → 가격 인상 시 발생' });
  }
  return { ok: true, min, bid, cap, score, A, B1, B2, Bavg, deltaRows };
}

// ============================================================================
// 여기부터는 이 스크립트 전용 — 아티팩트의 readModel()(DOM 의존)을 순수 함수로 옮긴 것.
// fields는 scenario.json의 inputs.fields와 같은 { id: "문자열값" } 모양(또는 DEFAULT_FIELDS).
// ============================================================================

function num(fields, id, fallback = 0) {
  const v = fields[id];
  const n = v === undefined || v === "" ? NaN : +v;
  return Number.isFinite(n) ? n : fallback;
}

function buildModelFromInputs(inputs) {
  const fields = { ...DEFAULT_FIELDS, ...(inputs?.fields ?? {}) };
  const capexItemsRaw = inputs?.capexItems?.length ? inputs.capexItems : CAPEX_ITEMS.map((it) => it.value);
  const opexItemsRaw = inputs?.opexItems?.length ? inputs.opexItems : OPEX_ITEMS.map((it) => it.value);
  const opRatesRaw = inputs?.opRates?.length ? inputs.opRates : DEFAULT_OP_RATES;

  const unitCount = num(fields, "unitCount"), unitStorage = num(fields, "unitStorageMWh");
  const pcsUnitCount = num(fields, "pcsUnitCount"), unitPower = num(fields, "unitPowerMW");
  const totalStorageMWh = unitCount * unitStorage, totalPowerMW = pcsUnitCount * unitPower;
  const durationHours = totalPowerMW > 0 ? totalStorageMWh / totalPowerMW : 0;

  const codDateVal = fields.codDate ? new Date(fields.codDate + "T00:00:00Z") : new Date();
  const codYear = codDateVal.getUTCFullYear(), codMonth = codDateVal.getUTCMonth() + 1, codDay = codDateVal.getUTCDate();
  const startYear = num(fields, "startYear"), endYear = num(fields, "endYear");
  const constructionYears = Math.max(1, num(fields, "constructionYears", 1)), operationYears = num(fields, "operationYears");
  const constructionStartYear = codYear - constructionYears + 1;
  const developmentYears = Math.max(0, constructionStartYear - startYear);
  const calendarMismatch = (codYear + operationYears) !== endYear;

  const capexItems = fields.capexInputMode === "lumpsum"
    ? [{ id: "epcLumpSum", label: "EPC 총액(수기입력)", value: num(fields, "capexLumpSum"), category: "기자재" }]
    : CAPEX_ITEMS.map((it, i) => ({ ...it, value: +capexItemsRaw[i] || 0 }));
  const opexItems = OPEX_ITEMS.map((it, i) => ({ ...it, value: +opexItemsRaw[i] || 0 }));

  const installedCapacityMW = totalPowerMW;
  const contractCapacityMW = Math.max(0, num(fields, "contractCapacityMW"));
  const capacityOverInstalled = contractCapacityMW > installedCapacityMW;

  const operatingRatesPct = opRatesRaw.map((v) => +v || 0);

  const delayDays = Math.max(0, num(fields, "delayDays"));
  const CONTRACT_DAYS = 15 * 365;
  let delayStage = 0, priceAdjustmentFactor = 1, delayStageLabel = "정상준공";
  if (delayDays > 730) { delayStage = 3; delayStageLabel = "3단계 (2년 초과, 계약 해지)"; }
  else if (delayDays > 180) { delayStage = 2; delayStageLabel = "2단계 (180일 초과~2년, 거래기간 단축)"; }
  else if (delayDays > 0) { delayStage = 1; delayStageLabel = "1단계 (180일 이하)"; priceAdjustmentFactor = (CONTRACT_DAYS - delayDays) / CONTRACT_DAYS; }

  const avgNonCompliancePct = Math.min(100, Math.max(0, num(fields, "avgNonCompliancePct")));

  const model = {
    project: { projectName: fields.projectName, startYear, endYear, constructionYears, codYear, codMonth, codDay, operationYears, totalStorageMWh, totalPowerMW, installedCapacityMW, degradationPct: DEGRADATION_PCT, delayDays, delayStage },
    revenue: { durationHours, operatingRatesPct, bidPricePerKWh: 0, priceAdjustmentFactor, avgNonCompliancePct, contractCapacityMW },
    capex: { items: capexItems, constructionInflationPct: num(fields, "constructionInflationPct"), contingencyPct: num(fields, "contingencyPct"), developmentSharePct: num(fields, "developmentSharePct") },
    opex: { items: opexItems, variableOMPerMWh: num(fields, "variableOMPerMWh"), powerTradingFeePerKWh: num(fields, "powerTradingFeePerKWh"), insurancePct: num(fields, "insurancePct"), communityRevenuePct: num(fields, "communityRevenuePct"), escalationPct: num(fields, "opexEscalationPct"), ltsaStepAfterYear: num(fields, "ltsaStepAfterYear"), ltsaStepMultiplierPct: num(fields, "ltsaStepMultiplierPct") },
    finance: { equityPct: num(fields, "equityPct"), residentBondPct: num(fields, "residentBondPct"), seniorRatePct: num(fields, "seniorRatePct"), seniorTermYears: num(fields, "seniorTermYears"), seniorGraceYears: num(fields, "seniorGraceYears"), bondRatePct: num(fields, "bondRatePct"), bondTermYears: num(fields, "bondTermYears"), financeFeePct: num(fields, "financeFeePct"), constructionRatePct: num(fields, "constructionRatePct"), dsraMonths: num(fields, "dsraMonths"), kchSharePct: num(fields, "kchSharePct") },
    assumptions: { ...ASSUMPTIONS, taxBrackets: TAX_BRACKETS },
  };
  return { model, fields, developmentYears, calendarMismatch, capacityOverInstalled, capexItems, opexItems, operatingRatesPct };
}

function solveCurrentModelNode(fields) {
  const { model } = buildModelFromInputs({ fields });
  if (fields.solveMode === "irr") {
    return solveBidPriceForTarget(model, rate(num(fields, "targetIrrPct", 8)), fields.irrKind || "projectIrr");
  }
  const targetProfit = num(fields, "targetCompanyProfit", 100);
  const profitKind = fields.companyProfitKind || "companyProfitPreTax";
  return solveBidPriceForCompanyProfitTarget(model, targetProfit, profitKind);
}

function computeFloorPriceNode(fields) {
  const { model: irrModel } = buildModelFromInputs({ fields });
  const irrResult = solveBidPriceForTarget(irrModel, 0.06, "projectIrr");
  const { model: profitModel } = buildModelFromInputs({ fields });
  const profitResult = solveBidPriceForCompanyProfitTarget(profitModel, 100, "companyProfitPreTax");
  if (!irrResult.ok && !profitResult.ok) return { ok: false };
  if (!irrResult.ok) return { ok: true, price: profitResult.price, binding: "당사이익 100억" };
  if (!profitResult.ok) return { ok: true, price: irrResult.price, binding: "P-IRR 6%" };
  return irrResult.price >= profitResult.price
    ? { ok: true, price: irrResult.price, binding: "P-IRR 6%" }
    : { ok: true, price: profitResult.price, binding: "당사이익 100억" };
}

// ============================================================================
// 워크북 빌드 — 아티팩트 CSV 내보내기와 같은 데이터를, 다중 시트 진짜 .xlsx로 재구성.
// ============================================================================

const FIELD_LABELS = {
  projectName: "사업명", unitCount: "배터리 유닛 대수", unitStorageMWh: "대당 저장용량(MWh/대)",
  pcsUnitCount: "PCS 대수", unitPowerMW: "대당 PCS 출력(MW/대)",
  startYear: "사업 시작연도", endYear: "사업 종료연도", constructionYears: "공사기간(년)",
  codDate: "상업운전개시일(COD)", operationYears: "운영기간(년)",
  contractCapacityMW: "계약용량(MW, 입찰물량)", year1RatePct: "1년차 가동률(%)", year2RatePct: "2년차 가동률(%)",
  operatingRatePct: "기본 가동률(3년차~,%)", delayDays: "계획 대비 준공지연일수", avgNonCompliancePct: "연평균 미이행률(%)",
  constructionInflationPct: "건설비 물가상승률(%/년)", contingencyPct: "예비비(%)", developmentSharePct: "개발기간 집행 비중(%)",
  capexInputMode: "CAPEX 입력 방식", capexLumpSum: "EPC 총액 수기입력(억원)",
  variableOMPerMWh: "변동 O&M(원/MWh)", powerTradingFeePerKWh: "전력거래수수료(원/kWh)",
  insurancePct: "연간 운영보험료율(총투자비 %)", communityRevenuePct: "주민·지역 기여(매출 %)",
  opexEscalationPct: "OPEX 물가상승률(%/년)", ltsaStepAfterYear: "LTSA 단가 변경 시점(운영연차 이후)",
  ltsaStepMultiplierPct: "LTSA 변경 후 단가 배율(%)",
  equityPct: "자기자본 비율(%)", residentBondPct: "주민참여채권 비율(총투자비 %)", seniorRatePct: "선순위 대출금리(%)",
  seniorTermYears: "선순위 상환기간(년)", seniorGraceYears: "원금 거치기간(년)", bondRatePct: "주민참여채권 금리(%)",
  bondTermYears: "주민참여채권 만기(년)", financeFeePct: "금융부대비용(타인자본 %)", constructionRatePct: "건설기간 적용금리(%)",
  dsraMonths: "DSRA(부채상환액 개월)", kchSharePct: "당사(KCH) 지분율(보통주 %)",
  solveMode: "산정 기준", companyProfitKind: "당사 이익 구성 기준", targetCompanyProfit: "목표 당사 이익(억원)",
  irrKind: "기준 IRR", targetIrrPct: "목표 IRR(%)",
};

// <select>류 필드는 원시 옵션값(예: "companyProfit")이 아니라 아티팩트 화면에 보이는 문구로 바꿔서 적는다
// (captureAssumptionSnapshot()의 el.options[...].textContent 처리와 동일한 취지).
const SELECT_LABELS = {
  solveMode: { companyProfit: "당사 이익 목표", irr: "목표 IRR" },
  companyProfitKind: { companyProfitPreTax: "누적 순이익 (세전)", companyProfitAfterTax: "누적 순이익 (세후)", companyDividendPlusRecovery: "누적 배당+최종회수" },
  irrKind: { projectIrr: "P-IRR (프로젝트)", equityIrr: "E-IRR (지분,배당세전)", equityIrrAfterInvestorTax: "E-IRR (지분,배당세후)" },
  capexInputMode: { itemized: "항목별 입력 (13개)", lumpsum: "EPC 총액 직접 입력" },
};
function displayFieldValue(id, raw) {
  return SELECT_LABELS[id]?.[raw] ?? raw;
}

function fmt(n, d = 2) {
  return Number.isFinite(n) ? Number(n.toFixed(d)) : null; // 엑셀 셀에는 숫자 그대로 넣는다 — 검증 시 그대로 수식에 쓸 수 있도록.
}

// ============================================================================
// 스타일 시스템 — ExcelJS는 무료 버전에서도 글꼴·배경색·테두리·숫자서식·틀고정을 온전히 지원한다
// (SheetJS 무료판은 이 중 숫자서식 정도만 지원해 예전 버전이 밋밋했음).
// ============================================================================

const FONT = "맑은 고딕";
const CLR = {
  titleBg: "FF16302B", titleText: "FFFFFFFF",
  headerBg: "FF1F5C4F", headerText: "FFFFFFFF",
  sectionBg: "FFDCEEE8", sectionText: "FF0E3B33",
  altRow: "FFF3F8F6",
  border: "FFC7D9D4",
  good: "FFE1F3E8", goodText: "FF176B4F",
  bad: "FFFBE7E4", badText: "FFB3261E",
  accent: "FF0E6B57",
  label: "FF3A4A46",
};
const FMT = { money: "#,##0.000", moneyBig: "#,##0.0", pct: "0.00%", ratio: '0.00"x"', int: "#,##0", price: "#,##0.00", year: "0" };
// 인쇄/PDF 변환 시 열이 페이지 폭에 안 맞아 옆으로 잘려나가 다른 페이지로 흩어지는 것을 막는다
// (Excel에서 그냥 열어 화면으로 보는 데는 영향 없지만, 인쇄 미리보기·PDF 내보내기에서는 이게 없으면 표가 깨져 보인다).
const PAGE_SETUP = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };

function fill(argb) { return { type: "pattern", pattern: "solid", fgColor: { argb } }; }
function thinBorder() {
  const side = { style: "thin", color: { argb: CLR.border } };
  return { top: side, left: side, bottom: side, right: side };
}

function titleRow(ws, text, span) {
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, span);
  const cell = row.getCell(1);
  cell.font = { name: FONT, size: 13, bold: true, color: { argb: CLR.titleText } };
  cell.fill = fill(CLR.titleBg);
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  row.height = 26;
  ws.addRow([]);
}

function sectionRow(ws, text, span) {
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, span);
  const cell = row.getCell(1);
  cell.font = { name: FONT, size: 10.5, bold: true, color: { argb: CLR.sectionText } };
  cell.fill = fill(CLR.sectionBg);
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  row.height = 19;
  return row;
}

function headerRow(ws, headers) {
  const row = ws.addRow(headers);
  row.eachCell((cell) => {
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: CLR.headerText } };
    cell.fill = fill(CLR.headerBg);
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = thinBorder();
  });
  row.height = 30;
  return row;
}

// values: 셀 값 배열. formats: 컬럼별 numFmt(또는 null). band: 짝수행 음영 여부.
function dataRow(ws, values, formats, band) {
  const row = ws.addRow(values);
  row.eachCell((cell, col) => {
    cell.font = { name: FONT, size: 10 };
    cell.border = thinBorder();
    const f = formats[col - 1];
    if (f) cell.numFmt = f;
    cell.alignment = { vertical: "middle", horizontal: typeof cell.value === "number" ? "right" : (col === 1 ? "left" : "center") };
    if (band) cell.fill = fill(CLR.altRow);
  });
  return row;
}

// 라벨 | 값 두 칸짜리 행(Assumptions/Summary/Funding 공용). goodBad: true=초록, false=빨강, undefined=무채색.
function labelValueRow(ws, label, value, opts = {}) {
  const row = ws.addRow([label, value]);
  const labelCell = row.getCell(1), valueCell = row.getCell(2);
  labelCell.font = { name: FONT, size: opts.bold ? 10.5 : 10, bold: !!opts.bold, color: { argb: CLR.label } };
  labelCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  valueCell.font = { name: FONT, size: opts.size ?? (opts.bold ? 12 : 10), bold: opts.bold ?? false, color: { argb: opts.goodBad === true ? CLR.goodText : opts.goodBad === false ? CLR.badText : (opts.accent ? CLR.accent : "FF10231F") } };
  valueCell.alignment = { vertical: "middle", horizontal: typeof value === "number" ? "right" : "left" };
  if (opts.numFmt && typeof value === "number") valueCell.numFmt = opts.numFmt;
  if (opts.goodBad === true) { labelCell.fill = fill(CLR.good); valueCell.fill = fill(CLR.good); }
  if (opts.goodBad === false) { labelCell.fill = fill(CLR.bad); valueCell.fill = fill(CLR.bad); }
  [labelCell, valueCell].forEach((c) => { c.border = thinBorder(); });
  if (opts.rowHeight) row.height = opts.rowHeight;
  return row;
}

// 이미 지정한 width는 하한으로 두고, 실제 내용이 더 길면만 넓힌다(절대 줄이지 않음).
function autoWidth(ws) {
  ws.columns.forEach((col) => {
    let max = col.width ?? 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 60);
  });
}

async function buildWorkbook({ fields, model, meta, solved, floor, capexItems, opexItems, developmentYears, calendarMismatch, capacityOverInstalled, kch, link, ps }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ESS 적정 입찰단가 프로토타입";
  wb.created = new Date();

  // ---------------- Assumptions ----------------
  const wsA = wb.addWorksheet("Assumptions", { views: [{ state: "frozen", ySplit: 1 }], pageSetup: PAGE_SETUP });
  wsA.columns = [{ width: 40 }, { width: 26 }, { width: 16 }];
  titleRow(wsA, "ESS 적정 입찰단가 프로토타입 — 가정(Assumptions)", 3);
  labelValueRow(wsA, "생성 시각", new Date().toLocaleString("ko-KR"));
  wsA.addRow([]);
  sectionRow(wsA, "일반 입력값", 3);
  Object.keys(FIELD_LABELS).forEach((id) => {
    const raw = fields[id];
    if (SELECT_LABELS[id]) { labelValueRow(wsA, FIELD_LABELS[id], displayFieldValue(id, raw)); return; }
    const asNum = raw !== undefined && raw !== "" && Number.isFinite(+raw) ? +raw : null;
    labelValueRow(wsA, FIELD_LABELS[id], asNum ?? raw ?? "");
  });
  wsA.addRow([]);
  labelValueRow(wsA, "설치 저장용량(MWh, 계산)", fmt(model.project.totalStorageMWh, 1));
  labelValueRow(wsA, "설치 출력용량(MW, 계산)", fmt(model.project.totalPowerMW, 1));
  labelValueRow(wsA, "저장시간(설치 기준, h, 계산)", fmt(model.revenue.durationHours, 2));
  labelValueRow(wsA, "개발기간(년, 계산)", developmentYears);
  labelValueRow(wsA, "계약용량이 설치용량 초과?", capacityOverInstalled ? "예 — 확인 필요" : "아니오", { goodBad: !capacityOverInstalled });
  labelValueRow(wsA, "사업종료연도 = COD연도+운영기간 일치?", calendarMismatch ? "불일치 — 확인 필요" : "일치", { goodBad: !calendarMismatch });
  wsA.addRow([]);
  sectionRow(wsA, "CAPEX 항목별 입력값(억원)", 3);
  headerRow(wsA, ["항목", "분류", "금액(억원)"]);
  capexItems.forEach((it, i) => dataRow(wsA, [it.label, it.category ?? "", fmt(it.value, 2)], [null, null, FMT.moneyBig], i % 2 === 1));
  labelValueRow(wsA, "합계", fmt(sum(capexItems.map((it) => it.value)), 2), { bold: true, numFmt: FMT.moneyBig });
  wsA.addRow([]);
  sectionRow(wsA, "OPEX 항목별 입력값(억원/년)", 3);
  headerRow(wsA, ["항목", "금액(억원/년)"]);
  opexItems.forEach((it, i) => dataRow(wsA, [it.label, fmt(it.value, 2)], [null, FMT.moneyBig], i % 2 === 1));
  labelValueRow(wsA, "합계", fmt(sum(opexItems.map((it) => it.value)), 2), { bold: true, numFmt: FMT.moneyBig });
  wsA.addRow([]);
  sectionRow(wsA, "운영연차별 가동률(%)", 3);
  headerRow(wsA, ["연차", "가동률(%)"]);
  model.revenue.operatingRatesPct.forEach((v, i) => dataRow(wsA, [`${i + 1}년차`, fmt(v, 2)], [null, FMT.moneyBig], i % 2 === 1));
  wsA.addRow([]);
  sectionRow(wsA, "읽기 전용 가정(세무·배당 프리셋)", 3);
  labelValueRow(wsA, "WACC/할인율(%)", ASSUMPTIONS.waccPct);
  labelValueRow(wsA, "정액 감가상각 기간(년)", ASSUMPTIONS.depreciationYears);
  labelValueRow(wsA, "이월결손금 공제기간(년)", ASSUMPTIONS.nolCarryforwardYears);
  labelValueRow(wsA, "연간 DSCR 임계치(배)", ASSUMPTIONS.annualDscrThreshold);
  labelValueRow(wsA, "누적 DSCR 임계치(배)", ASSUMPTIONS.cumulativeDscrThreshold);
  labelValueRow(wsA, "법정준비금 적립률(%)", ASSUMPTIONS.legalReserveContributionPct);
  labelValueRow(wsA, "법정준비금 상한(자기자본 %)", ASSUMPTIONS.legalReserveCapPctOfEquity);
  labelValueRow(wsA, "투자자 배당소득세(%)", ASSUMPTIONS.investorDividendTaxPct);
  wsA.addRow([]);
  sectionRow(wsA, "법인세 4단계 누진구간 (법인세+지방소득세 합산)", 3);
  headerRow(wsA, ["과세표준 상한(억원)", "세율(%)"]);
  TAX_BRACKETS.forEach((b, i) => dataRow(wsA, [b.upTo === null ? "3,000억 초과" : `${b.upTo}억 이하`, b.ratePct], [null, null], i % 2 === 1));

  // ---------------- Summary (대시보드) ----------------
  const r = solved.ok ? solved.result : null;
  const wsS = wb.addWorksheet("Summary", { views: [{ state: "frozen", ySplit: 1 }], pageSetup: PAGE_SETUP });
  wsS.columns = [{ width: 46 }, { width: 22 }];
  titleRow(wsS, "ESS 적정 입찰단가 프로토타입 — 요약(Summary)", 2);
  sectionRow(wsS, "산정 결과", 2);
  labelValueRow(wsS, "산정 기준", fields.solveMode === "irr" ? "목표 IRR" : "당사 이익 목표");
  labelValueRow(wsS, "계약용량(MW)", fmt(model.revenue.contractCapacityMW, 1));
  labelValueRow(wsS, "설치용량(MW, 참고)", fmt(model.project.totalPowerMW, 1));
  labelValueRow(wsS, "적정 입찰단가(원/kWh)", solved.ok ? fmt(solved.price, 2) : "N/A", { bold: true, size: 20, accent: true, numFmt: FMT.price, rowHeight: 30 });
  labelValueRow(wsS, "달성 상태", solved.ok ? "목표 도달" : `실패 — ${solved.reason}`, { goodBad: solved.ok });
  wsS.addRow([]);
  sectionRow(wsS, "최저단가 — P-IRR 6%·당사이익 100억(15년 누적) 동시충족", 2);
  labelValueRow(wsS, "최저단가(원/kWh)", floor.ok ? fmt(floor.price, 2) : "N/A", { bold: true, size: 16, accent: true, numFmt: FMT.price, rowHeight: 26 });
  labelValueRow(wsS, "타이트한 조건", floor.ok ? floor.binding : "");
  const belowFloor = floor.ok && solved.ok && floor.price > solved.price + 1e-9;
  labelValueRow(wsS, "현재 산정 결과가 최저단가 미만?", belowFloor ? "예 — 목표를 하한 이상으로 높여야 함" : "아니오", { goodBad: !belowFloor });
  wsS.addRow([]);
  if (r) {
    sectionRow(wsS, "수익률 지표", 2);
    labelValueRow(wsS, "달성 P-IRR", rate2(r.projectIrr), { numFmt: FMT.pct });
    labelValueRow(wsS, "달성 E-IRR 배당세전", rate2(r.equityIrr), { numFmt: FMT.pct });
    labelValueRow(wsS, "달성 E-IRR 배당세후", rate2(r.equityIrrAfterInvestorTax), { numFmt: FMT.pct });
    labelValueRow(wsS, "NPV(억원)", fmt(r.projectNpv, 2), { numFmt: FMT.moneyBig });
    labelValueRow(wsS, "총투자비(억원)", fmt(r.totalInvestment, 2), { numFmt: FMT.moneyBig });
    labelValueRow(wsS, "연간 방전전력량(환산, GWh)", fmt(r.annualGenerationMWh / 1000, 3));
    labelValueRow(wsS, "연간 매출(환산, 억원)", fmt(r.annualRevenue, 2), { numFmt: FMT.moneyBig });
    wsS.addRow([]);
    sectionRow(wsS, "당사(KCH 지분) 손익", 2);
    labelValueRow(wsS, "당사 누적 출자금(억원)", fmt(r.companyEquityInjected, 2), { numFmt: FMT.moneyBig });
    labelValueRow(wsS, "당사 누적 배당+최종회수(억원)", fmt(r.companyDividendPlusRecovery, 2), { numFmt: FMT.moneyBig });
    labelValueRow(wsS, "당사 누적 순이익 세전(억원)", fmt(r.companyProfitPreTax, 2), { numFmt: FMT.moneyBig });
    labelValueRow(wsS, "당사 누적 순이익 세후(억원)", fmt(r.companyProfitAfterTax, 2), { numFmt: FMT.moneyBig });
    labelValueRow(wsS, "투자배수 MOIC(배)", Number.isFinite(r.companyProfitMultiple) ? fmt(r.companyProfitMultiple, 3) : "N/A", { numFmt: FMT.ratio });
  }

  if (!r) {
    fs.writeFileSync(meta.outputPath.replace(/\.xlsx$/, "") + "_LOG.txt", "적정 입찰단가 산정 실패: " + solved.reason, "utf8");
    autoWidth(wsA); autoWidth(wsS);
    await wb.xlsx.writeFile(meta.outputPath);
    return { ok: false, reason: solved.reason };
  }

  const f = r.funding;

  // ---------------- Funding ----------------
  const wsF = wb.addWorksheet("Funding", { views: [{ state: "frozen", ySplit: 1 }], pageSetup: PAGE_SETUP });
  wsF.columns = [{ width: 48 }, { width: 18 }];
  titleRow(wsF, "총투자비 조달내역 — Uses of Funds vs Sources of Funds", 2);
  const checkVal = fmt(f.totalInvestment - (f.equityPrincipal + f.seniorPrincipal + f.bondPrincipal), 6);
  labelValueRow(wsF, "총투자비=조달합계 검증(억원, 0이어야 함)", checkVal, { goodBad: Math.abs(checkVal) < 1e-6, bold: true, numFmt: "#,##0.000000" });
  wsF.addRow([]);
  sectionRow(wsF, "Uses of Funds (총투자비 구성)", 2);
  labelValueRow(wsF, "총투자비(억원)", fmt(f.totalInvestment, 2), { bold: true, numFmt: FMT.moneyBig });
  labelValueRow(wsF, "직접공사비(명목,억원) — 감가상각 대상(PP&E) 원가", fmt(f.nominalDirectCapex, 2), { numFmt: FMT.moneyBig });
  labelValueRow(wsF, "예비비(억원) — 감가상각 대상(PP&E) 원가", fmt(f.contingency, 2), { numFmt: FMT.moneyBig });
  labelValueRow(wsF, "금융수수료(억원) — 감가상각 대상 아님", fmt(f.financeFee, 2), { numFmt: FMT.moneyBig });
  labelValueRow(wsF, "DSRA(억원) — 현금성자산, 종료 시 회수", fmt(f.dsra, 2), { numFmt: FMT.moneyBig });
  labelValueRow(wsF, "건설기간이자 IDC(억원) — 감가상각 대상 아님", fmt(f.constructionInterest, 2), { numFmt: FMT.moneyBig });
  labelValueRow(wsF, "감가상각 대상 원가(PP&E, 억원) = 직접공사비+예비비", fmt(f.nominalDirectCapex + f.contingency, 2), { bold: true, numFmt: FMT.moneyBig });
  wsF.addRow([]);
  sectionRow(wsF, "Sources of Funds (조달 구조)", 2);
  labelValueRow(wsF, "자기자본(억원)", fmt(f.equityPrincipal, 2), { numFmt: FMT.moneyBig });
  labelValueRow(wsF, "선순위대출(억원)", fmt(f.seniorPrincipal, 2), { numFmt: FMT.moneyBig });
  labelValueRow(wsF, "주민채권(억원)", fmt(f.bondPrincipal, 2), { numFmt: FMT.moneyBig });

  // ---------------- IS ----------------
  const wsIS = wb.addWorksheet("IS", { views: [{ state: "frozen", ySplit: 3 }], pageSetup: PAGE_SETUP });
  wsIS.columns = [10, 13, 13, 12, 13, 13, 12, 13, 12, 15, 12, 14].map((w) => ({ width: w }));
  titleRow(wsIS, "손익계산서(I/S) 스타일 재구성 — CashFlow 시트와 같은 원천값을 손익계산서 순서로 재배열", 12);
  headerRow(wsIS, ["연도", "단계", "매출(억원)", "OPEX(억원)", "EBITDA(억원)", "감가상각(억원)", "EBIT(억원)", "이자비용(억원)", "EBT(억원)", "과세표준(NOL후,억원)", "법인세(억원)", "당기순이익(억원)"]);
  const isFmts = [FMT.year, null, FMT.money, FMT.money, FMT.money, FMT.money, FMT.money, FMT.money, FMT.money, FMT.money, FMT.money, FMT.money];
  r.detail.forEach((row, i) => {
    const ebit = row.ebitda - row.depreciation;
    const interest = row.seniorInterest + row.bondInterest;
    const ebt = ebit - interest;
    const ni = ebt - row.corporateTax;
    dataRow(wsIS, [row.calendarYear, row.phase, fmt(row.revenue, 3), fmt(row.opex, 3), fmt(row.ebitda, 3), fmt(row.depreciation, 3), fmt(ebit, 3), fmt(interest, 3), fmt(ebt, 3), fmt(row.taxableIncome, 3), fmt(row.corporateTax, 3), fmt(ni, 3)], isFmts, i % 2 === 1);
  });

  // ---------------- Depreciation ----------------
  const ppeCost = f.nominalDirectCapex + f.contingency;
  let accumDep = 0;
  const wsD = wb.addWorksheet("Depreciation", { views: [{ state: "frozen", ySplit: 3 }], pageSetup: PAGE_SETUP });
  wsD.columns = [10, 13, 16, 16, 18].map((w) => ({ width: w }));
  titleRow(wsD, "감가상각 스케줄 — PP&E 순장부가액 (정액법)", 5);
  headerRow(wsD, ["연도", "단계", "당해 감가상각(억원)", "누적 감가상각(억원)", "PP&E 순장부가액(억원)"]);
  r.detail.forEach((row, i) => {
    accumDep += row.depreciation;
    dataRow(wsD, [row.calendarYear, row.phase, fmt(row.depreciation, 3), fmt(accumDep, 3), fmt(ppeCost - accumDep, 3)], [FMT.year, null, FMT.money, FMT.money, FMT.money], i % 2 === 1);
  });

  // ---------------- DebtSchedule ----------------
  let seniorOpen = f.seniorPrincipal, bondOpen = f.bondPrincipal;
  const wsDS = wb.addWorksheet("DebtSchedule", { views: [{ state: "frozen", ySplit: 3 }], pageSetup: PAGE_SETUP });
  wsDS.columns = [10, 13, 15, 12, 14, 14, 15, 12, 14, 14].map((w) => ({ width: w }));
  titleRow(wsDS, "부채상환 스케줄 — 선순위차입금·주민참여채권", 10);
  headerRow(wsDS, ["연도", "단계", "선순위 기초잔액", "선순위 이자", "선순위 원금상환", "선순위 기말잔액", "채권 기초잔액", "채권 이자", "채권 원금상환", "채권 기말잔액"]);
  const dsFmts = [FMT.year, null, FMT.money, FMT.money, FMT.money, FMT.money, FMT.money, FMT.money, FMT.money, FMT.money];
  r.detail.forEach((row, i) => {
    dataRow(wsDS, [row.calendarYear, row.phase, fmt(seniorOpen, 3), fmt(row.seniorInterest, 3), fmt(row.seniorPrincipal, 3), fmt(row.seniorBalanceEnd, 3), fmt(bondOpen, 3), fmt(row.bondInterest, 3), fmt(row.bondPrincipal, 3), fmt(row.bondBalanceEnd, 3)], dsFmts, i % 2 === 1);
    seniorOpen = row.seniorBalanceEnd; bondOpen = row.bondBalanceEnd;
  });

  // ---------------- CashFlow ----------------
  const cfHeader = ["연도", "단계", "가동일수", "연간일수", "가동률", "발전량(MWh)", "매출(억원)", "OPEX(억원)", "EBITDA(억원)",
    "CAPEX집행(억원)", "자기자본조달(억원)", "선순위대출조달(억원)", "주민채권조달(억원)", "감가상각(억원)",
    "선순위이자(억원)", "선순위원금상환(억원)", "선순위잔액기말(억원)", "채권이자(억원)", "채권원금상환(억원)", "채권잔액기말(억원)",
    "원리금상환합계(억원)", "DSCR연간", "DSCR연간충족", "DSCR누적", "DSCR누적충족",
    "과세표준NOL전(억원)", "과세표준NOL후(억원)", "법인세(억원)", "CFADS(억원)", "배당가능현금(억원)", "배당가능재원상한(억원)",
    "추가출자(억원)", "배당(억원)", "이익준비금당해적립(억원)", "이익준비금잔여기말(억원)", "투자자배당소득세(억원)", "최종연도회수(억원)",
    "프로젝트CF세전(억원)", "프로젝트CF세후(억원)", "SPC지분CF세전(억원)", "SPC지분CF세후(억원)", "당사지분CF세전(억원)", "당사지분CF세후(억원)"];
  const cfFmts = [FMT.year, null, FMT.int, FMT.int, FMT.pct, FMT.int, FMT.money, FMT.money, FMT.money,
    FMT.money, FMT.money, FMT.money, FMT.money, FMT.money,
    FMT.money, FMT.money, FMT.money, FMT.money, FMT.money, FMT.money,
    FMT.money, FMT.ratio, null, FMT.ratio, null,
    FMT.money, FMT.money, FMT.money, FMT.money, FMT.money, FMT.money,
    FMT.money, FMT.money, FMT.money, FMT.money, FMT.money, FMT.money,
    FMT.money, FMT.money, FMT.money, FMT.money, FMT.money, FMT.money];
  // CashFlow는 42개 열이라 다른 시트처럼 폭 1페이지에 욱여넣으면 글자가 안 보일 정도로 작아진다 —
  // 이 시트만 자연 페이지분할(가로만 landscape)로 두고, 연도·단계 열을 매 인쇄 페이지 왼쪽에 반복시킨다.
  const wsCF = wb.addWorksheet("CashFlow", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 3 }],
    pageSetup: { orientation: "landscape", margins: PAGE_SETUP.margins },
  });
  wsCF.pageSetup.printTitlesColumn = "A:B";
  wsCF.pageSetup.printTitlesRow = "1:3";
  // 억원 열은 "#,##0.000"(최대 "-10,000.000"=11자)까지 잘리지 않도록 13 이상 확보. 한글 헤더는 wrapText로 감싸 표시.
  wsCF.columns = cfHeader.map((h, i) => ({ width: i === 0 ? 10 : i === 1 ? 13 : i <= 4 ? Math.max(h.length + 2, 9) : Math.max(h.length + 2, 13) }));
  titleRow(wsCF, "연도별 현금흐름 상세 (DSCR 게이트·이익준비금 잔여액 반영한 실제 배당 로직)", cfHeader.length);
  headerRow(wsCF, cfHeader);
  r.detail.forEach((row, i) => {
    const values = [
      row.calendarYear, row.phase, row.operatingDays, row.daysInYear, row.ratePct == null ? null : rate2(row.ratePct / 100),
      fmt(row.generationMWh, 1), fmt(row.revenue, 3), fmt(row.opex, 3), fmt(row.ebitda, 3),
      fmt(row.capexDraw, 3), fmt(row.equityDraw, 3), fmt(row.seniorDraw, 3), fmt(row.bondDraw, 3), fmt(row.depreciation, 3),
      fmt(row.seniorInterest, 3), fmt(row.seniorPrincipal, 3), fmt(row.seniorBalanceEnd, 3), fmt(row.bondInterest, 3), fmt(row.bondPrincipal, 3), fmt(row.bondBalanceEnd, 3),
      fmt(row.debtService, 3), row.dscr == null ? null : fmt(row.dscr, 3), row.annualDscrGatePass == null ? "" : (row.annualDscrGatePass ? "Y" : "N"),
      row.cumDscr == null ? null : fmt(row.cumDscr, 3), row.cumDscrGatePass == null ? "" : (row.cumDscrGatePass ? "Y" : "N"),
      fmt(row.taxableBeforeNol, 3), fmt(row.taxableIncome, 3), fmt(row.corporateTax, 3), fmt(row.cfads, 3), fmt(row.availableCash, 3), fmt(row.distributable, 3),
      fmt(row.additionalEquity, 3), fmt(row.dividend, 3), fmt(row.legalReserveContribution, 3), fmt(row.legalReserveBalanceEnd, 3), fmt(row.investorDividendTax, 3), fmt(row.terminalRecovery, 3),
      fmt(row.projectFlowPreTax, 3), fmt(row.projectFlow, 3), fmt(row.equityFlow, 3), fmt(row.equityFlowAfterTax, 3), fmt(row.companyEquityFlow, 3), fmt(row.companyEquityFlowAfterTax, 3),
    ];
    const dr = dataRow(wsCF, values, cfFmts, i % 2 === 1);
    // DSCR 게이트 미충족(N) 셀은 경고색으로 강조.
    const gateCols = [23, 25]; // DSCR연간충족, DSCR누적충족 (1-based column index)
    gateCols.forEach((c) => {
      const cell = dr.getCell(c);
      if (cell.value === "N") { cell.fill = fill(CLR.bad); cell.font = { name: FONT, size: 10, bold: true, color: { argb: CLR.badText } }; }
      else if (cell.value === "Y") { cell.font = { name: FONT, size: 10, color: { argb: CLR.goodText } }; }
    });
  });

  // ---------------- KCH (개발수수료 단가산정, 6.4) ----------------
  const wsK = wb.addWorksheet("KCH", { views: [{ state: "frozen", ySplit: 1 }], pageSetup: PAGE_SETUP });
  wsK.columns = [{ width: 44 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }];
  titleRow(wsK, "KCH 개발수수료 단가산정(6.4) — SPC가 KCH(개발자)에게 지급하는 4개 수수료", 10);
  const km = kch.m;
  sectionRow(wsK, "산정 방식 · 사업 기본정보", 10);
  labelValueRow(wsK, "산정 방식", kch.directMode ? "총액 직접 입력 (권장)" : "목표 IRR 역산 (레거시)");
  labelValueRow(wsK, "설비용량(MW)", fmt(km.capacityMW, 2));
  labelValueRow(wsK, "저장용량(MWh)", fmt(km.storageMWh, 2));
  labelValueRow(wsK, "저장시간(h, 계산)", fmt(km.durationHours, 2));
  labelValueRow(wsK, "사업 시작연도", km.startYear);
  labelValueRow(wsK, "개발기간(년)", km.devYears);
  labelValueRow(wsK, "공사기간(년)", km.conYears);
  labelValueRow(wsK, "운영기간(년)", km.opYears);
  labelValueRow(wsK, "COD 연도(계산)", km.codYear);
  wsK.addRow([]);
  const KM2 = "#,##0.00"; // KCH 절은 아티팩트 화면처럼 소수 둘째 자리까지 표시(예: NPV 1.57억원, 실제 적용 금액 0.42억원)
  sectionRow(wsK, "KCH 비용(현금유출)", 10);
  labelValueRow(wsK, "용지 매입·옵션 비용(억원, 최초 1회)", fmt(km.landCost, 2), { numFmt: KM2 });
  labelValueRow(wsK, "개발·인허가비(억원/년, 개발+공사)", fmt(km.devCostAnnual, 2), { numFmt: KM2 });
  labelValueRow(wsK, "자체 관리비(억원/년, 운영기간)", fmt(km.omCostAnnual, 2), { numFmt: KM2 });
  wsK.addRow([]);
  sectionRow(wsK, "수익원 4종 입력(기준총액, 억원 — 현재 설비용량 기준)", 10);
  labelValueRow(wsK, "① 부지 임대료(억원/년)", fmt(km.leaseBase, 2), { numFmt: KM2 });
  labelValueRow(wsK, "① 연간 상승률(%)", km.leaseEsc);
  labelValueRow(wsK, "② 사전개발비(억원, COD 1회)", fmt(km.devFeeBase, 2), { numFmt: KM2 });
  labelValueRow(wsK, "③ 공동접속료 발생방식", km.connMode === "일시금" ? "일시금(COD 1회)" : "연간");
  labelValueRow(wsK, "③ 공동접속료 기준총액(억원)", fmt(km.connBase, 2), { numFmt: KM2 });
  labelValueRow(wsK, "③ 연간 상승률(%, 연간 방식)", km.connEsc);
  labelValueRow(wsK, "④ 운영수익(억원/년)", fmt(km.omBase, 2), { numFmt: KM2 });
  labelValueRow(wsK, "④ 연간 상승률(%)", km.omEsc);
  if (!kch.directMode) labelValueRow(wsK, "목표 IRR(%)", Number((km.targetIrr * 100).toFixed(4)));
  labelValueRow(wsK, "할인율 WACC(%, NPV용)", Number((km.wacc * 100).toFixed(4)));
  wsK.addRow([]);
  sectionRow(wsK, "결과", 10);
  if (!kch.ok) {
    labelValueRow(wsK, "상태", `실패 — ${kch.reason}`, { goodBad: false });
  } else {
    labelValueRow(wsK, "상태", kch.directMode ? "총액 직접입력 모드 — 입력한 금액을 그대로 사용" : "목표 IRR 도달", { goodBad: true });
    if (!kch.directMode) labelValueRow(wsK, "공통 가격배율(자동 역산, 배)", Number(kch.sf.toFixed(6)), { bold: true, numFmt: "0.0000" });
    labelValueRow(wsK, "달성 IRR(참고)", rate2(kch.achievedIrr), { numFmt: FMT.pct });
    labelValueRow(wsK, "NPV(억원)", fmt(kch.npv, 2), { numFmt: KM2 });
    labelValueRow(wsK, "총수익(운영기간 합계, 억원)", fmt(kch.totalRevenue, 2), { numFmt: KM2 });
    labelValueRow(wsK, "KCH 총비용(억원)", fmt(kch.totalCost, 2), { numFmt: KM2 });
    labelValueRow(wsK, "생애주기 누적 총 수취액(억원) — 4개 수익원 합산", fmt(kch.lifetimeTotal, 2), { bold: true, size: 16, accent: true, numFmt: KM2, rowHeight: 26 });
    wsK.addRow([]);
    sectionRow(wsK, "실제 적용 금액(억원 — 직접입력 모드는 입력값과 동일, 역산 모드는 가격배율 반영 후)", 10);
    labelValueRow(wsK, "① 부지 임대료(억원/년)", fmt(kch.out.lease, 2), { numFmt: KM2 });
    labelValueRow(wsK, "② 사전개발비(억원)", fmt(kch.out.devFee, 2), { numFmt: KM2 });
    labelValueRow(wsK, "③ 공동접속료(억원)", fmt(kch.out.conn, 2), { numFmt: KM2 });
    labelValueRow(wsK, "④ 운영수익(억원/년)", fmt(kch.out.om, 2), { numFmt: KM2 });
    wsK.addRow([]);
    sectionRow(wsK, "연차별 현금흐름(억원, 운영 종료까지) — ①~④ 수익원 − KCH 비용 = 순현금흐름", 10);
    headerRow(wsK, ["연차(n)", "연도", "단계", "① 부지임대료", "② 사전개발비", "③ 공동접속료", "④ 운영수익", "수익 합계", "KCH 비용", "순현금흐름"]);
    const kFmts = [FMT.int, FMT.year, null, FMT.money, FMT.money, FMT.money, FMT.money, FMT.money, FMT.money, FMT.money];
    kch.rows.filter((r) => r.phase !== "-").forEach((r, i) => {
      dataRow(wsK, [r.n, r.year, r.phase, fmt(r.lease, 3), fmt(r.devFee, 3), fmt(r.conn, 3), fmt(r.om, 3), fmt(r.revenue, 3), fmt(r.cost, 3), fmt(r.net, 3)], kFmts, i % 2 === 1);
    });
    wsK.addRow([]);
    sectionRow(wsK, "민감도표 — 가격배율 × 설비용량(MW) → 달성 IRR (목표 IRR 이상 = 초록; 총액은 설비용량 비율로 스케일링, KCH 비용은 고정)", 10);
    headerRow(wsK, ["가격배율 \\ 설비용량(MW)", ...KCH_SENS_CAPACITIES.map((c) => `${c}`)]);
    kch.sensitivity.forEach((srow, i) => {
      const dr = dataRow(wsK, [Number(srow.mult.toFixed(1)), ...srow.cells.map((c) => rate2(c.irr))], ["0.0", ...KCH_SENS_CAPACITIES.map(() => FMT.pct)], i % 2 === 1);
      srow.cells.forEach((c, j) => {
        const cell = dr.getCell(j + 2);
        if (Number.isFinite(c.irr) && c.irr >= km.targetIrr) { cell.fill = fill(CLR.good); cell.font = { name: FONT, size: 10, bold: true, color: { argb: CLR.goodText } }; }
      });
    });
  }

  // ---------------- 가격환산 (6.5 가격환산계산기 + 6.4→6.5 원/kWh 자동환산) ----------------
  const wsP = wb.addWorksheet("가격환산", { views: [{ state: "frozen", ySplit: 1 }], pageSetup: PAGE_SETUP });
  wsP.columns = [{ width: 52 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 30 }];
  titleRow(wsP, "가격환산계산기(6.5) — 공고 제2025-05호 Ⅲ.5 산식 + KCH 수수료(6.4) 원/kWh 자동환산", 5);
  sectionRow(wsP, "입찰가격 구성 — 6.5 입찰가격 = 단가산정모델 적정 입찰단가 + KCH 수수료 원/kWh 환산분", 5);
  labelValueRow(wsP, "단가산정모델 적정 입찰단가(원값, 원/kWh)", fmt(solved.price, 4), { numFmt: FMT.price });
  labelValueRow(wsP, "이 프로젝트 생애주기 총 발전량(kWh) — 계약용량·가동률·운영기간 기준", Math.round(link.totalGenKWh), { numFmt: FMT.int });
  labelValueRow(wsP, "KCH 생애주기 누적 총 수취액(억원)", kch.ok ? fmt(kch.lifetimeTotal, 2) : "N/A(KCH 산정 실패 → 환산분 0)", { numFmt: FMT.moneyBig });
  labelValueRow(wsP, "KCH 수수료 원/kWh 환산 반영분 = 수취액×1e8 ÷ 총발전량(kWh)", fmt(link.kchIncrementPerKWh, 4), { numFmt: FMT.price });
  labelValueRow(wsP, "6.5 입찰가격(자동연동, 원/kWh)", fmt(link.bidPrice65, 4), { bold: true, size: 16, accent: true, numFmt: FMT.price, rowHeight: 26 });
  const savedBid = link.savedBidPrice !== undefined && link.savedBidPrice !== "" ? +link.savedBidPrice : null;
  const bidMismatch = savedBid !== null && Number.isFinite(savedBid) && Math.abs(savedBid - link.bidPrice65) > 0.01;
  labelValueRow(wsP, "시나리오 저장 당시 화면의 6.5 입찰가격(원/kWh)", savedBid ?? "(기록 없음)", { numFmt: FMT.price, goodBad: savedBid === null ? undefined : !bidMismatch });
  if (bidMismatch) labelValueRow(wsP, "※ 위 두 값이 다릅니다", "저장 당시 6.5 입찰가격을 직접 입력해 자동연동이 끊긴 상태였을 수 있습니다 — 이 시트의 점수는 자동연동 값 기준입니다", { goodBad: false });
  wsP.addRow([]);
  sectionRow(wsP, "가격평가점수 = 최저입찰가격 ÷ 입찰가격 × 가격배점", 5);
  if (!ps.ok) {
    labelValueRow(wsP, "상태", "계산 불가(입찰가격 0 또는 미정)", { goodBad: false });
  } else {
    labelValueRow(wsP, "최저입찰가격(원/kWh)", fmt(ps.min, 4), { numFmt: FMT.price });
    labelValueRow(wsP, "입찰가격(평가대상, 원/kWh) — 위 6.5 자동연동 값", fmt(ps.bid, 4), { numFmt: FMT.price });
    labelValueRow(wsP, "가격배점(만점, 점)", ps.cap);
    labelValueRow(wsP, "가격평가점수(점)", fmt(ps.score, 2), { bold: true, size: 16, accent: true, numFmt: "0.00", rowHeight: 26 });
    labelValueRow(wsP, "방법 A. 한계(미분) 근사값(원/kWh)", fmt(ps.A, 4), { numFmt: "#,##0.0000" });
    labelValueRow(wsP, "방법 B-1. +1점 상승에 필요한 가격 인하폭(원/kWh)", fmt(ps.B1, 4), { numFmt: "#,##0.0000" });
    labelValueRow(wsP, "방법 B-2. −1점 하락을 유발하는 가격 인상폭(원/kWh)", Number.isFinite(ps.B2) ? fmt(ps.B2, 4) : "N/A", { numFmt: "#,##0.0000" });
    labelValueRow(wsP, "방법 B 평균값(권장, 원/kWh)", fmt(ps.Bavg, 4), { bold: true, accent: true, numFmt: "#,##0.0000" });
    wsP.addRow([]);
    sectionRow(wsP, "Δ점 민감도 — 목표점수별 필요 입찰가격", 5);
    headerRow(wsP, ["Δ점", "목표점수", "목표 입찰가격(원/kWh)", "가격 변동(원/kWh)", "비고"]);
    ps.deltaRows.forEach((r, i) => {
      const dr = dataRow(wsP, [r.d, fmt(r.targetScore, 2), r.targetScore > 0 ? fmt(r.targetPrice, 2) : "N/A", r.targetScore > 0 ? fmt(r.priceDelta, 2) : "N/A", r.note], ["+0;-0;0", "0.00", FMT.price, "+#,##0.00;-#,##0.00;0.00", null], i % 2 === 1);
      if (r.d === 0) dr.eachCell((cell) => { cell.fill = fill(CLR.sectionBg); cell.font = { name: FONT, size: 10, bold: true }; });
    });
  }

  autoWidth(wsA); autoWidth(wsS); autoWidth(wsF);
  await wb.xlsx.writeFile(meta.outputPath);
  return { ok: true };
}

function rate2(n) { return Number.isFinite(n) ? Number(n.toFixed(6)) : null; } // 비율 그대로(포맷은 셀 numFmt 0.00%가 처리)

// ============================================================================
// main
// ============================================================================

const scenarioPath = process.argv[2] && !process.argv[2].endsWith(".xlsx") ? process.argv[2] : null;
const outputPath = process.argv.find((a) => a.endsWith(".xlsx"))
  ?? `ESS_적정입찰단가_모델_${new Date().toISOString().slice(0, 10)}.xlsx`;

let inputs = null;
if (scenarioPath) {
  const raw = JSON.parse(fs.readFileSync(scenarioPath, "utf8"));
  inputs = raw.inputs ?? raw;
  console.log(`시나리오 파일 사용: ${scenarioPath} (이름: ${raw.scenarioName ?? "?"})`);
} else {
  console.log("시나리오 파일 없음 — 아티팩트 기본값(안좌 96MW/576MWh 기본안)을 사용합니다.");
}

const built = buildModelFromInputs(inputs ?? {});
const solved = solveCurrentModelNode(built.fields);
const floor = computeFloorPriceNode(built.fields);

// 6.4 KCH 개발수수료 + 6.4→6.5 원/kWh 자동환산 + 6.5 가격환산계산기 — 아티팩트 recalcAll()/kchRecalc()/recalcPriceScore()와 동일 로직.
const kch = kchCompute(built.fields);
const totalGenKWh = totalLifetimeGenerationKWh(built.model);
const kchIncrementPerKWh = (kch.ok && Number.isFinite(kch.lifetimeTotal) && totalGenKWh > 0) ? (kch.lifetimeTotal * HUNDRED_MILLION) / totalGenKWh : 0;
// 아티팩트는 6.5 입찰가격 입력란에 (solved.price + 환산분).toFixed(2)를 써넣고 그 "2자리로 반올림된 값"으로 점수를 계산한다
// (recalcAll: $('bidPrice').value = (...).toFixed(2) → recalcPriceScore: +$('bidPrice').value). 화면과 소수 둘째 자리까지
// 똑같이 나오도록 여기서도 같은 순서로 반올림한 뒤 점수를 구한다(반올림 없이 계산하면 점수가 0.01점 어긋날 수 있음).
const bidPrice65 = solved.ok ? Number((solved.price + kchIncrementPerKWh).toFixed(2)) : NaN;
const link = { totalGenKWh, kchIncrementPerKWh, bidPrice65, savedBidPrice: built.fields.bidPrice };
const ps = priceScoreCompute(num(built.fields, "minPrice", 18), bidPrice65, num(built.fields, "priceCap", 50));

const outcome = await buildWorkbook({
  fields: built.fields, model: built.model, meta: { outputPath },
  solved, floor,
  capexItems: built.capexItems, opexItems: built.opexItems,
  developmentYears: built.developmentYears, calendarMismatch: built.calendarMismatch, capacityOverInstalled: built.capacityOverInstalled,
  kch, link, ps,
});

if (outcome.ok) {
  console.log(`완료: ${outputPath}`);
  console.log(`적정 입찰단가: ${solved.ok ? solved.price.toFixed(2) + "원/kWh" : "N/A (" + solved.reason + ")"}`);
  console.log(`최저단가(P-IRR6%·이익100억): ${floor.ok ? floor.price.toFixed(2) + "원/kWh (" + floor.binding + " 기준)" : "N/A"}`);
  console.log(`KCH 생애주기 누적 총 수취액: ${kch.ok ? kch.lifetimeTotal.toFixed(2) + "억원 (" + (kch.directMode ? "총액 직접입력" : "목표 IRR 역산, 가격배율 " + kch.sf.toFixed(4) + "배") + ")" : "N/A (" + kch.reason + ")"}`);
  console.log(`KCH 수수료 원/kWh 환산분: +${kchIncrementPerKWh.toFixed(2)}원/kWh → 6.5 입찰가격 ${Number.isFinite(bidPrice65) ? bidPrice65.toFixed(2) + "원/kWh" : "N/A"}${ps.ok ? ", 가격평가점수 " + ps.score.toFixed(2) + "점" : ""}`);
} else {
  console.log(`실패: ${outcome.reason}`);
  process.exitCode = 1;
}
