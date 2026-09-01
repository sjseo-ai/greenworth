export const CAPEX_CATEGORIES = Object.freeze([
  { id: "equipment", label: "기자재" },
  { id: "constructionCivil", label: "토목" },
  { id: "constructionElectrical", label: "전기" },
  { id: "constructionGrid", label: "선로·계통" },
  { id: "constructionInstallation", label: "운송·설치" },
  { id: "indirect", label: "간접비" },
  { id: "land", label: "토지" },
]);

const cost = (id, label, value, category) => ({ id, label, value, category });
const opexCost = (id, label, value) => ({ id, label, value });

const historicalTaxBrackets = Object.freeze([
  { upTo: 2, ratePct: 9.9 },
  { upTo: 200, ratePct: 20.9 },
  { upTo: null, ratePct: 23.1 },
]);

const commonAssumptions = {
  waccPct: 4.575,
  taxBrackets: historicalTaxBrackets,
  depreciationYears: 20,
  nolCarryforwardYears: 10,
  annualDscrThreshold: 1.1,
  cumulativeDscrThreshold: 1.2,
  legalReserveContributionPct: 10,
  legalReserveCapPctOfEquity: 50,
  investorDividendTaxPct: 15.4,
};

const commonProject = {
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
    unitCostPerKWh: 280000,
    costEscalationPct: 2,
  },
};

const commonRevenue = {
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
  capacityPrice: 18000,
  rampUpFactors: [],
};

const commonCapex = {
  baseYear: 2025,
  constructionInflationPct: 2,
  contingencyPct: 7,
  drawProfile: {
    developmentSharePct: 5,
    constructionWeights: [0.35, 0.65],
    fundingOrder: ["equity", "senior", "residentBond"],
    convention: "annual-s-curve",
  },
  items: [],
};

const commonOpex = {
  baseYear: 2025,
  escalationPct: 2,
  variableOMPerMWh: 6500,
  insurancePct: 0.35,
  communityRevenuePct: 0.5,
  ltsaStepAfterYear: 0,
  ltsaStepMultiplierPct: 100,
  items: [],
};

const commonFinance = {
  equityPct: 25,
  residentBondPct: 5,
  seniorRatePct: 5.2,
  seniorTermYears: 15,
  seniorGraceYears: 1,
  bondRatePct: 7,
  bondTermYears: 10,
  financeFeePct: 1.5,
  constructionRatePct: 5.5,
  dsraMonths: 6,
};

const metadata = (source, limitations) => ({ source, limitations });

const onshore = {
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
    p75NetCapacityFactorPct: 28,
  },
  revenue: { ...commonRevenue, smpPrice: 86, recPrice: 77, recWeight: 1.2 },
  capex: {
    ...commonCapex,
    constructionInflationPct: 0,
    contingencyPct: 5,
    drawProfile: {
      ...commonCapex.drawProfile,
      developmentSharePct: 4.24,
      constructionWeights: [0.18, 0.18, 0.64],
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
      cost("land", "부지·임차·지상권", 5, "land"),
    ],
  },
  opex: {
    ...commonOpex,
    variableOMPerMWh: 0,
    items: [
      opexCost("om", "장기 O&M·BOP", 10.233333333333333),
      opexCost("staff", "인건비·SPC 운영", 3),
      opexCost("lease", "임차료", 3),
      opexCost("admin", "일반관리·수수료", 1.5),
    ],
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
    dsraMonths: 0,
  },
  assumptions: { ...commonAssumptions },
  metadata: metadata(
    "★ 육상풍력재무모델 (예시).xlsx cached values: Summary, Assumption, Investment, Finance, IRR, ROE",
    "역사적 예시 입력을 연간 단순화한 검증 프리셋이며 현재 세법·금융조건 또는 세무자문이 아닙니다.",
  ),
};

const offshore = {
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
    p75NetCapacityFactorPct: 31.8767,
  },
  revenue: { ...commonRevenue, recWeight: 2.5, bidPrice: 195 },
  capex: {
    ...commonCapex,
    contingencyPct: 10,
    drawProfile: {
      ...commonCapex.drawProfile,
      developmentSharePct: 6,
      constructionWeights: [0.15, 0.3, 0.35, 0.2],
    },
    items: [
      cost("turbine", "해상풍력 터빈", 6000, "equipment"),
      cost("foundation", "하부구조·기초", 4200, "constructionCivil"),
      cost("offshoreSub", "해상변전소", 1600, "constructionElectrical"),
      cost("arrayCable", "내부망 해저케이블", 1000, "constructionElectrical"),
      cost("exportCable", "외부망·육상케이블", 1800, "constructionGrid"),
      cost("grid", "계통접속설비", 600, "constructionGrid"),
      cost("installation", "설치선·해상시공", 2500, "constructionInstallation"),
      cost("port", "항만·물류·조립", 600, "constructionInstallation"),
      cost("development", "인허가·해역·환경조사", 500, "indirect"),
      cost("design", "설계·인증·엔지니어링", 350, "indirect"),
      cost("supervision", "감리·사업관리", 300, "indirect"),
      cost("community", "어업·주민수용성", 400, "indirect"),
      cost("insurance", "건설·ALOP·책임보험", 300, "indirect"),
      cost("land", "육상 접속부지", 100, "land"),
    ],
  },
  opex: {
    ...commonOpex,
    variableOMPerMWh: 12000,
    insurancePct: 0.5,
    items: [
      opexCost("om", "터빈·BOP O&M", 250),
      opexCost("vessel", "운영선박·항만", 35),
      opexCost("staff", "인건비·관제", 8),
      opexCost("admin", "일반관리·수수료", 5),
    ],
  },
  finance: {
    ...commonFinance,
    equityPct: 30,
    seniorRatePct: 5.6,
    seniorTermYears: 18,
    constructionRatePct: 6,
  },
  assumptions: { ...commonAssumptions, waccPct: 7 },
  metadata: metadata(
    "국내 해상풍력 예비타당성 검토용 내부 예시 범위와 육상 workbook 금융 구조를 조합한 프리셋",
    "해저지반·항만·선박·계통 거리별 견적과 월별 발전량을 반영하지 않은 개략 연간 모델입니다.",
  ),
};

const solar = {
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
    degradationPct: 0.6,
  },
  revenue: { ...commonRevenue, recWeight: 1, bidPrice: 155 },
  capex: {
    ...commonCapex,
    contingencyPct: 5,
    drawProfile: {
      ...commonCapex.drawProfile,
      developmentSharePct: 8,
      constructionWeights: [1],
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
      cost("land", "부지·임차권", 35, "land"),
    ],
  },
  opex: {
    ...commonOpex,
    variableOMPerMWh: 3500,
    insurancePct: 0.25,
    items: [
      opexCost("om", "O&M·모니터링", 6),
      opexCost("staff", "인건비·SPC 운영", 1.5),
      opexCost("lease", "임차료", 2),
      opexCost("admin", "일반관리·수수료", 1),
    ],
  },
  finance: {
    ...commonFinance,
    equityPct: 20,
    seniorRatePct: 4.9,
    seniorTermYears: 17,
    seniorGraceYears: 0,
  },
  assumptions: { ...commonAssumptions, waccPct: 6 },
  metadata: metadata(
    "국내 유틸리티급 태양광 개략 사업성 검토용 예시 프리셋",
    "일사량 시계열, 출력제한, 인버터 교체, 토지형상과 세부 접속공사를 별도 모델링하지 않습니다.",
  ),
};

const essAnnualDegradationPct = (1 - 0.7 ** (1 / 15)) * 100;

const ess = {
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
      unitCostPerKWh: 280000,
      costEscalationPct: 2,
    },
  },
  revenue: {
    ...commonRevenue,
    revenueMode: "hybrid",
    roundTripEfficiencyPct: 89.5,
    auxConsumptionPct: 3.3,
    rampUpFactors: [0.95, 0.96, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  capex: {
    ...commonCapex,
    contingencyPct: 7,
    drawProfile: {
      ...commonCapex.drawProfile,
      developmentSharePct: 8,
      constructionWeights: [1],
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
      cost("land", "부지·임차권", 5, "land"),
    ],
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
      opexCost("admin", "일반관리·수수료", 1),
    ],
  },
  finance: {
    ...commonFinance,
    equityPct: 30,
    seniorTermYears: 10,
    bondTermYears: 7,
  },
  assumptions: { ...commonAssumptions, waccPct: 7.5, depreciationYears: 15 },
  metadata: metadata(
    "70%/15년 잔존용량 가정에서 연환산 열화율을 도출하고, 5년 주기 배터리 증설(augmentation)과 워런티 종료 후 LTSA 단가 인상 구간을 반영한 ESS 개략 프리셋. 왕복효율과 소내소비율은 260112_효성중공업 운전효율계산시트_KCH접수_V3.xlsx의 SDI·LGES·SKon 3사 제안값(154TR·22.9TR·PCS 충방전·케이블 효율과 배터리 DC 왕복효율, 소내소비 부하)을 1년차 기준으로 평균해 산출했습니다.",
    "충방전 시계열과 보조서비스(주파수조정 등) 정산은 별도 모델링하지 않습니다. 배터리 증설비용은 매년 균등 발생이 아닌 지정 연차의 일시 지출로 단순화하며, 안전성 비용 변동은 반영하지 않습니다. 왕복효율과 소내소비율은 15년 운영기간 동안 고정값을 사용하며, 참조 시트에 나타난 배터리 DC 효율의 완만한 연차 하락(약 1~2%p)은 반영하지 않습니다.",
  ),
};

export const TECHNOLOGIES = Object.freeze({ onshore, offshore, solar, ess });

export function createCase(technology) {
  const preset = TECHNOLOGIES[technology];
  if (!preset) throw new RangeError(`지원하지 않는 기술입니다: ${technology}`);
  return structuredClone(preset);
}
