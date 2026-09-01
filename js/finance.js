import { CAPEX_CATEGORIES } from "./project-data.js";

const HUNDRED_MILLION = 100_000_000;
const MILLISECONDS_PER_DAY = 86_400_000;
const INVESTMENT_TOLERANCE = 1e-9;
const INVESTMENT_MAX_ITERATIONS = 200;
const MIN_CALENDAR_YEAR = 1900;
const MAX_CALENDAR_YEAR = 2200;

function rate(percent) {
  return percent / 100;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function utcDate(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day));
}

function daysBetween(start, endExclusive) {
  return Math.round((endExclusive.getTime() - start.getTime()) / MILLISECONDS_PER_DAY);
}

function overlapDays(startA, endA, startB, endB) {
  const start = Math.max(startA.getTime(), startB.getTime());
  const end = Math.min(endA.getTime(), endB.getTime());
  return end > start ? Math.round((end - start) / MILLISECONDS_PER_DAY) : 0;
}

export function npv(discountRate, cashFlows) {
  return cashFlows.reduce((total, value, year) => total + value / ((1 + discountRate) ** year), 0);
}

export function irr(cashFlows) {
  const hasPositive = cashFlows.some((value) => value > 0);
  const hasNegative = cashFlows.some((value) => value < 0);
  if (!hasPositive || !hasNegative) return Number.NaN;
  let low = -0.9999;
  let high = 1;
  while (npv(high, cashFlows) > 0 && high < 1024) high *= 2;
  if (npv(low, cashFlows) * npv(high, cashFlows) > 0) return Number.NaN;
  for (let index = 0; index < 180; index += 1) {
    const middle = (low + high) / 2;
    if (npv(middle, cashFlows) > 0) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

export function paybackPeriod(cashFlows) {
  let cumulative = cashFlows[0] ?? 0;
  if (cumulative >= 0) return 0;
  for (let year = 1; year < cashFlows.length; year += 1) {
    const prior = cumulative;
    cumulative += cashFlows[year] ?? 0;
    if (cumulative >= 0) {
      const annualFlow = cashFlows[year] ?? 0;
      return annualFlow === 0 ? year : (year - 1) + Math.abs(prior) / annualFlow;
    }
  }
  return Number.NaN;
}

export function levelDebtService(principal, annualRate, periods) {
  if (principal <= 0 || periods <= 0) return 0;
  if (annualRate === 0) return principal / periods;
  return principal * annualRate / (1 - (1 + annualRate) ** -periods);
}

export function progressiveTax(taxableIncome, brackets) {
  if (!(taxableIncome > 0)) return 0;
  let lower = 0;
  let tax = 0;
  for (const bracket of brackets) {
    const upper = bracket.upTo === null ? Number.POSITIVE_INFINITY : bracket.upTo;
    const taxableSlice = Math.max(0, Math.min(taxableIncome, upper) - lower);
    tax += taxableSlice * rate(bracket.ratePct);
    if (taxableIncome <= upper) break;
    lower = upper;
  }
  return tax;
}

function buildCalendar(project) {
  const constructionStartYear = project.startYear + project.developmentYears;
  const codYear = constructionStartYear + project.constructionYears - 1;
  const codDate = utcDate(codYear, project.codMonth - 1, 1);
  const operationEnd = utcDate(codYear + project.operationYears, project.codMonth - 1, 1);
  const lastOperatingDay = new Date(operationEnd.getTime() - MILLISECONDS_PER_DAY);
  const rows = [];
  let operationSequence = 0;

  for (let calendarYear = project.startYear; calendarYear <= lastOperatingDay.getUTCFullYear(); calendarYear += 1) {
    const yearStart = utcDate(calendarYear, 0, 1);
    const yearEnd = utcDate(calendarYear + 1, 0, 1);
    const daysInYear = daysBetween(yearStart, yearEnd);
    const operatingDays = overlapDays(yearStart, yearEnd, codDate, operationEnd);
    const phases = [];
    if (calendarYear < constructionStartYear) phases.push("development");
    if (calendarYear >= constructionStartYear && calendarYear <= codYear) phases.push("construction");
    if (operatingDays > 0) {
      phases.push("operation");
      operationSequence += 1;
    }
    rows.push({
      year: calendarYear,
      calendarYear,
      phase: phases.join("+"),
      daysInYear,
      operatingDays,
      operationFraction: operatingDays / daysInYear,
      operationSequence: operatingDays > 0 ? operationSequence : 0,
      isTerminalYear: calendarYear === lastOperatingDay.getUTCFullYear(),
    });
  }
  return { rows, constructionStartYear, codYear, codDate, operationEnd };
}

function normalizedWeights(values) {
  const total = sum(values);
  return values.map((value) => value / total);
}

function drawWeights(model, calendar) {
  const profile = model.capex.drawProfile;
  const developmentShare = rate(profile.developmentSharePct);
  const developmentWeight = model.project.developmentYears > 0
    ? developmentShare / model.project.developmentYears
    : 0;
  const constructionWeights = normalizedWeights(profile.constructionWeights);
  return calendar.rows.map((row) => {
    if (row.calendarYear < calendar.constructionStartYear) return developmentWeight;
    if (row.calendarYear <= calendar.codYear) {
      const index = row.calendarYear - calendar.constructionStartYear;
      return (1 - developmentShare) * constructionWeights[index];
    }
    return 0;
  });
}

function nominalCapex(model, calendar) {
  const weights = drawWeights(model, calendar);
  const categoryIds = CAPEX_CATEGORIES.map(({ id }) => id);
  const categoryDraws = Object.fromEntries(categoryIds.map((id) => [id, calendar.rows.map(() => 0)]));

  model.capex.items.forEach((item) => {
    weights.forEach((weight, index) => {
      const year = calendar.rows[index].calendarYear;
      const inflationYears = Math.max(0, year - model.capex.baseYear);
      const inflationFactor = (1 + rate(model.capex.constructionInflationPct)) ** inflationYears;
      categoryDraws[item.category][index] += item.value * weight * inflationFactor;
    });
  });

  const directDraws = calendar.rows.map((_, index) => sum(categoryIds.map((id) => categoryDraws[id][index])));
  const categoryTotals = Object.fromEntries(categoryIds.map((id) => [id, sum(categoryDraws[id])]));
  return { categoryTotals, directDraws, nominalDirectCapex: sum(directDraws) };
}

function allocateFunding(draws, principals, fundingOrder) {
  const remaining = { ...principals };
  const rows = draws.map(() => ({ equity: 0, senior: 0, residentBond: 0 }));
  draws.forEach((draw, rowIndex) => {
    let unfunded = draw;
    fundingOrder.forEach((source) => {
      const amount = Math.min(unfunded, Math.max(0, remaining[source]));
      rows[rowIndex][source] += amount;
      remaining[source] -= amount;
      unfunded -= amount;
    });
    if (Math.abs(unfunded) > 1e-7) throw new Error("총투자비 재원배분이 일치하지 않습니다.");
  });
  return rows;
}

function idcFromFunding(model, calendar, fundingRows) {
  let openingSenior = 0;
  let openingBond = 0;
  return fundingRows.map((funding, index) => {
    if (calendar.rows[index].calendarYear > calendar.codYear) return 0;
    const seniorInterest = (openingSenior + funding.senior / 2) * rate(model.finance.constructionRatePct);
    const bondInterest = (openingBond + funding.residentBond / 2) * rate(model.finance.bondRatePct);
    openingSenior += funding.senior;
    openingBond += funding.residentBond;
    return seniorInterest + bondInterest;
  });
}

function initialDebtServiceReserve(model, seniorPrincipal, bondPrincipal) {
  const seniorRate = rate(model.finance.seniorRatePct);
  const seniorService = model.finance.seniorGraceYears > 0
    ? seniorPrincipal * seniorRate
    : levelDebtService(seniorPrincipal, seniorRate, model.finance.seniorTermYears);
  const bondService = bondPrincipal * rate(model.finance.bondRatePct);
  return (seniorService + bondService) * model.finance.dsraMonths / 12;
}

function solveInvestment(model, calendar) {
  const nominal = nominalCapex(model, calendar);
  const contingencyDraws = nominal.directDraws.map((value) => value * rate(model.capex.contingencyPct));
  const firstConstructionIndex = calendar.rows.findIndex((row) => row.calendarYear === calendar.constructionStartYear);
  const lastConstructionIndex = calendar.rows.findIndex((row) => row.calendarYear === calendar.codYear);
  const equityRatio = rate(model.finance.equityPct);
  const bondRatio = rate(model.finance.residentBondPct);
  let financeFee = 0;
  let debtServiceReserve = 0;
  let idcDraws = calendar.rows.map(() => 0);
  let converged = false;
  let iterations = 0;
  let convergenceDifference = Number.POSITIVE_INFINITY;

  for (let iteration = 1; iteration <= INVESTMENT_MAX_ITERATIONS; iteration += 1) {
    iterations = iteration;
    const investmentDraws = nominal.directDraws.map((value, index) => value + contingencyDraws[index] + idcDraws[index]);
    investmentDraws[firstConstructionIndex] += financeFee;
    investmentDraws[lastConstructionIndex] += debtServiceReserve;
    const totalInvestment = sum(investmentDraws);
    const equity = totalInvestment * equityRatio;
    const residentBond = totalInvestment * bondRatio;
    const senior = totalInvestment - equity - residentBond;
    const principals = { equity, senior, residentBond };
    const fundingRows = allocateFunding(investmentDraws, principals, model.capex.drawProfile.fundingOrder);
    const nextIdcDraws = idcFromFunding(model, calendar, fundingRows);
    const nextFinanceFee = (senior + residentBond) * rate(model.finance.financeFeePct);
    const nextDebtServiceReserve = initialDebtServiceReserve(model, senior, residentBond);
    const difference = Math.max(
      Math.abs(nextFinanceFee - financeFee),
      Math.abs(nextDebtServiceReserve - debtServiceReserve),
      Math.abs(sum(nextIdcDraws) - sum(idcDraws)),
    );
    convergenceDifference = difference;
    financeFee = nextFinanceFee;
    debtServiceReserve = nextDebtServiceReserve;
    idcDraws = nextIdcDraws;
    if (difference <= INVESTMENT_TOLERANCE) {
      converged = true;
      break;
    }
  }

  if (!converged) throw new Error(`총투자비 반복계산이 ${INVESTMENT_MAX_ITERATIONS}회 안에 수렴하지 않았습니다.`);

  const investmentDraws = nominal.directDraws.map((value, index) => value + contingencyDraws[index] + idcDraws[index]);
  investmentDraws[firstConstructionIndex] += financeFee;
  investmentDraws[lastConstructionIndex] += debtServiceReserve;
  const totalInvestment = sum(investmentDraws);
  const equityPrincipal = totalInvestment * equityRatio;
  const bondPrincipal = totalInvestment * bondRatio;
  const seniorPrincipal = totalInvestment - equityPrincipal - bondPrincipal;
  const principals = { equity: equityPrincipal, senior: seniorPrincipal, residentBond: bondPrincipal };
  const fundingRows = allocateFunding(investmentDraws, principals, model.capex.drawProfile.fundingOrder);
  return {
    ...nominal,
    contingency: sum(contingencyDraws),
    contingencyDraws,
    financeFee,
    debtServiceReserve,
    idcDraws,
    constructionInterest: sum(idcDraws),
    investmentDraws,
    totalInvestment,
    equityPrincipal,
    seniorPrincipal,
    bondPrincipal,
    fundingRows,
    convergence: {
      converged,
      iterations,
      difference: convergenceDifference,
      tolerance: INVESTMENT_TOLERANCE,
      maxIterations: INVESTMENT_MAX_ITERATIONS,
    },
  };
}

function validateTaxBrackets(brackets) {
  if (!Array.isArray(brackets) || brackets.length === 0) return false;
  let prior = 0;
  return brackets.every((bracket, index) => {
    if (!bracket || typeof bracket !== "object") return false;
    const isLast = index === brackets.length - 1;
    const validLimit = isLast
      ? bracket.upTo === null
      : Number.isFinite(bracket.upTo) && bracket.upTo > prior;
    if (bracket.upTo !== null) prior = bracket.upTo;
    return validLimit && Number.isFinite(bracket.ratePct) && bracket.ratePct >= 0 && bracket.ratePct <= 100;
  });
}

function validate(model, technology) {
  const errors = [];
  const categoryIds = new Set(CAPEX_CATEGORIES.map(({ id }) => id));
  const finite = (value) => Number.isFinite(value);
  const integer = (value) => Number.isInteger(value);

  if (!finite(model?.project?.unitCapacityMW) || model.project.unitCapacityMW <= 0
    || !integer(model.project.units) || model.project.units <= 0) {
    errors.push("설비용량과 대수는 유효한 양수여야\u00a0합니다.");
  }
  const calendarYears = [
    model.project.baseYear,
    model.project.startYear,
    model.capex.baseYear,
    model.opex.baseYear,
  ];
  if (calendarYears.some((year) => !integer(year) || year < MIN_CALENDAR_YEAR || year > MAX_CALENDAR_YEAR)) {
    errors.push(`기준연도와 시작연도는 ${MIN_CALENDAR_YEAR}~${MAX_CALENDAR_YEAR} 범위의 정수여야 합니다.`);
  }
  if (!integer(model.project.developmentYears) || model.project.developmentYears < 0
    || !integer(model.project.constructionYears) || model.project.constructionYears < 1
    || !integer(model.project.operationYears) || model.project.operationYears < 1) {
    errors.push("개발·공사·운영기간이 유효하지 않습니다.");
  }
  if (!integer(model.project.codMonth) || model.project.codMonth < 1 || model.project.codMonth > 12) errors.push("COD 월은 1~12의 정수여야 합니다.");
  if (integer(model.project.startYear) && integer(model.project.developmentYears)
    && integer(model.project.constructionYears) && integer(model.project.operationYears)) {
    const finalYear = model.project.startYear + model.project.developmentYears
      + model.project.constructionYears - 1 + model.project.operationYears;
    if (finalYear > MAX_CALENDAR_YEAR) errors.push(`사업 종료연도는 ${MAX_CALENDAR_YEAR}년 이하여야 합니다.`);
  }
  if (technology !== "ess" && (!finite(model.project.p75NetCapacityFactorPct)
    || model.project.p75NetCapacityFactorPct <= 0 || model.project.p75NetCapacityFactorPct > 100)) {
    errors.push("P75 순 이용률은 0% 초과 100% 이하여야 합니다.");
  }
  if (!finite(model.project.degradationPct) || model.project.degradationPct < 0 || model.project.degradationPct >= 100) errors.push("열화율이 유효하지 않습니다.");
  const augmentation = model.project.augmentation;
  if (!augmentation || typeof augmentation !== "object"
    || typeof augmentation.enabled !== "boolean"
    || !integer(augmentation.intervalYears) || augmentation.intervalYears < 1
    || !finite(augmentation.capacityRestorePct) || augmentation.capacityRestorePct < 0 || augmentation.capacityRestorePct > 100
    || !finite(augmentation.unitCostPerKWh) || augmentation.unitCostPerKWh < 0
    || !finite(augmentation.costEscalationPct) || augmentation.costEscalationPct < 0) {
    errors.push("배터리 증설(augmentation) 입력이 유효하지 않습니다.");
  }
  if (!finite(model.finance.equityPct) || !finite(model.finance.residentBondPct)
    || model.finance.equityPct <= 0 || model.finance.residentBondPct < 0
    || model.finance.equityPct + model.finance.residentBondPct >= 100) {
    errors.push("자기자본과 주민참여채권 비율의 합은 100% 미만이어야 합니다.");
  }
  if (!integer(model.finance.seniorTermYears) || model.finance.seniorTermYears < 1
    || !integer(model.finance.seniorGraceYears) || model.finance.seniorGraceYears < 0
    || model.finance.seniorGraceYears >= model.finance.seniorTermYears
    || !integer(model.finance.bondTermYears) || model.finance.bondTermYears < 1) {
    errors.push("대출 만기와 거치기간이 유효하지 않습니다.");
  }
  for (const key of ["seniorRatePct", "bondRatePct", "financeFeePct", "constructionRatePct", "dsraMonths"]) {
    if (!finite(model.finance[key]) || model.finance[key] < 0) errors.push(`금융 입력 ${key}가 유효하지 않습니다.`);
  }
  const capexItems = Array.isArray(model.capex.items) ? model.capex.items : null;
  const opexItems = Array.isArray(model.opex.items) ? model.opex.items : null;
  if (!capexItems || capexItems.some((item) => !item || !finite(item.value) || item.value < 0)) {
    errors.push("CAPEX 항목 배열과 금액이 유효해야 합니다.");
  }
  if (capexItems && capexItems.some((item) => !categoryIds.has(item.category))) errors.push("CAPEX 범주가 유효하지 않습니다.");
  if (!opexItems || opexItems.some((item) => !item || !finite(item.value) || item.value < 0)) {
    errors.push("OPEX 항목 배열과 금액이 유효해야 합니다.");
  }
  for (const [section, key] of [
    [model.capex, "constructionInflationPct"], [model.capex, "contingencyPct"],
    [model.opex, "escalationPct"], [model.opex, "variableOMPerMWh"],
    [model.opex, "insurancePct"], [model.opex, "communityRevenuePct"],
  ]) {
    if (!finite(section[key]) || section[key] < 0) errors.push(`비용 입력 ${key}가 유효하지 않습니다.`);
  }
  if (!integer(model.opex.ltsaStepAfterYear) || model.opex.ltsaStepAfterYear < 0
    || !finite(model.opex.ltsaStepMultiplierPct) || model.opex.ltsaStepMultiplierPct < 0) {
    errors.push("LTSA 단가 변경 입력이 유효하지 않습니다.");
  }
  const revenueKeys = technology === "ess"
    ? ["durationHours", "cyclesPerYear", "roundTripEfficiencyPct", "auxConsumptionPct", "chargePrice", "dischargePrice", "capacityPrice"]
    : ["smpPrice", "recPrice", "recWeight", "bidPrice"];
  if (revenueKeys.some((key) => !finite(model.revenue[key]) || model.revenue[key] < 0)
    || (technology === "ess" && (model.revenue.roundTripEfficiencyPct > 100 || model.revenue.auxConsumptionPct > 100))) {
    errors.push("발전·판매 입력이 유효하지 않습니다.");
  }
  if (!Array.isArray(model.revenue.rampUpFactors)
    || model.revenue.rampUpFactors.some((value) => !finite(value) || value < 0)) {
    errors.push("가동률 램프업 입력이 유효하지 않습니다.");
  }
  const profile = model.capex.drawProfile;
  if (!profile || !Array.isArray(profile.constructionWeights)
    || profile.constructionWeights.length !== model.project.constructionYears
    || profile.constructionWeights.some((value) => !finite(value) || value < 0)
    || sum(profile.constructionWeights) <= 0
    || !finite(profile.developmentSharePct) || profile.developmentSharePct < 0 || profile.developmentSharePct > 100) {
    errors.push("CAPEX 집행곡선이 공사기간과 일치하지 않습니다.");
  }
  if (!profile || !Array.isArray(profile.fundingOrder)
    || profile.fundingOrder.length !== 3
    || new Set(profile.fundingOrder).size !== 3
    || !profile.fundingOrder.every((source) => ["equity", "senior", "residentBond"].includes(source))) {
    errors.push("재원조달 순서가 유효하지 않습니다.");
  }
  if (!validateTaxBrackets(model.assumptions.taxBrackets)) errors.push("누진세율 구간이 유효하지 않습니다.");
  for (const key of [
    "waccPct", "depreciationYears", "nolCarryforwardYears", "annualDscrThreshold",
    "cumulativeDscrThreshold", "legalReserveContributionPct", "legalReserveCapPctOfEquity",
    "investorDividendTaxPct",
  ]) {
    if (!finite(model.assumptions[key]) || model.assumptions[key] < 0) errors.push(`읽기 전용 가정 ${key}가 유효하지 않습니다.`);
  }
  if (!finite(model.assumptions.depreciationYears) || model.assumptions.depreciationYears <= 0) {
    errors.push("감가상각기간은 0보다 커야 합니다.");
  }
  for (const key of ["legalReserveContributionPct", "legalReserveCapPctOfEquity", "investorDividendTaxPct"]) {
    if (finite(model.assumptions[key]) && model.assumptions[key] > 100) errors.push(`읽기 전용 가정 ${key}는 100% 이하여야 합니다.`);
  }
  return errors;
}

function salesForRow(model, technology, capacityMW, row, degradationOverride) {
  if (row.operatingDays === 0) return { generationMWh: 0, chargedMWh: 0, revenue: 0 };
  const degradation = degradationOverride
    ?? (1 - rate(model.project.degradationPct)) ** (row.operationSequence - 1);
  if (technology === "ess") {
    const operationFraction = row.operationFraction;
    const ramp = rampFactor(model.revenue.rampUpFactors, row.operationSequence);
    const chargedMWh = capacityMW * model.revenue.durationHours * model.revenue.cyclesPerYear * degradation * ramp * operationFraction;
    const generationMWh = chargedMWh * rate(model.revenue.roundTripEfficiencyPct) * (1 - rate(model.revenue.auxConsumptionPct));
    const arbitrage = model.revenue.revenueMode === "fixed"
      ? 0
      : (generationMWh * 1000 * model.revenue.dischargePrice - chargedMWh * 1000 * model.revenue.chargePrice) / HUNDRED_MILLION;
    const capacityRevenue = capacityMW * 1000 * 12 * model.revenue.capacityPrice * operationFraction / HUNDRED_MILLION;
    return { generationMWh, chargedMWh, revenue: arbitrage + capacityRevenue };
  }
  const generationMWh = capacityMW * 24 * row.operatingDays * rate(model.project.p75NetCapacityFactorPct) * degradation;
  const unitPrice = model.revenue.revenueMode === "fixed"
    ? model.revenue.bidPrice
    : model.revenue.smpPrice + model.revenue.recPrice * model.revenue.recWeight;
  return { generationMWh, chargedMWh: 0, revenue: generationMWh * 1000 * unitPrice / HUNDRED_MILLION };
}

function stepAdjustedOpexValue(model, item, row) {
  const stepAfterYear = model.opex.ltsaStepAfterYear ?? 0;
  if (stepAfterYear <= 0 || item.id !== "om" || !(row.operationSequence > stepAfterYear)) return item.value;
  return item.value * rate(model.opex.ltsaStepMultiplierPct ?? 100);
}

function operatingCosts(model, row, sales, totalInvestment) {
  if (row.operatingDays === 0) return 0;
  const escalationYears = Math.max(0, row.calendarYear - model.opex.baseYear);
  const escalation = (1 + rate(model.opex.escalationPct)) ** escalationYears;
  const fixed = sum(model.opex.items.map((item) => stepAdjustedOpexValue(model, item, row))) * escalation * row.operationFraction;
  const variable = sales.generationMWh * model.opex.variableOMPerMWh / HUNDRED_MILLION;
  const insurance = totalInvestment * rate(model.opex.insurancePct) * row.operationFraction;
  const community = sales.revenue * rate(model.opex.communityRevenuePct);
  return fixed + variable + insurance + community;
}

function useNol(taxableIncome, lots, operatingYear, carryforwardYears) {
  const activeLots = lots.filter((lot) => lot.expiresAfter >= operatingYear && lot.amount > 1e-12);
  if (taxableIncome <= 0) {
    activeLots.push({ amount: -taxableIncome, expiresAfter: operatingYear + carryforwardYears });
    return { taxableAfterNol: 0, nolUsed: 0, lots: activeLots };
  }
  let remainingIncome = taxableIncome;
  let nolUsed = 0;
  activeLots.forEach((lot) => {
    const used = Math.min(remainingIncome, lot.amount);
    lot.amount -= used;
    remainingIncome -= used;
    nolUsed += used;
  });
  return { taxableAfterNol: remainingIncome, nolUsed, lots: activeLots.filter((lot) => lot.amount > 1e-12) };
}

function rampFactor(factors, operationSequence) {
  if (!Array.isArray(factors) || factors.length === 0 || !(operationSequence > 0)) return 1;
  const index = operationSequence - 1;
  return index < factors.length ? factors[index] : 1;
}

function augmentationProfile(model, calendar, capacityMW) {
  const config = model.project.augmentation;
  const totalOperationYears = model.project.operationYears;
  const degradationRate = rate(model.project.degradationPct);
  const durationHours = model.revenue.durationHours;
  const restoreShare = rate(config.capacityRestorePct);
  const escalationRate = rate(config.costEscalationPct);
  const baseYear = model.capex.baseYear;

  let fraction = 1;
  const fractionByIndex = [];
  const drawByIndex = [];
  const events = [];

  calendar.rows.forEach((row) => {
    if (row.operationSequence === 0) {
      fractionByIndex.push(null);
      drawByIndex.push(0);
      return;
    }
    const sequence = row.operationSequence;
    if (sequence > 1) fraction *= (1 - degradationRate);
    let draw = 0;
    const dueForAugmentation = config.enabled
      && config.intervalYears > 0
      && sequence % config.intervalYears === 0
      && sequence < totalOperationYears;
    if (dueForAugmentation) {
      const before = fraction;
      fraction = Math.min(1, fraction + (1 - fraction) * restoreShare);
      const restoredFraction = fraction - before;
      if (restoredFraction > 1e-9) {
        const restoredEnergyMWh = capacityMW * durationHours * restoredFraction;
        const inflationYears = Math.max(0, row.calendarYear - baseYear);
        draw = restoredEnergyMWh * 1000 * config.unitCostPerKWh
          * (1 + escalationRate) ** inflationYears / HUNDRED_MILLION;
        events.push({
          calendarYear: row.calendarYear,
          operationSequence: sequence,
          restoredFraction,
          restoredEnergyMWh,
          drawAmount: draw,
          capacityFractionAfter: fraction,
          start: utcDate(row.calendarYear, calendar.codDate.getUTCMonth(), calendar.codDate.getUTCDate()),
        });
      }
    }
    fractionByIndex.push(fraction);
    drawByIndex.push(draw);
  });

  return { fractionByIndex, drawByIndex, events };
}

function buildDepreciationTranches(model, calendar, investment, augmentationEvents) {
  const years = model.assumptions.depreciationYears;
  const tranches = [{ amount: investment.nominalDirectCapex + investment.contingency, start: calendar.codDate }];
  (augmentationEvents ?? []).forEach((event) => {
    if (event.drawAmount > 0) tranches.push({ amount: event.drawAmount, start: event.start });
  });
  return tranches.map((tranche) => ({
    ...tranche,
    end: utcDate(
      tranche.start.getUTCFullYear() + years,
      tranche.start.getUTCMonth(),
      tranche.start.getUTCDate(),
    ),
  }));
}

function capitalBreakdown(investment) {
  const labels = Object.fromEntries(CAPEX_CATEGORIES.map(({ id, label }) => [id, label]));
  const rows = CAPEX_CATEGORIES.map(({ id }) => ({ id, label: labels[id], value: investment.categoryTotals[id] }));
  rows.push(
    { id: "contingency", label: "예비비", value: investment.contingency },
    { id: "constructionInterest", label: "건설이자", value: investment.constructionInterest },
    { id: "financeFee", label: "금융부대비용", value: investment.financeFee },
    { id: "debtServiceReserve", label: "DSRA", value: investment.debtServiceReserve },
  );
  return rows;
}

export function analyzeCase(model, technology) {
  const errors = validate(model, technology);
  if (errors.length > 0) return { errors };

  const calendar = buildCalendar(model.project);
  let investment;
  try {
    investment = solveInvestment(model, calendar);
  } catch (error) {
    return { errors: [error instanceof Error ? error.message : "총투자비 반복계산 오류"] };
  }

  const capacityMW = model.project.unitCapacityMW * model.project.units;
  const augmentation = technology === "ess" && model.project.augmentation?.enabled
    ? augmentationProfile(model, calendar, capacityMW)
    : null;
  const depreciationTranches = buildDepreciationTranches(model, calendar, investment, augmentation?.events);
  const seniorAnnualRate = rate(model.finance.seniorRatePct);
  const seniorPayment = levelDebtService(
    investment.seniorPrincipal,
    seniorAnnualRate,
    model.finance.seniorTermYears - model.finance.seniorGraceYears,
  );
  let seniorBalance = investment.seniorPrincipal;
  let bondBalance = investment.bondPrincipal;
  let retainedCash = 0;
  let legalReserveBalance = 0;
  let cumulativeCfads = 0;
  let cumulativeDebtService = 0;
  let cumulativeSeniorDraw = 0;
  let cumulativeBondDraw = 0;
  let nolLots = [];
  const projectCashFlows = [];
  const projectCashFlowsPreTax = [];
  const equityCashFlows = [];
  const equityCashFlowsAfterInvestorTax = [];
  const rows = [];

  calendar.rows.forEach((calendarRow, index) => {
    const funding = investment.fundingRows[index];
    cumulativeSeniorDraw += funding.senior;
    cumulativeBondDraw += funding.residentBond;
    const sales = salesForRow(model, technology, capacityMW, calendarRow, augmentation?.fractionByIndex[index] ?? undefined);
    const opex = operatingCosts(model, calendarRow, sales, investment.totalInvestment);
    const ebitda = sales.revenue - opex;
    const augmentationDraw = augmentation?.drawByIndex[index] ?? 0;
    let seniorInterest = 0;
    let seniorPrincipal = 0;
    let seniorBalloon = 0;
    let bondInterest = 0;
    let bondPrincipal = 0;
    let bondBalloon = 0;

    if (calendarRow.operationSequence > 0) {
      const serviceYear = calendarRow.operationSequence;
      seniorInterest = seniorBalance * seniorAnnualRate * calendarRow.operationFraction;
      if (serviceYear > model.finance.seniorGraceYears && serviceYear <= model.finance.seniorTermYears) {
        const service = seniorPayment * calendarRow.operationFraction;
        seniorPrincipal = Math.min(seniorBalance, Math.max(0, service - seniorInterest));
      }
      bondInterest = bondBalance * rate(model.finance.bondRatePct) * calendarRow.operationFraction;
      if (serviceYear === model.finance.bondTermYears) bondPrincipal = bondBalance;

      seniorBalance -= seniorPrincipal;
      bondBalance -= bondPrincipal;
      if (serviceYear === model.finance.seniorTermYears && seniorBalance > 1e-9) {
        seniorBalloon = seniorBalance;
        seniorPrincipal += seniorBalloon;
        seniorBalance = 0;
      }
      if (calendarRow.isTerminalYear) {
        if (seniorBalance > 1e-9) {
          seniorBalloon = seniorBalance;
          seniorPrincipal += seniorBalloon;
          seniorBalance = 0;
        }
        if (bondBalance > 1e-9) {
          bondBalloon = bondBalance;
          bondPrincipal += bondBalloon;
          bondBalance = 0;
        }
      }
    }

    const depreciation = depreciationTranches.reduce((total, tranche) => {
      const days = overlapDays(
        utcDate(calendarRow.calendarYear, 0, 1),
        utcDate(calendarRow.calendarYear + 1, 0, 1),
        tranche.start,
        tranche.end,
      );
      return total + (tranche.amount / model.assumptions.depreciationYears) * days / calendarRow.daysInYear;
    }, 0);
    const taxableBeforeNol = calendarRow.operationSequence > 0
      ? ebitda - depreciation - seniorInterest - bondInterest
      : 0;
    let nolUsed = 0;
    let taxableIncome = 0;
    let corporateTax = 0;
    if (calendarRow.operationSequence > 0) {
      const nolResult = useNol(
        taxableBeforeNol,
        nolLots,
        calendarRow.operationSequence,
        model.assumptions.nolCarryforwardYears,
      );
      nolLots = nolResult.lots;
      nolUsed = nolResult.nolUsed;
      taxableIncome = nolResult.taxableAfterNol;
      corporateTax = progressiveTax(taxableIncome, model.assumptions.taxBrackets);
    }
    const nolBalance = sum(nolLots.map((lot) => lot.amount));
    const debtService = seniorInterest + seniorPrincipal + bondInterest + bondPrincipal;
    const cfads = calendarRow.operationSequence > 0 ? ebitda - corporateTax : 0;
    let dscr = null;
    let cumulativeDscr = null;
    let dividend = 0;
    let legalReserveContribution = 0;
    let investorDividendTax = 0;
    let terminalRecovery = 0;
    let terminalDsraRecovery = 0;
    let terminalLegalReserveRecovery = 0;
    let terminalRetainedCashRecovery = 0;
    let additionalEquityContribution = 0;
    let distributableProfit = 0;

    if (calendarRow.operationSequence > 0) {
      cumulativeCfads += cfads;
      cumulativeDebtService += debtService;
      dscr = debtService > 1e-12 ? cfads / debtService : null;
      cumulativeDscr = cumulativeDebtService > 1e-12 ? cumulativeCfads / cumulativeDebtService : null;
      const availableCash = retainedCash + cfads - debtService - augmentationDraw;
      distributableProfit = Math.max(
        0,
        ebitda - depreciation - seniorInterest - bondInterest - corporateTax,
      );
      if (availableCash < 0) {
        additionalEquityContribution = -availableCash;
        retainedCash = 0;
      } else {
        const annualGate = dscr === null || dscr >= model.assumptions.annualDscrThreshold;
        const cumulativeGate = cumulativeDscr === null || cumulativeDscr >= model.assumptions.cumulativeDscrThreshold;
        if (annualGate && cumulativeGate) {
          const disposition = Math.min(availableCash, distributableProfit);
          const reserveCap = investment.equityPrincipal * rate(model.assumptions.legalReserveCapPctOfEquity);
          legalReserveContribution = Math.min(
            Math.max(0, reserveCap - legalReserveBalance),
            disposition * rate(model.assumptions.legalReserveContributionPct),
          );
          legalReserveBalance += legalReserveContribution;
          dividend = disposition - legalReserveContribution;
          retainedCash = availableCash - disposition;
        } else {
          retainedCash = availableCash;
        }
      }
      investorDividendTax = dividend * rate(model.assumptions.investorDividendTaxPct);
      if (calendarRow.isTerminalYear) {
        terminalDsraRecovery = investment.debtServiceReserve;
        terminalLegalReserveRecovery = legalReserveBalance;
        terminalRetainedCashRecovery = retainedCash;
        terminalRecovery = terminalDsraRecovery + terminalLegalReserveRecovery + terminalRetainedCashRecovery;
        retainedCash = 0;
        legalReserveBalance = 0;
      }
    }

    const capitalDraw = investment.investmentDraws[index];
    const projectFlowPreTax = -capitalDraw - augmentationDraw + ebitda
      + (calendarRow.isTerminalYear ? investment.debtServiceReserve : 0);
    const projectFlow = projectFlowPreTax - corporateTax;
    const equityFlow = -funding.equity - additionalEquityContribution + dividend + terminalRecovery;
    const equityFlowAfterInvestorTax = equityFlow - investorDividendTax;
    projectCashFlowsPreTax.push(projectFlowPreTax);
    projectCashFlows.push(projectFlow);
    equityCashFlows.push(equityFlow);
    equityCashFlowsAfterInvestorTax.push(equityFlowAfterInvestorTax);
    rows.push({
      ...calendarRow,
      ...sales,
      opex,
      ebitda,
      depreciation,
      taxableBeforeNol,
      nolUsed,
      nolBalance,
      taxableIncome,
      corporateTax,
      projectTax: corporateTax,
      cfads,
      capitalDraw,
      augmentationDraw,
      nominalDirectCapexDraw: investment.directDraws[index],
      contingencyDraw: investment.contingencyDraws[index],
      constructionInterest: investment.idcDraws[index],
      equityContribution: funding.equity,
      additionalEquityContribution,
      seniorDraw: funding.senior,
      bondDraw: funding.residentBond,
      seniorInterest,
      seniorPrincipal,
      seniorBalloon,
      seniorBalance: calendarRow.operationSequence > 0 ? seniorBalance : cumulativeSeniorDraw,
      bondInterest,
      bondPrincipal,
      bondBalloon,
      bondBalance: calendarRow.operationSequence > 0 ? bondBalance : cumulativeBondDraw,
      debtService,
      dscr,
      cumulativeDscr,
      retainedCash,
      dividend,
      distributableProfit,
      legalReserveContribution,
      legalReserveBalance,
      investorDividendTax,
      terminalRecovery,
      terminalDsraRecovery,
      terminalLegalReserveRecovery,
      terminalRetainedCashRecovery,
      projectFlow,
      equityFlow,
      equityFlowAfterInvestorTax,
    });
  });

  const breakdown = capitalBreakdown(investment);
  const fundingBreakdown = [
    { id: "equity", label: "자기자본", value: investment.equityPrincipal },
    { id: "senior", label: "선순위대출", value: investment.seniorPrincipal },
    { id: "residentBond", label: "주민참여채권", value: investment.bondPrincipal },
  ];
  const projectPayback = paybackPeriod(projectCashFlows);
  return {
    errors: [],
    rows,
    capacityMW,
    baseCapex: sum(model.capex.items.map(({ value }) => value)),
    nominalDirectCapex: investment.nominalDirectCapex,
    contingency: investment.contingency,
    financeFee: investment.financeFee,
    constructionInterest: investment.constructionInterest,
    debtServiceReserve: investment.debtServiceReserve,
    totalInvestment: investment.totalInvestment,
    equityPrincipal: investment.equityPrincipal,
    seniorPrincipal: investment.seniorPrincipal,
    bondPrincipal: investment.bondPrincipal,
    capitalBreakdown: breakdown,
    fundingBreakdown,
    augmentationEvents: augmentation?.events ?? [],
    annualGenerationMWh: rows.find((row) => row.operationFraction === 1)?.generationMWh
      ?? rows.find((row) => row.operatingDays > 0)?.generationMWh ?? 0,
    firstYearRevenue: rows.find((row) => row.operatingDays > 0)?.revenue ?? 0,
    projectIrrPreTax: irr(projectCashFlowsPreTax),
    projectIrr: irr(projectCashFlows),
    equityIrr: irr(equityCashFlows),
    equityIrrAfterInvestorTax: irr(equityCashFlowsAfterInvestorTax),
    projectNpv: npv(rate(model.assumptions.waccPct), projectCashFlows),
    projectPayback: Number.isFinite(projectPayback) ? projectPayback : null,
    projectCashFlowsPreTax,
    projectCashFlows,
    equityCashFlows,
    equityCashFlowsAfterInvestorTax,
    benchmarkVariance: {
      actualProjectAfterTaxIrr: irr(projectCashFlows),
      actualEquityPreInvestorTaxIrr: irr(equityCashFlows),
      actualTotalInvestment: investment.totalInvestment,
      actualConstructionInterest: investment.constructionInterest,
    },
    investmentIterations: investment.convergence,
  };
}

export function sensitivityCases(model, technology) {
  const scenarios = [
    { label: "판매단가 -10%", key: "priceDown", mutate: (copy) => {
      ["smpPrice", "recPrice", "bidPrice", "dischargePrice", "capacityPrice"].forEach((key) => { copy.revenue[key] *= 0.9; });
    } },
    { label: "발전량 -10%", key: "yieldDown", mutate: (copy) => {
      if (technology === "ess") copy.revenue.cyclesPerYear *= 0.9;
      else copy.project.p75NetCapacityFactorPct *= 0.9;
    } },
    { label: "기준 시나리오", key: "base", mutate: () => {} },
    { label: "CAPEX +10%", key: "capexUp", mutate: (copy) => { copy.capex.items.forEach((item) => { item.value *= 1.1; }); } },
    { label: "금리 +1.0%p", key: "rateUp", mutate: (copy) => {
      copy.finance.seniorRatePct += 1;
      copy.finance.constructionRatePct += 1;
    } },
  ];
  return scenarios.map((scenario) => {
    const copy = structuredClone(model);
    scenario.mutate(copy);
    const result = analyzeCase(copy, technology);
    return {
      label: scenario.label,
      key: scenario.key,
      projectIrr: result.errors.length === 0 ? result.projectIrr : Number.NaN,
    };
  });
}
