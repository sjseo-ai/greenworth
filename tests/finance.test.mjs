import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeCase,
  irr,
  levelDebtService,
  npv,
  paybackPeriod,
  progressiveTax,
  sensitivityCases,
} from "../js/finance.js";
import { CAPEX_CATEGORIES, createCase, TECHNOLOGIES } from "../js/project-data.js";
import {
  MAPPED_ONSHORE_TARGETS,
  WORKBOOK_CASH_FLOWS,
  WORKBOOK_TARGETS,
} from "./fixtures/onshore-workbook-benchmark.mjs";

test("NPV discounts annual cash flows from year zero", () => {
  assert.ok(Math.abs(npv(0.1, [-100, 60, 60]) - 4.1322314) < 0.000001);
});

test("IRR solves a conventional investment cash flow", () => {
  assert.ok(Math.abs(irr([-100, 60, 60]) - 0.1306624) < 0.000001);
  assert.ok(Number.isNaN(irr([0, 10, 20])));
});

test("payback interpolates within the crossing year", () => {
  assert.ok(Math.abs(paybackPeriod([-100, 60, 60]) - 1.6666667) < 0.000001);
  assert.ok(Number.isNaN(paybackPeriod([-100, 10, 10])));
});

for (const technology of Object.keys(TECHNOLOGIES)) {
  test(`${technology} default case produces complete outputs`, () => {
    const model = createCase(technology);
    const result = analyzeCase(model, technology);
    assert.deepEqual(result.errors, []);
    assert.ok(result.rows.length > model.project.operationYears);
    assert.ok(Number.isFinite(result.projectIrr));
    assert.ok(Number.isFinite(result.equityIrr));
    assert.ok(Number.isFinite(result.equityIrrAfterInvestorTax));
    assert.ok(Number.isFinite(result.projectNpv));
    assert.ok(result.projectPayback === null || Number.isFinite(result.projectPayback));
    assert.equal("lcoe" in result, false);
    assert.equal("minDscr" in result, false);
    const funded = result.equityPrincipal + result.seniorPrincipal + result.bondPrincipal;
    assert.ok(Math.abs(funded - result.totalInvestment) < 0.000001);
    assert.ok(Math.abs(result.capitalBreakdown.reduce((sum, row) => sum + row.value, 0) - result.totalInvestment) < 0.000001);
    assert.ok(Math.abs(result.fundingBreakdown.reduce((sum, row) => sum + row.value, 0) - result.totalInvestment) < 0.000001);
    assert.equal(result.capitalBreakdown.length, 11);
    const nonFinite = [];
    const inspect = (value, path = "result") => {
      if (typeof value === "number" && !Number.isFinite(value)) nonFinite.push(path);
      if (value && typeof value === "object") Object.entries(value).forEach(([key, child]) => inspect(child, `${path}.${key}`));
    };
    inspect(result);
    assert.deepEqual(nonFinite, []);
  });
}

test("technology presets expose P75, calendar, seven categorized CAPEX groups, and read-only assumptions", () => {
  assert.deepEqual(CAPEX_CATEGORIES.map(({ id }) => id), [
    "equipment", "constructionCivil", "constructionElectrical", "constructionGrid",
    "constructionInstallation", "indirect", "land",
  ]);
  assert.equal(createCase("onshore").project.p75NetCapacityFactorPct, 28);
  assert.equal(createCase("offshore").project.p75NetCapacityFactorPct, 31.8767);
  assert.equal(createCase("solar").project.p75NetCapacityFactorPct, 15.25);
  assert.equal("p75NetCapacityFactorPct" in createCase("ess").project, false);
  assert.ok(Math.abs((1 - createCase("ess").project.degradationPct / 100) ** 15 - 0.7) < 1e-12);
  assert.equal(createCase("solar").project.degradationPct, 0.6);
  for (const technology of Object.keys(TECHNOLOGIES)) {
    const model = createCase(technology);
    assert.ok(Number.isInteger(model.project.baseYear));
    assert.ok(Number.isInteger(model.project.startYear));
    assert.ok(Number.isInteger(model.project.developmentYears));
    assert.ok(Number.isInteger(model.project.constructionYears));
    assert.ok(Number.isInteger(model.project.codMonth));
    assert.ok(model.capex.items.every(({ category }) => CAPEX_CATEGORIES.some(({ id }) => id === category)));
    for (const removed of ["gridLossPct", "residualPct", "decommissioningPct"]) assert.equal(removed in model.project, false);
    assert.equal("priceEscalationPct" in model.revenue, false);
    for (const removed of ["taxRatePct", "waccPct", "depreciationYears", "minDscr", "dividendPayoutPct"]) {
      assert.equal(removed in model.finance, false);
    }
    assert.ok(Array.isArray(model.assumptions.taxBrackets));
    assert.ok(model.metadata.source.length > 0);
    assert.ok(model.metadata.limitations.length > 0);
  }
});

test("workbook cached cash-flow arrays reproduce all four IRRs exactly", () => {
  const pairs = [
    [WORKBOOK_CASH_FLOWS.projectPreTax, WORKBOOK_TARGETS.projectPreTaxIrr],
    [WORKBOOK_CASH_FLOWS.projectAfterTax, WORKBOOK_TARGETS.projectAfterTaxIrr],
    [WORKBOOK_CASH_FLOWS.equityPreInvestorTax, WORKBOOK_TARGETS.equityPreInvestorTaxIrr],
    [WORKBOOK_CASH_FLOWS.equityAfterInvestorTax, WORKBOOK_TARGETS.equityAfterInvestorTaxIrr],
  ];
  for (const [cashFlows, target] of pairs) assert.ok(Math.abs(irr(cashFlows) - target) < 1e-8);
});

test("calendar uses actual leap days and creates construction/operation coexistence with terminal partial year", () => {
  const model = createCase("solar");
  model.project.startYear = 2023;
  model.project.developmentYears = 1;
  model.project.constructionYears = 1;
  model.project.codMonth = 7;
  model.project.operationYears = 2;
  const result = analyzeCase(model, "solar");
  assert.deepEqual(result.errors, []);
  const codYear = result.rows.find((row) => row.phase.includes("operation"));
  assert.ok(codYear);
  assert.ok(codYear.phase.includes("construction"));
  assert.equal(codYear.daysInYear, 366);
  assert.equal(codYear.operatingDays, 184);
  assert.equal(result.rows.at(-1).operatingDays, 181);
});

test("P75 is already net, selling prices stay fixed, and degradation is applied", () => {
  const onshoreModel = createCase("onshore");
  onshoreModel.project.unitCapacityMW = 5;
  onshoreModel.project.units = 8;
  onshoreModel.project.p75NetCapacityFactorPct = 28;
  onshoreModel.revenue.smpPrice = 86;
  onshoreModel.revenue.recPrice = 77;
  onshoreModel.revenue.recWeight = 1.2;
  const onshore = analyzeCase(onshoreModel, "onshore");
  const fullYear = onshore.rows.find((row) => row.operatingDays === row.daysInYear && row.daysInYear === 365);
  assert.ok(fullYear);
  assert.ok(Math.abs(fullYear.generationMWh - MAPPED_ONSHORE_TARGETS.fullYearGenerationMWh) < 1e-6);
  assert.ok(Math.abs(fullYear.revenue - MAPPED_ONSHORE_TARGETS.fullYearRevenue) < 1e-6);
  const nextComparable = onshore.rows.find((row) => row.calendarYear > fullYear.calendarYear && row.daysInYear === 365 && row.operatingDays === 365);
  assert.ok(nextComparable);
  assert.ok(Math.abs(nextComparable.revenue - fullYear.revenue) < 1e-6);
  assert.ok(nextComparable.opex > fullYear.opex);

  const solar = analyzeCase(createCase("solar"), "solar");
  const solarFullYears = solar.rows.filter((row) => row.operatingDays === 365 && row.daysInYear === 365).slice(0, 2);
  assert.equal(solarFullYears.length, 2);
  assert.ok(Math.abs(solarFullYears[1].generationMWh / solarFullYears[0].generationMWh - 0.994) < 1e-6);
});

test("CAPEX inflation, half-period IDC, and construction funding draws are explicit", () => {
  const model = createCase("onshore");
  model.capex.constructionInflationPct = 0;
  const flat = analyzeCase(model, "onshore");
  model.capex.constructionInflationPct = 5;
  const inflated = analyzeCase(model, "onshore");
  assert.ok(inflated.nominalDirectCapex > flat.nominalDirectCapex);
  assert.ok(inflated.constructionInterest > 0);
  assert.ok(inflated.rows.some((row) => row.seniorDraw > 0 && row.constructionInterest > row.seniorDraw * model.finance.constructionRatePct / 200));
  assert.ok(inflated.rows.some((row) => row.equityContribution > 0));
  const higherRate = createCase("solar");
  higherRate.finance.seniorRatePct += 2;
  assert.ok(analyzeCase(higherRate, "solar").debtServiceReserve > analyzeCase(createCase("solar"), "solar").debtServiceReserve);
});

test("senior debt uses a level annuity after grace and bonds are bullet", () => {
  assert.ok(Math.abs(levelDebtService(100, 0.05, 5) - 23.0974798128) < 1e-9);
  const model = createCase("solar");
  model.project.codMonth = 1;
  model.finance.seniorGraceYears = 1;
  model.finance.seniorTermYears = 6;
  model.finance.bondTermYears = 4;
  const result = analyzeCase(model, "solar");
  const operations = result.rows.filter((row) => row.phase.includes("operation"));
  assert.equal(operations[0].seniorPrincipal, 0);
  const annuities = operations.slice(1, 5).map((row) => row.seniorInterest + row.seniorPrincipal);
  assert.ok(annuities.every((value) => Math.abs(value - annuities[0]) < 1e-6));
  assert.ok(operations.slice(0, 3).every((row) => row.bondPrincipal === 0));
  assert.ok(operations[3].bondPrincipal > 0);
});

test("debt maturity beyond operations is surfaced as an explicit balloon", () => {
  const model = createCase("onshore");
  model.project.operationYears = 5;
  model.finance.seniorTermYears = 12;
  model.finance.bondTermYears = 10;
  const result = analyzeCase(model, "onshore");
  const finalYear = result.rows.at(-1);
  assert.ok(finalYear.seniorBalloon > 0);
  assert.ok(finalYear.bondBalloon > 0);
  assert.equal(finalYear.seniorBalance, 0);
  assert.equal(finalYear.bondBalance, 0);
});

test("historical progressive tax helper respects brackets and zero floor", () => {
  const brackets = createCase("onshore").assumptions.taxBrackets;
  assert.equal(progressiveTax(-1, brackets), 0);
  assert.ok(Math.abs(progressiveTax(2, brackets) - 0.198) < 1e-12);
  assert.ok(Math.abs(progressiveTax(200, brackets) - (0.198 + 198 * 0.209)) < 1e-12);
  assert.ok(Math.abs(progressiveTax(201, brackets) - (0.198 + 198 * 0.209 + 0.231)) < 1e-12);
});

test("interest deduction and NOL carryforward reduce corporate tax without changing project EBITDA", () => {
  const leveraged = createCase("onshore");
  leveraged.revenue.smpPrice = 20;
  leveraged.revenue.recPrice = 20;
  const lossResult = analyzeCase(leveraged, "onshore");
  assert.ok(lossResult.rows.some((row) => row.nolBalance > 0));
  const nolModel = createCase("onshore");
  nolModel.revenue.smpPrice = 50;
  nolModel.revenue.recPrice = 50;
  nolModel.finance.seniorRatePct = 6;
  const nolResult = analyzeCase(nolModel, "onshore");
  assert.ok(nolResult.rows.some((row) => row.nolUsed > 0));
  const recoveryModel = structuredClone(leveraged);
  recoveryModel.revenue.smpPrice = 140;
  recoveryModel.revenue.recPrice = 100;
  const leveragedResult = analyzeCase(recoveryModel, "onshore");
  const unleveraged = structuredClone(recoveryModel);
  unleveraged.finance.equityPct = 99;
  unleveraged.finance.residentBondPct = 0;
  const unleveragedResult = analyzeCase(unleveraged, "onshore");
  assert.ok(leveragedResult.rows.reduce((sum, row) => sum + row.corporateTax, 0) < unleveragedResult.rows.reduce((sum, row) => sum + row.corporateTax, 0));
});

test("dividend gates, legal reserve cap, investor tax, and terminal recoveries are explicit", () => {
  const gated = createCase("solar");
  gated.assumptions.annualDscrThreshold = 99;
  gated.assumptions.cumulativeDscrThreshold = 99;
  const result = analyzeCase(gated, "solar");
  const operating = result.rows.filter((row) => row.phase.includes("operation"));
  assert.ok(operating.slice(0, -1).every((row) => row.dividend === 0));
  assert.ok(operating.at(-1).terminalRecovery >= result.debtServiceReserve);
  assert.equal(operating.at(-1).terminalDsraRecovery, result.debtServiceReserve);
  assert.ok(operating.at(-1).terminalRetainedCashRecovery > 0);
  assert.ok(result.equityCashFlowsAfterInvestorTax.every((value, index) => value <= result.equityCashFlows[index] + 1e-9));
  assert.ok(operating.every((row) => row.legalReserveBalance <= result.equityPrincipal * gated.assumptions.legalReserveCapPctOfEquity / 100 + 1e-8));
  const normal = analyzeCase(createCase("solar"), "solar");
  assert.ok(normal.rows.at(-1).terminalLegalReserveRecovery > 0);
});

test("capital structure rejects over-allocation", () => {
  const model = createCase("onshore");
  model.finance.equityPct = 80;
  model.finance.residentBondPct = 20;
  const result = analyzeCase(model, "onshore");
  assert.ok(result.errors.some((message) => message.includes("100% 미만")));
});

test("capacity validation keeps the Korean recovery phrase atomic", () => {
  const model = createCase("onshore");
  model.project.unitCapacityMW = Number.NaN;

  const error = analyzeCase(model, "onshore").errors
    .find((message) => message.startsWith("설비용량과 대수"));

  assert.equal(error, "설비용량과 대수는 유효한 양수여야\u00a0합니다.");
});

test("malformed months, years, capacity factors, ratios, terms, categories, and negative costs are rejected", () => {
  const mutations = [
    (model) => { model.project.codMonth = 13; },
    (model) => { model.project.startYear = 2025.5; },
    (model) => { model.project.p75NetCapacityFactorPct = 101; },
    (model) => { model.finance.equityPct = -1; },
    (model) => { model.finance.seniorGraceYears = model.finance.seniorTermYears; },
    (model) => { model.capex.items[0].category = "mystery"; },
    (model) => { model.capex.items[0].value = -1; },
    (model) => { model.opex.variableOMPerMWh = -1; },
  ];
  for (const mutate of mutations) {
    const model = createCase("onshore");
    mutate(model);
    assert.ok(analyzeCase(model, "onshore").errors.length > 0);
  }
});

test("investment iteration is bounded and reports non-convergence", () => {
  const model = createCase("onshore");
  model.finance.financeFeePct = 100;
  const result = analyzeCase(model, "onshore");
  assert.ok(result.errors.some((message) => message.includes("200회 안에 수렴하지 않았습니다")));
});

test("malformed cost containers return validation errors instead of throwing", () => {
  for (const mutate of [
    (model) => { model.capex.items = null; },
    (model) => { model.capex.items = {}; },
    (model) => { model.opex.items = null; },
    (model) => { model.opex.items = {}; },
  ]) {
    const model = createCase("onshore");
    mutate(model);
    let result;
    assert.doesNotThrow(() => { result = analyzeCase(model, "onshore"); });
    assert.ok(result.errors.length > 0);
  }
});

test("calendar, depreciation, reserve, and progressive tax domains are closed by validation", () => {
  const mutations = [
    (model) => { model.project.startYear = 999999; },
    (model) => { model.project.baseYear = 999999; },
    (model) => { model.assumptions.depreciationYears = 0; },
    (model) => { model.assumptions.legalReserveContributionPct = 101; },
    (model) => { model.assumptions.legalReserveCapPctOfEquity = 101; },
    (model) => { model.assumptions.taxBrackets = [{ upTo: 2, ratePct: 9.9 }, { upTo: 200, ratePct: 20.9 }]; },
    (model) => { model.assumptions.taxBrackets = [null]; },
  ];
  for (const mutate of mutations) {
    const model = createCase("onshore");
    mutate(model);
    let result;
    assert.doesNotThrow(() => { result = analyzeCase(model, "onshore"); });
    assert.ok(result.errors.length > 0);
  }
});

test("partial first operating year settles senior debt explicitly on the stated maturity row", () => {
  const model = createCase("solar");
  model.project.codMonth = 7;
  model.project.operationYears = 10;
  model.finance.seniorTermYears = 6;
  model.finance.seniorGraceYears = 0;
  model.finance.bondTermYears = 4;
  const result = analyzeCase(model, "solar");
  assert.deepEqual(result.errors, []);
  const maturity = result.rows.find((row) => row.operationSequence === 6);
  assert.ok(maturity);
  assert.equal(maturity.seniorBalance, 0);
  assert.ok(maturity.seniorBalloon > 0 || Math.abs(maturity.seniorPrincipal) > 0);
  assert.ok(result.rows.filter((row) => row.operationSequence > 6).every((row) => row.seniorInterest === 0));
});

test("investment audit metadata and construction balances reflect actual convergence and cumulative draws", () => {
  const result = analyzeCase(createCase("onshore"), "onshore");
  assert.equal(result.investmentIterations.converged, true);
  assert.ok(Number.isInteger(result.investmentIterations.iterations));
  assert.ok(result.investmentIterations.iterations > 0);
  assert.ok(result.investmentIterations.iterations <= result.investmentIterations.maxIterations);
  let cumulativeSenior = 0;
  let cumulativeBond = 0;
  for (const row of result.rows) {
    cumulativeSenior += row.seniorDraw;
    cumulativeBond += row.bondDraw;
    if (row.phase.includes("operation")) break;
    assert.ok(Math.abs(row.seniorBalance - cumulativeSenior) < 1e-8);
    assert.ok(Math.abs(row.bondBalance - cumulativeBond) < 1e-8);
  }
});

test("createCase returns isolated deep clones", () => {
  const first = createCase("onshore");
  first.capex.items[0].value = -999;
  first.assumptions.taxBrackets[0].ratePct = 0;
  const second = createCase("onshore");
  assert.notEqual(second.capex.items[0].value, -999);
  assert.notEqual(second.assumptions.taxBrackets[0].ratePct, 0);
});

test("base sensitivity equals the direct project IRR", () => {
  const model = createCase("solar");
  const direct = analyzeCase(model, "solar");
  const base = sensitivityCases(model, "solar").find((scenario) => scenario.key === "base");
  assert.ok(base);
  assert.ok(Math.abs(base.projectIrr - direct.projectIrr) < 0.000001);
  assert.ok(Math.abs(direct.projectPayback - paybackPeriod(direct.projectCashFlows)) < 0.000001);
});

test("mapped onshore benchmark stays within the declared structural variance gates", () => {
  const model = createCase("onshore");
  model.project.unitCapacityMW = 5;
  model.project.units = 8;
  model.project.p75NetCapacityFactorPct = 28;
  model.project.operationYears = 20;
  model.revenue.smpPrice = 86;
  model.revenue.recPrice = 77;
  model.revenue.recWeight = 1.2;
  const result = analyzeCase(model, "onshore");
  assert.ok(Math.abs(result.projectIrr - WORKBOOK_TARGETS.projectAfterTaxIrr) <= 0.005);
  assert.ok(Math.abs(result.equityIrr - WORKBOOK_TARGETS.equityPreInvestorTaxIrr) <= 0.01);
  assert.ok(Math.abs(result.totalInvestment / WORKBOOK_TARGETS.totalInvestment - 1) <= 0.02);
  assert.ok(Math.abs(result.constructionInterest / WORKBOOK_TARGETS.constructionInterest - 1) <= 0.2);
});

test("ESS augmentation restores capacity on schedule, draws cash outside the 11-line CAPEX, and is depreciated", () => {
  const withAugmentation = createCase("ess");
  const result = analyzeCase(withAugmentation, "ess");
  assert.equal(result.errors.length, 0);
  assert.ok(result.augmentationEvents.length > 0);
  const [firstEvent] = result.augmentationEvents;
  assert.equal(firstEvent.operationSequence, withAugmentation.project.augmentation.intervalYears);
  assert.ok(Math.abs(firstEvent.capacityFractionAfter - 1) < 1e-9, "100% restore share returns capacity to nameplate");
  assert.ok(!result.augmentationEvents.some((event) => event.operationSequence >= withAugmentation.project.operationYears),
    "no augmentation is scheduled in the terminal operating year");

  const eventRow = result.rows.find((row) => row.operationSequence === firstEvent.operationSequence);
  assert.ok(eventRow.augmentationDraw > 0);
  const capitalTotal = result.capitalBreakdown.reduce((total, line) => total + line.value, 0);
  assert.ok(Math.abs(capitalTotal - result.totalInvestment) < 1e-6, "augmentation must not leak into the initial 11-line CAPEX total");

  const withoutAugmentation = createCase("ess");
  withoutAugmentation.project.augmentation.enabled = false;
  const disabled = analyzeCase(withoutAugmentation, "ess");
  assert.equal(disabled.augmentationEvents.length, 0);
  assert.ok(disabled.totalInvestment === result.totalInvestment, "toggling augmentation never changes construction financing sizing");
  assert.ok(disabled.projectIrr > result.projectIrr, "augmentation capex is a real cash cost that lowers unlevered returns");

  const eventYearDepreciation = eventRow.depreciation;
  const laterRow = result.rows.find((row) => row.operationSequence === firstEvent.operationSequence + 1);
  assert.ok(laterRow.depreciation > disabled.rows.find((row) => row.operationSequence === firstEvent.operationSequence + 1).depreciation,
    "the augmentation tranche adds incremental depreciation after it is capitalized");
});

test("ESS capacity ramp-up lowers early-year discharge and reverts to full cycling from year three", () => {
  const model = createCase("ess");
  model.revenue.rampUpFactors = [0.5, 0.8];
  model.project.augmentation.enabled = false;
  model.project.degradationPct = 0;
  model.project.codMonth = 1;
  const result = analyzeCase(model, "ess");
  const operating = result.rows.filter((row) => row.operationSequence > 0);
  const year1 = operating.find((row) => row.operationSequence === 1);
  const year2 = operating.find((row) => row.operationSequence === 2);
  const year3 = operating.find((row) => row.operationSequence === 3);
  assert.ok(Math.abs(year1.chargedMWh / year3.chargedMWh - 0.5) < 1e-9);
  assert.ok(Math.abs(year2.chargedMWh / year3.chargedMWh - 0.8) < 1e-9);
  const year4 = operating.find((row) => row.operationSequence === 4);
  assert.ok(Math.abs(year4.chargedMWh - year3.chargedMWh) < 1e-9, "ramp-up factors do not extend past their declared years");
});

test("LTSA step change raises only the battery/PCS LTSA line after the declared operating year", () => {
  const model = createCase("ess");
  model.project.augmentation.enabled = false;
  model.project.degradationPct = 0;
  model.project.codMonth = 1;
  model.opex.ltsaStepAfterYear = 2;
  model.opex.ltsaStepMultiplierPct = 200;
  model.opex.escalationPct = 0;
  model.opex.variableOMPerMWh = 0;
  model.opex.communityRevenuePct = 0;
  const result = analyzeCase(model, "ess");
  const operating = result.rows.filter((row) => row.operationSequence > 0 && row.operationFraction === 1);
  const beforeStep = operating.find((row) => row.operationSequence === 2);
  const afterStep = operating.find((row) => row.operationSequence === 3);
  const ltsaBase = model.opex.items.find((item) => item.id === "om").value;
  assert.ok(Math.abs(afterStep.opex - beforeStep.opex - ltsaBase) < 1e-6,
    "only the stepped LTSA item's incremental cost should change OPEX between the two years");

  const noStep = createCase("ess");
  noStep.project.augmentation.enabled = false;
  noStep.project.degradationPct = 0;
  noStep.project.codMonth = 1;
  noStep.opex.escalationPct = 0;
  noStep.opex.variableOMPerMWh = 0;
  noStep.opex.communityRevenuePct = 0;
  const flatResult = analyzeCase(noStep, "ess");
  const flatOperating = flatResult.rows.filter((row) => row.operationSequence > 0 && row.operationFraction === 1);
  assert.ok(Math.abs(flatOperating.find((row) => row.operationSequence === 3).opex
    - flatOperating.find((row) => row.operationSequence === 2).opex) < 1e-6,
    "without a step configured, OPEX stays flat when escalation is zero");
});

test("ESS ramp-up factors can be set individually for all 15 operating years", () => {
  const model = createCase("ess");
  assert.equal(model.revenue.rampUpFactors.length, model.project.operationYears,
    "the default preset declares one ramp-up multiplier per operating year");
  model.revenue.rampUpFactors = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.1];
  model.project.augmentation.enabled = false;
  model.project.degradationPct = 0;
  model.project.codMonth = 1;
  const result = analyzeCase(model, "ess");
  assert.equal(result.errors.length, 0);
  const operating = result.rows.filter((row) => row.operationSequence > 0);
  const year1 = operating.find((row) => row.operationSequence === 1);
  const year5 = operating.find((row) => row.operationSequence === 5);
  const year10 = operating.find((row) => row.operationSequence === 10);
  const year15 = operating.find((row) => row.operationSequence === 15);
  assert.ok(Math.abs(year1.chargedMWh / year10.chargedMWh - 0.5) < 1e-9, "year 1 uses its own declared multiplier");
  assert.ok(Math.abs(year5.chargedMWh / year10.chargedMWh - 0.9) < 1e-9, "year 5 uses its own declared multiplier");
  assert.ok(Math.abs(year15.chargedMWh / year10.chargedMWh - 1.1) < 1e-9,
    "the 15th year is independently editable and is not forced back to normal cycling");
});

test("ESS operating efficiency combines round-trip efficiency and auxiliary (house-load) consumption", () => {
  const model = createCase("ess");
  assert.ok(model.revenue.roundTripEfficiencyPct > 0 && model.revenue.roundTripEfficiencyPct <= 100);
  assert.ok(model.revenue.auxConsumptionPct > 0 && model.revenue.auxConsumptionPct <= 100,
    "the Hyosung reference sheet's house-load consumption is modeled as an explicit deduction");
  model.project.augmentation.enabled = false;
  model.project.degradationPct = 0;
  model.project.codMonth = 1;
  model.revenue.rampUpFactors = model.revenue.rampUpFactors.map(() => 1);
  const withAux = analyzeCase(model, "ess");
  const noAux = createCase("ess");
  noAux.project.augmentation.enabled = false;
  noAux.project.degradationPct = 0;
  noAux.project.codMonth = 1;
  noAux.revenue.rampUpFactors = noAux.revenue.rampUpFactors.map(() => 1);
  noAux.revenue.auxConsumptionPct = 0;
  const withoutAux = analyzeCase(noAux, "ess");
  const withAuxRow = withAux.rows.find((row) => row.operationSequence === 1);
  const withoutAuxRow = withoutAux.rows.find((row) => row.operationSequence === 1);
  const expectedRatio = 1 - model.revenue.auxConsumptionPct / 100;
  assert.ok(Math.abs(withAuxRow.generationMWh / withoutAuxRow.generationMWh - expectedRatio) < 1e-9,
    "auxiliary consumption reduces net discharge beyond the round-trip efficiency factor alone");
  assert.ok(Math.abs(withAuxRow.chargedMWh - withoutAuxRow.chargedMWh) < 1e-9,
    "auxiliary consumption reduces net output, not the gross charged energy");
});
