import { analyzeCase, sensitivityCases } from "./finance.js";
import { canRemoveCostItem, renderForm, SECTIONS } from "./form-view.js";
import { CAPEX_CATEGORIES, createCase, TECHNOLOGIES } from "./project-data.js";
import { renderCashFlow, renderResults } from "./results-view.js";

const technologySwitch = document.querySelector("#technology-switch");
const sectionNavigation = document.querySelector("#section-navigation");
const form = document.querySelector("#model-form");
const resultsContent = document.querySelector("#results-content");
const cashflowContent = document.querySelector("#cashflow-content");
const errorSummary = document.querySelector("#error-summary");
const status = document.querySelector("#model-status");
const cases = new Map();
let currentTechnology = "onshore";
let currentSection = "project";
let calculationTimer = 0;
let customItemSequence = 0;
let currentErrors = [];
const nativeInvalidFields = new Map();

const NATIVE_VALIDITY_ERROR = "입력 형식과 허용 단위를 확인해 주세요.";

const LOADING_METRICS = Object.freeze([
  { label: "P-IRR", primary: true },
  { label: "E-IRR (투자자 배당세 전)" },
  { label: "투자자 세후 E-IRR" },
  { label: "NPV", compact: true },
  { label: "P-PBP" },
  { label: "연간 발전·방전량" },
]);

const LOADING_CASH_FLOW_HEADERS = Object.freeze([
  "달력연도", "단계", "운영비율·일수", "발전·방전량(MWh)", "매출(억원)", "OPEX(억원)",
  "법인세(억원)", "이자(억원)", "원금(억원)", "연간 DSCR", "누적 DSCR", "배당(억원)",
  "프로젝트 CF(억원)", "자기자본 CF(억원)",
]);

function loadingNode(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderCalculationLoading() {
  const resultsState = document.createElement("div");
  resultsState.dataset.calculationState = "loading";
  const metrics = loadingNode("div", "metric-grid");
  LOADING_METRICS.forEach(({ label, primary = false, compact = false }) => {
    const metric = loadingNode("article", `metric${primary ? " metric-primary" : ""}`);
    metric.append(loadingNode("span", "metric-label", label));
    metric.append(loadingNode("strong", `metric-value${compact ? " metric-value--compact" : ""}`, "계산 중"));
    metric.append(loadingNode("small", "metric-description", "새 입력값을 반영하고 있습니다."));
    metrics.append(metric);
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
    "전체 사업 달력 현금흐름. 새 입력값을 반영하고 있습니다.",
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
      index === 0 ? "새 입력값 반영 중" : "—",
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
    `계산 중인 개발·건설·운영 전체기간 현금흐름 표${overflows ? ", 좌우로 스크롤 가능" : ""}`,
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
  SECTIONS.forEach((section, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "section-button";
    button.dataset.section = section.id;
    button.setAttribute("aria-label", `${section.label} 입력 단계 열기. ${section.description}`);
    if (section.id === currentSection) button.setAttribute("aria-current", "step");
    const number = document.createElement("span");
    number.className = "step-number";
    number.textContent = String(index + 1).padStart(2, "0");
    const label = document.createElement("span");
    label.textContent = section.label;
    button.append(number, label);
    sectionNavigation.append(button);
  });
}

function updateCapacitySummary(model) {
  const capacity = model.project.unitCapacityMW * model.project.units;
  document.querySelector("#capacity-summary").textContent = Number.isFinite(capacity)
    ? `${capacity.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} MW`
    : "N/A";
}

function renderSection() {
  const model = currentModel();
  const meta = SECTIONS.find((section) => section.id === currentSection) ?? SECTIONS[0];
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
  const invalid = (input.type === "number" && input.value.trim() === "") || !input.checkValidity();
  const invalidFields = nativeInvalidFields.get(currentTechnology) ?? new Set();
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
  const hasNativeValidityError = !form.checkValidity()
    || (nativeInvalidFields.get(currentTechnology)?.size ?? 0) > 0;
  const errors = hasNativeValidityError
    ? [...analysis.errors, NATIVE_VALIDITY_ERROR]
    : analysis.errors;
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
  const marked = new Set();
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
    block: "start",
  });
});

form.addEventListener("input", (event) => {
  const input = event.target;
  const model = currentModel();
  if (input.dataset.path) {
    const value = input.dataset.boolean === "true"
      ? input.value === "true"
      : input.type === "number"
        ? input.value.trim() === "" ? Number.NaN : Number(input.value)
        : input.value;
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
      const value = input.dataset.costField === "value"
        ? input.value.trim() === "" ? Number.NaN : Number(input.value)
        : input.value;
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
    const item = add.dataset.addCost === "capex"
      ? { id, label: "추가 항목", value: 0, category: "indirect", userAdded: true }
      : { id, label: "추가 항목", value: 0, userAdded: true };
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
    const permitted = row?.dataset.costRow === type
      && row.dataset.costRemovable === "true"
      && row.dataset.costItemId === item?.id
      && canRemoveCostItem(type, item);
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
  const payload = { exportedAt: new Date().toISOString(), technology: currentTechnology, model: currentModel() };
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
