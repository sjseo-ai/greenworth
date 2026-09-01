(() => {
  // js/project-data.js
  var CAPEX_CATEGORIES = Object.freeze([
    { id: "equipment", label: "기자재" },
    { id: "constructionCivil", label: "토목" },
    { id: "constructionElectrical", label: "전기" },
    { id: "constructionGrid", label: "선로·계통" },
    { id: "constructionInstallation", label: "운송·설치" },
    { id: "indirect", label: "간접비" },
    { id: "land", label: "토지" }
  ]);
  var cost = (id, label, value, category) => ({ id, label, value, category });
  var opexCost = (id, label, value) => ({ id, label, value });
  var historicalTaxBrackets = Object.freeze([
    { upTo: 2, ratePct: 9.9 },
    { upTo: 200, ratePct: 20.9 },
    { upTo: null, ratePct: 23.1 }
  ]);
  var commonAssumptions = {
    waccPct: 4.575,
    taxBrackets: historicalTaxBrackets,
    depreciationYears: 20,
    nolCarryforwardYears: 10,
    annualDscrThreshold: 1.1,
    cumulativeDscrThreshold: 1.2,
    legalReserveContributionPct: 10,
    legalReserveCapPctOfEquity: 50,
    investorDividendTaxPct: 15.4
  };
  var commonProject = {
    projectName: "신재생에너지 개발사업",
    baseYear: 2025,
    startYear: 2025,
    unitCapacityMW: 5,
    units: 12,
    developmentYears: 4,
    constructionYears: 2,
    codMonth: 7,
    operationYears: 20,
    degradationPct: 0,
    augmentation: {
      enabled: false,
      intervalYears: 5,
      capacityRestorePct: 100,
      unitCostPerKWh: 28e4,
      costEscalationPct: 2
    }
  };
  var commonRevenue = {
    revenueMode: "smpRec",
    smpPrice: 105,
    recPrice: 72,
    recWeight: 1,
    bidPrice: 165,
    durationHours: 4,
    cyclesPerYear: 320,
    roundTripEfficiencyPct: 88,
    auxConsumptionPct: 0,
    chargePrice: 75,
    dischargePrice: 145,
    capacityPrice: 18e3,
    rampUpFactors: []
  };
  var commonCapex = {
    baseYear: 2025,
    constructionInflationPct: 2,
    contingencyPct: 7,
    drawProfile: {
      developmentSharePct: 5,
      constructionWeights: [0.35, 0.65],
      fundingOrder: ["equity", "senior", "residentBond"],
      convention: "annual-s-curve"
    },
    items: []
  };
  var commonOpex = {
    baseYear: 2025,
    escalationPct: 2,
    variableOMPerMWh: 6500,
    insurancePct: 0.35,
    communityRevenuePct: 0.5,
    ltsaStepAfterYear: 0,
    ltsaStepMultiplierPct: 100,
    items: []
  };
  var commonFinance = {
    equityPct: 25,
    residentBondPct: 5,
    seniorRatePct: 5.2,
    seniorTermYears: 15,
    seniorGraceYears: 1,
    bondRatePct: 7,
    bondTermYears: 10,
    financeFeePct: 1.5,
    constructionRatePct: 5.5,
    dsraMonths: 6
  };
  var metadata = (source, limitations) => ({ source, limitations });
  var onshore = {
    label: "육상풍력",
    code: "ON",
    description: "터빈, 진입도로, 기초, 계통연계와 지역수용성을 함께 검토합니다.",
    project: {
      ...commonProject,
      projectName: "육상풍력 40MW",
      unitCapacityMW: 5,
      units: 8,
      developmentYears: 3,
      constructionYears: 3,
      p75NetCapacityFactorPct: 28
    },
    revenue: { ...commonRevenue, smpPrice: 86, recPrice: 77, recWeight: 1.2 },
    capex: {
      ...commonCapex,
      constructionInflationPct: 0,
      contingencyPct: 5,
      drawProfile: {
        ...commonCapex.drawProfile,
        developmentSharePct: 4.24,
        constructionWeights: [0.18, 0.18, 0.64]
      },
      items: [
        cost("turbine", "풍력발전기 공급", 588, "equipment"),
        cost("civil", "토목·진입도로·기초", 200, "constructionCivil"),
        cost("internalElectrical", "내부 전기·통신공사", 76, "constructionElectrical"),
        cost("grid", "154kV 송전·계통연계", 250, "constructionGrid"),
        cost("installation", "운송 및 설치", 88, "constructionInstallation"),
        cost("design", "기본·실시설계", 20, "indirect"),
        cost("supervision", "감리·건설관리", 10, "indirect"),
        cost("development", "인허가·환경·지역개발", 76, "indirect"),
        cost("land", "부지·임차·지상권", 5, "land")
      ]
    },
    opex: {
      ...commonOpex,
      variableOMPerMWh: 0,
      items: [
        opexCost("om", "장기 O&M·BOP", 10.233333333333333),
        opexCost("staff", "인건비·SPC 운영", 3),
        opexCost("lease", "임차료", 3),
        opexCost("admin", "일반관리·수수료", 1.5)
      ]
    },
    finance: {
      ...commonFinance,
      equityPct: 15,
      residentBondPct: 4,
      seniorRatePct: 4.5,
      seniorTermYears: 20,
      seniorGraceYears: 2,
      bondRatePct: 4.5,
      bondTermYears: 20,
      financeFeePct: 0.9,
      constructionRatePct: 4.5,
      dsraMonths: 0
    },
    assumptions: { ...commonAssumptions },
    metadata: metadata(
      "★ 육상풍력재무모델 (예시).xlsx cached values: Summary, Assumption, Investment, Finance, IRR, ROE",
      "역사적 예시 입력을 연간 단순화한 검증 프리셋이며 현재 세법·금융조건 또는 세무자문이 아닙니다."
    )
  };
  var offshore = {
    label: "해상풍력",
    code: "OF",
    description: "터빈과 하부구조, 해저케이블, 설치선·항만, 해상변전소 비용을 분리합니다.",
    project: {
      ...commonProject,
      projectName: "해상풍력 300MW",
      unitCapacityMW: 15,
      units: 20,
      developmentYears: 5,
      constructionYears: 4,
      codMonth: 10,
      p75NetCapacityFactorPct: 31.8767
    },
    revenue: { ...commonRevenue, recWeight: 2.5, bidPrice: 195 },
    capex: {
      ...commonCapex,
      contingencyPct: 10,
      drawProfile: {
        ...commonCapex.drawProfile,
        developmentSharePct: 6,
        constructionWeights: [0.15, 0.3, 0.35, 0.2]
      },
      items: [
        cost("turbine", "해상풍력 터빈", 6e3, "equipment"),
        cost("foundation", "하부구조·기초", 4200, "constructionCivil"),
        cost("offshoreSub", "해상변전소", 1600, "constructionElectrical"),
        cost("arrayCable", "내부망 해저케이블", 1e3, "constructionElectrical"),
        cost("exportCable", "외부망·육상케이블", 1800, "constructionGrid"),
        cost("grid", "계통접속설비", 600, "constructionGrid"),
        cost("installation", "설치선·해상시공", 2500, "constructionInstallation"),
        cost("port", "항만·물류·조립", 600, "constructionInstallation"),
        cost("development", "인허가·해역·환경조사", 500, "indirect"),
        cost("design", "설계·인증·엔지니어링", 350, "indirect"),
        cost("supervision", "감리·사업관리", 300, "indirect"),
        cost("community", "어업·주민수용성", 400, "indirect"),
        cost("insurance", "건설·ALOP·책임보험", 300, "indirect"),
        cost("land", "육상 접속부지", 100, "land")
      ]
    },
    opex: {
      ...commonOpex,
      variableOMPerMWh: 12e3,
      insurancePct: 0.5,
      items: [
        opexCost("om", "터빈·BOP O&M", 250),
        opexCost("vessel", "운영선박·항만", 35),
        opexCost("staff", "인건비·관제", 8),
        opexCost("admin", "일반관리·수수료", 5)
      ]
    },
    finance: {
      ...commonFinance,
      equityPct: 30,
      seniorRatePct: 5.6,
      seniorTermYears: 18,
      constructionRatePct: 6
    },
    assumptions: { ...commonAssumptions, waccPct: 7 },
    metadata: metadata(
      "국내 해상풍력 예비타당성 검토용 내부 예시 범위와 육상 workbook 금융 구조를 조합한 프리셋",
      "해저지반·항만·선박·계통 거리별 견적과 월별 발전량을 반영하지 않은 개략 연간 모델입니다."
    )
  };
  var solar = {
    label: "태양광",
    code: "PV",
    description: "모듈, 인버터, 구조물, 부지와 계통비를 구분하고 열화율을 반영합니다.",
    project: {
      ...commonProject,
      projectName: "태양광 50MW",
      unitCapacityMW: 1,
      units: 50,
      developmentYears: 2,
      constructionYears: 1,
      codMonth: 7,
      operationYears: 20,
      p75NetCapacityFactorPct: 15.25,
      degradationPct: 0.6
    },
    revenue: { ...commonRevenue, recWeight: 1, bidPrice: 155 },
    capex: {
      ...commonCapex,
      contingencyPct: 5,
      drawProfile: {
        ...commonCapex.drawProfile,
        developmentSharePct: 8,
        constructionWeights: [1]
      },
      items: [
        cost("module", "태양광 모듈", 240, "equipment"),
        cost("inverter", "인버터·PCS", 35, "equipment"),
        cost("structure", "구조물·트래커", 60, "constructionCivil"),
        cost("civil", "토목공사", 45, "constructionCivil"),
        cost("electrical", "내부 전기공사", 35, "constructionElectrical"),
        cost("grid", "송전·계통연계", 60, "constructionGrid"),
        cost("installation", "운송·설치", 20, "constructionInstallation"),
        cost("development", "인허가·개발비", 25, "indirect"),
        cost("design", "설계비", 12, "indirect"),
        cost("supervision", "감리비", 10, "indirect"),
        cost("community", "민원·주민수용성", 8, "indirect"),
        cost("insurance", "건설보험·보증", 5, "indirect"),
        cost("land", "부지·임차권", 35, "land")
      ]
    },
    opex: {
      ...commonOpex,
      variableOMPerMWh: 3500,
      insurancePct: 0.25,
      items: [
        opexCost("om", "O&M·모니터링", 6),
        opexCost("staff", "인건비·SPC 운영", 1.5),
        opexCost("lease", "임차료", 2),
        opexCost("admin", "일반관리·수수료", 1)
      ]
    },
    finance: {
      ...commonFinance,
      equityPct: 20,
      seniorRatePct: 4.9,
      seniorTermYears: 17,
      seniorGraceYears: 0
    },
    assumptions: { ...commonAssumptions, waccPct: 6 },
    metadata: metadata(
      "국내 유틸리티급 태양광 개략 사업성 검토용 예시 프리셋",
      "일사량 시계열, 출력제한, 인버터 교체, 토지형상과 세부 접속공사를 별도 모델링하지 않습니다."
    )
  };
  var essAnnualDegradationPct = (1 - 0.7 ** (1 / 15)) * 100;
  var ess = {
    label: "ESS",
    code: "ES",
    description: "출력·저장시간·사이클·효율과 용량요금 또는 시장차익을 함께 분석합니다.",
    project: {
      ...commonProject,
      projectName: "ESS 50MW / 200MWh",
      unitCapacityMW: 50,
      units: 1,
      developmentYears: 1,
      constructionYears: 1,
      codMonth: 7,
      operationYears: 15,
      degradationPct: essAnnualDegradationPct,
      augmentation: {
        enabled: true,
        intervalYears: 5,
        capacityRestorePct: 100,
        unitCostPerKWh: 28e4,
        costEscalationPct: 2
      }
    },
    revenue: {
      ...commonRevenue,
      revenueMode: "hybrid",
      roundTripEfficiencyPct: 89.5,
      auxConsumptionPct: 3.3,
      rampUpFactors: [0.95, 0.96, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    },
    capex: {
      ...commonCapex,
      contingencyPct: 7,
      drawProfile: {
        ...commonCapex.drawProfile,
        developmentSharePct: 8,
        constructionWeights: [1]
      },
      items: [
        cost("battery", "배터리·랙·컨테이너", 650, "equipment"),
        cost("pcs", "PCS", 120, "equipment"),
        cost("ems", "EMS·SCADA", 25, "constructionElectrical"),
        cost("electrical", "변압기·전기공사", 60, "constructionElectrical"),
        cost("civil", "토목·건축", 35, "constructionCivil"),
        cost("fire", "소방·안전설비", 20, "constructionInstallation"),
        cost("grid", "계통접속", 50, "constructionGrid"),
        cost("development", "인허가·개발비", 15, "indirect"),
        cost("design", "설계비", 8, "indirect"),
        cost("supervision", "감리비", 6, "indirect"),
        cost("community", "민원·주민수용성", 5, "indirect"),
        cost("insurance", "건설보험·보증", 6, "indirect"),
        cost("land", "부지·임차권", 5, "land")
      ]
    },
    opex: {
      ...commonOpex,
      variableOMPerMWh: 2500,
      insurancePct: 0.45,
      ltsaStepAfterYear: 3,
      ltsaStepMultiplierPct: 190,
      items: [
        opexCost("om", "배터리·PCS LTSA", 9),
        opexCost("staff", "인건비·관제", 1.5),
        opexCost("lease", "부지 임차료", 1),
        opexCost("admin", "일반관리·수수료", 1)
      ]
    },
    finance: {
      ...commonFinance,
      equityPct: 30,
      seniorTermYears: 10,
      bondTermYears: 7
    },
    assumptions: { ...commonAssumptions, waccPct: 7.5, depreciationYears: 15 },
    metadata: metadata(
      "70%/15년 잔존용량 가정에서 연환산 열화율을 도출하고, 5년 주기 배터리 증설(augmentation)과 워런티 종료 후 LTSA 단가 인상 구간을 반영한 ESS 개략 프리셋. 왕복효율과 소내소비율은 260112_효성중공업 운전효율계산시트_KCH접수_V3.xlsx의 SDI·LGES·SKon 3사 제안값(154TR·22.9TR·PCS 충방전·케이블 효율과 배터리 DC 왕복효율, 소내소비 부하)을 1년차 기준으로 평균해 산출했습니다.",
      "충방전 시계열과 보조서비스(주파수조정 등) 정산은 별도 모델링하지 않습니다. 배터리 증설비용은 매년 균등 발생이 아닌 지정 연차의 일시 지출로 단순화하며, 안전성 비용 변동은 반영하지 않습니다. 왕복효율과 소내소비율은 15년 운영기간 동안 고정값을 사용하며, 참조 시트에 나타난 배터리 DC 효율의 완만한 연차 하락(약 1~2%p)은 반영하지 않습니다."
    )
  };
  var TECHNOLOGIES = Object.freeze({ onshore, offshore, solar, ess });
  function createCase(technology) {
    const preset = TECHNOLOGIES[technology];
    if (!preset) throw new RangeError(`지원하지 않는 기술입니다: ${technology}`);
    return structuredClone(preset);
  }

  // js/finance.js
  var HUNDRED_MILLION = 1e8;
  var MILLISECONDS_PER_DAY = 864e5;
  var INVESTMENT_TOLERANCE = 1e-9;
  var INVESTMENT_MAX_ITERATIONS = 200;
  var MIN_CALENDAR_YEAR = 1900;
  var MAX_CALENDAR_YEAR = 2200;
  function rate(percent2) {
    return percent2 / 100;
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
  function npv(discountRate, cashFlows) {
    return cashFlows.reduce((total, value, year) => total + value / (1 + discountRate) ** year, 0);
  }
  function irr(cashFlows) {
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
  function paybackPeriod(cashFlows) {
    let cumulative = cashFlows[0] ?? 0;
    if (cumulative >= 0) return 0;
    for (let year = 1; year < cashFlows.length; year += 1) {
      const prior = cumulative;
      cumulative += cashFlows[year] ?? 0;
      if (cumulative >= 0) {
        const annualFlow = cashFlows[year] ?? 0;
        return annualFlow === 0 ? year : year - 1 + Math.abs(prior) / annualFlow;
      }
    }
    return Number.NaN;
  }
  function levelDebtService(principal, annualRate, periods) {
    if (principal <= 0 || periods <= 0) return 0;
    if (annualRate === 0) return principal / periods;
    return principal * annualRate / (1 - (1 + annualRate) ** -periods);
  }
  function progressiveTax(taxableIncome, brackets) {
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
        isTerminalYear: calendarYear === lastOperatingDay.getUTCFullYear()
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
    const developmentWeight = model.project.developmentYears > 0 ? developmentShare / model.project.developmentYears : 0;
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
    const seniorService = model.finance.seniorGraceYears > 0 ? seniorPrincipal * seniorRate : levelDebtService(seniorPrincipal, seniorRate, model.finance.seniorTermYears);
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
      const investmentDraws2 = nominal.directDraws.map((value, index) => value + contingencyDraws[index] + idcDraws[index]);
      investmentDraws2[firstConstructionIndex] += financeFee;
      investmentDraws2[lastConstructionIndex] += debtServiceReserve;
      const totalInvestment2 = sum(investmentDraws2);
      const equity = totalInvestment2 * equityRatio;
      const residentBond = totalInvestment2 * bondRatio;
      const senior = totalInvestment2 - equity - residentBond;
      const principals2 = { equity, senior, residentBond };
      const fundingRows2 = allocateFunding(investmentDraws2, principals2, model.capex.drawProfile.fundingOrder);
      const nextIdcDraws = idcFromFunding(model, calendar, fundingRows2);
      const nextFinanceFee = (senior + residentBond) * rate(model.finance.financeFeePct);
      const nextDebtServiceReserve = initialDebtServiceReserve(model, senior, residentBond);
      const difference = Math.max(
        Math.abs(nextFinanceFee - financeFee),
        Math.abs(nextDebtServiceReserve - debtServiceReserve),
        Math.abs(sum(nextIdcDraws) - sum(idcDraws))
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
        maxIterations: INVESTMENT_MAX_ITERATIONS
      }
    };
  }
  function validateTaxBrackets(brackets) {
    if (!Array.isArray(brackets) || brackets.length === 0) return false;
    let prior = 0;
    return brackets.every((bracket, index) => {
      if (!bracket || typeof bracket !== "object") return false;
      const isLast = index === brackets.length - 1;
      const validLimit = isLast ? bracket.upTo === null : Number.isFinite(bracket.upTo) && bracket.upTo > prior;
      if (bracket.upTo !== null) prior = bracket.upTo;
      return validLimit && Number.isFinite(bracket.ratePct) && bracket.ratePct >= 0 && bracket.ratePct <= 100;
    });
  }
  function validate(model, technology) {
    const errors = [];
    const categoryIds = new Set(CAPEX_CATEGORIES.map(({ id }) => id));
    const finite = (value) => Number.isFinite(value);
    const integer = (value) => Number.isInteger(value);
    if (!finite(model?.project?.unitCapacityMW) || model.project.unitCapacityMW <= 0 || !integer(model.project.units) || model.project.units <= 0) {
      errors.push("설비용량과 대수는 유효한 양수여야 합니다.");
    }
    const calendarYears = [
      model.project.baseYear,
      model.project.startYear,
      model.capex.baseYear,
      model.opex.baseYear
    ];
    if (calendarYears.some((year) => !integer(year) || year < MIN_CALENDAR_YEAR || year > MAX_CALENDAR_YEAR)) {
      errors.push(`기준연도와 시작연도는 ${MIN_CALENDAR_YEAR}~${MAX_CALENDAR_YEAR} 범위의 정수여야 합니다.`);
    }
    if (!integer(model.project.developmentYears) || model.project.developmentYears < 0 || !integer(model.project.constructionYears) || model.project.constructionYears < 1 || !integer(model.project.operationYears) || model.project.operationYears < 1) {
      errors.push("개발·공사·운영기간이 유효하지 않습니다.");
    }
    if (!integer(model.project.codMonth) || model.project.codMonth < 1 || model.project.codMonth > 12) errors.push("COD 월은 1~12의 정수여야 합니다.");
    if (integer(model.project.startYear) && integer(model.project.developmentYears) && integer(model.project.constructionYears) && integer(model.project.operationYears)) {
      const finalYear = model.project.startYear + model.project.developmentYears + model.project.constructionYears - 1 + model.project.operationYears;
      if (finalYear > MAX_CALENDAR_YEAR) errors.push(`사업 종료연도는 ${MAX_CALENDAR_YEAR}년 이하여야 합니다.`);
    }
    if (technology !== "ess" && (!finite(model.project.p75NetCapacityFactorPct) || model.project.p75NetCapacityFactorPct <= 0 || model.project.p75NetCapacityFactorPct > 100)) {
      errors.push("P75 순 이용률은 0% 초과 100% 이하여야 합니다.");
    }
    if (!finite(model.project.degradationPct) || model.project.degradationPct < 0 || model.project.degradationPct >= 100) errors.push("열화율이 유효하지 않습니다.");
    const augmentation = model.project.augmentation;
    if (!augmentation || typeof augmentation !== "object" || typeof augmentation.enabled !== "boolean" || !integer(augmentation.intervalYears) || augmentation.intervalYears < 1 || !finite(augmentation.capacityRestorePct) || augmentation.capacityRestorePct < 0 || augmentation.capacityRestorePct > 100 || !finite(augmentation.unitCostPerKWh) || augmentation.unitCostPerKWh < 0 || !finite(augmentation.costEscalationPct) || augmentation.costEscalationPct < 0) {
      errors.push("배터리 증설(augmentation) 입력이 유효하지 않습니다.");
    }
    if (!finite(model.finance.equityPct) || !finite(model.finance.residentBondPct) || model.finance.equityPct <= 0 || model.finance.residentBondPct < 0 || model.finance.equityPct + model.finance.residentBondPct >= 100) {
      errors.push("자기자본과 주민참여채권 비율의 합은 100% 미만이어야 합니다.");
    }
    if (!integer(model.finance.seniorTermYears) || model.finance.seniorTermYears < 1 || !integer(model.finance.seniorGraceYears) || model.finance.seniorGraceYears < 0 || model.finance.seniorGraceYears >= model.finance.seniorTermYears || !integer(model.finance.bondTermYears) || model.finance.bondTermYears < 1) {
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
    for (const [section2, key] of [
      [model.capex, "constructionInflationPct"],
      [model.capex, "contingencyPct"],
      [model.opex, "escalationPct"],
      [model.opex, "variableOMPerMWh"],
      [model.opex, "insurancePct"],
      [model.opex, "communityRevenuePct"]
    ]) {
      if (!finite(section2[key]) || section2[key] < 0) errors.push(`비용 입력 ${key}가 유효하지 않습니다.`);
    }
    if (!integer(model.opex.ltsaStepAfterYear) || model.opex.ltsaStepAfterYear < 0 || !finite(model.opex.ltsaStepMultiplierPct) || model.opex.ltsaStepMultiplierPct < 0) {
      errors.push("LTSA 단가 변경 입력이 유효하지 않습니다.");
    }
    const revenueKeys = technology === "ess" ? ["durationHours", "cyclesPerYear", "roundTripEfficiencyPct", "auxConsumptionPct", "chargePrice", "dischargePrice", "capacityPrice"] : ["smpPrice", "recPrice", "recWeight", "bidPrice"];
    if (revenueKeys.some((key) => !finite(model.revenue[key]) || model.revenue[key] < 0) || technology === "ess" && (model.revenue.roundTripEfficiencyPct > 100 || model.revenue.auxConsumptionPct > 100)) {
      errors.push("발전·판매 입력이 유효하지 않습니다.");
    }
    if (!Array.isArray(model.revenue.rampUpFactors) || model.revenue.rampUpFactors.some((value) => !finite(value) || value < 0)) {
      errors.push("가동률 램프업 입력이 유효하지 않습니다.");
    }
    const profile = model.capex.drawProfile;
    if (!profile || !Array.isArray(profile.constructionWeights) || profile.constructionWeights.length !== model.project.constructionYears || profile.constructionWeights.some((value) => !finite(value) || value < 0) || sum(profile.constructionWeights) <= 0 || !finite(profile.developmentSharePct) || profile.developmentSharePct < 0 || profile.developmentSharePct > 100) {
      errors.push("CAPEX 집행곡선이 공사기간과 일치하지 않습니다.");
    }
    if (!profile || !Array.isArray(profile.fundingOrder) || profile.fundingOrder.length !== 3 || new Set(profile.fundingOrder).size !== 3 || !profile.fundingOrder.every((source) => ["equity", "senior", "residentBond"].includes(source))) {
      errors.push("재원조달 순서가 유효하지 않습니다.");
    }
    if (!validateTaxBrackets(model.assumptions.taxBrackets)) errors.push("누진세율 구간이 유효하지 않습니다.");
    for (const key of [
      "waccPct",
      "depreciationYears",
      "nolCarryforwardYears",
      "annualDscrThreshold",
      "cumulativeDscrThreshold",
      "legalReserveContributionPct",
      "legalReserveCapPctOfEquity",
      "investorDividendTaxPct"
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
    const degradation = degradationOverride ?? (1 - rate(model.project.degradationPct)) ** (row.operationSequence - 1);
    if (technology === "ess") {
      const operationFraction = row.operationFraction;
      const ramp = rampFactor(model.revenue.rampUpFactors, row.operationSequence);
      const chargedMWh = capacityMW * model.revenue.durationHours * model.revenue.cyclesPerYear * degradation * ramp * operationFraction;
      const generationMWh2 = chargedMWh * rate(model.revenue.roundTripEfficiencyPct) * (1 - rate(model.revenue.auxConsumptionPct));
      const arbitrage = model.revenue.revenueMode === "fixed" ? 0 : (generationMWh2 * 1e3 * model.revenue.dischargePrice - chargedMWh * 1e3 * model.revenue.chargePrice) / HUNDRED_MILLION;
      const capacityRevenue = capacityMW * 1e3 * 12 * model.revenue.capacityPrice * operationFraction / HUNDRED_MILLION;
      return { generationMWh: generationMWh2, chargedMWh, revenue: arbitrage + capacityRevenue };
    }
    const generationMWh = capacityMW * 24 * row.operatingDays * rate(model.project.p75NetCapacityFactorPct) * degradation;
    const unitPrice = model.revenue.revenueMode === "fixed" ? model.revenue.bidPrice : model.revenue.smpPrice + model.revenue.recPrice * model.revenue.recWeight;
    return { generationMWh, chargedMWh: 0, revenue: generationMWh * 1e3 * unitPrice / HUNDRED_MILLION };
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
      if (sequence > 1) fraction *= 1 - degradationRate;
      let draw = 0;
      const dueForAugmentation = config.enabled && config.intervalYears > 0 && sequence % config.intervalYears === 0 && sequence < totalOperationYears;
      if (dueForAugmentation) {
        const before = fraction;
        fraction = Math.min(1, fraction + (1 - fraction) * restoreShare);
        const restoredFraction = fraction - before;
        if (restoredFraction > 1e-9) {
          const restoredEnergyMWh = capacityMW * durationHours * restoredFraction;
          const inflationYears = Math.max(0, row.calendarYear - baseYear);
          draw = restoredEnergyMWh * 1e3 * config.unitCostPerKWh * (1 + escalationRate) ** inflationYears / HUNDRED_MILLION;
          events.push({
            calendarYear: row.calendarYear,
            operationSequence: sequence,
            restoredFraction,
            restoredEnergyMWh,
            drawAmount: draw,
            capacityFractionAfter: fraction,
            start: utcDate(row.calendarYear, calendar.codDate.getUTCMonth(), calendar.codDate.getUTCDate())
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
        tranche.start.getUTCDate()
      )
    }));
  }
  function capitalBreakdown(investment) {
    const labels = Object.fromEntries(CAPEX_CATEGORIES.map(({ id, label }) => [id, label]));
    const rows = CAPEX_CATEGORIES.map(({ id }) => ({ id, label: labels[id], value: investment.categoryTotals[id] }));
    rows.push(
      { id: "contingency", label: "예비비", value: investment.contingency },
      { id: "constructionInterest", label: "건설이자", value: investment.constructionInterest },
      { id: "financeFee", label: "금융부대비용", value: investment.financeFee },
      { id: "debtServiceReserve", label: "DSRA", value: investment.debtServiceReserve }
    );
    return rows;
  }
  function analyzeCase(model, technology) {
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
    const augmentation = technology === "ess" && model.project.augmentation?.enabled ? augmentationProfile(model, calendar, capacityMW) : null;
    const depreciationTranches = buildDepreciationTranches(model, calendar, investment, augmentation?.events);
    const seniorAnnualRate = rate(model.finance.seniorRatePct);
    const seniorPayment = levelDebtService(
      investment.seniorPrincipal,
      seniorAnnualRate,
      model.finance.seniorTermYears - model.finance.seniorGraceYears
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
      const sales = salesForRow(model, technology, capacityMW, calendarRow, augmentation?.fractionByIndex[index] ?? void 0);
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
          tranche.end
        );
        return total + tranche.amount / model.assumptions.depreciationYears * days / calendarRow.daysInYear;
      }, 0);
      const taxableBeforeNol = calendarRow.operationSequence > 0 ? ebitda - depreciation - seniorInterest - bondInterest : 0;
      let nolUsed = 0;
      let taxableIncome = 0;
      let corporateTax = 0;
      if (calendarRow.operationSequence > 0) {
        const nolResult = useNol(
          taxableBeforeNol,
          nolLots,
          calendarRow.operationSequence,
          model.assumptions.nolCarryforwardYears
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
          ebitda - depreciation - seniorInterest - bondInterest - corporateTax
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
              disposition * rate(model.assumptions.legalReserveContributionPct)
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
      const projectFlowPreTax = -capitalDraw - augmentationDraw + ebitda + (calendarRow.isTerminalYear ? investment.debtServiceReserve : 0);
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
        equityFlowAfterInvestorTax
      });
    });
    const breakdown = capitalBreakdown(investment);
    const fundingBreakdown = [
      { id: "equity", label: "자기자본", value: investment.equityPrincipal },
      { id: "senior", label: "선순위대출", value: investment.seniorPrincipal },
      { id: "residentBond", label: "주민참여채권", value: investment.bondPrincipal }
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
      annualGenerationMWh: rows.find((row) => row.operationFraction === 1)?.generationMWh ?? rows.find((row) => row.operatingDays > 0)?.generationMWh ?? 0,
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
        actualConstructionInterest: investment.constructionInterest
      },
      investmentIterations: investment.convergence
    };
  }
  function sensitivityCases(model, technology) {
    const scenarios = [
      { label: "판매단가 -10%", key: "priceDown", mutate: (copy) => {
        ["smpPrice", "recPrice", "bidPrice", "dischargePrice", "capacityPrice"].forEach((key) => {
          copy.revenue[key] *= 0.9;
        });
      } },
      { label: "발전량 -10%", key: "yieldDown", mutate: (copy) => {
        if (technology === "ess") copy.revenue.cyclesPerYear *= 0.9;
        else copy.project.p75NetCapacityFactorPct *= 0.9;
      } },
      { label: "기준 시나리오", key: "base", mutate: () => {
      } },
      { label: "CAPEX +10%", key: "capexUp", mutate: (copy) => {
        copy.capex.items.forEach((item) => {
          item.value *= 1.1;
        });
      } },
      { label: "금리 +1.0%p", key: "rateUp", mutate: (copy) => {
        copy.finance.seniorRatePct += 1;
        copy.finance.constructionRatePct += 1;
      } }
    ];
    return scenarios.map((scenario) => {
      const copy = structuredClone(model);
      scenario.mutate(copy);
      const result = analyzeCase(copy, technology);
      return {
        label: scenario.label,
        key: scenario.key,
        projectIrr: result.errors.length === 0 ? result.projectIrr : Number.NaN
      };
    });
  }

  // js/form-view.js
  var SECTIONS = [
    { id: "project", label: "사업 개요", description: "설비 규모와 개발, 건설, 상업운전 일정을 정의합니다." },
    { id: "revenue", label: "발전·매출", description: "발전량 또는 ESS 운전량과 고정 판매가격 구조를 설정합니다." },
    { id: "capex", label: "CAPEX", description: "사업비를 범주별로 분류하고 건설비 물가와 예비비를 반영합니다." },
    { id: "opex", label: "OPEX", description: "고정·변동 운영비, 보험료, 주민기여와 물가상승을 반영합니다." },
    { id: "finance", label: "금융·세무", description: "자본구조와 부채 조건을 편집하고 예시 세무·배당 프리셋을 확인합니다." }
  ];
  var projectFields = [
    { path: "project.projectName", label: "사업명", type: "text", wide: true, hint: "내보내는 가정 파일에 포함되는 식별명입니다." },
    { path: "project.unitCapacityMW", label: "발전기·설비 1대 용량", unit: "MW", min: 0.1, step: 0.1, hint: "ESS는 PCS 기준 출력 용량입니다." },
    { path: "project.units", label: "설비 대수", unit: "대", min: 1, step: 1, hint: "총 설비용량은 1대 용량과 대수의 곱입니다." },
    { path: "project.baseYear", label: "기준연도", unit: "년", min: 1900, max: 2200, step: 1, hint: "비용과 가격 가정의 기준이 되는 달력연도입니다." },
    { path: "project.startYear", label: "사업 시작연도", unit: "년", min: 1900, max: 2200, step: 1, hint: "개발기간이 시작되는 달력연도입니다." },
    { path: "project.developmentYears", label: "개발기간", unit: "년", min: 0, max: 20, step: 1, hint: "인허가와 개발비가 집행되는 기간입니다." },
    { path: "project.constructionYears", label: "공사기간", unit: "년", min: 1, max: 10, step: 1, hint: "직접비는 개발·건설 집행곡선에 따라 배분됩니다." },
    { path: "project.codMonth", label: "상업운전 개시월", unit: "월", min: 1, max: 12, step: 1, hint: "1월부터 12월 사이의 정수이며 첫 운영연도는 실제 일수로 계산합니다." },
    { path: "project.operationYears", label: "운영기간", unit: "년", min: 1, max: 40, step: 1, hint: "상업운전 개시일부터 종료일까지의 전체 운영기간입니다." },
    { path: "project.p75NetCapacityFactorPct", label: "P75 순 이용률", unit: "%", min: 0.1, max: 100, step: 1e-4, hint: "이미 손실을 반영한 순 이용률입니다. 모델에서 손실을 다시 차감하지 않습니다." }
  ];
  var standardRevenueFields = [
    { path: "revenue.revenueMode", label: "판매가격 방식", type: "select", options: [{ value: "smpRec", label: "SMP + REC" }, { value: "fixed", label: "고정 입찰·PPA" }], hint: "시장가격 조합 또는 계약기간 고정가격을 선택합니다." },
    { path: "revenue.smpPrice", label: "SMP", unit: "원/kWh", min: 0, step: 1, mode: "smpRec", hint: "모델 전체 기간에 고정 적용하는 전력 판매 기준단가입니다." },
    { path: "revenue.recPrice", label: "REC", unit: "원/REC", min: 0, step: 1, mode: "smpRec", hint: "모델 전체 기간에 고정 적용하는 REC 단가입니다." },
    { path: "revenue.recWeight", label: "REC 가중치", unit: "배", min: 0, step: 0.1, mode: "smpRec", hint: "기술과 주민참여 조건에 따른 최종 가중치입니다." },
    { path: "revenue.bidPrice", label: "고정 입찰·PPA 단가", unit: "원/kWh", min: 0, step: 1, mode: "fixed", hint: "계약기간 전체에 고정 적용하는 판매단가입니다." }
  ];
  var essRevenueFields = [
    { path: "revenue.revenueMode", label: "수익 방식", type: "select", options: [{ value: "hybrid", label: "시장차익 + 용량요금" }, { value: "fixed", label: "고정 용량 입찰" }], hint: "고정 입찰은 충·방전 차익을 제외하고 용량요금만 반영합니다." },
    { path: "revenue.durationHours", label: "저장시간", unit: "시간", min: 0.5, max: 12, step: 0.5, hint: "정격 출력으로 방전 가능한 시간입니다." },
    { path: "revenue.cyclesPerYear", label: "연간 운전 사이클", unit: "회/년", min: 0, max: 730, step: 1, hint: "연간 충전과 방전 횟수 가정입니다." },
    { path: "revenue.roundTripEfficiencyPct", label: "왕복효율(설비+배터리)", unit: "%", min: 1, max: 100, step: 0.1, hint: "변압기(154TR·22.9TR)·PCS 충방전·케이블 손실과 배터리 DC 왕복효율을 곱한 충전 대비 방전 전력 비율입니다. 효성중공업 운전효율계산시트의 SDI·LGES·SKon 3사 제안값 평균을 기본값으로 사용합니다." },
    { path: "revenue.auxConsumptionPct", label: "소내소비율", unit: "%", min: 0, max: 50, step: 0.1, hint: "PCS 대기전력, 배터리 냉각·BMS, LPMS 등 소내소비 부하가 충전전력량에서 차지하는 비율입니다. 왕복효율 적용 후 방전량에서 추가로 차감하며, 두 값을 곱한 실효값이 시트의 “운전효율”입니다." },
    { path: "revenue.chargePrice", label: "충전 전력단가", unit: "원/kWh", min: 0, step: 1, mode: "hybrid", hint: "시장차익 계산에 고정 적용하는 전력 구매단가입니다." },
    { path: "revenue.dischargePrice", label: "방전 전력단가", unit: "원/kWh", min: 0, step: 1, mode: "hybrid", hint: "시장차익 계산에 고정 적용하는 전력 판매단가입니다." },
    { path: "revenue.capacityPrice", label: "용량·입찰 단가", unit: "원/kW·월", min: 0, step: 100, hint: "정격출력에 월 단가를 곱해 연간 수익을 계산합니다." }
  ];
  var degradationField = {
    path: "project.degradationPct",
    label: "연간 성능저하율",
    unit: "%/년",
    min: 0,
    max: 99,
    step: 0.1,
    hint: "태양광 발전량 또는 ESS 가용 운전량에 매년 적용합니다."
  };
  var essRampUpFields = Array.from({ length: 15 }, (_, index) => ({
    path: `revenue.rampUpFactors.${index}`,
    label: `${index + 1}년차 가동률 배수`,
    unit: "배",
    min: 0,
    max: 1.5,
    step: 0.01,
    hint: "연간 운전 사이클에 곱하는 해당 연차 배수입니다. 1배는 정상 가동률과 동일합니다."
  }));
  var essAugmentationFields = [
    { path: "project.augmentation.enabled", label: "배터리 증설(Augmentation) 적용", type: "boolean", hint: "정기적으로 배터리를 보강해 열화된 용량을 회복하는 운영기간 중 재투자를 반영합니다." },
    { path: "project.augmentation.intervalYears", label: "증설 주기", unit: "년", min: 1, max: 20, step: 1, hint: "몇 년마다 배터리를 증설할지 정합니다. 마지막 운영연도에는 증설하지 않습니다." },
    { path: "project.augmentation.capacityRestorePct", label: "용량 회복률", unit: "%", min: 0, max: 100, step: 1, hint: "증설 시점까지 열화된 용량 중 회복하는 비율입니다. 100%는 정격용량으로 완전 회복을 의미합니다." },
    { path: "project.augmentation.unitCostPerKWh", label: "증설 단가", unit: "원/kWh", min: 0, step: 1e3, hint: "회복하는 배터리 용량 1kWh당 증설 비용입니다." },
    { path: "project.augmentation.costEscalationPct", label: "증설 단가 상승률", unit: "%/년", min: 0, max: 15, step: 0.1, hint: "기준연도 이후 증설 시점까지 배터리 단가에 복리 적용하는 상승률입니다." }
  ];
  var essLtsaStepFields = [
    { path: "opex.ltsaStepAfterYear", label: "LTSA 단가 변경 시점", unit: "운영 연차 이후", min: 0, max: 40, step: 1, hint: "배터리·PCS LTSA 항목에만 적용합니다. 0은 변경 없음을 뜻하며, 3이면 4년차부터 변경 단가가 적용됩니다." },
    { path: "opex.ltsaStepMultiplierPct", label: "변경 후 단가 배율", unit: "%", min: 0, max: 500, step: 1, hint: "제조사 워런티 종료 후 등 LTSA 계약 단가가 바뀌는 배율입니다. 100%는 변경 없음을 뜻합니다." }
  ];
  var capexFields = [
    { path: "capex.constructionInflationPct", label: "건설비 물가상승률", unit: "%/년", min: 0, max: 30, step: 0.1, hint: "기준연도 이후의 개발·건설 집행액에 복리 적용합니다." },
    { path: "capex.contingencyPct", label: "예비비", unit: "세부 CAPEX %", min: 0, max: 30, step: 0.1, hint: "설계변경, 물량증가, 미확정 범위에 대한 버퍼입니다." }
  ];
  var opexFields = [
    { path: "opex.variableOMPerMWh", label: "변동 O&M", unit: "원/MWh", min: 0, step: 100, hint: "발전량 또는 ESS 방전량에 비례하는 비용입니다." },
    { path: "opex.insurancePct", label: "연간 운영보험료율", unit: "총투자비 %", min: 0, max: 5, step: 0.01, hint: "재물손해, 휴지, 배상책임 등 운영보험의 합산율입니다." },
    { path: "opex.communityRevenuePct", label: "주민·지역 기여", unit: "매출 %", min: 0, max: 10, step: 0.1, hint: "지역발전기금 또는 매출연동 상생비용입니다." },
    { path: "opex.escalationPct", label: "OPEX 물가상승률", unit: "%/년", min: 0, max: 15, step: 0.1, hint: "고정 운영비에 매년 복리 적용합니다." }
  ];
  var financeGroups = [
    { title: "자본구조", description: "자기자본, 선순위 대출, 주민참여채권과 회수 가능한 준비금을 정합니다.", fields: [
      { path: "finance.equityPct", label: "자기자본 비율", unit: "%", min: 0.1, max: 99.9, step: 0.1, hint: "나머지는 선순위 대출과 주민참여채권으로 조달합니다." },
      { path: "finance.residentBondPct", label: "주민참여채권 비율", unit: "총투자비 %", min: 0, max: 50, step: 0.1, hint: "총투자비 중 주민참여채권으로 조달하는 비율입니다." },
      { path: "finance.dsraMonths", label: "DSRA", unit: "예정 부채상환액 개월", min: 0, max: 24, step: 1, hint: "예정 부채상환액 기준의 회수 가능한 준비금이며 운영 종료 시 회수합니다." },
      { path: "finance.financeFeePct", label: "금융부대비용", unit: "타인자본 %", min: 0, max: 10, step: 0.1, hint: "주선, 약정, 법률, 실사, 발행 수수료를 포괄합니다." }
    ] },
    { title: "대출·채권 조건", description: "선순위는 거치 후 원리금균등 상환하고 주민참여채권은 만기일시상환합니다.", fields: [
      { path: "finance.seniorRatePct", label: "선순위 대출금리", unit: "%", min: 0, max: 30, step: 0.1, hint: "운영기간의 선순위 대출 이자율입니다." },
      { path: "finance.constructionRatePct", label: "건설기간 적용금리", unit: "%", min: 0, max: 30, step: 0.1, hint: "기초 잔액과 반기 신규 인출액에 건설이자를 계산합니다." },
      { path: "finance.seniorTermYears", label: "선순위 상환기간", unit: "년", min: 1, max: 40, step: 1, hint: "거치기간을 포함한 운영기준 만기입니다." },
      { path: "finance.seniorGraceYears", label: "원금 거치기간", unit: "년", min: 0, max: 10, step: 1, hint: "거치 종료 후 잔여기간에 원리금균등 상환합니다." },
      { path: "finance.bondRatePct", label: "주민참여채권 금리", unit: "%", min: 0, max: 30, step: 0.1, hint: "채권 보유자에게 지급하는 연간 이자율입니다." },
      { path: "finance.bondTermYears", label: "주민참여채권 만기", unit: "년", min: 1, max: 40, step: 1, hint: "원금은 명시한 만기에 일시 상환합니다." }
    ] }
  ];
  function node(tag, className, text) {
    const element2 = document.createElement(tag);
    if (className) element2.className = className;
    if (text !== void 0) element2.textContent = text;
    return element2;
  }
  function valueAt(model, path) {
    return path.split(".").reduce((value, key) => value[key], model);
  }
  function field(model, definition) {
    const wrapper = node("div", definition.wide ? "field field-wide" : "field");
    const id = `field-${definition.path.replaceAll(".", "-")}`;
    const label = node("label", "", definition.label);
    label.htmlFor = id;
    const inputWrap = node("div", "input-wrap");
    const isBoolean = definition.type === "boolean";
    const input = document.createElement(definition.type === "select" || isBoolean ? "select" : "input");
    input.id = id;
    input.dataset.path = definition.path;
    input.required = true;
    if (isBoolean) {
      input.dataset.boolean = "true";
      [{ value: "true", label: "적용" }, { value: "false", label: "미적용" }].forEach((option) => {
        const item = node("option", "", option.label);
        item.value = option.value;
        input.append(item);
      });
    } else if (definition.type === "select") {
      definition.options.forEach((option) => {
        const item = node("option", "", option.label);
        item.value = option.value;
        input.append(item);
      });
    } else {
      input.type = definition.type ?? "number";
      if (definition.min !== void 0) input.min = definition.min;
      if (definition.max !== void 0) input.max = definition.max;
      if (definition.step !== void 0) input.step = definition.step;
    }
    input.value = isBoolean ? String(valueAt(model, definition.path)) : valueAt(model, definition.path);
    inputWrap.append(input);
    if (definition.unit) inputWrap.append(node("span", "input-unit", definition.unit));
    const hint = node("p", "field-hint", definition.hint);
    hint.id = `${id}-hint`;
    input.setAttribute("aria-describedby", hint.id);
    wrapper.append(label, inputWrap, hint);
    return wrapper;
  }
  function group(model, title, description, definitions) {
    const container = node("section", "form-group");
    const header = node("div", "form-group-header");
    const copy = node("div");
    copy.append(node("h3", "", title), node("p", "", description));
    header.append(copy);
    const grid = node("div", "form-grid");
    definitions.forEach((definition) => grid.append(field(model, definition)));
    container.append(header, grid);
    return container;
  }
  function categorySelect(item, index, describedBy) {
    const select = document.createElement("select");
    select.className = "capex-category-select";
    select.dataset.costGroup = "capex";
    select.dataset.costIndex = index;
    select.dataset.costField = "category";
    select.required = true;
    select.setAttribute("aria-label", `${item.label} CAPEX 범주`);
    select.setAttribute("aria-describedby", describedBy);
    CAPEX_CATEGORIES.forEach(({ id, label }) => {
      const option = node("option", "", label);
      option.value = id;
      select.append(option);
    });
    select.value = item.category;
    return select;
  }
  function canRemoveCostItem(type, item) {
    return type !== "capex" || item?.userAdded === true;
  }
  function costGroup(model, type, title, description) {
    const container = node("section", `form-group cost-group cost-group-${type}`);
    container.dataset.costSection = type;
    const descriptionId = `${type}-cost-description`;
    const header = node("div", "form-group-header");
    const copy = node("div");
    const descriptionNode = node("p", "", description);
    descriptionNode.id = descriptionId;
    copy.append(node("h3", "", title), descriptionNode);
    const add = node("button", "button button-quiet", "항목 추가");
    add.type = "button";
    add.dataset.addCost = type;
    add.setAttribute("aria-label", `${title} 항목 추가`);
    add.setAttribute("aria-describedby", descriptionId);
    header.append(copy, add);
    const list = node("div", "cost-list");
    model[type].items.forEach((item, index) => {
      const row = node("div", `cost-row ${type === "capex" ? "capex-cost-row" : "opex-cost-row"}`);
      row.dataset.costRow = type;
      row.dataset.costIndex = index;
      row.dataset.costItemId = item.id;
      const removable = canRemoveCostItem(type, item);
      row.dataset.costRemovable = String(removable);
      const label = document.createElement("input");
      label.type = "text";
      label.value = item.label;
      label.dataset.costGroup = type;
      label.dataset.costIndex = index;
      label.dataset.costField = "label";
      label.required = true;
      label.setAttribute("aria-label", `${title} ${index + 1} 항목명`);
      label.setAttribute("aria-describedby", descriptionId);
      const valueWrap = node("div", "cost-value");
      const value = document.createElement("input");
      value.type = "number";
      value.min = "0";
      value.step = "any";
      value.value = item.value;
      value.dataset.costGroup = type;
      value.dataset.costIndex = index;
      value.dataset.costField = "value";
      value.required = true;
      value.setAttribute("aria-label", `${item.label} 금액`);
      value.setAttribute("aria-describedby", descriptionId);
      valueWrap.append(value, node("span", "", "억원"));
      const rowContent = type === "capex" ? [label, categorySelect(item, index, descriptionId), valueWrap] : [label, valueWrap];
      if (removable) {
        const remove = node("button", "remove-cost", "삭제");
        remove.type = "button";
        remove.dataset.removeCost = type;
        remove.dataset.costIndex = index;
        remove.setAttribute("aria-label", `${item.label} 항목 삭제`);
        remove.setAttribute("aria-describedby", descriptionId);
        rowContent.push(remove);
      }
      row.append(...rowContent);
      list.append(row);
    });
    const total = model[type].items.reduce((sum3, item) => sum3 + Number(item.value), 0);
    const totalRow = node("div", "cost-total");
    totalRow.append(node("span", "", "입력 항목 합계"), node("strong", "", `${total.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} 억원`));
    container.append(header, list, totalRow);
    return container;
  }
  function taxBracketsText(brackets) {
    let lower = 0;
    return brackets.map((bracket) => {
      const range = bracket.upTo === null ? `${lower}억원 초과` : lower === 0 ? `${bracket.upTo}억원 이하` : `${lower}억원 초과 ${bracket.upTo}억원 이하`;
      if (bracket.upTo !== null) lower = bracket.upTo;
      return `${range} ${bracket.ratePct}%`;
    }).join(", ");
  }
  function financePreset(model) {
    const panel = node("section", "form-group finance-preset-panel");
    panel.dataset.financePreset = "readonly";
    const titleId = "finance-preset-title";
    panel.setAttribute("aria-labelledby", titleId);
    const header = node("div", "form-group-header finance-preset-header");
    const copy = node("div");
    const title = node("h3", "", "읽기 전용 금융 프리셋");
    title.id = titleId;
    copy.append(title, node("p", "", "기술별 검증 프리셋이며 이 화면에서 편집하지 않는 계산 기준입니다."));
    header.append(copy, node("span", "finance-preset-status", "읽기 전용"));
    const values = [
      ["WACC·할인율", `${model.assumptions.waccPct}%`],
      ["역사적 누진세율", taxBracketsText(model.assumptions.taxBrackets)],
      ["정액 감가상각", `${model.assumptions.depreciationYears}년`],
      ["이월결손금", `${model.assumptions.nolCarryforwardYears}년`],
      ["연간 DSCR", `${model.assumptions.annualDscrThreshold}배`],
      ["누적 DSCR", `${model.assumptions.cumulativeDscrThreshold}배`],
      ["법정준비금 적립", `배당가능액의 ${model.assumptions.legalReserveContributionPct}%`],
      ["법정준비금 상한", `자기자본의 ${model.assumptions.legalReserveCapPctOfEquity}%`],
      ["투자자 배당세", `${model.assumptions.investorDividendTaxPct}%`],
      ["출처", model.metadata.source],
      ["한계", model.metadata.limitations]
    ];
    const list = node("dl", "finance-preset-list");
    values.forEach(([term, value]) => {
      const row = node("div", "finance-preset-row");
      row.append(node("dt", "", term), node("dd", "", value));
      list.append(row);
    });
    const warning = node("p", "finance-preset-warning", "세율 가정은 역사적 예시 입력이며 현행 세법을 반영하지 않습니다. 현재 세무자문이 아닙니다.");
    warning.setAttribute("role", "note");
    panel.append(header, list, warning);
    return panel;
  }
  function renderForm(target, model, technology, section2) {
    target.replaceChildren();
    if (section2 === "project") {
      const fields = technology === "ess" ? projectFields.slice(0, -1) : projectFields;
      target.append(group(model, "설비와 사업 일정", "기준연도부터 개발, 건설, 상업운전 종료까지의 달력을 설정합니다.", fields));
    }
    if (section2 === "revenue") {
      const definitions = technology === "ess" ? essRevenueFields : standardRevenueFields;
      const visible = definitions.filter((item) => !item.mode || item.mode === model.revenue.revenueMode);
      if (technology === "solar" || technology === "ess") visible.push(degradationField);
      target.append(group(model, technology === "ess" ? "운전과 수익" : "발전과 고정 판매가격", "판매단가는 모델 전체 기간에 고정되며 별도 상승률을 적용하지 않습니다.", visible));
      if (technology === "ess") {
        target.append(group(
          model,
          "가동률 램프업",
          "운영 15개 연차 전체에 대해 가동률 배수를 각각 지정합니다. 1배는 정상 가동률과 동일하며, 운영기간이 15년보다 짧으면 초과 연차의 값은 사용하지 않습니다.",
          essRampUpFields
        ));
        target.append(group(
          model,
          "배터리 증설(Augmentation)",
          "정기적으로 배터리를 보강해 열화된 용량을 회복하는 운영기간 중 재투자이며, 자기자본 배당 재원과 감가상각에 반영됩니다.",
          essAugmentationFields
        ));
      }
    }
    if (section2 === "capex") {
      target.append(
        costGroup(model, "capex", "범주별 사업비", "각 항목의 CAPEX 범주와 불변가격 기준 금액을 입력합니다."),
        group(model, "건설비 조정", "기준연도 이후 건설비와 미확정 공사범위를 반영합니다.", capexFields)
      );
    }
    if (section2 === "opex") {
      target.append(
        costGroup(model, "opex", "연간 고정 운영비", "운영 첫해 기준 고정비이며 CAPEX 범주를 사용하지 않습니다."),
        group(model, "변동·연동 운영비", "발전량, 총투자비 또는 매출에 연동되는 비용입니다.", opexFields)
      );
      if (technology === "ess") {
        target.append(group(
          model,
          "LTSA 단가 변경",
          "배터리·PCS LTSA 항목(위 고정 운영비의 “배터리·PCS LTSA”)에만 지정 연차 이후 새 단가를 적용합니다.",
          essLtsaStepFields
        ));
      }
    }
    if (section2 === "finance") {
      financeGroups.forEach((item) => target.append(group(model, item.title, item.description, item.fields)));
      target.append(financePreset(model));
    }
  }

  // js/results-view.js
  var CAPITAL_LINES = Object.freeze([
    { id: "equipment", label: "기자재비" },
    { id: "constructionCivil", label: "시공비-토목" },
    { id: "constructionElectrical", label: "시공비-전기" },
    { id: "constructionGrid", label: "시공비-선로·계통" },
    { id: "constructionInstallation", label: "시공비-운송·설치" },
    { id: "indirect", label: "간접비" },
    { id: "land", label: "토지비용" },
    { id: "contingency", label: "예비비" },
    { id: "constructionInterest", label: "건설이자" },
    { id: "financeFee", label: "금융부대비용" },
    { id: "debtServiceReserve", label: "DSRA" }
  ]);
  var FUNDING_LINES = Object.freeze([
    { id: "equity", label: "자기자본", fallback: "equityPrincipal" },
    { id: "senior", label: "선순위대출", fallback: "seniorPrincipal" },
    { id: "residentBond", label: "주민참여채권", fallback: "bondPrincipal" }
  ]);
  var SENSITIVITY_LABELS = Object.freeze({
    priceDown: "판매단가 -10%",
    yieldDown: "발전량 -10%",
    base: "기준 시나리오",
    capexUp: "CAPEX +10%",
    rateUp: "금리 +1.0%p"
  });
  var CASH_FLOW_HEADERS = Object.freeze([
    "달력연도",
    "단계",
    "운영비율·일수",
    "발전·방전량(MWh)",
    "매출(억원)",
    "OPEX(억원)",
    "법인세(억원)",
    "이자(억원)",
    "원금(억원)",
    "연간 DSCR",
    "누적 DSCR",
    "배당(억원)",
    "프로젝트 CF(억원)",
    "자기자본 CF(억원)"
  ]);
  var RECONCILIATION_TOLERANCE = 1e-6;
  function element(tagName, className, text) {
    const node2 = document.createElement(tagName);
    if (className) node2.className = className;
    if (text !== void 0) node2.textContent = text;
    return node2;
  }
  function numeric(value, digits = 1) {
    return Number.isFinite(value) ? value.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "N/A";
  }
  function percent(value, digits = 2) {
    return Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "N/A";
  }
  function money(value, digits = 1) {
    return Number.isFinite(value) ? `${numeric(value, digits)} 억⁠원` : "N/A";
  }
  function ratio(value) {
    return Number.isFinite(value) ? `${value.toFixed(2)}x` : "N/A";
  }
  function metric(label, value, description, tier = "", compact = false) {
    const tierClass = tier ? ` metric-${tier}` : "";
    const article = element("article", `metric${tierClass}`);
    article.append(element("span", "metric-label", label));
    const valueNode = element("strong", `metric-value${compact ? " metric-value--compact" : ""}`, value);
    article.append(valueNode);
    article.append(element("small", "metric-description", description));
    return article;
  }
  function annualizedRow(result) {
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    return rows.find((row) => Number.isFinite(row?.operationFraction) && row.operationFraction > 0 && Number.isFinite(row?.generationMWh) && Number.isFinite(row?.revenue));
  }
  function effectiveUnitPrice(result) {
    const row = annualizedRow(result);
    if (!row || !(row.generationMWh > 0)) return null;
    const annualGenerationMWh = row.generationMWh / row.operationFraction;
    const annualRevenue = row.revenue / row.operationFraction;
    if (!(annualGenerationMWh > 0) || !Number.isFinite(annualRevenue)) return null;
    return annualRevenue * 1e5 / annualGenerationMWh;
  }
  function appendPriceRange(parent, result) {
    const priceSection = section("판매단가 범위", "price-range-title");
    const highPrice = effectiveUnitPrice(result);
    if (!Number.isFinite(highPrice) || highPrice <= 0) {
      priceSection.append(emptyState(
        "단가 범위 산출 불가",
        "첫 운영연도 매출·발전량을 확인할 수 없어 최저·최고단가를 표시할 수 없습니다."
      ));
      parent.append(priceSection);
      return;
    }
    const lowPrice = highPrice * 0.9;
    const wrap = element("div", "price-range");
    wrap.append(element(
      "p",
      "price-range-caption",
      "실효 판매단가는 첫 운영연도 매출을 발전·방전량으로 환산한 값이며, 최저단가는 「판매단가 -10%」 민감도 시나리오를 반영합니다."
    ));
    const track = element("div", "price-range-track");
    track.append(element("div", "price-range-fill"));
    wrap.append(track);
    const labels = element("div", "price-range-labels");
    const lowPoint = element("div", "price-range-point price-range-point--low");
    lowPoint.append(element("span", "", "최저단가"));
    lowPoint.append(element("strong", "", `${numeric(lowPrice, 1)} 원/kWh`));
    lowPoint.append(element("small", "", "판매단가 -10% 시나리오"));
    const highPoint = element("div", "price-range-point price-range-point--high");
    highPoint.append(element("span", "", "최고단가"));
    highPoint.append(element("strong", "", `${numeric(highPrice, 1)} 원/kWh`));
    highPoint.append(element("small", "", "기준 시나리오"));
    labels.append(lowPoint, highPoint);
    wrap.append(labels);
    priceSection.append(wrap);
    parent.append(priceSection);
  }
  function emptyState(title, detail) {
    const state = element("div", "empty-state");
    if (title) state.append(element("strong", "", title));
    if (detail) state.append(element("p", "", detail));
    return state;
  }
  function resultErrors(result) {
    return Array.isArray(result?.errors) ? result.errors.map((error) => String(error)) : [];
  }
  function section(title, id) {
    const container = element("section", "result-section");
    const heading = element("h3", "", title);
    heading.id = id;
    container.setAttribute("aria-labelledby", id);
    container.append(heading);
    return container;
  }
  function amountRow(label, value, className = "funding-row", digits = 1) {
    const row = element("div", className);
    row.append(element("span", "", label));
    row.append(element("strong", "", money(value, digits)));
    return row;
  }
  function completeSum(values) {
    return values.every(Number.isFinite) ? values.reduce((total, value) => total + value, 0) : null;
  }
  function reconciliationRow(label, difference) {
    const isError = Number.isFinite(difference) && Math.abs(difference) > RECONCILIATION_TOLERANCE;
    const digits = isError && Math.abs(difference) < 0.05 ? 6 : 1;
    const row = amountRow(
      `${isError ? "오류: " : ""}${label}`,
      difference,
      `funding-row reconciliation-row${isError ? " reconciliation-error" : ""}`,
      digits
    );
    if (isError) {
      row.setAttribute("role", "alert");
      row.setAttribute("aria-label", `${label}가 허용오차를 초과했습니다. ${money(difference, digits)}`);
    }
    return row;
  }
  function appendCapitalBreakdown(parent, result) {
    const capitalSection = section("총사업비 11개 명세", "capital-breakdown-title");
    const list = element("div", "funding-list capital-breakdown-list");
    const actualRows = Array.isArray(result.capitalBreakdown) ? result.capitalBreakdown : [];
    const valuesById = new Map(actualRows.map((row) => [row?.id, row?.value]));
    const values = CAPITAL_LINES.map(({ id, label }) => {
      const value = valuesById.get(id);
      const row = amountRow(label, value, "funding-row capital-breakdown-row");
      row.setAttribute("data-capital-id", id);
      list.append(row);
      return value;
    });
    const capitalTotal = completeSum(values);
    const investmentTotal = result.totalInvestment;
    list.append(amountRow("총사업비 합계", capitalTotal, "funding-row reconciliation-row"));
    list.append(amountRow("엔진 총투자비", investmentTotal, "funding-row reconciliation-row"));
    const difference = Number.isFinite(capitalTotal) && Number.isFinite(investmentTotal) ? capitalTotal - investmentTotal : null;
    list.append(reconciliationRow("사업비 조정차이", difference));
    capitalSection.append(list);
    if (!Number.isFinite(capitalTotal)) {
      capitalSection.append(element(
        "p",
        "model-note unavailable-note",
        "일부 총사업비 항목이 없어 총사업비 합계와 조정차이는 N/A입니다."
      ));
    } else if (Number.isFinite(difference) && Math.abs(difference) > RECONCILIATION_TOLERANCE) {
      capitalSection.append(element(
        "p",
        "model-note reconciliation-error-note",
        "총사업비 명세와 엔진 총투자비가 일치하지 않습니다. 가정과 계산 상태를 확인해 주세요."
      ));
    }
    capitalSection.append(element(
      "p",
      "model-note capital-reserve-note",
      "DSRA는 대출상환을 위해 예치했다가 종료 시 회수하는 준비금이며, 소비되는 공사비나 OPEX가 아닙니다."
    ));
    parent.append(capitalSection);
  }
  function appendFundingBreakdown(parent, result) {
    const fundingSection = section("조달 구조와 총투자비 조정", "funding-reconciliation-title");
    const list = element("div", "funding-list funding-reconciliation-list");
    const actualRows = Array.isArray(result.fundingBreakdown) ? result.fundingBreakdown : [];
    const valuesById = new Map(actualRows.map((row) => [row?.id, row?.value]));
    const values = FUNDING_LINES.map(({ id, label, fallback }) => {
      const mapped = valuesById.get(id);
      const value = Number.isFinite(mapped) ? mapped : result[fallback];
      const row = amountRow(label, value);
      row.setAttribute("data-funding-id", id);
      list.append(row);
      return value;
    });
    const fundingTotal = completeSum(values);
    list.append(amountRow("조달 합계", fundingTotal, "funding-row reconciliation-row"));
    list.append(amountRow("총투자비", result.totalInvestment, "funding-row reconciliation-row"));
    const difference = Number.isFinite(fundingTotal) && Number.isFinite(result.totalInvestment) ? fundingTotal - result.totalInvestment : null;
    list.append(reconciliationRow("조달 조정차이", difference));
    fundingSection.append(list);
    if (!Number.isFinite(fundingTotal)) {
      fundingSection.append(element(
        "p",
        "model-note unavailable-note",
        "일부 조달 항목이 없어 조달 합계와 조정차이는 N/A입니다."
      ));
    } else if (Number.isFinite(difference) && Math.abs(difference) > RECONCILIATION_TOLERANCE) {
      fundingSection.append(element(
        "p",
        "model-note reconciliation-error-note",
        "조달 합계와 총투자비가 일치하지 않습니다. 자본구조와 계산 상태를 확인해 주세요."
      ));
    }
    parent.append(fundingSection);
  }
  function appendSensitivities(parent, result, sensitivities) {
    const sensitivitySection = section("P-IRR 민감도", "sensitivity-title");
    const list = element("div", "sensitivity-list");
    const scenarios = Array.isArray(sensitivities) ? sensitivities : [];
    const baselineValue = percent(result.projectIrr);
    const baselineMarker = element(
      "div",
      "sensitivity-baseline-marker",
      `가운데 기준선 · 기준 P-IRR ${baselineValue}`
    );
    baselineMarker.setAttribute("data-baseline-position", "center");
    baselineMarker.setAttribute("role", "note");
    baselineMarker.setAttribute(
      "aria-label",
      `기준 시나리오의 가운데 기준선: 기준 P-IRR ${baselineValue}`
    );
    list.append(baselineMarker);
    if (scenarios.length === 0) {
      list.append(emptyState("민감도 산출 불가", "유효한 기준 시나리오를 확인해 주세요."));
    }
    let hasUnavailableScenario = !Number.isFinite(result.projectIrr);
    scenarios.forEach((scenario) => {
      const key = typeof scenario?.key === "string" ? scenario.key : "unknown";
      const value = key === "base" ? result.projectIrr : scenario?.projectIrr;
      const difference = Number.isFinite(value) && Number.isFinite(result.projectIrr) ? (value - result.projectIrr) * 100 : null;
      const unavailable = !Number.isFinite(value);
      if (unavailable) hasUnavailableScenario = true;
      const comparison = unavailable ? "비교 N/A" : key === "base" ? "기준" : Number.isFinite(difference) ? `기준 대비 ${difference >= 0 ? "+" : ""}${difference.toFixed(2)}%p` : "기준 N/A";
      const row = element("div", "sensitivity-row");
      row.setAttribute("data-sensitivity-key", key);
      row.append(element("span", "sensitivity-label", SENSITIVITY_LABELS[key] ?? "추가 시나리오"));
      row.append(element("span", "sensitivity-value", percent(value)));
      row.append(element("span", "sensitivity-comparison", comparison));
      list.append(row);
    });
    if (hasUnavailableScenario) {
      list.append(element(
        "p",
        "sensitivity-reason",
        "N/A 사유: 수익률 부호 전환이 없거나 시나리오 계산이 완료되지 않았습니다."
      ));
    }
    sensitivitySection.append(list);
    parent.append(sensitivitySection);
  }
  function appendAugmentationSchedule(parent, result) {
    const events = Array.isArray(result.augmentationEvents) ? result.augmentationEvents : [];
    if (events.length === 0) return;
    const augmentationSection = section("배터리 증설(Augmentation) 내역", "augmentation-title");
    const list = element("div", "funding-list augmentation-list");
    events.forEach((event) => {
      const row = element("div", "funding-row augmentation-row");
      row.append(element("span", "", `${event.calendarYear}년 · 운영 ${event.operationSequence}년차`));
      row.append(element("strong", "", money(event.drawAmount)));
      list.append(row);
    });
    const total = sum2(events.map((event) => event.drawAmount));
    list.append(amountRow("증설 CAPEX 합계", total, "funding-row reconciliation-row"));
    augmentationSection.append(list);
    augmentationSection.append(element(
      "p",
      "model-note",
      "증설 CAPEX는 총사업비 11개 명세에 포함되지 않는 운영기간 중 재투자이며, 해당 연도의 배당가능현금을 우선 사용하고 부족하면 자기자본을 추가로 투입합니다."
    ));
    parent.append(augmentationSection);
  }
  function sum2(values) {
    return values.reduce((total, value) => total + value, 0);
  }
  function renderResults(target, result, sensitivities, model) {
    const errors = resultErrors(result);
    if (errors.length > 0) {
      target.replaceChildren(emptyState("가정을 확인해 주세요.", errors.join(" ")));
      return;
    }
    const metrics = element("div", "metric-grid");
    metrics.append(metric(
      "P-IRR",
      percent(result?.projectIrr),
      Number.isFinite(result?.projectIrr) ? "법인세 후 프로젝트 CF 기준" : "수익률 부호 전환이 없습니다.",
      "primary"
    ));
    metrics.append(metric(
      "E-IRR (투자자 배당세 전)",
      percent(result?.equityIrr),
      Number.isFinite(result?.equityIrr) ? "법인세 후 출자·배당 CF, 투자자 배당세 전 기준" : "수익률 부호 전환이 없습니다.",
      "highlight"
    ));
    metrics.append(metric(
      "투자자 세후 E-IRR",
      percent(result?.equityIrrAfterInvestorTax),
      Number.isFinite(result?.equityIrrAfterInvestorTax) ? "투자자 배당세 차감 후 자기자본 CF 기준" : "수익률 부호 전환이 없습니다.",
      "highlight"
    ));
    const wacc = model?.assumptions?.waccPct;
    metrics.append(metric(
      "NPV",
      money(result?.projectNpv),
      Number.isFinite(result?.projectNpv) && Number.isFinite(wacc) ? `WACC ${numeric(wacc, 3)}% 읽기 전용 프리셋 기준` : "현금흐름 또는 WACC가 유효하지 않아 산출할 수 없습니다.",
      "highlight",
      true
    ));
    const payback = result?.projectPayback;
    const paybackValue = Number.isFinite(payback) ? `${numeric(payback)}년` : payback === null ? "기⁠간 내 미⁠회⁠수" : "N/A";
    metrics.append(metric(
      "P-PBP",
      paybackValue,
      payback !== null && !Number.isFinite(payback) ? "프로젝트 CF 누적 경로를 확인할 수 없습니다." : "누적 법인세 후 프로젝트 CF가 0 이상이 되는 시점",
      "",
      !Number.isFinite(payback)
    ));
    const firstOperatingRow = Array.isArray(result?.rows) ? result.rows.find((row) => Number.isFinite(row?.operationFraction) && row.operationFraction > 0 && Number.isFinite(row?.generationMWh)) : null;
    const generation = firstOperatingRow ? firstOperatingRow.generationMWh / firstOperatingRow.operationFraction : result?.annualGenerationMWh;
    metrics.append(metric(
      "연간 발전·방전량",
      Number.isFinite(generation) ? `${numeric(generation / 1e3)} GWh` : "N/A",
      Number.isFinite(generation) ? "첫 운영연도 실적을 1년으로 환산한 발전량 또는 ESS 방전량" : "운영연도 발전·방전량을 확인할 수 없습니다."
    ));
    const content = document.createElement("div");
    content.append(metrics);
    appendPriceRange(content, result ?? {});
    appendCapitalBreakdown(content, result ?? {});
    appendFundingBreakdown(content, result ?? {});
    appendAugmentationSchedule(content, result ?? {});
    appendSensitivities(content, result ?? {}, sensitivities);
    content.append(element(
      "p",
      "model-note",
      "본 결과는 실제 달력의 개발·건설·부분 운영연도, 법인세, 이자·원금, 배당 제한과 회수 가능한 준비금을 반영한 사전검토 값입니다."
    ));
    target.replaceChildren(content);
  }
  function dividendState(row, assumptions) {
    if (!(row?.operationSequence > 0) || row?.dividend !== 0) return "";
    if (Number.isFinite(row?.legalReserveContribution) && row.legalReserveContribution > 0 && Number.isFinite(row?.distributableProfit) && row.distributableProfit > 0) {
      return "배당 유보: 법정준비금 적립 기준";
    }
    if (!(row?.distributableProfit > 0)) return "배당 없음: 배당가능이익 없음";
    const availableCash = Number.isFinite(row?.retainedCash) ? row.retainedCash : 0;
    const terminalCash = Number.isFinite(row?.terminalRetainedCashRecovery) ? row.terminalRetainedCashRecovery : 0;
    if (!(availableCash + terminalCash > 0)) return "배당 없음: 가용현금 없음";
    const failed = [];
    if (Number.isFinite(row?.dscr) && Number.isFinite(assumptions?.annualDscrThreshold) && row.dscr < assumptions.annualDscrThreshold) {
      failed.push(`연간 DSCR 기준 미충족(${ratioComparison(row.dscr, assumptions.annualDscrThreshold)})`);
    }
    if (Number.isFinite(row?.cumulativeDscr) && Number.isFinite(assumptions?.cumulativeDscrThreshold) && row.cumulativeDscr < assumptions.cumulativeDscrThreshold) {
      failed.push(`누적 DSCR 기준 미충족(${ratioComparison(row.cumulativeDscr, assumptions.cumulativeDscrThreshold)})`);
    }
    return failed.length > 0 ? `배당 유보: ${failed.join(", ")}` : "배당 없음: 배당 제한 사유 N/A";
  }
  function ratioComparison(value, threshold) {
    const maximumDigits = 16;
    let digits = 2;
    while (digits < maximumDigits && value.toFixed(digits) === threshold.toFixed(digits)) digits += 1;
    return `${value.toFixed(digits)}x < ${threshold.toFixed(digits)}x`;
  }
  function phaseText(row, assumptions) {
    const labels = { development: "개발", construction: "건설", operation: "운영" };
    const rawPhase = typeof row?.phase === "string" ? row.phase : "";
    let text = rawPhase ? rawPhase.split("+").map((phase) => labels[phase] ?? phase).join(" + ") : "N/A";
    if (Number.isFinite(row?.operatingDays) && Number.isFinite(row?.daysInYear) && row.operatingDays > 0 && row.operatingDays < row.daysInYear) {
      text += ` · 부분연도 ${row.operatingDays}/${row.daysInYear}일`;
    }
    if (Number.isFinite(row?.seniorBalloon) && row.seniorBalloon > 0) {
      text += ` · 선순위 잔존원금 만기상환 ${money(row.seniorBalloon)}`;
    }
    if (Number.isFinite(row?.bondBalloon) && row.bondBalloon > 0) {
      text += ` · 주민참여채권 잔존원금 만기상환 ${money(row.bondBalloon)}`;
    } else if (Number.isFinite(row?.bondPrincipal) && row.bondPrincipal > 0) {
      text += ` · 주민참여채권 만기 일시상환 ${money(row.bondPrincipal)}`;
    }
    if (Number.isFinite(row?.augmentationDraw) && row.augmentationDraw > 0) {
      text += ` · 배터리 증설 CAPEX ${money(row.augmentationDraw)}`;
    }
    const dividend = dividendState(row, assumptions);
    if (dividend) text += ` · ${dividend}`;
    return text;
  }
  function operationPeriod(row) {
    if (!Number.isFinite(row?.operationFraction)) return "N/A";
    const fraction = percent(row.operationFraction, 1);
    return Number.isFinite(row.operatingDays) && Number.isFinite(row.daysInYear) ? `${fraction} (${row.operatingDays}/${row.daysInYear}일)` : fraction;
  }
  function sumRowFields(row, fields) {
    const values = fields.map((field2) => row?.[field2]);
    return values.every(Number.isFinite) ? values.reduce((total, value) => total + value, 0) : null;
  }
  function rowValues(row, assumptions) {
    const tax = Number.isFinite(row?.corporateTax) ? row.corporateTax : row?.projectTax;
    return [
      phaseText(row, assumptions),
      operationPeriod(row),
      numeric(row?.generationMWh),
      numeric(row?.revenue),
      numeric(row?.opex),
      numeric(tax),
      numeric(sumRowFields(row, ["constructionInterest", "seniorInterest", "bondInterest"])),
      numeric(sumRowFields(row, ["seniorPrincipal", "bondPrincipal"])),
      ratio(row?.dscr),
      ratio(row?.cumulativeDscr),
      numeric(row?.dividend),
      numeric(row?.projectFlow),
      numeric(row?.equityFlow)
    ];
  }
  function renderCashFlow(target, result, model) {
    const errors = resultErrors(result);
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    if (errors.length > 0 || rows.length === 0) {
      const detail = errors.length > 0 ? errors.join(" ") : "계산 가능한 전체기간 행이 없습니다.";
      target.replaceChildren(emptyState("유효한 가정을 입력하면 현금흐름이 표시됩니다.", detail));
      return;
    }
    const wrapper = element("div", "table-wrap cashflow-scroll-region");
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", "개발·건설·운영 전체기간 현금흐름 표, 좌우로 스크롤 가능");
    wrapper.addEventListener("focus", (event) => {
      const region = event.currentTarget;
      setTimeout(() => {
        region.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" });
      }, 0);
    });
    const table = element("table", "cashflow-table");
    table.append(element(
      "caption",
      "cashflow-caption",
      "전체 사업 달력 현금흐름 · 좌우 스크롤로 열 확인"
    ));
    const key = element(
      "p",
      "cashflow-key",
      "DSCR은 부채상환계수이며, N/A는 해당 단계에서 값이 의미 없거나 산출할 수 없음을 뜻합니다."
    );
    key.id = "cashflow-key";
    table.setAttribute("aria-describedby", key.id);
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    CASH_FLOW_HEADERS.forEach((label) => {
      const header = element("th", "", label);
      header.setAttribute("scope", "col");
      headerRow.append(header);
    });
    head.append(headerRow);
    const body = document.createElement("tbody");
    rows.forEach((row) => {
      const tableRow = document.createElement("tr");
      const year = Number.isFinite(row?.calendarYear) ? row.calendarYear : row?.year;
      const yearHeader = element("th", "cashflow-year", Number.isFinite(year) ? `${year}년` : "N/A");
      yearHeader.setAttribute("scope", "row");
      tableRow.append(yearHeader);
      rowValues(row, model?.assumptions).forEach((value, index) => {
        const className = index === 0 ? "cashflow-phase cashflow-state-text" : "";
        tableRow.append(element("td", className, value));
      });
      body.append(tableRow);
    });
    table.append(head, body);
    wrapper.append(key, table);
    target.replaceChildren(wrapper);
  }

  // js/app.js
  var technologySwitch = document.querySelector("#technology-switch");
  var sectionNavigation = document.querySelector("#section-navigation");
  var form = document.querySelector("#model-form");
  var resultsContent = document.querySelector("#results-content");
  var cashflowContent = document.querySelector("#cashflow-content");
  var errorSummary = document.querySelector("#error-summary");
  var status = document.querySelector("#model-status");
  var cases = /* @__PURE__ */ new Map();
  var currentTechnology = "onshore";
  var currentSection = "project";
  var calculationTimer = 0;
  var customItemSequence = 0;
  var currentErrors = [];
  var nativeInvalidFields = /* @__PURE__ */ new Map();
  var NATIVE_VALIDITY_ERROR = "입력 형식과 허용 단위를 확인해 주세요.";
  var LOADING_METRICS = Object.freeze([
    { label: "P-IRR", primary: true },
    { label: "E-IRR (투자자 배당세 전)" },
    { label: "투자자 세후 E-IRR" },
    { label: "NPV", compact: true },
    { label: "P-PBP" },
    { label: "연간 발전·방전량" }
  ]);
  var LOADING_CASH_FLOW_HEADERS = Object.freeze([
    "달력연도",
    "단계",
    "운영비율·일수",
    "발전·방전량(MWh)",
    "매출(억원)",
    "OPEX(억원)",
    "법인세(억원)",
    "이자(억원)",
    "원금(억원)",
    "연간 DSCR",
    "누적 DSCR",
    "배당(억원)",
    "프로젝트 CF(억원)",
    "자기자본 CF(억원)"
  ]);
  function loadingNode(tagName, className, text) {
    const element2 = document.createElement(tagName);
    if (className) element2.className = className;
    if (text !== void 0) element2.textContent = text;
    return element2;
  }
  function renderCalculationLoading() {
    const resultsState = document.createElement("div");
    resultsState.dataset.calculationState = "loading";
    const metrics = loadingNode("div", "metric-grid");
    LOADING_METRICS.forEach(({ label, primary = false, compact = false }) => {
      const metric2 = loadingNode("article", `metric${primary ? " metric-primary" : ""}`);
      metric2.append(loadingNode("span", "metric-label", label));
      metric2.append(loadingNode("strong", `metric-value${compact ? " metric-value--compact" : ""}`, "계산 중"));
      metric2.append(loadingNode("small", "metric-description", "새 입력값을 반영하고 있습니다."));
      metrics.append(metric2);
    });
    resultsState.append(metrics);
    resultsContent.replaceChildren(resultsState);
    const wrapper = loadingNode("div", "table-wrap cashflow-scroll-region");
    wrapper.dataset.calculationState = "loading";
    wrapper.setAttribute("role", "region");
    const table = loadingNode("table", "cashflow-table");
    table.append(loadingNode(
      "caption",
      "cashflow-caption",
      "전체 사업 달력 현금흐름. 새 입력값을 반영하고 있습니다."
    ));
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    LOADING_CASH_FLOW_HEADERS.forEach((label) => {
      const header = loadingNode("th", "", label);
      header.setAttribute("scope", "col");
      headerRow.append(header);
    });
    head.append(headerRow);
    const body = document.createElement("tbody");
    const placeholderRow = document.createElement("tr");
    const year = loadingNode("th", "cashflow-year", "계산 중");
    year.setAttribute("scope", "row");
    placeholderRow.append(year);
    LOADING_CASH_FLOW_HEADERS.slice(1).forEach((_, index) => {
      placeholderRow.append(loadingNode(
        "td",
        index === 0 ? "cashflow-phase cashflow-state-text" : "",
        index === 0 ? "새 입력값 반영 중" : "—"
      ));
    });
    body.append(placeholderRow);
    table.append(head, body);
    wrapper.append(table);
    cashflowContent.replaceChildren(wrapper);
    const overflows = wrapper.scrollWidth > wrapper.clientWidth;
    wrapper.tabIndex = overflows ? 0 : -1;
    wrapper.setAttribute(
      "aria-label",
      `계산 중인 개발·건설·운영 전체기간 현금흐름 표${overflows ? ", 좌우로 스크롤 가능" : ""}`
    );
  }
  function currentModel() {
    if (!cases.has(currentTechnology)) cases.set(currentTechnology, createCase(currentTechnology));
    return cases.get(currentTechnology);
  }
  function buildTechnologySwitch() {
    technologySwitch.replaceChildren();
    Object.entries(TECHNOLOGIES).forEach(([key, technology]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "technology-button";
      button.dataset.technology = key;
      button.setAttribute("aria-pressed", String(key === currentTechnology));
      button.setAttribute("aria-label", `${technology.label} 사업으로 전환`);
      button.setAttribute("aria-describedby", "technology-title");
      const name = document.createElement("strong");
      name.textContent = technology.label;
      const code = document.createElement("small");
      code.textContent = technology.code;
      button.append(name, code);
      technologySwitch.append(button);
    });
  }
  function buildSectionNavigation() {
    sectionNavigation.replaceChildren();
    SECTIONS.forEach((section2, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "section-button";
      button.dataset.section = section2.id;
      button.setAttribute("aria-label", `${section2.label} 입력 단계 열기. ${section2.description}`);
      if (section2.id === currentSection) button.setAttribute("aria-current", "step");
      const number = document.createElement("span");
      number.className = "step-number";
      number.textContent = String(index + 1).padStart(2, "0");
      const label = document.createElement("span");
      label.textContent = section2.label;
      button.append(number, label);
      sectionNavigation.append(button);
    });
  }
  function updateCapacitySummary(model) {
    const capacity = model.project.unitCapacityMW * model.project.units;
    document.querySelector("#capacity-summary").textContent = Number.isFinite(capacity) ? `${capacity.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} MW` : "N/A";
  }
  function renderSection() {
    const model = currentModel();
    const meta = SECTIONS.find((section2) => section2.id === currentSection) ?? SECTIONS[0];
    document.querySelector("#section-index").textContent = `Step ${String(SECTIONS.indexOf(meta) + 1).padStart(2, "0")}`;
    document.querySelector("#section-title").textContent = meta.label;
    document.querySelector("#section-description").textContent = meta.description;
    updateCapacitySummary(model);
    renderForm(form, model, currentTechnology, currentSection);
    if (currentErrors.length > 0) applyModelErrors(currentErrors);
    buildSectionNavigation();
  }
  function nativeValidityKey(input, model = currentModel()) {
    if (input.dataset.path) return `path:${input.dataset.path}`;
    if (!input.dataset.costGroup || !input.dataset.costField) return null;
    const item = model[input.dataset.costGroup]?.items[Number(input.dataset.costIndex)];
    return item ? `cost:${input.dataset.costGroup}:${item.id}:${input.dataset.costField}` : null;
  }
  function rememberNativeValidity(input) {
    const key = nativeValidityKey(input);
    if (!key) return !input.checkValidity();
    const invalid = input.type === "number" && input.value.trim() === "" || !input.checkValidity();
    const invalidFields = nativeInvalidFields.get(currentTechnology) ?? /* @__PURE__ */ new Set();
    if (invalid) invalidFields.add(key);
    else invalidFields.delete(key);
    if (invalidFields.size > 0) nativeInvalidFields.set(currentTechnology, invalidFields);
    else nativeInvalidFields.delete(currentTechnology);
    return invalid;
  }
  function forgetCostItemValidity(type, itemId) {
    const invalidFields = nativeInvalidFields.get(currentTechnology);
    if (!invalidFields) return;
    const prefix = `cost:${type}:${itemId}:`;
    [...invalidFields].forEach((key) => {
      if (key.startsWith(prefix)) invalidFields.delete(key);
    });
    if (invalidFields.size === 0) nativeInvalidFields.delete(currentTechnology);
  }
  function calculate() {
    calculationTimer = 0;
    const model = currentModel();
    const analysis = analyzeCase(model, currentTechnology);
    const hasNativeValidityError = !form.checkValidity() || (nativeInvalidFields.get(currentTechnology)?.size ?? 0) > 0;
    const errors = hasNativeValidityError ? [...analysis.errors, NATIVE_VALIDITY_ERROR] : analysis.errors;
    const result = errors === analysis.errors ? analysis : { ...analysis, errors };
    currentErrors = errors;
    const sensitivities = errors.length === 0 ? sensitivityCases(model, currentTechnology) : [];
    errorSummary.hidden = errors.length === 0;
    errorSummary.textContent = errors.join(" ");
    status.textContent = errors.length === 0 ? "계산 완료" : "입력 확인";
    resultsContent.setAttribute("aria-busy", "false");
    cashflowContent.setAttribute("aria-busy", "false");
    applyModelErrors(errors);
    renderResults(resultsContent, result, sensitivities, model);
    renderCashFlow(cashflowContent, result, model);
  }
  function applyModelErrors(errors) {
    const marked = /* @__PURE__ */ new Set();
    const mark = (selector, predicate = () => true) => {
      form.querySelectorAll(selector).forEach((control) => {
        if (predicate(control)) marked.add(control);
      });
    };
    const messages = errors.join(" ");
    if (messages.includes("기준연도와 시작연도")) mark("[data-path='project.baseYear'], [data-path='project.startYear']");
    if (messages.includes("사업 종료연도")) mark("[data-path='project.startYear'], [data-path='project.developmentYears'], [data-path='project.constructionYears'], [data-path='project.operationYears']");
    if (messages.includes("개발·공사·운영기간")) mark("[data-path='project.developmentYears'], [data-path='project.constructionYears'], [data-path='project.operationYears']");
    if (messages.includes("COD 월")) mark("[data-path='project.codMonth']");
    if (messages.includes("P75 순 이용률")) mark("[data-path='project.p75NetCapacityFactorPct']");
    if (messages.includes("열화율")) mark("[data-path='project.degradationPct']");
    if (messages.includes("증설(augmentation)")) mark("[data-path^='project.augmentation.']");
    if (messages.includes("LTSA 단가 변경")) mark("[data-path='opex.ltsaStepAfterYear'], [data-path='opex.ltsaStepMultiplierPct']");
    if (messages.includes("가동률 램프업")) mark("[data-path^='revenue.rampUpFactors.']");
    if (messages.includes("자기자본과 주민참여채권")) mark("[data-path='finance.equityPct'], [data-path='finance.residentBondPct']");
    if (messages.includes("대출 만기와 거치기간")) mark("[data-path='finance.seniorTermYears'], [data-path='finance.seniorGraceYears'], [data-path='finance.bondTermYears']");
    if (messages.includes("CAPEX 범주")) {
      const categories = new Set(CAPEX_CATEGORIES.map(({ id }) => id));
      mark("[data-cost-group='capex'][data-cost-field='category']", (control) => !categories.has(control.value));
    }
    if (messages.includes("CAPEX 항목 배열과 금액")) mark("[data-cost-group='capex'][data-cost-field='value']");
    if (messages.includes("OPEX 항목 배열과 금액")) mark("[data-cost-group='opex'][data-cost-field='value']");
    if (messages.includes("CAPEX 집행곡선")) mark("[data-path='project.constructionYears']");
    if (messages.includes("발전·판매 입력")) mark("[data-path^='revenue.']");
    for (const match of messages.matchAll(/금융 입력 (\w+)/g)) mark(`[data-path='finance.${match[1]}']`);
    for (const match of messages.matchAll(/비용 입력 (\w+)/g)) mark(`[data-path$='.${match[1]}']`);
    form.querySelectorAll("input, select").forEach((control) => {
      const invalidNumber = control.type === "number" && control.value.trim() === "";
      const invalid = invalidNumber || !control.checkValidity() || marked.has(control);
      const help = control.dataset.helpIds ?? control.getAttribute("aria-describedby") ?? "";
      control.dataset.helpIds = help;
      if (invalid) {
        control.setAttribute("aria-invalid", "true");
        control.setAttribute("aria-errormessage", errorSummary.id);
        control.setAttribute("aria-describedby", `${help} ${errorSummary.id}`.trim());
      } else {
        control.removeAttribute("aria-invalid");
        control.removeAttribute("aria-errormessage");
        if (help) control.setAttribute("aria-describedby", help);
        else control.removeAttribute("aria-describedby");
      }
    });
  }
  function requestCalculation() {
    status.textContent = "계산 중";
    errorSummary.hidden = true;
    errorSummary.textContent = "";
    currentErrors = [];
    applyModelErrors(currentErrors);
    resultsContent.setAttribute("aria-busy", "true");
    cashflowContent.setAttribute("aria-busy", "true");
    renderCalculationLoading();
    window.clearTimeout(calculationTimer);
    calculationTimer = window.setTimeout(calculate, 120);
  }
  function setPath(model, path, value) {
    const keys = path.split(".");
    const finalKey = keys.pop();
    const target = keys.reduce((nested, key) => nested[key], model);
    target[finalKey] = value;
  }
  technologySwitch.addEventListener("click", (event) => {
    const button = event.target.closest("[data-technology]");
    if (!button || button.dataset.technology === currentTechnology) return;
    window.clearTimeout(calculationTimer);
    calculationTimer = 0;
    currentTechnology = button.dataset.technology;
    currentErrors = [];
    nativeInvalidFields.delete(currentTechnology);
    cases.set(currentTechnology, createCase(currentTechnology));
    buildTechnologySwitch();
    renderSection();
    calculate();
    technologySwitch.querySelector(`[data-technology='${currentTechnology}']`)?.focus();
  });
  sectionNavigation.addEventListener("click", (event) => {
    const button = event.target.closest("[data-section]");
    if (!button) return;
    currentSection = button.dataset.section;
    renderSection();
    sectionNavigation.querySelector(`[data-section='${currentSection}']`)?.focus({ preventScroll: true });
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    document.querySelector("#model-content").scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start"
    });
  });
  form.addEventListener("input", (event) => {
    const input = event.target;
    const model = currentModel();
    if (input.dataset.path) {
      const value = input.dataset.boolean === "true" ? input.value === "true" : input.type === "number" ? input.value.trim() === "" ? Number.NaN : Number(input.value) : input.value;
      setPath(model, input.dataset.path, value);
      if (input.dataset.path === "project.baseYear") {
        model.capex.baseYear = value;
        model.opex.baseYear = value;
      }
      if (input.dataset.path === "project.constructionYears" && Number.isInteger(value) && value > 0) {
        model.capex.drawProfile.constructionWeights = Array.from({ length: value }, () => 1 / value);
      }
      if (input.dataset.path === "project.unitCapacityMW" || input.dataset.path === "project.units") {
        updateCapacitySummary(model);
      }
    }
    if (input.dataset.costGroup) {
      const item = model[input.dataset.costGroup].items[Number(input.dataset.costIndex)];
      if (item) {
        const value = input.dataset.costField === "value" ? input.value.trim() === "" ? Number.NaN : Number(input.value) : input.value;
        item[input.dataset.costField] = value;
        if (input.dataset.costField === "label") {
          const row = input.closest(".cost-row");
          row?.querySelector("[data-cost-field='category']")?.setAttribute("aria-label", `${value} CAPEX 범주`);
          row?.querySelector("[data-cost-field='value']")?.setAttribute("aria-label", `${value} 금액`);
          row?.querySelector("[data-remove-cost]")?.setAttribute("aria-label", `${value} 항목 삭제`);
        }
      }
    }
    if (rememberNativeValidity(input)) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
    requestCalculation();
  });
  form.addEventListener("change", (event) => {
    if (event.target.dataset.path === "revenue.revenueMode") {
      renderSection();
      form.querySelector("[data-path='revenue.revenueMode']")?.focus();
    }
  });
  form.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add-cost]");
    const remove = event.target.closest("[data-remove-cost]");
    if (add) {
      customItemSequence += 1;
      const id = `custom-${Date.now()}-${customItemSequence}`;
      const item = add.dataset.addCost === "capex" ? { id, label: "추가 항목", value: 0, category: "indirect", userAdded: true } : { id, label: "추가 항목", value: 0, userAdded: true };
      currentModel()[add.dataset.addCost].items.push(item);
      const addedIndex = currentModel()[add.dataset.addCost].items.length - 1;
      renderSection();
      form.querySelector(`[data-cost-group='${add.dataset.addCost}'][data-cost-index='${addedIndex}'][data-cost-field='label']`)?.focus();
      requestCalculation();
    }
    if (remove) {
      const type = remove.dataset.removeCost;
      const removedIndex = Number(remove.dataset.costIndex);
      const items = currentModel()[type]?.items;
      const item = Number.isInteger(removedIndex) ? items?.[removedIndex] : null;
      const row = remove.closest(".cost-row");
      const permitted = row?.dataset.costRow === type && row.dataset.costRemovable === "true" && row.dataset.costItemId === item?.id && canRemoveCostItem(type, item);
      if (permitted) {
        forgetCostItemValidity(type, item.id);
        items.splice(removedIndex, 1);
        const focusIndex = Math.min(removedIndex, items.length - 1);
        renderSection();
        if (focusIndex >= 0) {
          form.querySelector(`[data-cost-group='${type}'][data-cost-index='${focusIndex}'][data-cost-field='label']`)?.focus();
        } else {
          form.querySelector(`[data-add-cost='${type}']`)?.focus();
        }
        requestCalculation();
      }
    }
  });
  document.querySelector("#reset-button").addEventListener("click", () => {
    window.clearTimeout(calculationTimer);
    calculationTimer = 0;
    currentErrors = [];
    nativeInvalidFields.delete(currentTechnology);
    cases.set(currentTechnology, createCase(currentTechnology));
    renderSection();
    calculate();
  });
  document.querySelector("#export-button").addEventListener("click", () => {
    const payload = { exportedAt: (/* @__PURE__ */ new Date()).toISOString(), technology: currentTechnology, model: currentModel() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `greenworth-${currentTechnology}-assumptions.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
  form.addEventListener("submit", (event) => event.preventDefault());
  buildTechnologySwitch();
  renderSection();
  calculate();
})();
