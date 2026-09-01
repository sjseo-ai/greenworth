import assert from "node:assert/strict";
import test from "node:test";

import { analyzeCase, sensitivityCases } from "../js/finance.js";
import { createCase } from "../js/project-data.js";
import { renderCashFlow, renderResults } from "../js/results-view.js";

class TestElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.className = "";
    this.id = "";
    this.tabIndex = -1;
    this.scrollLeft = 0;
    this.scrollIntoViewCalls = [];
    this.listeners = new Map();
    this._text = "";
    this._innerHtml = "";
  }

  append(...children) {
    for (const child of children) {
      if (child === null || child === undefined) continue;
      this.children.push(typeof child === "string" ? new TestText(child) : child);
    }
  }

  replaceChildren(...children) {
    this.children = [];
    this._text = "";
    this._innerHtml = "";
    this.append(...children);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    event.target ??= this;
    event.currentTarget = this;
    for (const listener of this.listeners.get(event.type) ?? []) listener.call(this, event);
    return true;
  }

  scrollIntoView(options) {
    this.scrollIntoViewCalls.push(options);
  }

  set textContent(value) {
    this.children = [];
    this._innerHtml = "";
    this._text = String(value ?? "");
  }

  get textContent() {
    return this._text + this.children.map((child) => child.textContent).join("");
  }

  set innerHTML(value) {
    this.children = [];
    this._text = "";
    this._innerHtml = String(value);
  }

  get innerHTML() {
    return this._innerHtml;
  }
}

class TestText {
  constructor(value) {
    this.value = value;
  }

  get textContent() {
    return this.value;
  }
}

globalThis.document = {
  createElement(tagName) {
    return new TestElement(tagName);
  },
};

function descendants(root) {
  return [root, ...root.children.flatMap((child) => child instanceof TestElement ? descendants(child) : [])];
}

function byClass(root, className) {
  return descendants(root).filter((element) => element.className.split(/\s+/).includes(className));
}

function byTag(root, tagName) {
  return descendants(root).filter((element) => element.tagName === tagName.toUpperCase());
}

function byAttribute(root, name, value) {
  return descendants(root).filter((element) => element.getAttribute(name) === value);
}

function onshoreOutput() {
  const model = createCase("onshore");
  return {
    model,
    result: analyzeCase(model, "onshore"),
    sensitivities: sensitivityCases(model, "onshore"),
  };
}

test("results render v3 return definitions and omit removed KPI cards", () => {
  const { model, result, sensitivities } = onshoreOutput();
  const target = new TestElement("div");
  renderResults(target, result, sensitivities, model);

  assert.equal(byClass(target, "metric").length, 6);
  assert.match(target.textContent, /P-IRR.*법인세 후 프로젝트 CF/s);
  assert.match(target.textContent, /E-IRR \(투자자 배당세 전\).*법인세 후.*투자자 배당세 전/s);
  assert.match(target.textContent, /투자자 세후 E-IRR.*투자자 배당세 차감 후/s);
  assert.match(target.textContent, /NPV.*WACC 4\.575%.*읽기 전용 프리셋/s);
  assert.match(target.textContent, /P-PBP.*누적 법인세 후 프로젝트 CF가 0 이상/s);
  assert.match(target.textContent, /연간 발전·방전량.*첫 운영연도 실적을 1년으로 환산/s);
  assert.doesNotMatch(target.textContent, /LCOE|최소 DSCR/);
  const npv = byClass(target, "metric").find((item) => item.children[0].textContent === "NPV");
  assert.ok(npv.children[1].className.split(/\s+/).includes("metric-value--compact"));
});

test("capital breakdown uses the exact 11 mapped lines and reconciles both sides", () => {
  const { model, result, sensitivities } = onshoreOutput();
  const target = new TestElement("div");
  renderResults(target, result, sensitivities, model);

  const expected = [
    "기자재비", "시공비-토목", "시공비-전기", "시공비-선로·계통", "시공비-운송·설치",
    "간접비", "토지비용", "예비비", "건설이자", "금융부대비용", "DSRA",
  ];
  const rows = byClass(target, "capital-breakdown-row");
  assert.equal(rows.length, 11);
  assert.deepEqual(rows.map((row) => row.children[0].textContent), expected);
  assert.match(target.textContent, /DSRA는 대출상환을 위해 예치했다가 종료 시 회수하는 준비금/);
  assert.match(target.textContent, /총사업비 합계.*엔진 총투자비.*사업비 조정차이.*0\.0\s억\u2060원/s);
  assert.match(target.textContent, /자기자본.*선순위대출.*주민참여채권.*조달 합계.*조달 조정차이.*0\.0\s억\u2060원/s);
});

test("non-zero or incomplete reconciliations expose error and unavailable reasons", () => {
  const { model, result, sensitivities } = onshoreOutput();
  const mismatched = {
    ...result,
    totalInvestment: result.totalInvestment + 0.000002,
  };
  const target = new TestElement("div");
  renderResults(target, mismatched, sensitivities, model);
  const errors = byClass(target, "reconciliation-error");
  assert.equal(errors.length, 2);
  assert.ok(errors.every((row) => row.getAttribute("role") === "alert"));
  assert.match(target.textContent, /오류: 사업비 조정차이.*-0\.000002\s억\u2060원/s);
  assert.match(target.textContent, /오류: 조달 조정차이.*-0\.000002\s억\u2060원/s);

  renderResults(target, {
    ...result,
    equityPrincipal: undefined,
    capitalBreakdown: result.capitalBreakdown.filter((row) => row.id !== "equipment"),
    fundingBreakdown: result.fundingBreakdown.filter((row) => row.id !== "equity"),
  }, sensitivities, model);
  assert.match(target.textContent, /일부 총사업비 항목이 없어.*N\/A/);
  assert.match(target.textContent, /일부 조달 항목이 없어.*N\/A/);
});

test("sensitivities remain numeric comparisons and pin baseline to result P-IRR", () => {
  const { model, result, sensitivities } = onshoreOutput();
  const target = new TestElement("div");
  const misleading = sensitivities.map((item) => {
    if (item.key === "base") return { ...item, projectIrr: 0.999 };
    if (item.key === "priceDown") return { ...item, projectIrr: null };
    return item;
  });
  renderResults(target, result, misleading, model);

  assert.equal(byClass(target, "sensitivity-track").length, 0);
  assert.equal(byClass(target, "sensitivity-fill").length, 0);
  const rows = byClass(target, "sensitivity-row");
  assert.equal(rows.length, 5);
  assert.deepEqual(
    rows.map((row) => row.children[1].textContent),
    ["N/A", "5.80%", "7.11%", "6.08%", "7.20%"],
  );
  for (const label of ["판매단가 -10%", "발전량 -10%", "기준 시나리오", "CAPEX +10%", "금리 +1.0%p"]) {
    assert.match(target.textContent, new RegExp(label.replace(/[+]/g, "\\+")));
  }
  const markers = byClass(target, "sensitivity-baseline-marker");
  assert.equal(markers.length, 1);
  assert.equal(markers[0].getAttribute("data-baseline-position"), "center");
  assert.match(markers[0].textContent, /가운데 기준선.*기준 P-IRR 7\.11%/);
  assert.match(markers[0].getAttribute("aria-label"), /기준 시나리오.*가운데.*7\.11%/);
  const base = byAttribute(target, "data-sensitivity-key", "base")[0];
  assert.ok(base);
  assert.match(base.textContent, new RegExp(`${(result.projectIrr * 100).toFixed(2)}%`));
  assert.doesNotMatch(base.textContent, /99\.90%/);
  const unavailable = byAttribute(target, "data-sensitivity-key", "priceDown")[0];
  assert.equal(unavailable.children[2].textContent, "비교 N/A");
  assert.equal(byClass(target, "sensitivity-reason").length, 1);
  assert.match(
    byClass(target, "sensitivity-reason")[0].textContent,
    /수익률 부호 전환이 없거나 시나리오 계산이 완료되지 않았습니다/,
  );

  const highRateModel = createCase("onshore");
  highRateModel.finance.constructionRatePct = 213;
  const highRateResult = analyzeCase(highRateModel, "onshore");
  const highRateSensitivities = sensitivityCases(highRateModel, "onshore");
  assert.equal(highRateResult.errors.length, 0);
  assert.ok(Number.isFinite(highRateResult.projectIrr));
  assert.ok(Number.isNaN(highRateSensitivities.find((item) => item.key === "rateUp").projectIrr));
  renderResults(target, highRateResult, highRateSensitivities, highRateModel);
  assert.equal(byAttribute(target, "data-sensitivity-key", "rateUp")[0].children[2].textContent, "비교 N/A");
  assert.match(
    byClass(target, "sensitivity-reason")[0].textContent,
    /수익률 부호 전환이 없거나 시나리오 계산이 완료되지 않았습니다/,
  );
});

test("cash-flow keyboard entry schedules start alignment without changing horizontal scroll or semantics", async () => {
  const { model, result } = onshoreOutput();
  const target = new TestElement("div");
  renderCashFlow(target, result, model);

  const wrapper = byClass(target, "cashflow-scroll-region")[0];
  wrapper.scrollLeft = 137;
  wrapper.dispatchEvent({ type: "focus" });
  assert.equal(wrapper.scrollIntoViewCalls.length, 0, "focus correction must wait until native focus scrolling finishes");
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(wrapper.scrollIntoViewCalls, [{
    block: "start",
    inline: "nearest",
    behavior: "instant",
  }]);
  assert.equal(wrapper.scrollLeft, 137);
  const captions = byTag(wrapper, "caption");
  assert.equal(captions.length, 1);
  assert.equal(captions[0].textContent, "전체 사업 달력 현금흐름 · 좌우 스크롤로 열 확인");
  const keys = byClass(wrapper, "cashflow-key");
  assert.equal(keys.length, 1);
  assert.match(keys[0].textContent, /DSCR은 부채상환계수.*N\/A는 해당 단계/);
  assert.equal(keys[0].id, "cashflow-key");
  assert.equal(byTag(wrapper, "table")[0].getAttribute("aria-describedby"), keys[0].id);
  assert.equal(byTag(wrapper, "thead").length, 1);
  assert.ok(byTag(wrapper, "th").every((header) => ["col", "row"].includes(header.getAttribute("scope"))));
});

test("cash-flow table spans the calendar and exposes partial, balloon, and withheld states", () => {
  const { model, result } = onshoreOutput();
  const target = new TestElement("div");
  renderCashFlow(target, result, model);

  const headers = byTag(target, "thead")[0].children[0].children.map((cell) => cell.textContent);
  assert.deepEqual(headers, [
    "달력연도", "단계", "운영비율·일수", "발전·방전량(MWh)", "매출(억원)", "OPEX(억원)",
    "법인세(억원)", "이자(억원)", "원금(억원)", "연간 DSCR", "누적 DSCR", "배당(억원)",
    "프로젝트 CF(억원)", "자기자본 CF(억원)",
  ]);
  assert.equal(byTag(target, "caption").length, 1);
  assert.equal(byClass(target, "table-wrap")[0].tabIndex, 0);
  assert.match(byClass(target, "table-wrap")[0].getAttribute("aria-label"), /전체기간 현금흐름/);
  assert.equal(byTag(target, "tbody")[0].children.length, result.rows.length);
  assert.match(target.textContent, /2025년.*개발/s);
  assert.match(target.textContent, /2030년.*건설 \+ 운영.*부분연도.*184\/365일/s);
  assert.match(target.textContent, /2049년.*주민참여채권 만기 일시상환.*배당 유보/s);
  assert.match(target.textContent, /2050년.*부분연도.*181\/365일/s);
  assert.match(target.textContent, /N\/A/);
  assert.ok(byTag(target, "th").every((header) => ["col", "row"].includes(header.getAttribute("scope"))));
});

test("first operating year is annualized and construction IDC is included in interest", () => {
  const solarModel = createCase("solar");
  const solarResult = analyzeCase(solarModel, "solar");
  const resultsTarget = new TestElement("div");
  renderResults(resultsTarget, solarResult, sensitivityCases(solarModel, "solar"), solarModel);
  const generationMetric = byClass(resultsTarget, "metric")
    .find((item) => item.children[0].textContent === "연간 발전·방전량");
  const firstOperatingRow = solarResult.rows.find((row) => row.operationFraction > 0);
  const annualizedGWh = firstOperatingRow.generationMWh / firstOperatingRow.operationFraction / 1000;
  assert.equal(
    generationMetric.children[1].textContent,
    `${annualizedGWh.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}\u00a0GWh`,
  );
  assert.match(generationMetric.textContent, /첫 운영연도 실적을 1년으로 환산/);

  const { model, result } = onshoreOutput();
  const cashTarget = new TestElement("div");
  renderCashFlow(cashTarget, result, model);
  const row2028 = byTag(cashTarget, "tbody")[0].children
    .find((row) => row.children[0].textContent === "2028년");
  assert.equal(row2028.children[7].textContent, result.rows.find((row) => row.calendarYear === 2028)
    .constructionInterest.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
});

test("dividend and balloon states identify true causes without false withheld labels", () => {
  const { model, result } = onshoreOutput();
  const template = result.rows.find((row) => row.operationSequence > 0);
  const rows = [
    { ...template, calendarYear: 2061, year: 2061, dividend: 0, retainedCash: 10, distributableProfit: 10, legalReserveContribution: 0, dscr: 1, cumulativeDscr: 2 },
    { ...template, calendarYear: 2062, year: 2062, dividend: 0, retainedCash: 10, distributableProfit: 10, legalReserveContribution: 0, dscr: 2, cumulativeDscr: 1 },
    { ...template, calendarYear: 2063, year: 2063, dividend: 0, retainedCash: 0, distributableProfit: 10, dscr: 2, cumulativeDscr: 2, legalReserveContribution: 10 },
    { ...template, calendarYear: 2064, year: 2064, dividend: 0, retainedCash: 10, distributableProfit: 0, dscr: 2, cumulativeDscr: 2, legalReserveContribution: 0 },
    { ...template, calendarYear: 2065, year: 2065, seniorBalloon: 12.3, bondBalloon: 4.5, bondPrincipal: 4.5 },
    { ...template, calendarYear: 2066, year: 2066, dividend: 0, retainedCash: 10, distributableProfit: 10, legalReserveContribution: 0, dscr: 1.0999, cumulativeDscr: 2 },
    { ...template, calendarYear: 2067, year: 2067, dividend: 0, retainedCash: 10, distributableProfit: 10, legalReserveContribution: 0, dscr: 1.09999, cumulativeDscr: 2 },
    { ...template, calendarYear: 2068, year: 2068, dividend: 0, retainedCash: 10, distributableProfit: 10, legalReserveContribution: 0, dscr: 1.1, cumulativeDscr: 2 },
  ];
  const target = new TestElement("div");
  renderCashFlow(target, { errors: [], rows }, model);
  assert.match(target.textContent, /2061년.*배당 유보: 연간 DSCR 기준 미충족/s);
  assert.match(target.textContent, /2062년.*배당 유보: 누적 DSCR 기준 미충족/s);
  assert.match(target.textContent, /2063년.*배당 유보: 법정준비금 적립 기준/s);
  assert.match(target.textContent, /2064년.*배당 없음: 배당가능이익 없음/s);
  assert.doesNotMatch(byTag(target, "tbody")[0].children[3].textContent, /배당 유보/);
  assert.match(target.textContent, /2065년.*선순위 잔존원금 만기상환 12\.3\s억\u2060원.*주민참여채권 잔존원금 만기상환 4\.5\s억\u2060원/s);
  assert.match(target.textContent, /2066년.*연간 DSCR 기준 미충족\(1\.0999x < 1\.1000x\)/s);
  assert.match(target.textContent, /2067년.*연간 DSCR 기준 미충족\(1\.09999x < 1\.10000x\)/s);
  assert.doesNotMatch(byTag(target, "tbody")[0].children[7].textContent, /DSCR 기준 미충족/);

  const terminalModel = createCase("onshore");
  terminalModel.revenue.smpPrice *= 0.8;
  terminalModel.revenue.recPrice *= 0.8;
  const terminalResult = analyzeCase(terminalModel, "onshore");
  const terminalRow = terminalResult.rows.find((row) => row.isTerminalYear);
  assert.ok(terminalRow.terminalRetainedCashRecovery > 0);
  assert.ok(terminalRow.cumulativeDscr < terminalModel.assumptions.cumulativeDscrThreshold);
  renderCashFlow(target, terminalResult, terminalModel);
  assert.match(target.textContent, /2050년.*배당 유보: 누적 DSCR 기준 미충족/s);
  assert.doesNotMatch(byTag(target, "tbody")[0].children.at(-1).textContent, /배당 없음: 가용현금 없음/);
});

test("composite debt values fail closed when any required component is unavailable", () => {
  const { model, result } = onshoreOutput();
  const row = { ...result.rows.find((item) => item.operationSequence > 0) };
  delete row.bondInterest;
  delete row.bondPrincipal;
  const target = new TestElement("div");
  renderCashFlow(target, { errors: [], rows: [row] }, model);
  const rendered = byTag(target, "tbody")[0].children[0];
  assert.equal(rendered.children[7].textContent, "N/A");
  assert.equal(rendered.children[8].textContent, "N/A");
});

test("invalid, unavailable, and malicious strings clear stale output without markup execution", () => {
  const { model, result, sensitivities } = onshoreOutput();
  const resultsTarget = new TestElement("div");
  const cashTarget = new TestElement("div");
  renderResults(resultsTarget, result, sensitivities, model);
  renderCashFlow(cashTarget, result);

  const attack = `<img src=x onerror="globalThis.__resultsPwned=true">모델 오류`;
  renderResults(resultsTarget, { errors: [attack] }, [], model);
  renderCashFlow(cashTarget, { errors: [attack], rows: [] });
  assert.equal(byClass(resultsTarget, "metric").length, 0);
  assert.equal(byClass(resultsTarget, "sensitivity-baseline-marker").length, 0);
  assert.equal(byTag(cashTarget, "table").length, 0);
  assert.match(resultsTarget.textContent, /<img src=x/);
  assert.equal(byTag(resultsTarget, "img").length, 0);
  assert.equal(globalThis.__resultsPwned, undefined);

  assert.doesNotThrow(() => renderResults(resultsTarget, {
    errors: [], rows: [], capitalBreakdown: [{ id: "equipment", label: attack, value: Number.NaN }],
    fundingBreakdown: [], projectIrr: Number.NaN, equityIrr: undefined,
    equityIrrAfterInvestorTax: Number.POSITIVE_INFINITY, projectNpv: null,
    projectPayback: Number.NaN, annualGenerationMWh: Number.NaN, totalInvestment: Number.NaN,
  }, [{ key: "base", label: attack, projectIrr: Number.NaN }], { assumptions: { waccPct: Number.NaN } }));
  assert.match(resultsTarget.textContent, /N\/A/);
  const unavailableReturns = byClass(resultsTarget, "metric")
    .filter((item) => item.children[0].textContent.includes("IRR"));
  assert.ok(unavailableReturns.every((item) => /수익률 부호 전환이 없습니다/.test(item.textContent)));
  assert.ok(unavailableReturns.every((item) => !/산출할 수 없습니다/.test(item.textContent)));
  assert.match(resultsTarget.textContent, /현금흐름 또는 WACC가 유효하지 않아 산출할 수 없습니다/);
  assert.match(resultsTarget.textContent, /운영연도 발전·방전량을 확인할 수 없습니다/);
  assert.match(
    byClass(resultsTarget, "sensitivity-reason")[0].textContent,
    /수익률 부호 전환이 없거나 시나리오 계산이 완료되지 않았습니다/,
  );
  const unavailableMarker = byClass(resultsTarget, "sensitivity-baseline-marker")[0];
  assert.equal(unavailableMarker.getAttribute("data-baseline-position"), "center");
  assert.match(unavailableMarker.textContent, /기준 P-IRR N\/A/);
  assert.match(unavailableMarker.getAttribute("aria-label"), /기준 시나리오.*N\/A/);
  const unavailablePayback = byClass(resultsTarget, "metric")
    .find((item) => item.children[0].textContent === "P-PBP");
  assert.ok(unavailablePayback.children[1].className.split(/\s+/).includes("metric-value--compact"));
  assert.doesNotMatch(resultsTarget.textContent, /onerror/);

  assert.doesNotThrow(() => renderCashFlow(cashTarget, {
    errors: [],
    rows: [{ calendarYear: 2031, phase: attack, daysInYear: 365, operatingDays: 1, operationFraction: Number.NaN }],
  }));
  assert.match(cashTarget.textContent, /<img src=x/);
  assert.equal(byTag(cashTarget, "img").length, 0);
});
