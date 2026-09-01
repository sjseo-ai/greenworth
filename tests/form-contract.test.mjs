import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { CAPEX_CATEGORIES, createCase } from "../js/project-data.js";

class TestElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.className = "";
    this.id = "";
    this.type = "";
    this._value = "";
    this.required = false;
    this.hidden = false;
    this.clientWidth = 0;
    this.scrollWidth = 0;
    this.tabIndex = -1;
    this._listeners = new Map();
    this._textContent = "";
  }

  set value(value) {
    this._value = String(value);
  }

  get value() {
    return this._value;
  }

  append(...children) {
    children.forEach((child) => {
      child.parentNode = this;
      this.children.push(child);
    });
  }

  replaceChildren(...children) {
    this.children = [];
    this._textContent = "";
    this.append(...children);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener(type, listener) {
    const listeners = this._listeners.get(type) ?? [];
    listeners.push(listener);
    this._listeners.set(type, listeners);
  }

  emit(type, target = this) {
    const event = { target, preventDefault() {} };
    (this._listeners.get(type) ?? []).forEach((listener) => listener(event));
  }

  querySelectorAll(selector) {
    return descendants(this).slice(1).filter((element) => matchesSelector(element, selector));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (matchesSelector(current, selector)) return current;
      current = current.parentNode;
    }
    return null;
  }

  checkValidity() {
    if (this.tagName === "FORM") {
      return this.querySelectorAll("input, select").every((control) => control.checkValidity());
    }
    if (this.required && String(this.value).trim() === "") return false;
    if (this.type !== "number") return true;
    const value = Number(this.value);
    if (!Number.isFinite(value)) return false;
    if (this.min !== "" && this.min !== undefined && value < Number(this.min)) return false;
    if (this.max !== "" && this.max !== undefined && value > Number(this.max)) return false;
    if (this.step !== "" && this.step !== undefined && this.step !== "any") {
      const step = Number(this.step);
      const base = this.min !== "" && this.min !== undefined ? Number(this.min) : 0;
      const stepsFromBase = (value - base) / step;
      if (!Number.isFinite(step) || step <= 0 || Math.abs(stepsFromBase - Math.round(stepsFromBase)) > 1e-9) {
        return false;
      }
    }
    return true;
  }

  focus() {
    document.activeElement = this;
  }

  scrollIntoView(options) {
    this.scrollOptions = options;
  }

  click() {}

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  get textContent() {
    return `${this._textContent}${this.children.map((child) => child.textContent).join("")}`;
  }
}

globalThis.document = {
  createElement(tagName) {
    return new TestElement(tagName);
  },
};

const { renderForm } = await import("../js/form-view.js");

function descendants(root) {
  return [root, ...root.children.flatMap(descendants)];
}

function dataKey(attribute) {
  return attribute.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function matchesSingleSelector(element, selector) {
  const trimmed = selector.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith(".")) {
    return element.className.split(/\s+/).includes(trimmed.slice(1));
  }
  const attributePattern = /\[([^\]^$=]+)(\^=|\$=|=)?(?:['\"]([^'\"]*)['\"])?\]/g;
  const attributes = [...trimmed.matchAll(attributePattern)];
  const tag = trimmed.replace(attributePattern, "").trim();
  if (tag && element.tagName !== tag.toUpperCase()) return false;
  return attributes.every(([, attribute, operator, expected]) => {
    const actual = attribute.startsWith("data-")
      ? element.dataset[dataKey(attribute)]
      : element.getAttribute(attribute);
    if (!operator) return actual !== undefined && actual !== null;
    if (operator === "=") return String(actual) === expected;
    if (operator === "^=") return String(actual).startsWith(expected);
    if (operator === "$=") return String(actual).endsWith(expected);
    return false;
  });
}

function matchesSelector(element, selector) {
  return selector.split(",").some((part) => matchesSingleSelector(element, part));
}

function controls(root) {
  return descendants(root).filter((element) => ["INPUT", "SELECT", "BUTTON"].includes(element.tagName));
}

function render(technology, section) {
  const root = new TestElement("form");
  renderForm(root, createCase(technology), technology, section);
  return root;
}

function createAppHarness() {
  const ids = new Map();
  [
    "technology-switch",
    "section-navigation",
    "model-form",
    "results-content",
    "cashflow-content",
    "error-summary",
    "model-status",
    "section-index",
    "section-title",
    "section-description",
    "capacity-summary",
    "model-content",
    "reset-button",
    "export-button",
  ].forEach((id) => {
    const tag = id.endsWith("button") ? "button" : id === "model-form" ? "form" : "div";
    const element = new TestElement(tag);
    element.id = id;
    ids.set(id, element);
  });
  const appDocument = {
    activeElement: null,
    createElement(tagName) {
      return new TestElement(tagName);
    },
    querySelector(selector) {
      return selector.startsWith("#") ? ids.get(selector.slice(1)) ?? null : null;
    },
  };
  const timers = new Map();
  let timerSequence = 0;
  const appWindow = {
    clearTimeout(id) {
      timers.delete(id);
    },
    setTimeout(callback) {
      timerSequence += 1;
      timers.set(timerSequence, callback);
      return timerSequence;
    },
    matchMedia(query) {
      return { matches: query === "(prefers-reduced-motion: reduce)" };
    },
  };
  globalThis.document = appDocument;
  globalThis.window = appWindow;
  return {
    element(id) {
      return ids.get(id);
    },
    pendingTimers() {
      return timers.size;
    },
    runTimers() {
      const callbacks = [...timers.values()];
      timers.clear();
      callbacks.forEach((callback) => callback());
      return callbacks.length;
    },
  };
}

async function loadAppHarness(name) {
  const harness = createAppHarness();
  await import(new URL("../js/app.js?form-contract=" + name, import.meta.url));
  return harness;
}

function openCapex(harness) {
  const navigation = harness.element("section-navigation");
  const button = navigation.querySelector("[data-section='capex']");
  navigation.emit("click", button);
  return harness.element("model-form");
}

function assertInvalidCapacityState(harness) {
  const summary = harness.element("capacity-summary");
  const errorSummary = harness.element("error-summary");
  assert.equal(summary.textContent, "N/A");
  assert.doesNotMatch(summary.textContent, /NaN|Infinity/);
  assert.equal(harness.element("model-status").textContent, "입력 확인");
  assert.equal(errorSummary.hidden, false);
  assert.match(errorSummary.textContent, /설비용량과 대수는 유효한 양수여야/);
  assert.equal(harness.element("results-content").querySelectorAll(".metric").length, 0);
  assert.equal(harness.element("cashflow-content").querySelector("tbody")?.children.length ?? 0, 0);
}

test("section navigation honors the reduced-motion preference", async () => {
  const harness = await loadAppHarness("reduced-motion-scroll");

  openCapex(harness);

  assert.deepEqual(harness.element("model-content").scrollOptions, {
    behavior: "auto",
    block: "start",
  });
});

test("project section renders the v3 calendar and technology-specific P75 contract", () => {
  const onshore = render("onshore", "project");
  const onshorePaths = controls(onshore).map((control) => control.dataset.path).filter(Boolean);
  assert.deepEqual(onshorePaths, [
    "project.projectName",
    "project.unitCapacityMW",
    "project.units",
    "project.baseYear",
    "project.startYear",
    "project.developmentYears",
    "project.constructionYears",
    "project.codMonth",
    "project.operationYears",
    "project.p75NetCapacityFactorPct",
  ]);
  assert.match(onshore.textContent, /P75 순 이용률/);
  assert.match(onshore.textContent, /이미 손실을 반영한 순 이용률/);

  const ess = render("ess", "project");
  assert.equal(controls(ess).some((control) => /capacityFactor|p75/i.test(control.dataset.path ?? "")), false);
  assert.doesNotMatch(ess.textContent, /이용률/);
});

test("P75 accepts exact wind and solar preset precision without weakening other scalar steps", () => {
  for (const technology of ["offshore", "solar"]) {
    const project = render(technology, "project");
    const p75 = project.querySelector("[data-path='project.p75NetCapacityFactorPct']");
    assert.ok(p75);
    assert.equal(String(p75.step), "0.0001");
    assert.equal(p75.value, String(createCase(technology).project.p75NetCapacityFactorPct));
    assert.equal(p75.checkValidity(), true, `${technology} P75 preset should satisfy native validity`);
  }

  const solar = render("solar", "project");
  const p75 = solar.querySelector("[data-path='project.p75NetCapacityFactorPct']");
  p75.value = "15.2501";
  assert.equal(p75.checkValidity(), true);
  p75.value = "15.25001";
  assert.equal(p75.checkValidity(), false);

  const capex = render("onshore", "capex");
  const contingency = capex.querySelector("[data-path='capex.contingencyPct']");
  assert.equal(String(contingency.step), "0.1");
  contingency.value = "2.25";
  assert.equal(contingency.checkValidity(), false);
});

test("revenue section keeps current prices and exposes degradation only for solar and ESS", () => {
  const windPaths = controls(render("onshore", "revenue")).map((control) => control.dataset.path).filter(Boolean);
  assert.deepEqual(windPaths, [
    "revenue.revenueMode",
    "revenue.smpPrice",
    "revenue.recPrice",
    "revenue.recWeight",
  ]);

  const solar = render("solar", "revenue");
  assert.equal(controls(solar).some((control) => control.dataset.path === "project.degradationPct"), true);
  const ess = render("ess", "revenue");
  assert.equal(controls(ess).some((control) => control.dataset.path === "project.degradationPct"), true);
  assert.equal(
    [windPaths, controls(solar), controls(ess)].flat().some((entry) => {
      const path = typeof entry === "string" ? entry : entry.dataset.path;
      return path === "revenue.priceEscalationPct";
    }),
    false,
  );
});

test("CAPEX rows use the preset category enum while OPEX rows stay category-free", () => {
  const capex = render("onshore", "capex");
  const capexPaths = controls(capex).map((control) => control.dataset.path).filter(Boolean);
  assert.deepEqual(capexPaths, ["capex.constructionInflationPct", "capex.contingencyPct"]);
  const categorySelects = controls(capex).filter((control) => control.dataset.costField === "category");
  assert.equal(categorySelects.length, createCase("onshore").capex.items.length);
  categorySelects.forEach((select) => {
    assert.equal(select.tagName, "SELECT");
    assert.deepEqual(select.children.map((option) => [option.value, option.textContent]), CAPEX_CATEGORIES.map(({ id, label }) => [id, label]));
    assert.ok(select.getAttribute("aria-label"));
    assert.ok(select.getAttribute("aria-describedby"));
  });
  controls(capex)
    .filter((control) => control.dataset.costField === "value")
    .forEach((input) => {
      assert.equal(input.step, "any");
      assert.equal(input.checkValidity(), true);
    });

  const opex = render("onshore", "opex");
  assert.equal(controls(opex).some((control) => control.dataset.costField === "category"), false);
  assert.equal(createCase("onshore").opex.items.some((item) => "category" in item), false);
  controls(opex)
    .filter((control) => control.dataset.costField === "value")
    .forEach((input) => {
      assert.equal(input.step, "any");
      assert.equal(input.checkValidity(), true);
    });
});

test("baseline: preset CAPEX rows render intact and a user-added row exposes removal", () => {
  const model = createCase("onshore");
  const presetItems = model.capex.items.map(({ id, label }) => ({ id, label }));
  const customItem = {
    id: "custom-characterization",
    label: "사용자 추가 항목",
    value: 0,
    category: "indirect",
    userAdded: true,
  };
  model.capex.items.push(customItem);

  const root = new TestElement("form");
  renderForm(root, model, "onshore", "capex");
  const rows = descendants(root).filter((element) => element.dataset.costRow === "capex");

  assert.deepEqual(
    rows.slice(0, presetItems.length).map((row) => row.children[0].value),
    presetItems.map(({ label }) => label),
  );
  assert.equal(rows.length, presetItems.length + 1);
  const customRow = rows.at(-1);
  assert.equal(customRow.children[0].value, customItem.label);
  assert.equal(
    controls(customRow).some((control) => control.dataset.removeCost === "capex"),
    true,
  );
});

test("required preset CAPEX rows expose protected data semantics and no remove control", () => {
  const root = render("onshore", "capex");
  const rows = descendants(root).filter((element) => element.dataset.costRow === "capex");

  assert.equal(rows.length, createCase("onshore").capex.items.length);
  rows.forEach((row) => {
    assert.equal(row.dataset.costRemovable, "false");
    assert.ok(row.dataset.costItemId);
    assert.equal(
      controls(row).some((control) => control.dataset.removeCost === "capex"),
      false,
    );
  });
});

test("delegated remove attempts cannot delete a required preset CAPEX row", async () => {
  const harness = await loadAppHarness("protected-default");
  const form = openCapex(harness);
  const before = descendants(form)
    .filter((element) => element.dataset.costRow === "capex")
    .map((row) => row.children[0].value);
  const firstRow = descendants(form).find((element) => element.dataset.costRow === "capex");
  const forgedRemove = new TestElement("button");
  forgedRemove.dataset.removeCost = "capex";
  forgedRemove.dataset.costIndex = "0";
  firstRow.append(forgedRemove);

  form.emit("click", forgedRemove);

  const after = descendants(form)
    .filter((element) => element.dataset.costRow === "capex")
    .map((row) => row.children[0].value);
  assert.deepEqual(after, before);
  assert.equal(harness.pendingTimers(), 0);
});

test("a user-added CAPEX row remains removable and focus returns to the adjacent row", async () => {
  const harness = await loadAppHarness("user-added");
  const form = openCapex(harness);
  const presetCount = createCase("onshore").capex.items.length;
  const add = form.querySelector("[data-add-cost='capex']");

  form.emit("click", add);

  let rows = descendants(form).filter((element) => element.dataset.costRow === "capex");
  assert.equal(rows.length, presetCount + 1);
  const customRow = rows.at(-1);
  assert.equal(customRow.dataset.costRemovable, "true");
  assert.match(customRow.dataset.costItemId, /^custom-/);
  assert.equal(document.activeElement, customRow.children[0]);
  const remove = controls(customRow).find((control) => control.dataset.removeCost === "capex");
  assert.ok(remove);

  form.emit("click", remove);

  rows = descendants(form).filter((element) => element.dataset.costRow === "capex");
  assert.equal(rows.length, presetCount);
  assert.equal(rows.some((row) => row.dataset.costItemId.startsWith("custom-")), false);
  assert.equal(document.activeElement, rows.at(-1).children[0]);
  assert.equal(harness.pendingTimers(), 1);
});

test("debounced recalculation keeps named loading structure and only settles the latest valid revision", async () => {
  const harness = await loadAppHarness("loading-state");
  const form = harness.element("model-form");
  const results = harness.element("results-content");
  const cashflow = harness.element("cashflow-content");
  const status = harness.element("model-status");
  const capacity = form.querySelector("[data-path='project.unitCapacityMW']");
  const staleValue = descendants(results)
    .find((element) => element.className.split(/\s+/).includes("metric-value"))
    ?.textContent;
  assert.ok(staleValue);

  capacity.value = "6";
  form.emit("input", capacity);

  assert.equal(results.getAttribute("aria-busy"), "true");
  assert.equal(cashflow.getAttribute("aria-busy"), "true");
  ["P-IRR", "E-IRR (투자자 배당세 전)", "투자자 세후 E-IRR", "NPV", "P-PBP", "연간 발전·방전량"]
    .forEach((label) => assert.equal(results.textContent.includes(label), true));
  assert.match(results.textContent, /새 입력값을 반영하고 있습니다/);
  ["달력연도", "단계", "연간 DSCR", "프로젝트 CF(억원)"]
    .forEach((label) => assert.equal(cashflow.textContent.includes(label), true));
  const loadingCashflowRegion = cashflow.querySelector(".cashflow-scroll-region");
  assert.ok(loadingCashflowRegion);
  assert.equal(loadingCashflowRegion.tabIndex, -1);
  assert.equal(
    loadingCashflowRegion.getAttribute("aria-label"),
    "계산 중인 개발·건설·운영 전체기간 현금흐름 표",
  );
  assert.equal(results.textContent.includes(staleValue), false);
  assert.equal(harness.pendingTimers(), 1);

  capacity.value = "";
  form.emit("input", capacity);
  capacity.value = "7";
  form.emit("input", capacity);
  assert.equal(harness.pendingTimers(), 1);
  assert.equal(harness.runTimers(), 1);

  assert.equal(results.getAttribute("aria-busy"), "false");
  assert.equal(cashflow.getAttribute("aria-busy"), "false");
  assert.equal(status.textContent, "계산 완료");
  assert.doesNotMatch(results.textContent, /새 입력값을 반영하고 있습니다|가정을 확인해 주세요/);
  assert.match(results.textContent, /P-IRR/);
  assert.match(cashflow.textContent, /전체 사업 달력 현금흐름/);
});

test("blank unit capacity stays unavailable across navigation and recovers the finite total", async () => {
  const harness = await loadAppHarness("blank-unit-capacity-summary");
  const form = harness.element("model-form");
  const navigation = harness.element("section-navigation");
  let capacity = form.querySelector("[data-path='project.unitCapacityMW']");

  capacity.value = "";
  form.emit("input", capacity);
  assert.equal(harness.element("capacity-summary").textContent, "N/A");
  assert.equal(harness.runTimers(), 1);
  assertInvalidCapacityState(harness);

  navigation.emit("click", navigation.querySelector("[data-section='capex']"));
  assert.equal(harness.element("capacity-summary").textContent, "N/A");
  navigation.emit("click", navigation.querySelector("[data-section='project']"));
  assert.equal(harness.element("capacity-summary").textContent, "N/A");

  capacity = form.querySelector("[data-path='project.unitCapacityMW']");
  capacity.value = "5.3";
  form.emit("input", capacity);
  assert.equal(harness.element("capacity-summary").textContent, "42.4 MW");
  assert.equal(harness.runTimers(), 1);
  assert.equal(harness.element("model-status").textContent, "계산 완료");
  assert.equal(harness.element("error-summary").textContent, "");
  assert.equal(harness.element("results-content").querySelectorAll(".metric").length, 6);
  assert.ok(harness.element("cashflow-content").querySelector("tbody").children.length > 0);
});

test("blank unit count shows unavailable and recovers without leaking non-finite text", async () => {
  const harness = await loadAppHarness("blank-unit-count-summary");
  const form = harness.element("model-form");
  const units = form.querySelector("[data-path='project.units']");

  units.value = "";
  form.emit("input", units);
  assert.equal(harness.element("capacity-summary").textContent, "N/A");
  assert.equal(harness.runTimers(), 1);
  assertInvalidCapacityState(harness);

  units.value = "8";
  form.emit("input", units);
  assert.equal(harness.element("capacity-summary").textContent, "40 MW");
  assert.equal(harness.runTimers(), 1);
  assert.equal(harness.element("model-status").textContent, "계산 완료");
  assert.equal(harness.element("error-summary").textContent, "");
});

test("native step mismatches fail closed until the exact control is corrected", async () => {
  const harness = await loadAppHarness("native-step-mismatch");
  const form = openCapex(harness);
  const navigation = harness.element("section-navigation");
  const status = harness.element("model-status");
  const errorSummary = harness.element("error-summary");
  const results = harness.element("results-content");
  let value = form.querySelector("[data-path='capex.contingencyPct']");

  value.value = "2.25";
  form.emit("input", value);
  assert.equal(value.checkValidity(), false);
  assert.equal(harness.runTimers(), 1);

  assert.equal(status.textContent, "입력 확인");
  assert.match(errorSummary.textContent, /입력 형식과 허용 단위/);
  assert.equal(value.getAttribute("aria-invalid"), "true");
  assert.match(results.textContent, /가정을 확인해 주세요/);

  navigation.emit("click", navigation.querySelector("[data-section='opex']"));
  const opexValue = form.querySelector("[data-path='opex.insurancePct']");
  opexValue.value = "0.4";
  form.emit("input", opexValue);
  assert.equal(harness.runTimers(), 1);
  assert.equal(status.textContent, "입력 확인");
  assert.match(errorSummary.textContent, /입력 형식과 허용 단위/);

  openCapex(harness);
  value = form.querySelector("[data-path='capex.contingencyPct']");
  value.value = "2.2";
  form.emit("input", value);
  assert.equal(value.checkValidity(), true);
  assert.equal(harness.runTimers(), 1);

  assert.equal(status.textContent, "계산 완료");
  assert.equal(value.getAttribute("aria-invalid"), null);
  assert.equal(errorSummary.textContent, "");
  assert.doesNotMatch(results.textContent, /가정을 확인해 주세요/);
});

test("finance presets render as semantic read-only content alongside only v3 editable debt fields", () => {
  const finance = render("onshore", "finance");
  const editablePaths = controls(finance).map((control) => control.dataset.path).filter(Boolean);
  assert.deepEqual(editablePaths, [
    "finance.equityPct",
    "finance.residentBondPct",
    "finance.dsraMonths",
    "finance.financeFeePct",
    "finance.seniorRatePct",
    "finance.constructionRatePct",
    "finance.seniorTermYears",
    "finance.seniorGraceYears",
    "finance.bondRatePct",
    "finance.bondTermYears",
  ]);
  const preset = descendants(finance).find((element) => element.dataset.financePreset === "readonly");
  assert.ok(preset);
  assert.equal(controls(preset).length, 0);
  assert.equal(descendants(preset).some((element) => element.tagName === "DL"), true);
  [
    "WACC·할인율",
    "역사적 누진세율",
    "정액 감가상각",
    "이월결손금",
    "연간 DSCR",
    "누적 DSCR",
    "법정준비금 적립",
    "법정준비금 상한",
    "투자자 배당세",
    "출처",
    "한계",
    "현재 세무자문이 아닙니다",
  ].forEach((copy) => assert.match(preset.textContent, new RegExp(copy)));
  assert.match(finance.textContent, /원리금균등/);
  assert.match(finance.textContent, /만기일시상환/);
  assert.match(finance.textContent, /예정 부채상환액 개월/);
  assert.doesNotMatch(finance.textContent, /고정 OPEX 개월/);
});

test("rendered form controls have names and linked help without HTML string injection", async () => {
  for (const section of ["project", "revenue", "capex", "opex", "finance"]) {
    const root = render(section === "revenue" ? "solar" : "onshore", section);
    controls(root).forEach((control) => {
      const hasName = Boolean(control.getAttribute("aria-label"))
        || descendants(root).some((element) => element.tagName === "LABEL" && element.htmlFor === control.id);
      assert.equal(hasName, true, `${section} ${control.tagName} should have a programmatic name`);
      assert.ok(control.getAttribute("aria-describedby"), `${section} ${control.tagName} should link help text`);
    });
  }
  const source = await readFile(new URL("../js/form-view.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /innerHTML|insertAdjacentHTML/);
});

test("app source preserves v3 category, calendar synchronization, reset, export, and stale-result state", async () => {
  const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(source, /category:\s*"indirect"/);
  assert.match(source, /add\.dataset\.addCost\s*===\s*"capex"/);
  assert.match(source, /item\[input\.dataset\.costField\]/);
  assert.match(source, /project\.baseYear[\s\S]*capex\.baseYear[\s\S]*opex\.baseYear/);
  assert.match(source, /constructionWeights/);
  assert.match(source, /currentTechnology\s*=\s*button\.dataset\.technology[\s\S]*cases\.set\(currentTechnology, createCase\(currentTechnology\)\)/);
  assert.match(source, /cases\.set\(currentTechnology, createCase\(currentTechnology\)\)/);
  assert.match(source, /model:\s*currentModel\(\)/);
  assert.doesNotMatch(source, /resultsContent\.replaceChildren\(\)/);
  assert.doesNotMatch(source, /cashflowContent\.replaceChildren\(\)/);
  assert.match(source, /renderCalculationLoading\(\)/);
  assert.match(source, /renderCashFlow\(cashflowContent, result, model\)/);
  assert.match(source, /input\.value\.trim\(\)\s*===\s*""\s*\?\s*Number\.NaN/);
  assert.match(source, /aria-errormessage/);
  assert.match(source, /CAPEX_CATEGORIES[\s\S]*CAPEX 범주/);
  assert.match(source, /currentErrors[\s\S]*renderForm[\s\S]*applyModelErrors\(currentErrors\)/);
  assert.match(source, /사업 종료연도[\s\S]*project\.startYear[\s\S]*project\.operationYears/);
  assert.match(source, /data-technology[\s\S]*\.focus\(\)/);
  assert.match(source, /data-section[\s\S]*\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /revenue\.revenueMode[\s\S]*\.focus\(\)/);
  assert.match(source, /addedIndex[\s\S]*data-cost-field='label'[\s\S]*\.focus\(\)/);
  assert.match(source, /focusIndex[\s\S]*data-add-cost[\s\S]*\.focus\(\)/);
});

test("form source removes every legacy v2 input path", async () => {
  const source = await readFile(new URL("../js/form-view.js", import.meta.url), "utf8");
  [
    "project.capacityFactorPct",
    "project.gridLossPct",
    "project.residualPct",
    "project.decommissioningPct",
    "revenue.priceEscalationPct",
    "finance.waccPct",
    "finance.taxRatePct",
    "finance.depreciationYears",
    "finance.minDscr",
    "finance.dividendPayoutPct",
  ].forEach((path) => assert.doesNotMatch(source, new RegExp(path.replaceAll(".", "\\."))));
});
