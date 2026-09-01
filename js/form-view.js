import { CAPEX_CATEGORIES } from "./project-data.js";

export const SECTIONS = [
  { id: "project", label: "사업 개요", description: "설비 규모와 개발, 건설, 상업운전 일정을 정의합니다." },
  { id: "revenue", label: "발전·매출", description: "발전량 또는 ESS 운전량과 고정 판매가격 구조를 설정합니다." },
  { id: "capex", label: "CAPEX", description: "사업비를 범주별로 분류하고 건설비 물가와 예비비를 반영합니다." },
  { id: "opex", label: "OPEX", description: "고정·변동 운영비, 보험료, 주민기여와 물가상승을 반영합니다." },
  { id: "finance", label: "금융·세무", description: "자본구조와 부채 조건을 편집하고 예시 세무·배당 프리셋을 확인합니다." },
];

const projectFields = [
  { path: "project.projectName", label: "사업명", type: "text", wide: true, hint: "내보내는 가정 파일에 포함되는 식별명입니다." },
  { path: "project.unitCapacityMW", label: "발전기·설비 1대 용량", unit: "MW", min: 0.1, step: 0.1, hint: "ESS는 PCS 기준 출력 용량입니다." },
  { path: "project.units", label: "설비 대수", unit: "대", min: 1, step: 1, hint: "총 설비용량은 1대 용량과 대수의 곱입니다." },
  { path: "project.baseYear", label: "기준연도", unit: "년", min: 1900, max: 2200, step: 1, hint: "비용과 가격 가정의 기준이 되는 달력연도입니다." },
  { path: "project.startYear", label: "사업 시작연도", unit: "년", min: 1900, max: 2200, step: 1, hint: "개발기간이 시작되는 달력연도입니다." },
  { path: "project.developmentYears", label: "개발기간", unit: "년", min: 0, max: 20, step: 1, hint: "인허가와 개발비가 집행되는 기간입니다." },
  { path: "project.constructionYears", label: "공사기간", unit: "년", min: 1, max: 10, step: 1, hint: "직접비는 개발·건설 집행곡선에 따라 배분됩니다." },
  { path: "project.codMonth", label: "상업운전 개시월", unit: "월", min: 1, max: 12, step: 1, hint: "1월부터 12월 사이의 정수이며 첫 운영연도는 실제 일수로 계산합니다." },
  { path: "project.operationYears", label: "운영기간", unit: "년", min: 1, max: 40, step: 1, hint: "상업운전 개시일부터 종료일까지의 전체 운영기간입니다." },
  { path: "project.p75NetCapacityFactorPct", label: "P75 순 이용률", unit: "%", min: 0.1, max: 100, step: 0.0001, hint: "이미 손실을 반영한 순 이용률입니다. 모델에서 손실을 다시 차감하지 않습니다." },
];

const standardRevenueFields = [
  { path: "revenue.revenueMode", label: "판매가격 방식", type: "select", options: [{ value: "smpRec", label: "SMP + REC" }, { value: "fixed", label: "고정 입찰·PPA" }], hint: "시장가격 조합 또는 계약기간 고정가격을 선택합니다." },
  { path: "revenue.smpPrice", label: "SMP", unit: "원/kWh", min: 0, step: 1, mode: "smpRec", hint: "모델 전체 기간에 고정 적용하는 전력 판매 기준단가입니다." },
  { path: "revenue.recPrice", label: "REC", unit: "원/REC", min: 0, step: 1, mode: "smpRec", hint: "모델 전체 기간에 고정 적용하는 REC 단가입니다." },
  { path: "revenue.recWeight", label: "REC 가중치", unit: "배", min: 0, step: 0.1, mode: "smpRec", hint: "기술과 주민참여 조건에 따른 최종 가중치입니다." },
  { path: "revenue.bidPrice", label: "고정 입찰·PPA 단가", unit: "원/kWh", min: 0, step: 1, mode: "fixed", hint: "계약기간 전체에 고정 적용하는 판매단가입니다." },
];

const essRevenueFields = [
  { path: "revenue.revenueMode", label: "수익 방식", type: "select", options: [{ value: "hybrid", label: "시장차익 + 용량요금" }, { value: "fixed", label: "고정 용량 입찰" }], hint: "고정 입찰은 충·방전 차익을 제외하고 용량요금만 반영합니다." },
  { path: "revenue.durationHours", label: "저장시간", unit: "시간", min: 0.5, max: 12, step: 0.5, hint: "정격 출력으로 방전 가능한 시간입니다." },
  { path: "revenue.cyclesPerYear", label: "연간 운전 사이클", unit: "회/년", min: 0, max: 730, step: 1, hint: "연간 충전과 방전 횟수 가정입니다." },
  { path: "revenue.roundTripEfficiencyPct", label: "왕복효율(설비+배터리)", unit: "%", min: 1, max: 100, step: 0.1, hint: "변압기(154TR·22.9TR)·PCS 충방전·케이블 손실과 배터리 DC 왕복효율을 곱한 충전 대비 방전 전력 비율입니다. 효성중공업 운전효율계산시트의 SDI·LGES·SKon 3사 제안값 평균을 기본값으로 사용합니다." },
  { path: "revenue.auxConsumptionPct", label: "소내소비율", unit: "%", min: 0, max: 50, step: 0.1, hint: "PCS 대기전력, 배터리 냉각·BMS, LPMS 등 소내소비 부하가 충전전력량에서 차지하는 비율입니다. 왕복효율 적용 후 방전량에서 추가로 차감하며, 두 값을 곱한 실효값이 시트의 “운전효율”입니다." },
  { path: "revenue.chargePrice", label: "충전 전력단가", unit: "원/kWh", min: 0, step: 1, mode: "hybrid", hint: "시장차익 계산에 고정 적용하는 전력 구매단가입니다." },
  { path: "revenue.dischargePrice", label: "방전 전력단가", unit: "원/kWh", min: 0, step: 1, mode: "hybrid", hint: "시장차익 계산에 고정 적용하는 전력 판매단가입니다." },
  { path: "revenue.capacityPrice", label: "용량·입찰 단가", unit: "원/kW·월", min: 0, step: 100, hint: "정격출력에 월 단가를 곱해 연간 수익을 계산합니다." },
];

const degradationField = {
  path: "project.degradationPct",
  label: "연간 성능저하율",
  unit: "%/년",
  min: 0,
  max: 99,
  step: 0.1,
  hint: "태양광 발전량 또는 ESS 가용 운전량에 매년 적용합니다.",
};

const essRampUpFields = Array.from({ length: 15 }, (_, index) => ({
  path: `revenue.rampUpFactors.${index}`,
  label: `${index + 1}년차 가동률 배수`,
  unit: "배",
  min: 0,
  max: 1.5,
  step: 0.01,
  hint: "연간 운전 사이클에 곱하는 해당 연차 배수입니다. 1배는 정상 가동률과 동일합니다.",
}));

const essAugmentationFields = [
  { path: "project.augmentation.enabled", label: "배터리 증설(Augmentation) 적용", type: "boolean", hint: "정기적으로 배터리를 보강해 열화된 용량을 회복하는 운영기간 중 재투자를 반영합니다." },
  { path: "project.augmentation.intervalYears", label: "증설 주기", unit: "년", min: 1, max: 20, step: 1, hint: "몇 년마다 배터리를 증설할지 정합니다. 마지막 운영연도에는 증설하지 않습니다." },
  { path: "project.augmentation.capacityRestorePct", label: "용량 회복률", unit: "%", min: 0, max: 100, step: 1, hint: "증설 시점까지 열화된 용량 중 회복하는 비율입니다. 100%는 정격용량으로 완전 회복을 의미합니다." },
  { path: "project.augmentation.unitCostPerKWh", label: "증설 단가", unit: "원/kWh", min: 0, step: 1000, hint: "회복하는 배터리 용량 1kWh당 증설 비용입니다." },
  { path: "project.augmentation.costEscalationPct", label: "증설 단가 상승률", unit: "%/년", min: 0, max: 15, step: 0.1, hint: "기준연도 이후 증설 시점까지 배터리 단가에 복리 적용하는 상승률입니다." },
];

const essLtsaStepFields = [
  { path: "opex.ltsaStepAfterYear", label: "LTSA 단가 변경 시점", unit: "운영 연차 이후", min: 0, max: 40, step: 1, hint: "배터리·PCS LTSA 항목에만 적용합니다. 0은 변경 없음을 뜻하며, 3이면 4년차부터 변경 단가가 적용됩니다." },
  { path: "opex.ltsaStepMultiplierPct", label: "변경 후 단가 배율", unit: "%", min: 0, max: 500, step: 1, hint: "제조사 워런티 종료 후 등 LTSA 계약 단가가 바뀌는 배율입니다. 100%는 변경 없음을 뜻합니다." },
];

const capexFields = [
  { path: "capex.constructionInflationPct", label: "건설비 물가상승률", unit: "%/년", min: 0, max: 30, step: 0.1, hint: "기준연도 이후의 개발·건설 집행액에 복리 적용합니다." },
  { path: "capex.contingencyPct", label: "예비비", unit: "세부 CAPEX %", min: 0, max: 30, step: 0.1, hint: "설계변경, 물량증가, 미확정 범위에 대한 버퍼입니다." },
];

const opexFields = [
  { path: "opex.variableOMPerMWh", label: "변동 O&M", unit: "원/MWh", min: 0, step: 100, hint: "발전량 또는 ESS 방전량에 비례하는 비용입니다." },
  { path: "opex.insurancePct", label: "연간 운영보험료율", unit: "총투자비 %", min: 0, max: 5, step: 0.01, hint: "재물손해, 휴지, 배상책임 등 운영보험의 합산율입니다." },
  { path: "opex.communityRevenuePct", label: "주민·지역 기여", unit: "매출 %", min: 0, max: 10, step: 0.1, hint: "지역발전기금 또는 매출연동 상생비용입니다." },
  { path: "opex.escalationPct", label: "OPEX 물가상승률", unit: "%/년", min: 0, max: 15, step: 0.1, hint: "고정 운영비에 매년 복리 적용합니다." },
];

const financeGroups = [
  { title: "자본구조", description: "자기자본, 선순위 대출, 주민참여채권과 회수 가능한 준비금을 정합니다.", fields: [
    { path: "finance.equityPct", label: "자기자본 비율", unit: "%", min: 0.1, max: 99.9, step: 0.1, hint: "나머지는 선순위 대출과 주민참여채권으로 조달합니다." },
    { path: "finance.residentBondPct", label: "주민참여채권 비율", unit: "총투자비 %", min: 0, max: 50, step: 0.1, hint: "총투자비 중 주민참여채권으로 조달하는 비율입니다." },
    { path: "finance.dsraMonths", label: "DSRA", unit: "예정 부채상환액 개월", min: 0, max: 24, step: 1, hint: "예정 부채상환액 기준의 회수 가능한 준비금이며 운영 종료 시 회수합니다." },
    { path: "finance.financeFeePct", label: "금융부대비용", unit: "타인자본 %", min: 0, max: 10, step: 0.1, hint: "주선, 약정, 법률, 실사, 발행 수수료를 포괄합니다." },
  ] },
  { title: "대출·채권 조건", description: "선순위는 거치 후 원리금균등 상환하고 주민참여채권은 만기일시상환합니다.", fields: [
    { path: "finance.seniorRatePct", label: "선순위 대출금리", unit: "%", min: 0, max: 30, step: 0.1, hint: "운영기간의 선순위 대출 이자율입니다." },
    { path: "finance.constructionRatePct", label: "건설기간 적용금리", unit: "%", min: 0, max: 30, step: 0.1, hint: "기초 잔액과 반기 신규 인출액에 건설이자를 계산합니다." },
    { path: "finance.seniorTermYears", label: "선순위 상환기간", unit: "년", min: 1, max: 40, step: 1, hint: "거치기간을 포함한 운영기준 만기입니다." },
    { path: "finance.seniorGraceYears", label: "원금 거치기간", unit: "년", min: 0, max: 10, step: 1, hint: "거치 종료 후 잔여기간에 원리금균등 상환합니다." },
    { path: "finance.bondRatePct", label: "주민참여채권 금리", unit: "%", min: 0, max: 30, step: 0.1, hint: "채권 보유자에게 지급하는 연간 이자율입니다." },
    { path: "finance.bondTermYears", label: "주민참여채권 만기", unit: "년", min: 1, max: 40, step: 1, hint: "원금은 명시한 만기에 일시 상환합니다." },
  ] },
];

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
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
    if (definition.min !== undefined) input.min = definition.min;
    if (definition.max !== undefined) input.max = definition.max;
    if (definition.step !== undefined) input.step = definition.step;
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

export function canRemoveCostItem(type, item) {
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
    const rowContent = type === "capex"
      ? [label, categorySelect(item, index, descriptionId), valueWrap]
      : [label, valueWrap];
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
  const total = model[type].items.reduce((sum, item) => sum + Number(item.value), 0);
  const totalRow = node("div", "cost-total");
  totalRow.append(node("span", "", "입력 항목 합계"), node("strong", "", `${total.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} 억원`));
  container.append(header, list, totalRow);
  return container;
}

function taxBracketsText(brackets) {
  let lower = 0;
  return brackets.map((bracket) => {
    const range = bracket.upTo === null
      ? `${lower}억원 초과`
      : lower === 0 ? `${bracket.upTo}억원 이하` : `${lower}억원 초과 ${bracket.upTo}억원 이하`;
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
    ["한계", model.metadata.limitations],
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

export function renderForm(target, model, technology, section) {
  target.replaceChildren();
  if (section === "project") {
    const fields = technology === "ess" ? projectFields.slice(0, -1) : projectFields;
    target.append(group(model, "설비와 사업 일정", "기준연도부터 개발, 건설, 상업운전 종료까지의 달력을 설정합니다.", fields));
  }
  if (section === "revenue") {
    const definitions = technology === "ess" ? essRevenueFields : standardRevenueFields;
    const visible = definitions.filter((item) => !item.mode || item.mode === model.revenue.revenueMode);
    if (technology === "solar" || technology === "ess") visible.push(degradationField);
    target.append(group(model, technology === "ess" ? "운전과 수익" : "발전과 고정 판매가격", "판매단가는 모델 전체 기간에 고정되며 별도 상승률을 적용하지 않습니다.", visible));
    if (technology === "ess") {
      target.append(group(
        model,
        "가동률 램프업",
        "운영 15개 연차 전체에 대해 가동률 배수를 각각 지정합니다. 1배는 정상 가동률과 동일하며, 운영기간이 15년보다 짧으면 초과 연차의 값은 사용하지 않습니다.",
        essRampUpFields,
      ));
      target.append(group(
        model,
        "배터리 증설(Augmentation)",
        "정기적으로 배터리를 보강해 열화된 용량을 회복하는 운영기간 중 재투자이며, 자기자본 배당 재원과 감가상각에 반영됩니다.",
        essAugmentationFields,
      ));
    }
  }
  if (section === "capex") {
    target.append(
      costGroup(model, "capex", "범주별 사업비", "각 항목의 CAPEX 범주와 불변가격 기준 금액을 입력합니다."),
      group(model, "건설비 조정", "기준연도 이후 건설비와 미확정 공사범위를 반영합니다.", capexFields),
    );
  }
  if (section === "opex") {
    target.append(
      costGroup(model, "opex", "연간 고정 운영비", "운영 첫해 기준 고정비이며 CAPEX 범주를 사용하지 않습니다."),
      group(model, "변동·연동 운영비", "발전량, 총투자비 또는 매출에 연동되는 비용입니다.", opexFields),
    );
    if (technology === "ess") {
      target.append(group(
        model,
        "LTSA 단가 변경",
        "배터리·PCS LTSA 항목(위 고정 운영비의 “배터리·PCS LTSA”)에만 지정 연차 이후 새 단가를 적용합니다.",
        essLtsaStepFields,
      ));
    }
  }
  if (section === "finance") {
    financeGroups.forEach((item) => target.append(group(model, item.title, item.description, item.fields)));
    target.append(financePreset(model));
  }
}
