// ESS 적정 입찰단가 프로토타입 — 엑셀 회신(.xlsx) 생성기. 설계 기준: excel-export-spec.md
//
// 아티팩트(claude.ai/code/artifact/fea66d24-...)의 downloads 캡ability는 xlsx 저장을 막고 있어(플랫폼 하드 제한:
// gif png jpg jpeg webp mp4 webm txt json md docx pptx epub csv ttf html svg pdf 만 허용), 화면에서 받은 시나리오 .json을
// 이 스크립트로 .xlsx로 바꾼다. 계산 엔진은 아티팩트 <script>의 순수 함수를 그대로 복사했으므로 수치는 화면과 같다.
//
// 구조(spec 3장 3계층):
//   · 계층 1·2 — ess-xlsx-lite.mjs : ZIP·OOXML 직접 작성, 의존성 0 (예전 ExcelJS 불필요)
//   · 계층 3   — 이 파일 후반부     : computeScenario()가 계산하고, buildExportSheets()는 옮기기만 한다(순수 함수)
//
// 사용법:
//   node ess-bidprice-xlsx.mjs [시나리오1.json 시나리오2.json …] [출력.xlsx] [--out-dir=폴더] [--no-open]
//   - JSON 없음 → 아티팩트 기본값(96MW/576MWh 기본안). 2개 이상 → '시나리오 비교' 시트 추가(첫 파일이 본 시나리오).
//   - 출력 생략 → 첫 JSON과 같은 폴더에 ESS_적정입찰단가_모델_<사업명>_<YYYYMMDD>.xlsx (.gitignore 접두어와 일치)
//   - 저장 후 Excel로 연다(--no-open 또는 환경변수 ESS_NO_OPEN 이 있으면 열지 않음).
//   ESS_엑셀변환.bat 에 JSON을 끌어다 놓아도 된다(여러 개 가능).

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { buildXlsx, colName, COLORS } from "./ess-xlsx-lite.mjs";

const HUNDRED_MILLION = 100_000_000;

// ---------- CAPEX / OPEX 항목 기본값 (아티팩트와 동일) ----------
// group: construction = ① 공사비(EPC) · soft = ② 개발·간접비 · ancillary = ③ 부대비용(보험·기타) — 아티팩트와 같은 순서(인덱스 = JSON 순서)
const CAPEX_ITEMS = [
  { id: "battery", label: "배터리·랙·컨테이너", value: 650, category: "기자재", group: "construction" },
  { id: "pcs", label: "PCS", value: 120, category: "기자재", group: "construction" },
  { id: "ems", label: "EMS·SCADA", value: 25, category: "시공-전기", group: "construction" },
  { id: "electrical", label: "변압기·전기공사", value: 60, category: "시공-전기", group: "construction" },
  { id: "civil", label: "토목·건축", value: 35, category: "시공-토목", group: "construction" },
  { id: "fire", label: "소방·안전설비", value: 20, category: "시공-운송·설치", group: "construction" },
  { id: "grid", label: "계통접속", value: 50, category: "시공-선로·계통", group: "construction" },
  { id: "development", label: "인허가·개발비", value: 15, category: "간접비", group: "soft" },
  { id: "design", label: "설계비", value: 8, category: "간접비", group: "soft" },
  { id: "supervision", label: "감리비", value: 6, category: "간접비", group: "soft" },
  { id: "community", label: "민원·주민수용성", value: 5, category: "간접비", group: "soft" },
  { id: "insurance", label: "건설보험·보증", value: 6, category: "부대비용", group: "ancillary" },
  { id: "land", label: "부지·임차권", value: 5, category: "토지", group: "soft" },
  { id: "otherAncillary", label: "기타 부대비용 (취득세·PM·법인설립 등)", value: 0, category: "부대비용", group: "ancillary" },
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
  capexInputMode: "itemized", capexLumpSum: "960",
  variableOMPerMWh: "2500", powerTradingFeePerKWh: "0.1193", insurancePct: "0.45", communityRevenuePct: "0.5",
  opexEscalationPct: "2", ltsaStepAfterYear: "3", ltsaStepMultiplierPct: "190",
  equityPct: "30", residentBondPct: "5", seniorRatePct: "5.2", seniorTermYears: "10", seniorGraceYears: "1",
  fundingMode: "ratio", equityAmount: "339", bondAmount: "56.5",
  seniorFixedSharePct: "100", seniorSpreadPct: "2.4", cdBaseRatePct: "2.8", rateResetMonths: "3",
  bondRatePct: "7", bondTermYears: "7", financeFeePct: "1.5", constructionRatePct: "5.5", dsraMonths: "6",
  kchSharePct: "20",
  solveMode: "companyProfit", companyProfitKind: "companyProfitPreTax", targetCompanyProfit: "100",
  irrKind: "projectIrr", targetIrrPct: "8",
};
const DEFAULT_OP_RATES = Array.from({ length: 15 }, (_, i) => (i === 0 ? 95 : i === 1 ? 96 : 97));

// KCH 개발수수료 절(6.4)·가격환산계산기(6.5) 기본값 — 아티팩트 HTML의 초기값과 동일.
// 아티팩트의 시나리오 JSON(inputs.fields)에는 kch*·minPrice·priceCap 값도 그대로 들어오므로 있으면 그것을 우선 사용한다.
const DEFAULT_KCH_FIELDS = {
  // 설비용량·저장용량은 계약용량 연동이라 입력값이 없다(예전 JSON의 kchCapacityMW·kchStorageMWh는 무시)
  kchStartYear: "2026", kchDevYears: "1", kchConYears: "1", kchOpYears: "15",
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

// 자금조달 — 비율 모드: 총사업비 × 비율 / 금액 모드: 자기자본·주민채권 억원 고정. 선순위 = 나머지(아티팩트와 동일).
function fundingSplit(model, total) {
  const f = model.finance;
  if (f.fundingMode === "amount") return { equity: Math.max(0, f.equityAmount || 0), bond: Math.max(0, f.bondAmount || 0) };
  return { equity: total * rate(f.equityPct), bond: total * rate(f.residentBondPct) };
}
// 선순위 적용금리 = 고정 비중 × 고정금리 + 변동 비중 × (CD 91일물 + 가산금리) + 민감도 가감.
// 조정주기 k개월 → 그해 CD × (1 − k/24) + 전년 CD × k/24(첫해의 전년 = 기준 CD). 아티팩트와 동일.
function cdRatePctForYear(f, seq) {
  const p = f.cdRatesPct;
  if (!p || !p.length) return f.cdBaseRatePct ?? 0;
  return p[Math.min(Math.max(0, seq - 1), p.length - 1)];
}
export function seniorRateForYear(model, seq) {
  const f = model.finance;
  const w = Math.min(1, Math.max(0, rate(f.seniorFixedSharePct ?? 100)));
  const lag = (f.rateResetMonths || 3) / 24;
  const cdNow = cdRatePctForYear(f, seq), cdPrev = seq > 1 ? cdRatePctForYear(f, seq - 1) : (f.cdBaseRatePct ?? cdNow);
  const floating = cdNow * (1 - lag) + cdPrev * lag + (f.seniorSpreadPct ?? 0);
  return Math.max(0, rate(w * f.seniorRatePct + (1 - w) * floating + (f.rateShiftPct ?? 0)));
}

function initialDSRA(model, seniorPrincipal, bondPrincipal) {
  const seniorRate = seniorRateForYear(model, 1); // 첫 운영연도 적용금리 — 원금 상환 일정(원리금균등)은 이 금리로 고정
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
  // 자기자본·주민채권은 fundingSplit()(비율 또는 금액 모드), 선순위는 나머지
  let financeFee = 0, dsra = 0, idcDraws = cal.rows.map(() => 0), converged = false;
  for (let iter = 0; iter < 200; iter++) {
    const draws = nominal.draws.map((v, i) => v + contDraws[i] + idcDraws[i]);
    draws[firstConIdx] += financeFee; draws[lastConIdx] += dsra;
    const total = sum(draws);
    const { equity, bond } = fundingSplit(model, total), senior = total - equity - bond;
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
  const { equity: equityPrincipal, bond: bondPrincipal } = fundingSplit(model, total), seniorPrincipal = total - equityPrincipal - bondPrincipal;
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
  const seniorRate = seniorRateForYear(model, 1); // 첫 운영연도 적용금리 — 원금 상환 일정(원리금균등)은 이 금리로 고정
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
      seniorInterest = seniorBalance * seniorRateForYear(model, serviceYear) * row.operationFraction; // 이자는 그해 적용금리
      if (serviceYear > model.finance.seniorGraceYears && serviceYear <= model.finance.seniorTermYears) {
        const service = seniorPayment * row.operationFraction;
        // 원금은 첫해 금리 기준 원리금균등 일정 그대로 — 변동금리는 이자만 바꾼다
        seniorPrincipal = Math.min(seniorBalance, Math.max(0, service - seniorBalance * seniorRate * row.operationFraction));
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
      seniorRateApplied: row.operationSequence > 0 ? seniorRateForYear(model, row.operationSequence) : null,
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
  // 설비용량·저장용량 = 계약용량 연동(아티팩트 kchReadModel과 동일, 저장용량 = 계약용량 × 6h)
  const capacityMW = Math.max(0, num(f, "contractCapacityMW", 96)), storageMWh = capacityMW * 6;
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
// 설비용량 축 — 60~110MW 눈금에 현재 용량(계약용량)을 끼워 넣는다(아티팩트 kchRenderSensitivity와 동일)
const kchSensCapacities = (cap) => [...new Set([60, 70, 80, 90, 100, 110, ...(cap > 0 ? [cap] : [])])].sort((a, b) => a - b);
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
    cells: kchSensCapacities(m.capacityMW).map((cap) => {
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

// KCH 합산 수익률 — 수수료 순현금(4종 − KCH 비용) + 당사(KCH) 지분의 SPC 현금흐름(출자·배당·최종회수, 배당세전).
// 수수료만으로 IRR을 내면 지분 출자(현금유출)가 빠져 50%대로 과대하게 나와 합쳐서 계산한다(아티팩트 renderKchReturns와 동일).
// 두 흐름의 시작연도는 서로 다른 입력일 수 있어 달력 연도로 맞춰 더하고 빈 연도는 0으로 채운다.
function kchCombinedFlows(feeRows, detail) {
  const byYear = new Map();
  const add = (y, v) => byYear.set(y, (byYear.get(y) || 0) + v);
  feeRows.forEach((r) => { if (r.phase !== "-") add(r.year, r.net); });
  (detail || []).forEach((d) => add(d.calendarYear, d.companyEquityFlow));
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const out = [];
  for (let y = years[0]; y <= years[years.length - 1]; y++) out.push(byYear.get(y) || 0);
  return out;
}
function kchReturns(kch, detail) {
  if (!kch.ok || !detail) return null;
  const flows = kchCombinedFlows(kch.rows, detail);
  const caps = kchSensCapacities(kch.m.capacityMW);
  return {
    irr: irr(flows), npv: npv(kch.m.wacc, flows),
    feeSum: sum(kch.rows.filter((r) => r.phase !== "-").map((r) => r.net)), equitySum: sum(detail.map((d) => d.companyEquityFlow)),
    // 민감도 — 가격배율·설비용량은 수수료에만 적용, 당사 지분 현금흐름은 현재 사업 기준 고정
    sensitivity: KCH_SENS_MULTIPLIERS.map((mult) => ({
      mult,
      cells: caps.map((cap) => ({ cap, irr: irr(kchCombinedFlows(kchBuildCashflow(kch.m, mult, kch.m.capacityMW > 0 ? cap / kch.m.capacityMW : 1), detail)) })),
    })),
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
  // 연차별 CD금리 전망(시나리오 JSON의 cdRates) — 없으면(예전 JSON) 빈 배열 → 기준 CD금리로 평탄
  const cdRatesPct = (inputs?.cdRates ?? []).map((v) => +v || 0);

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

  // ① 공사비만 EPC 총액으로 대체 — ② 개발·간접비·③ 부대비용 항목은 입력 방식과 무관하게 더한다(아티팩트 readModel과 동일)
  const capexItemAt = (it, i) => ({ ...it, value: +capexItemsRaw[i] || 0 });
  const capexItems = fields.capexInputMode === "lumpsum"
    ? [{ id: "epcLumpSum", label: "EPC 총액(수기입력)", value: num(fields, "capexLumpSum"), category: "기자재", group: "construction" },
      ...CAPEX_ITEMS.map(capexItemAt).filter((it) => it.group !== "construction")]
    : CAPEX_ITEMS.map(capexItemAt);
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
    finance: { equityPct: num(fields, "equityPct"), residentBondPct: num(fields, "residentBondPct"), seniorRatePct: num(fields, "seniorRatePct"), seniorTermYears: num(fields, "seniorTermYears"), seniorGraceYears: num(fields, "seniorGraceYears"), bondRatePct: num(fields, "bondRatePct"), bondTermYears: num(fields, "bondTermYears"), financeFeePct: num(fields, "financeFeePct"), constructionRatePct: num(fields, "constructionRatePct"), dsraMonths: num(fields, "dsraMonths"), kchSharePct: num(fields, "kchSharePct"),
      fundingMode: fields.fundingMode || "ratio", equityAmount: num(fields, "equityAmount"), bondAmount: num(fields, "bondAmount"),
      seniorFixedSharePct: num(fields, "seniorFixedSharePct", 100), seniorSpreadPct: num(fields, "seniorSpreadPct", 2.4), cdBaseRatePct: num(fields, "cdBaseRatePct", 2.8),
      rateResetMonths: num(fields, "rateResetMonths", 3), cdRatesPct },
    assumptions: { ...ASSUMPTIONS, taxBrackets: TAX_BRACKETS },
  };
  return { model, fields, developmentYears, calendarMismatch, capacityOverInstalled, capexItems, opexItems, operatingRatesPct };
}

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
  // 기준 금리 = 첫해 적용금리(고정·변동 혼합), ±Δ는 적용금리 전체 평행 이동(아티팩트와 동일)
  const baseRate = seniorRateForYear(baseModel, 1) * 100, baseOpex = baseModel.opex.escalationPct;
  // EPC 총액 = ① 공사비 항목 합계 — ②·③ 항목은 그대로(아티팩트 computeSensitivity와 동일)
  const isEpc = (it) => it.group === "construction";
  const baseEpc = sum(baseModel.capex.items.filter(isEpc).map((it) => it.value));
  const withRate = (rd) => ({ ...baseModel, finance: { ...baseModel.finance, rateShiftPct: rd } });
  const macro = SENS_RATE_DELTAS.map((rd) => SENS_OPEX_DELTAS.map((od) => {
    const m = withRate(rd);
    m.opex = { ...baseModel.opex, escalationPct: Math.max(0, baseOpex + od) };
    return sensPick(analyzeEss(m));
  }));
  const epc = SENS_RATE_DELTAS.map((rd) => SENS_EPC_DELTAS.map((ed) => {
    const m = withRate(rd);
    m.capex = { ...baseModel.capex, items: baseModel.capex.items.map((it) => (isEpc(it) ? { ...it, value: it.value * (1 + ed / 100) } : it)) };
    return sensPick(analyzeEss(m));
  }));
  return { bidPrice: baseModel.revenue.bidPricePerKWh, baseRate, baseOpex, baseEpc, macro, epc };
}

// 총사업비 구성 — 아티팩트 capexComposition()과 같은 분해(새 계산이 아니라 funding 결과를 ①②③으로 나눈 것).
export function capexComposition(items, inv) {
  const base = sum(items.map((i) => i.value));
  const k = base !== 0 ? inv.nominalDirectCapex / base : 1;
  const by = (pred) => sum(items.filter(pred).map((i) => i.value)) * k;
  const construction = by((i) => i.group === "construction"), soft = by((i) => i.group === "soft");
  const insurance = by((i) => i.id === "insurance"), other = by((i) => i.group === "ancillary" && i.id !== "insurance");
  return {
    construction, soft, insurance, other,
    contingency: inv.contingency, financeFee: inv.financeFee, idc: inv.constructionInterest, dsra: inv.dsra,
    ancillary: inv.totalInvestment - construction - soft, total: inv.totalInvestment,
  };
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
  if (fields.fundingMode === "amount") {
    const inv = solveInvestment(built.model, buildCalendar(built.model.project));
    if (inv.seniorPrincipal < 0) w.push(`자기자본(${inv.equityPrincipal.toFixed(1)}억)+주민참여채권(${inv.bondPrincipal.toFixed(1)}억)이 총사업비(${inv.totalInvestment.toFixed(1)}억)를 넘습니다 — 선순위 대출이 음수가 됩니다.`);
  } else if (num(fields, "equityPct") + num(fields, "residentBondPct") > 100) w.push("자기자본 비율+주민참여채권 비율이 100%를 초과합니다 — 선순위 대출이 음수가 됩니다.");
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
  const kchRet = kchReturns(kch, solved.ok ? solved.result.detail : null);
  const c = { label: meta.label || "기본값 (96MW 기본안)", savedAt: meta.savedAt || null, built, fields, solved, floor, kch, link, ps, sens, kchRet, inputsRaw: inputs ?? {} };
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
const CAPEX_MODE_LABEL = { itemized: "항목별 입력 (7개)", lumpsum: "EPC 총액 직접 입력" };
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
    section("입찰단가 산정 결과", W), // 섹션 이름을 KPI 행("적정 입찰단가")과 다르게 — 라벨로 행을 찾을 때 헷갈리지 않게
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
      kv("총사업비 (총투자비)", n1(fu.totalInvestment), "억원", "① 공사비 + ② 개발·간접비 + ③ 부대비용", labB),
      ...(() => {
        const cc = capexComposition(c.built.model.capex.items, fu), share = (v) => (cc.total > 0 ? `총사업비의 ${(v / cc.total * 100).toFixed(1)}%` : "");
        return [
          kv("① 공사비 (EPC)", n1(cc.construction), "억원", `물가상승 반영 명목 · ${share(cc.construction)} · 감가상각 대상`, labIn),
          kv("② 개발·간접비", n1(cc.soft), "억원", `인허가·설계·감리·민원·부지 · ${share(cc.soft)}`, labIn),
          kv("③ 부대비용", n1(cc.ancillary), "억원", `공사비 외 비용 · ${share(cc.ancillary)}`, labIn),
          kv("　건설보험·보증", n1(cc.insurance), "억원", "감가상각 대상", labIn),
          ...(Math.abs(cc.other) > 1e-9 ? [kv("　기타 부대비용", n1(cc.other), "억원", "감가상각 대상", labIn)] : []),
          kv("　예비비", n1(cc.contingency), "억원", `입력 항목 합계의 ${num(f, "contingencyPct")}% · 감가상각 대상`, labIn),
          kv("　금융수수료", n1(cc.financeFee), "억원", `타인자본의 ${num(f, "financeFeePct")}%`, labIn),
          kv("　건설기간 이자 (IDC)", n1(cc.idc), "억원", `건설기간 금리 ${num(f, "constructionRatePct")}%`, labIn),
          kv("　DSRA", n1(cc.dsra), "억원", `원리금 ${num(f, "dsraMonths")}개월분 · 사업 종료 시 회수`, labIn),
        ];
      })(),
      kv("자금조달 합계", n1(fu.equityPrincipal + fu.seniorPrincipal + fu.bondPrincipal), "억원", "", labB),
      kv("자기자본", n1(fu.equityPrincipal), "억원", `총사업비의 ${(fu.equityPrincipal / fu.totalInvestment * 100).toFixed(1)}%${f.fundingMode === "amount" ? " · 금액 직접 입력" : ""}`, labIn),
      kv("선순위대출", n1(fu.seniorPrincipal), "억원", `총사업비의 ${(fu.seniorPrincipal / fu.totalInvestment * 100).toFixed(1)}% · 첫해 적용금리 ${(seniorRateForYear(c.built.model, 1) * 100).toFixed(2)}% (고정 ${Math.min(100, Math.max(0, num(f, "seniorFixedSharePct", 100)))}%)`, labIn),
      kv("주민참여채권", n1(fu.bondPrincipal), "억원", `총사업비의 ${(fu.bondPrincipal / fu.totalInvestment * 100).toFixed(1)}%`, labIn),
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
  return { name: "요약", rows, colWidths: [34, 26, 9, 58], merges: ["A1:D1", "A2:D2"], freeze: { row: 2 }, tabColor: TAB.요약, fit: "width" };
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
  // D. CAPEX — 화면과 같은 ① 공사비 / ② 개발·간접비 / ③ 부대비용 구성. 표의 값은 "계산에 쓰인 값" 기준이고,
  // EPC 총액 모드에서 대체된 ① 항목은 전환 당시 값으로 보여 주되 소계에서 뺀다.
  const lump = f.capexInputMode === "lumpsum";
  const usedById = Object.fromEntries(b.capexItems.map((it) => [it.id, it.value]));
  const rawCapex = c.inputsRaw?.capexItems ?? [];
  const capexRows = CAPEX_ITEMS.map((it, i) => (it.id in usedById
    ? { it, v: usedById[it.id], used: true }
    : { it, v: +(rawCapex[i] ?? it.value) || 0, used: false }));
  const groupTable = (group, head) => {
    const list = capexRows.filter((x) => x.it.group === group);
    rows.push(blank(), headerRow([head, "금액 (억원)", "분류", "비고"]));
    list.forEach((x) => rows.push([lab(x.it.label), n2(x.v), ctr(x.it.category || ""), rem(x.used ? "" : "EPC 총액 모드 — 계산에 쓰이지 않음")]));
    rows.push([cell("소계 (계산 반영)", "TOTAL_LABEL"), cell(fin(sum(list.filter((x) => x.used).map((x) => x.v)), 2), "TOTAL_NUM2"), cell(null, "TOTAL_LABEL"), rem("")]);
  };
  rows.push(blank(), section("D. CAPEX (총사업비 = ① 공사비 + ② 개발·간접비 + ③ 부대비용)", W),
    kv("건설비 물가상승률", pctIn(num(f, "constructionInflationPct")), "/년"),
    kv("개발기간 집행 비중", pctIn(num(f, "developmentSharePct"))),
    kv("공사비 입력 방식", txt(label(CAPEX_MODE_LABEL, f.capexInputMode || "itemized"))));
  if (lump) rows.push(kv("EPC 총액 (수기 입력)", n1(num(f, "capexLumpSum")), "억원", "① 공사비를 이 값 하나로 대체 — ②·③ 항목은 그대로 더한다"));
  groupTable("construction", "① 공사비 (EPC)");
  groupTable("soft", "② 개발·간접비");
  groupTable("ancillary", "③ 부대비용 — 항목");
  rows.push(blank(), headerRow(["③ 부대비용 — 비율·계산", "값", "단위", "비고"]),
    kv("예비비", pctIn(num(f, "contingencyPct")), "", "입력 항목(①+②+③ 항목) 합계 대비"),
    kv("금융수수료 (주선·약정 등)", pctIn(num(f, "financeFeePct")), "", "타인자본(선순위+주민채권) 대비 — 조달액에 따라 반복 수렴"),
    kv("건설기간 적용금리 (건설이자)", pctIn(num(f, "constructionRatePct")), "", "건설기간 이자(IDC) 계산용"),
    kv("DSRA (원리금 적립)", int(num(f, "dsraMonths")), "개월", "사업 종료 시 회수"));
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
    kv("자금조달 입력 방식", txt(f.fundingMode === "amount" ? "금액 (억원) 직접 입력" : "비율 (%) — 총사업비 대비")),
    ...(f.fundingMode === "amount"
      ? [kv("자기자본 금액", n1(num(f, "equityAmount")), "억원"), kv("주민참여채권 금액", n1(num(f, "bondAmount")), "억원", "선순위 = 총사업비 − 자기자본 − 주민채권")]
      : [kv("자기자본 비율", pctIn(num(f, "equityPct")), "", "총사업비 대비"), kv("주민참여채권 비율", pctIn(num(f, "residentBondPct")), "", "총사업비 대비 · 선순위 = 나머지")]),
    kv("선순위 고정금리 비중", pctIn(num(f, "seniorFixedSharePct", 100)), "", "나머지는 변동금리(CD 91일물 + 가산금리)"),
    kv("선순위 고정금리", pctIn(num(f, "seniorRatePct"))),
    kv("기준 CD금리 (91일물)", pctIn(num(f, "cdBaseRatePct", 2.8)), "", "약정 시점 금리 — 직접 입력(기본 2.80%는 예시)"),
    kv("변동 가산금리", pctIn(num(f, "seniorSpreadPct", 2.4)), "", "%p"),
    kv("변동금리 조정주기", int(num(f, "rateResetMonths", 3)), "개월", "조정주기 절반만큼 늦게 반영(연 단위 근사)"),
    kv("선순위 상환기간", int(num(f, "seniorTermYears")), "년", "원리금균등"),
    kv("원금 거치기간", int(num(f, "seniorGraceYears")), "년"),
    kv("주민참여채권 금리", pctIn(num(f, "bondRatePct"))),
    kv("주민참여채권 만기", int(num(f, "bondTermYears")), "년", "만기 일시상환"),
    kv("당사(KCH) 지분율", pctIn(num(f, "kchSharePct")), "", "보통주 — 당사 손익 금액에만 곱함"),
    blank(), headerRow(["선순위 금리 (운영연차)", "CD금리 전망", "적용금리", "비고"]),
    ...Array.from({ length: Math.max(1, Math.round(num(f, "seniorTermYears")) || 1) }, (_, i) => [ctr(`${i + 1}년차`), pctIn(cdRatePctForYear(b.model.finance, i + 1)),
      pc(seniorRateForYear(b.model, i + 1)), rem(i === 0 ? "적용금리 = 고정 비중 × 고정금리 + 변동 비중 × (CD + 가산금리) · 원금 일정은 첫해 금리 기준" : "")]),
    blank(), headerRow(["세무 · 배당 프리셋 (읽기 전용)", "값", "단위", "비고"]),
    kv("WACC · 할인율", pctIn(ASSUMPTIONS.waccPct)),
    kv("정액 감가상각 기간", int(ASSUMPTIONS.depreciationYears), "년", "①·②·③ 입력 항목 + 예비비 대상(금융수수료·건설이자·DSRA 제외)"),
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
  return { name: "입력값", rows, colWidths: [34, 24, 15, 44], merges: ["A1:D1", "A2:D2"], freeze: { row: 2 }, tabColor: TAB.입력값, fit: "width" };
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
    ["선순위 첫해 적용금리", (c) => pc(seniorRateForYear(c.built.model, 1))],
    ["선순위 고정금리 비중", (c) => pctIn(num(c.fields, "seniorFixedSharePct", 100))],
    ["자기자본 (총사업비 대비)", (c) => pc(c.solved.ok ? c.solved.result.funding.equityPrincipal / c.solved.result.funding.totalInvestment : null)],
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
  return { name: "시나리오 비교", rows, colWidths: [30, ...cs.map(() => 24), 34], merges: [`A1:${last}1`, `A2:${last}2`], freeze: { row: 4, col: 1 }, tabColor: TAB.시나리오, fit: "width" };
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
  const k = c.kch, km = k.m, W = 12, kr = c.kchRet;
  const eqByYear = new Map((c.solved.ok ? c.solved.result.detail : []).map((d) => [d.calendarYear, d.companyEquityFlow]));
  const rows = [
    [title("KCH 개발수수료 — 생애주기 누적 수취액")],
    [sub("SPC가 KCH(개발자)에게 지급하는 4개 수수료 · ESS 발전매출과 별개 · 입찰가격에는 원/kWh로 환산해 더한다('가격환산' 시트)")],
    blank(),
    section("산정 방식 · 사업 기본정보", W),
    kv("산정 방식", txt(k.directMode ? "총액 직접 입력 (권장)" : "목표 IRR 역산 (레거시)")),
    kv("설비용량", n1(km.capacityMW), "MW", "C. 발전매출의 계약용량과 연동", labIn),
    kv("저장용량", n1(km.storageMWh), "MWh", "계약용량 × 6h", labIn),
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
    return { name: "KCH 개발수수료", rows, colWidths: [34, 14, 10, 12, 12, 12, 12, 12, 12, 12, 13, 13], merges: ["A1:L1", "A2:L2"], freeze: { row: 2 }, tabColor: TAB.KCH, fit: "width" };
  }
  if (!k.directMode) rows.push(kv("공통 가격배율 (자동 역산)", n4(k.sf), "배"));
  rows.push(
    [cell("KCH 합산 IRR", "KPI_LABEL"), cell(kr ? fin(kr.irr, 6) : null, "KPI_PCT"), ctr(""),
      rem(kr ? `수수료 순현금 ${kr.feeSum.toFixed(1)}억 + 당사 지분(${num(c.fields, "kchSharePct")}%) 출자·배당·최종회수 ${kr.equitySum.toFixed(1)}억 — 수수료만으로 계산하면 ${pct2(k.achievedIrr)}`
        : `적정 입찰단가 산정 실패로 지분 현금흐름 없음 — 수수료만으로 계산하면 ${pct2(k.achievedIrr)}`)],
    kv("KCH 합산 NPV", sgn(kr ? kr.npv : null), "억원", `같은 합산 현금흐름 · 할인율 ${pct2(km.wacc)}`),
    kv("총수익 (운영기간 합계)", n2(k.totalRevenue), "억원"),
    kv("KCH 총비용", n2(k.totalCost), "억원"),
    [cell("생애주기 누적 총 수취액", "KPI_LABEL"), cell(fin(k.lifetimeTotal, 2), "KPI_NUM2"), ctr("억원"), rem("4개 수익원 합산(운영기간·상승률 반영)")],
    blank(), section("실제 적용 금액", W),
    kv("① 부지 임대료", n2(k.out.lease), "억원/년"),
    kv("② 사전개발비", n2(k.out.devFee), "억원"),
    kv("③ 공동접속료", n2(k.out.conn), "억원"),
    kv("④ 운영수익", n2(k.out.om), "억원/년"),
    blank(), section("연차별 현금흐름 (억원) — ①~④ 수익원 − KCH 비용 = 수수료 순현금, + 당사 지분 CF = KCH 합산 CF", W),
    headerRow(["연차 (n)", "연도", "단계", "① 부지임대료", "② 사전개발비", "③ 공동접속료", "④ 운영수익", "수익 합계", "KCH 비용", "수수료\n순현금", "당사 지분 CF\n(배당세전)", "KCH 합산 CF"]));
  const flows = k.rows.filter((x) => x.phase !== "-");
  const eqOf = (x) => (c.solved.ok ? eqByYear.get(x.year) ?? 0 : null);
  for (const x of flows) {
    const eq = eqOf(x);
    rows.push([int(x.n), yr(x.year), ctr(x.phase), n2(x.lease), n2(x.devFee), n2(x.conn), n2(x.om), n2(x.revenue), n2(x.cost),
      cell(fin(x.net, 2), "SIGNED2"), cell(fin(eq, 2), "SIGNED2"), cell(eq == null ? null : fin(x.net + eq, 2), "SIGNED2")]);
  }
  const tot = (key) => cell(fin(sum(flows.map((x) => x[key])), 2), "TOTAL_NUM2");
  const eqTot = c.solved.ok ? sum(flows.map((x) => eqOf(x))) : null;
  rows.push([cell("합계", "TOTAL_LABEL"), cell(null, "TOTAL_LABEL"), cell(null, "TOTAL_LABEL"), tot("lease"), tot("devFee"), tot("conn"), tot("om"), tot("revenue"), tot("cost"), tot("net"),
    cell(fin(eqTot, 2), "TOTAL_NUM2"), cell(eqTot == null ? null : fin(sum(flows.map((x) => x.net)) + eqTot, 2), "TOTAL_NUM2")]);
  rows.push(blank(), section(`민감도 — 가격배율 × 설비용량 → ${kr ? "KCH 합산 IRR" : "수수료만 IRR"} (목표 ${pct2(km.targetIrr)} 대비 색)`, W),
    headerRow(["가격배율 ＼ 설비용량", ...kchSensCapacities(km.capacityMW).map((cp) => `${cp} MW${cp === km.capacityMW ? " (현재)" : ""}`)]));
  for (const srow of (kr ? kr.sensitivity : k.sensitivity)) {
    rows.push([cell(`${srow.mult.toFixed(1)}배${srow.mult === 1 ? " (입력 총액)" : ""}`, "AXIS_LABEL"), ...srow.cells.map((cc) => {
      if (srow.mult === 1 && cc.cap === km.capacityMW) return cell(fin(cc.irr, 6), "TOTAL_PCT");
      const lvl = heatLevel(cc.irr, km.targetIrr);
      return cell(fin(cc.irr, 6), lvl === 3 ? "PCT" : `PCT_H${lvl}`);
    })]);
  }
  rows.push(blank(), [note("민감도표는 4개 수익원 총액에만 가격배율·설비용량 비율을 적용했습니다(KCH 비용·당사 지분 현금흐름은 현재 사업 기준 고정). 굵은 회색 칸이 현재 가정입니다.")]);
  return { name: "KCH 개발수수료", rows, colWidths: [34, 12, 10, 12, 12, 12, 12, 12, 12, 12, 13, 13], merges: ["A1:L1", "A2:L2"], freeze: { row: 2 }, tabColor: TAB.KCH, fit: "width" };
}

// 부록 공통 — 연도별 표. cols: { h, v(row, i), s, t } — t 가 있으면 합계 대상(스타일 이름)
function yearlyTable(name, titleText, subText, d, cols, extraNotes = [], opts = {}) {
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
  // fit=width(15칼럼 안팎)는 폭 1쪽에 맞춘다. 43칼럼 부록3은 자연 분할 + 연도·단계 열과 머리 행을 매 쪽 반복.
  return { name, rows, colWidths: cols.map((c) => c.w || 12.5), merges: [`A1:${last}1`, `A2:${last}2`], freeze: { row: 3, col: 2 }, tabColor: TAB.부록,
    fit: opts.fit, printTitles: opts.printTitles ?? { cols: "A:B", rows: "1:3" } };
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
    { h: "이자비용\n(선순위+채권)", v: (x) => x.seniorInterest + x.bondInterest, s: "NUM3", t: "TOTAL_NUM3", w: 14 },
    { h: "EBT\n(세전이익)", v: (x) => x.ebitda - x.depreciation - x.seniorInterest - x.bondInterest, s: "SIGNED3", t: "TOTAL_SIGNED3" },
    { h: "과세표준\n(NOL 반영 후)", v: (x) => x.taxableIncome, s: "NUM3", t: "TOTAL_NUM3", w: 14 },
    { h: "법인세", v: (x) => x.corporateTax, s: "NUM3", t: "TOTAL_NUM3" },
    { h: "당기순이익", v: (x) => x.ebitda - x.depreciation - x.seniorInterest - x.bondInterest - x.corporateTax, s: "SIGNED3", t: "TOTAL_SIGNED3" },
    { h: "누적\n감가상각", v: (_, i) => accDep[i], s: "NUM3" },
    { h: "PP&E\n순장부가액", v: (_, i) => ppe - accDep[i], s: "NUM3" },
  ];
  return yearlyTable("부록1 손익계산서", "부록1 — 손익계산서 (검산용)",
    `금액 단위 억원(소수 3자리) · 연도별 현금흐름과 같은 원천값을 손익계산서 순서로 재배열 · 감가상각 대상 원가(직접공사비+예비비) ${ppe.toFixed(1)}억원`,
    r.detail, cols, ["EBT는 부록3의 '과세표준 (NOL 반영 전)'과 항상 같아야 합니다(대사용). 누적 감가상각·순장부가액은 잔액이라 합계를 비웁니다."], { fit: "width", printTitles: { rows: "1:3" } });
}

function debtSheet(c) {
  const r = c.solved.result, fu = r.funding;
  let so = fu.seniorPrincipal, bo = fu.bondPrincipal;
  const opens = r.detail.map((x) => { const o = { s: so, b: bo }; so = x.seniorBalanceEnd; bo = x.bondBalanceEnd; return o; });
  const cols = [
    { h: "연도", v: (x) => x.calendarYear, s: "YEAR", w: 8 },
    { h: "단계", v: (x) => x.phase, s: "CENTER", w: 11 },
    { h: "선순위\n적용금리", v: (x) => x.seniorRateApplied, s: "PCT", w: 10 },
    { h: "선순위\n기초잔액", v: (_, i) => opens[i].s, s: "NUM3" },
    { h: "선순위\n이자", v: (x) => x.seniorInterest, s: "NUM3", t: "TOTAL_NUM3" },
    { h: "선순위 원금\n(만기일시 포함)", v: (x) => x.seniorPrincipal, s: "NUM3", t: "TOTAL_NUM3", w: 15 },
    { h: "선순위\n기말잔액", v: (x) => x.seniorBalanceEnd, s: "NUM3" },
    { h: "채권\n기초잔액", v: (_, i) => opens[i].b, s: "NUM3" },
    { h: "채권\n이자", v: (x) => x.bondInterest, s: "NUM3", t: "TOTAL_NUM3" },
    { h: "채권 원금\n(만기일시 포함)", v: (x) => x.bondPrincipal, s: "NUM3", t: "TOTAL_NUM3", w: 15 },
    { h: "채권\n기말잔액", v: (x) => x.bondBalanceEnd, s: "NUM3" },
    { h: "원리금\n상환 합계", v: (x) => x.debtService, s: "NUM3", t: "TOTAL_NUM3" },
    { h: "DSCR\n(연간)", v: (x) => x.dscr, s: "DEC3", w: 9 },
    { h: `연간 게이트\n(${ASSUMPTIONS.annualDscrThreshold}배)`, v: (x) => gateText(x.annualDscrGatePass), gate: true, w: 15 },
    { h: "DSCR\n(누적)", v: (x) => x.cumDscr, s: "DEC3", w: 9 },
    { h: `누적 게이트\n(${ASSUMPTIONS.cumulativeDscrThreshold}배)`, v: (x) => gateText(x.cumDscrGatePass), gate: true, w: 15 },
  ];
  return yearlyTable("부록2 부채상환", "부록2 — 부채상환 스케줄 (검산용)",
    `금액 단위 억원(소수 3자리) · 선순위 ${fu.seniorPrincipal.toFixed(1)}억원 원리금균등 · 주민참여채권 ${fu.bondPrincipal.toFixed(1)}억원 만기 일시상환 · 기초잔액 = 직전 연도 기말잔액`,
    r.detail, cols, ["게이트가 N이면 그 해 배당을 하지 않고 전액 사내유보합니다(빨간 칸). 잔액·DSCR은 합계를 비웁니다."], { fit: "width", printTitles: { rows: "1:3" } });
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
    { h: "연간\n게이트", v: (x) => gateText(x.annualDscrGatePass), gate: true, w: 15 },
    { h: "DSCR\n(누적)", v: (x) => x.cumDscr, s: "DEC3", w: 9 },
    { h: "누적\n게이트", v: (x) => gateText(x.cumDscrGatePass), gate: true, w: 15 },
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
    r.detail, cols, ["잔액·재원 상한·배당가능 현금은 합계를 비웁니다(더하면 의미가 없는 값). 연간 모델입니다 — 분기·월 단위는 담지 않습니다."],
    { printTitles: { cols: "A:B", rows: "3:3" } }); // 제목 행은 첫 쪽에만(반복하면 쪽 경계에서 잘려 보인다)
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
  // Windows 금지문자는 지우지 않고 '-'로 바꾼다 — 기본 사업명 "96MW/576MWh"가 "96MW576MWh"(다른 숫자처럼 읽힘)가 되지 않게
  const name = String(projectName || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/^-+|-+$/g, "").trim();
  return `ESS_적정입찰단가_모델${name ? `_${name}` : ""}${count > 1 ? `_시나리오${count}개` : ""}_${ymd(now)}.xlsx`;
}

// ============================================================================
// 진입점 — node ess-bidprice-xlsx.mjs [시나리오1.json 시나리오2.json …] [출력.xlsx] [--out-dir=폴더] [--no-open]
// ============================================================================
// 메모장 등이 붙이는 UTF-8 BOM(U+FEFF) 제거 — 보이지 않는 문자를 소스에 직접 쓰지 않도록 코드값으로 판정
const stripBom = (t) => (t.charCodeAt(0) === 0xfeff ? t.slice(1) : t);
function loadScenarioFile(p) {
  const raw = JSON.parse(stripBom(fs.readFileSync(p, "utf8")));
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
  const cases = jsons.length ? jsons.map(loadScenarioFile) : [{ inputs: {}, label: "기본값 (96MW 기본안)", savedAt: null }];
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
