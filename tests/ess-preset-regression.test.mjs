// Iteration 1 (PRD_사업성분석_프로토타입.md, 9장) DoD:
// "IRR/NPV 값이 js/finance.js의 기존 ESS 프리셋 계산 결과와 오차 없이 일치한다(회귀 테스트로 고정)".
//
// Unlike tests/fixtures/onshore-workbook-benchmark.mjs (which checks the engine against an
// independent source workbook), this file is a golden-master snapshot: it pins the ESS preset's
// current analyzeCase() output so a future refactor of finance.js or project-data.js cannot
// silently change ESS results. If a change is intentional, update ESS_GOLDEN below deliberately
// and note why in the commit message.
import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCase } from "../js/finance.js";
import { createCase } from "../js/project-data.js";

const ESS_GOLDEN = Object.freeze({
  capacityMW: 50,
  totalInvestment: 1151.290641015445,
  equityPrincipal: 345.3871923046335,
  seniorPrincipal: 748.3389166600392,
  bondPrincipal: 57.56453205077226,
  annualGenerationMWh: 51924.690800277654,
  firstYearRevenue: 69.91969471123288,
  projectIrrPreTax: 0.03900848472884533,
  projectIrr: 0.03544407417767281,
  equityIrr: 0.010302327898062402,
  equityIrrAfterInvestorTax: 0.009192093898164111,
  projectNpv: -228.9018932325678,
  projectPayback: 12.440191556580931,
});

const TOLERANCE = 1e-9;

test("ESS preset analyzeCase() matches the golden-master snapshot (iteration 1 regression lock)", () => {
  const result = analyzeCase(createCase("ess"), "ess");

  assert.deepEqual(result.errors, []);
  for (const [key, expected] of Object.entries(ESS_GOLDEN)) {
    const actual = result[key];
    assert.ok(
      Number.isFinite(actual),
      `${key} should be a finite number, got ${actual}`,
    );
    assert.ok(
      Math.abs(actual - expected) < TOLERANCE,
      `${key} drifted from the golden value: expected ${expected}, got ${actual}`,
    );
  }
});

test("ESS preset investment iteration converges (prototype cannot ship on a non-converged model)", () => {
  const result = analyzeCase(createCase("ess"), "ess");
  assert.equal(result.investmentIterations.converged, true);
  assert.ok(result.investmentIterations.iterations <= result.investmentIterations.maxIterations);
});
