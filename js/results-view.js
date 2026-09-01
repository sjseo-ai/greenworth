const CAPITAL_LINES = Object.freeze([
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
  { id: "debtServiceReserve", label: "DSRA" },
]);

const FUNDING_LINES = Object.freeze([
  { id: "equity", label: "자기자본", fallback: "equityPrincipal" },
  { id: "senior", label: "선순위대출", fallback: "seniorPrincipal" },
  { id: "residentBond", label: "주민참여채권", fallback: "bondPrincipal" },
]);

const SENSITIVITY_LABELS = Object.freeze({
  priceDown: "판매단가 -10%",
  yieldDown: "발전량 -10%",
  base: "기준 시나리오",
  capexUp: "CAPEX +10%",
  rateUp: "금리 +1.0%p",
});

const CASH_FLOW_HEADERS = Object.freeze([
  "달력연도", "단계", "운영비율·일수", "발전·방전량(MWh)", "매출(억원)", "OPEX(억원)",
  "법인세(억원)", "이자(억원)", "원금(억원)", "연간 DSCR", "누적 DSCR", "배당(억원)",
  "프로젝트 CF(억원)", "자기자본 CF(억원)",
]);

const RECONCILIATION_TOLERANCE = 0.000001;

function element(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function numeric(value, digits = 1) {
  return Number.isFinite(value)
    ? value.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : "N/A";
}

function percent(value, digits = 2) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "N/A";
}

function money(value, digits = 1) {
  return Number.isFinite(value) ? `${numeric(value, digits)}\u00a0억\u2060원` : "N/A";
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
  return rows.find((row) => Number.isFinite(row?.operationFraction)
    && row.operationFraction > 0 && Number.isFinite(row?.generationMWh) && Number.isFinite(row?.revenue));
}

function effectiveUnitPrice(result) {
  const row = annualizedRow(result);
  if (!row || !(row.generationMWh > 0)) return null;
  const annualGenerationMWh = row.generationMWh / row.operationFraction;
  const annualRevenue = row.revenue / row.operationFraction;
  if (!(annualGenerationMWh > 0) || !Number.isFinite(annualRevenue)) return null;
  return (annualRevenue * 100000) / annualGenerationMWh;
}

function appendPriceRange(parent, result) {
  const priceSection = section("판매단가 범위", "price-range-title");
  const highPrice = effectiveUnitPrice(result);
  if (!Number.isFinite(highPrice) || highPrice <= 0) {
    priceSection.append(emptyState(
      "단가 범위 산출 불가",
      "첫 운영연도 매출·발전량을 확인할 수 없어 최저·최고단가를 표시할 수 없습니다.",
    ));
    parent.append(priceSection);
    return;
  }
  const lowPrice = highPrice * 0.9;
  const wrap = element("div", "price-range");
  wrap.append(element(
    "p",
    "price-range-caption",
    "실효 판매단가는 첫 운영연도 매출을 발전·방전량으로 환산한 값이며, 최저단가는 「판매단가 -10%」 민감도 시나리오를 반영합니다.",
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
    digits,
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
  const difference = Number.isFinite(capitalTotal) && Number.isFinite(investmentTotal)
    ? capitalTotal - investmentTotal : null;
  list.append(reconciliationRow("사업비 조정차이", difference));
  capitalSection.append(list);
  if (!Number.isFinite(capitalTotal)) {
    capitalSection.append(element(
      "p",
      "model-note unavailable-note",
      "일부 총사업비 항목이 없어 총사업비 합계와 조정차이는 N/A입니다.",
    ));
  } else if (Number.isFinite(difference) && Math.abs(difference) > RECONCILIATION_TOLERANCE) {
    capitalSection.append(element(
      "p",
      "model-note reconciliation-error-note",
      "총사업비 명세와 엔진 총투자비가 일치하지 않습니다. 가정과 계산 상태를 확인해 주세요.",
    ));
  }
  capitalSection.append(element(
    "p",
    "model-note capital-reserve-note",
    "DSRA는 대출상환을 위해 예치했다가 종료 시 회수하는 준비금이며, 소비되는 공사비나 OPEX가 아닙니다.",
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
  const difference = Number.isFinite(fundingTotal) && Number.isFinite(result.totalInvestment)
    ? fundingTotal - result.totalInvestment : null;
  list.append(reconciliationRow("조달 조정차이", difference));
  fundingSection.append(list);
  if (!Number.isFinite(fundingTotal)) {
    fundingSection.append(element(
      "p",
      "model-note unavailable-note",
      "일부 조달 항목이 없어 조달 합계와 조정차이는 N/A입니다.",
    ));
  } else if (Number.isFinite(difference) && Math.abs(difference) > RECONCILIATION_TOLERANCE) {
    fundingSection.append(element(
      "p",
      "model-note reconciliation-error-note",
      "조달 합계와 총투자비가 일치하지 않습니다. 자본구조와 계산 상태를 확인해 주세요.",
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
    `가운데 기준선 · 기준 P-IRR ${baselineValue}`,
  );
  baselineMarker.setAttribute("data-baseline-position", "center");
  baselineMarker.setAttribute("role", "note");
  baselineMarker.setAttribute(
    "aria-label",
    `기준 시나리오의 가운데 기준선: 기준 P-IRR ${baselineValue}`,
  );
  list.append(baselineMarker);
  if (scenarios.length === 0) {
    list.append(emptyState("민감도 산출 불가", "유효한 기준 시나리오를 확인해 주세요."));
  }
  let hasUnavailableScenario = !Number.isFinite(result.projectIrr);
  scenarios.forEach((scenario) => {
    const key = typeof scenario?.key === "string" ? scenario.key : "unknown";
    const value = key === "base" ? result.projectIrr : scenario?.projectIrr;
    const difference = Number.isFinite(value) && Number.isFinite(result.projectIrr)
      ? (value - result.projectIrr) * 100 : null;
    const unavailable = !Number.isFinite(value);
    if (unavailable) hasUnavailableScenario = true;
    const comparison = unavailable
      ? "비교 N/A"
      : key === "base"
        ? "기준"
        : Number.isFinite(difference)
        ? `기준 대비 ${difference >= 0 ? "+" : ""}${difference.toFixed(2)}%p`
        : "기준 N/A";
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
      "N/A 사유: 수익률 부호 전환이 없거나 시나리오 계산이 완료되지 않았습니다.",
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
  const total = sum(events.map((event) => event.drawAmount));
  list.append(amountRow("증설 CAPEX 합계", total, "funding-row reconciliation-row"));
  augmentationSection.append(list);
  augmentationSection.append(element(
    "p",
    "model-note",
    "증설 CAPEX는 총사업비 11개 명세에 포함되지 않는 운영기간 중 재투자이며, 해당 연도의 배당가능현금을 우선 사용하고 부족하면 자기자본을 추가로 투입합니다.",
  ));
  parent.append(augmentationSection);
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

export function renderResults(target, result, sensitivities, model) {
  const errors = resultErrors(result);
  if (errors.length > 0) {
    target.replaceChildren(emptyState("가정을 확인해 주세요.", errors.join(" ")));
    return;
  }

  const metrics = element("div", "metric-grid");
  metrics.append(metric(
    "P-IRR",
    percent(result?.projectIrr),
    Number.isFinite(result?.projectIrr)
      ? "법인세 후 프로젝트 CF 기준" : "수익률 부호 전환이 없습니다.",
    "primary",
  ));
  metrics.append(metric(
    "E-IRR (투자자 배당세 전)",
    percent(result?.equityIrr),
    Number.isFinite(result?.equityIrr)
      ? "법인세 후 출자·배당 CF, 투자자 배당세 전 기준" : "수익률 부호 전환이 없습니다.",
    "highlight",
  ));
  metrics.append(metric(
    "투자자 세후 E-IRR",
    percent(result?.equityIrrAfterInvestorTax),
    Number.isFinite(result?.equityIrrAfterInvestorTax)
      ? "투자자 배당세 차감 후 자기자본 CF 기준" : "수익률 부호 전환이 없습니다.",
    "highlight",
  ));
  const wacc = model?.assumptions?.waccPct;
  metrics.append(metric(
    "NPV",
    money(result?.projectNpv),
    Number.isFinite(result?.projectNpv) && Number.isFinite(wacc)
      ? `WACC ${numeric(wacc, 3)}% 읽기 전용 프리셋 기준`
      : "현금흐름 또는 WACC가 유효하지 않아 산출할 수 없습니다.",
    "highlight",
    true,
  ));
  const payback = result?.projectPayback;
  const paybackValue = Number.isFinite(payback)
    ? `${numeric(payback)}년` : payback === null ? "기\u2060간\u00a0내\u00a0미\u2060회\u2060수" : "N/A";
  metrics.append(metric(
    "P-PBP",
    paybackValue,
    payback !== null && !Number.isFinite(payback)
      ? "프로젝트 CF 누적 경로를 확인할 수 없습니다."
      : "누적 법인세 후 프로젝트 CF가 0 이상이 되는 시점",
    "",
    !Number.isFinite(payback),
  ));
  const firstOperatingRow = Array.isArray(result?.rows)
    ? result.rows.find((row) => Number.isFinite(row?.operationFraction)
      && row.operationFraction > 0 && Number.isFinite(row?.generationMWh))
    : null;
  const generation = firstOperatingRow
    ? firstOperatingRow.generationMWh / firstOperatingRow.operationFraction
    : result?.annualGenerationMWh;
  metrics.append(metric(
    "연간 발전·방전량",
    Number.isFinite(generation) ? `${numeric(generation / 1000)}\u00a0GWh` : "N/A",
    Number.isFinite(generation)
      ? "첫 운영연도 실적을 1년으로 환산한 발전량 또는 ESS 방전량"
      : "운영연도 발전·방전량을 확인할 수 없습니다.",
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
    "본 결과는 실제 달력의 개발·건설·부분 운영연도, 법인세, 이자·원금, 배당 제한과 회수 가능한 준비금을 반영한 사전검토 값입니다.",
  ));
  target.replaceChildren(content);
}

function dividendState(row, assumptions) {
  if (!(row?.operationSequence > 0) || row?.dividend !== 0) return "";
  if (Number.isFinite(row?.legalReserveContribution) && row.legalReserveContribution > 0
      && Number.isFinite(row?.distributableProfit) && row.distributableProfit > 0) {
    return "배당 유보: 법정준비금 적립 기준";
  }
  if (!(row?.distributableProfit > 0)) return "배당 없음: 배당가능이익 없음";
  const availableCash = Number.isFinite(row?.retainedCash) ? row.retainedCash : 0;
  const terminalCash = Number.isFinite(row?.terminalRetainedCashRecovery) ? row.terminalRetainedCashRecovery : 0;
  if (!(availableCash + terminalCash > 0)) return "배당 없음: 가용현금 없음";
  const failed = [];
  if (Number.isFinite(row?.dscr) && Number.isFinite(assumptions?.annualDscrThreshold)
      && row.dscr < assumptions.annualDscrThreshold) {
    failed.push(`연간 DSCR 기준 미충족(${ratioComparison(row.dscr, assumptions.annualDscrThreshold)})`);
  }
  if (Number.isFinite(row?.cumulativeDscr) && Number.isFinite(assumptions?.cumulativeDscrThreshold)
      && row.cumulativeDscr < assumptions.cumulativeDscrThreshold) {
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
  if (Number.isFinite(row?.operatingDays) && Number.isFinite(row?.daysInYear)
      && row.operatingDays > 0 && row.operatingDays < row.daysInYear) {
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
  return Number.isFinite(row.operatingDays) && Number.isFinite(row.daysInYear)
    ? `${fraction} (${row.operatingDays}/${row.daysInYear}일)` : fraction;
}

function sumRowFields(row, fields) {
  const values = fields.map((field) => row?.[field]);
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
    numeric(row?.equityFlow),
  ];
}

export function renderCashFlow(target, result, model) {
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
    "전체 사업 달력 현금흐름 · 좌우 스크롤로 열 확인",
  ));
  const key = element(
    "p",
    "cashflow-key",
    "DSCR은 부채상환계수이며, N/A는 해당 단계에서 값이 의미 없거나 산출할 수 없음을 뜻합니다.",
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
