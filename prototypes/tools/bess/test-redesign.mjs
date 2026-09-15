// Redesign verification (web-app-blueprint.md + result-tabs-design-spec.md): values unchanged, 6 tabs + lazy rendering,
// summary tab (chart/kv/detail), sensitivity heatmap/tornado/metric switch, scenario win/lose table, KCH matrix,
// 44px targets, responsive widths (with the platform-equivalent viewport meta), light/dark screenshots.
import { readFileSync, writeFileSync } from "node:fs";

const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
const SRC = `${SP}/ess-bid-price-prototype.html`;
const WRAPPED = `${SP}/redesign-wrapped.html`;
// The artifact platform wraps content in <head><meta viewport>…</head><body>; reproduce that so widths are real.
writeFileSync(WRAPPED, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>\n' + readFileSync(SRC, "utf8") + "\n</body></html>", "utf8");
const URL_ = "file:///" + WRAPPED.replace(/^\//, "");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, detail = "") => { if (!ok) failures++; console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail !== "" ? " — " + detail : ""}`); };

async function open() {
  const tab = await (await fetch("http://127.0.0.1:9335/json/new?" + encodeURIComponent(URL_), { method: "PUT" })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const errors = [];
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text + " " + (m.params.exceptionDetails.exception?.description ?? ""));
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console.error: " + m.params.args.map((a) => a.value ?? a.description).join(" "));
  });
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error("evaluate failed: " + expression + " :: " + JSON.stringify(r.result.exceptionDetails));
    return r.result?.result?.value;
  };
  await send("Runtime.enable"); await send("Page.enable");
  return { send, ev, errors };
}
const shot = async (p, file) => {
  const r = await p.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${SP}/${file}`, Buffer.from(r.result.data, "base64"));
  console.log("     screenshot:", file);
};
const setVal = (p, id, v) => p.ev(`(()=>{const e=document.getElementById(${JSON.stringify(id)}); e.value=${JSON.stringify(String(v))}; e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const txt = (p, id) => p.ev(`document.getElementById(${JSON.stringify(id)}).textContent.trim()`);
const val = (p, id) => p.ev(`document.getElementById(${JSON.stringify(id)}).value`);
const count = (p, sel) => p.ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const click = (p, id) => p.ev(`document.getElementById(${JSON.stringify(id)}).click()`);

const p = await open();
await p.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await p.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
await sleep(400);
await p.ev("localStorage.clear()");
await p.send("Page.reload"); await sleep(1500);

console.log("=== 1) values unchanged by the redesign ===");
check("heroBidPrice = 22.51", (await txt(p, "heroBidPrice")) === "22.51", await txt(p, "heroBidPrice"));
check("kpiPIrr = 7.86%", (await txt(p, "kpiPIrr")) === "7.86%", await txt(p, "kpiPIrr"));
check("kpiNpv = 239.8 억원", (await txt(p, "kpiNpv")) === "239.8 억원", await txt(p, "kpiNpv"));
check("kchLifetimeTotal = 137.67 억원", (await txt(p, "kchLifetimeTotal")) === "137.67 억원", await txt(p, "kchLifetimeTotal"));
check("6.5 bidPrice = 23.63", (await val(p, "bidPrice")) === "23.63", await val(p, "bidPrice"));
check("solveStatus ok", (await p.ev("document.getElementById('solveStatus').className")).includes("ok"));
check("crossRefIrr filled", (await txt(p, "crossRefIrr")).includes("7.86%"), await txt(p, "crossRefIrr"));
check("timing shows 재계산 Nms", /^재계산 \d+ms$/.test(await txt(p, "timing")), await txt(p, "timing"));
check("opRate grid has 15 rows", (await count(p, "#opRateGrid [data-oprate-index]")) === 15);

console.log("=== 2) KPI cards — k/v/s, primary ×3 + scale ×3, outside tabs ===");
check("#cards has 3 .card.primary", (await count(p, "#cards > .card.primary")) === 3);
check("#cards-scale has 3 .card.scale", (await count(p, "#cards-scale > .card.scale")) === 3);
check("every card has k/v/s", (await p.ev("[...document.querySelectorAll('#cards > .card, #cards-scale > .card')].every(c=>c.querySelector('.k')&&c.querySelector('.v')&&c.querySelector('.s'))")) === true);
check("kpiFundingSplit filled", (await txt(p, "kpiFundingSplit")).startsWith("자기자본 "), await txt(p, "kpiFundingSplit"));
check("kpiKchShare = 20%", (await txt(p, "kpiKchShare")) === "20%", await txt(p, "kpiKchShare"));
check("cards are not inside a tabpanel", (await p.ev("!document.getElementById('cards').closest('.tabpanel')")) === true);

console.log("=== 2b) CAPEX — ① 공사비 ② 개발·간접비 ③ 부대비용, 총사업비 = 총투자비 ===");
check("CAPEX groups: 7 / 5 / 2 inputs", (await count(p, "#capexItems [data-capex-index]")) === 7 && (await count(p, "#capexSoftItems [data-capex-index]")) === 5 && (await count(p, "#capexAncillaryItems [data-capex-index]")) === 2);
check("예비비·금융수수료·건설이자·DSRA are inputs in D", (await p.ev("['contingencyPct','financeFeePct','constructionRatePct','dsraMonths'].every(id=>document.getElementById(id).closest('#capexBody'))")) === true);
const bdTotal = await p.ev("document.querySelector('#capexBreakdownBody tr.strong td').textContent");
check("breakdown total = 총투자비 KPI", bdTotal === (await txt(p, "kpiTotalInvestment")), `${bdTotal} vs ${await txt(p, "kpiTotalInvestment")}`);
const bdParts = await p.ev(`(()=>{const rows=[...document.querySelectorAll('#capexBreakdownBody tr')]; const v=(r)=>parseFloat(r.querySelector('td').textContent.replace(/,/g,'')); const vals=rows.map(v); const t=vals.at(-1); const sub=vals.slice(3,-1).reduce((a,b)=>a+b,0); return {sum123: vals[0]+vals[1]+vals[2], t, anc: vals[2], sub, labels: rows.map(r=>r.querySelector('th').firstChild.textContent)};})()`);
check("① + ② + ③ = 총사업비", Math.abs(bdParts.sum123 - bdParts.t) < 0.15, JSON.stringify(bdParts));
check("③ = 보험 + 예비비 + 금융수수료 + 건설이자 + DSRA", Math.abs(bdParts.anc - bdParts.sub) < 0.3, `${bdParts.anc} vs ${bdParts.sub}`);
check("D summary shows 총 1,130억", (await txt(p, "capexAccTotal")) === "총 1,130억", await txt(p, "capexAccTotal"));
await setVal(p, "capexItem13", 20); await sleep(300);
const tinv20 = parseFloat((await txt(p, "kpiTotalInvestment")).replace(/,/g, ""));
check("기타 부대비용 20억 → 총투자비·단가 상승", tinv20 > 1150 && parseFloat(await txt(p, "heroBidPrice")) > 22.51, `${tinv20} / ${await txt(p, "heroBidPrice")}`);
check("기타 부대비용 row appears when > 0", (await p.ev("[...document.querySelectorAll('#capexBreakdownBody th')].some(t=>t.textContent.includes('기타 부대비용'))")) === true);
await setVal(p, "capexItem13", 0); await sleep(300);
check("기타 부대비용 0 → back to 22.51", (await txt(p, "heroBidPrice")) === "22.51", await txt(p, "heroBidPrice"));
await setVal(p, "capexInputMode", "lumpsum"); await sleep(300);
check("EPC 총액 모드: ① 공사비 합계 960.0 채움 · 단가 불변", (await val(p, "capexLumpSum")) === "960.0" && (await txt(p, "heroBidPrice")) === "22.51", `${await val(p, "capexLumpSum")} / ${await txt(p, "heroBidPrice")}`);
check("EPC 총액 모드에서도 ②·③ 칸은 보인다", (await p.ev("getComputedStyle(document.getElementById('capexSoftItems')).display !== 'none' && document.getElementById('capexSoftItems').offsetParent !== null")) === true);
await setVal(p, "capexInputMode", "itemized"); await sleep(300);

console.log("=== 2c) 자금조달 금액 입력 · 선순위 고정+변동(CD) 금리 ===");
check("기본: 비율 모드 · 선순위 첫해 적용금리 5.20%", (await val(p, "fundingMode")) === "ratio" && (await p.ev("document.querySelector('#seniorRateBody td').textContent")) === "5.20%", await p.ev("document.querySelector('#seniorRateBody td').textContent"));
check("자금조달 구성: 자기자본 339.0 · 합계 1,130.0", (await p.ev("document.querySelector('#fundingBreakdownBody td').textContent")) === "339.0 억원" && (await p.ev("document.querySelector('#fundingBreakdownBody tr.strong td').textContent")) === "1,130.0 억원");
await setVal(p, "fundingMode", "amount"); await sleep(400);
check("금액 모드 전환: 지금 금액 채움(339.0 / 56.5) · 단가 거의 불변", (await val(p, "equityAmount")) === "339.0" && (await val(p, "bondAmount")) === "56.5" && Math.abs(parseFloat(await txt(p, "heroBidPrice")) - 22.51) <= 0.02,
  `${await val(p, "equityAmount")} / ${await val(p, "bondAmount")} / ${await txt(p, "heroBidPrice")}`);
check("금액 모드: 금액 칸 보이고 비율 칸 숨김", (await p.ev("getComputedStyle(document.getElementById('fundingAmountWrap')).display !== 'none' && getComputedStyle(document.getElementById('fundingRatioWrap')).display === 'none'")) === true);
await setVal(p, "equityAmount", 400); await sleep(400);
const fb = await p.ev(`[...document.querySelectorAll('#fundingBreakdownBody tr')].map(r=>parseFloat(r.querySelector('td').textContent.replace(/,/g,'')))`);
check("자기자본 400억 → 선순위 = 총사업비 − 400 − 주민채권", Math.abs(fb[0] - 400) < 0.05 && Math.abs(fb[1] - (fb[3] - 400 - fb[2])) < 0.15, JSON.stringify(fb));
await setVal(p, "fundingMode", "ratio"); await sleep(400);
check("비율 모드 복귀 → 22.51", (await txt(p, "heroBidPrice")) === "22.51", await txt(p, "heroBidPrice"));
await setVal(p, "seniorFixedSharePct", 50); await sleep(400);
check("고정 50% · CD 평탄(2.8+2.4=5.2) → 단가 불변 22.51", (await txt(p, "heroBidPrice")) === "22.51", await txt(p, "heroBidPrice"));
check("CD금리 전망 칸 = 상환기간 10개", (await count(p, "#cdRateGrid [data-cd-index]")) === 10);
await setVal(p, "cdRate1", 3.8); await sleep(400);
check("2년차 CD 3.8% → 단가 상승", parseFloat(await txt(p, "heroBidPrice")) > 22.51, await txt(p, "heroBidPrice"));
await setVal(p, "cdBaseRatePct", 3.0); await sleep(400);
check("기준 CD 변경 → 고치지 않은 칸만 따라감(1년차 3, 2년차 3.8 유지)", (await val(p, "cdRate0")) === "3" && (await val(p, "cdRate1")) === "3.8", `${await val(p, "cdRate0")} / ${await val(p, "cdRate1")}`);
await setVal(p, "cdBaseRatePct", 2.8); await sleep(300);
await p.ev("document.getElementById('applyCdBtn').click()"); await sleep(400);
await setVal(p, "seniorFixedSharePct", 100); await sleep(400);
check("일괄 적용 · 고정 100% 복귀 → 22.51", (await txt(p, "heroBidPrice")) === "22.51", await txt(p, "heroBidPrice"));

console.log("=== 3) summary tab (default) + lazy rendering ===");
check("default tab = 요약", (await p.ev("document.getElementById('tab-summary').getAttribute('aria-selected')")) === "true");
check("lazy: sensitivity NOT computed while hidden", (await count(p, "#macroSensBody tr")) === 0, `${await count(p, "#macroSensBody tr")} rows`);
check("cashflow chart: revenue bars", (await count(p, "#summaryChart svg rect.cf-rev")) >= 15, `${await count(p, "#summaryChart svg rect.cf-rev")}`);
check("cashflow chart: cumulative line + legend outside SVG", (await count(p, "#summaryChart svg polyline.cf-cum")) === 1 && (await count(p, "#summaryChart > .legend span")) === 7);
check("ribbon: 운영 label = operation years (15), not calendar years (16)", (await p.ev("[...document.querySelectorAll('#summaryChart svg text.ph-txt')].map(t=>t.textContent).join('|')")) === "개발 1년|운영 15년", await p.ev("[...document.querySelectorAll('#summaryChart svg text.ph-txt')].map(t=>t.textContent).join('|')"));
check("cashflow chart: phase ribbons", (await count(p, "#summaryChart svg [class^='ph-rib-']")) >= 2);
check("basis kv table ≥ 18 rows, 전각 공백 계층", (await count(p, "#summaryBasis table.kv tr")) >= 18 && (await p.ev("[...document.querySelectorAll('#summaryBasis th')].some(t=>t.textContent.startsWith('\\u3000'))")) === true);
check("basis: 적정 입찰단가 22.51 원/kWh", (await p.ev("document.querySelector('#summaryBasis tr.strong td').textContent")) === "22.51 원/kWh");
check("detail table: 17 years, 16 op-rows", (await count(p, "#summaryDetail tbody tr")) === 17 && (await count(p, "#summaryDetail tbody tr.op-row")) === 16, `${await count(p, "#summaryDetail tbody tr")}/${await count(p, "#summaryDetail tbody tr.op-row")}`);
check("detail table: no all-zero numeric column", (await p.ev(`(()=>{const rows=[...document.querySelectorAll('#summaryDetail tbody tr')]; const n=document.querySelectorAll('#summaryDetail thead th').length; for(let c=2;c<n;c++){ if(rows.every(r=>/^[-−]?0(\\.0+)?$|^—$/.test(r.children[c].textContent.replace(/[%배,]/g,'').trim()))) return false;} return true;})()`)) === true);
check("#warnings hidden when empty", (await p.ev("document.getElementById('warnings').hidden")) === true);

console.log("=== 4) tabs ===");
const tabs = ["tab-summary", "tab-sens", "tab-scenario", "tab-price", "tab-kch", "tab-caveats"];
for (const t of tabs) {
  await click(p, t); await sleep(80);
  const state = await p.ev(`[...document.querySelectorAll('.tab')].map(b=>b.id+':'+b.getAttribute('aria-selected')+':'+document.getElementById(b.dataset.panel).hidden).join(' ')`);
  const okAll = state.split(" ").every((s) => { const [id, sel, hid] = s.split(":"); return id === t ? (sel === "true" && hid === "false") : (sel === "false" && hid === "true"); });
  check(`click ${t} → only its panel visible`, okAll, okAll ? "" : state);
}
check("tab strip: no vertical overflow (no scroll arrows)", (await p.ev("(()=>{const t=document.querySelector('.tabs'); return t.scrollHeight<=t.clientHeight;})()")) === true);
await click(p, "tab-summary");
await p.ev("document.querySelector('[data-goto-tab]').click()"); await sleep(100);
check("notice link jumps to 확정 필요 항목 tab", (await p.ev("document.getElementById('panel-caveats').hidden")) === false);
await p.ev("document.getElementById('tab-kch').focus()");
await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
await sleep(80);
check("ArrowRight on tab-kch → tab-caveats selected", (await p.ev("document.getElementById('tab-caveats').getAttribute('aria-selected')")) === "true");

console.log("=== 5) sensitivity — heatmap, 2-line cells, tornado, metric switch ===");
await click(p, "tab-sens"); await sleep(300);
check("opening tab computes matrices (7 + 7 rows)", (await count(p, "#macroSensBody tr")) === 7 && (await count(p, "#epcSensBody tr")) === 7);
check("base cells: outline class .base ×2", (await count(p, "#macroSensBody td.base, #epcSensBody td.base")) === 2);
check("base cell E-IRR = sensBaseIrr", (await p.ev("document.querySelector('#macroSensBody td.base .cell-main').textContent")) === (await val(p, "sensBaseIrr")), await val(p, "sensBaseIrr"));
check("2-line cells (.cell-main + .cell-sub)", (await count(p, "#macroSensBody td .cell-main")) === 49 && (await count(p, "#macroSensBody td .cell-sub")) === 49);
check("heat classes present (green & red)", (await count(p, "#macroSensBody .heat-5, #macroSensBody .heat-4")) > 0 && (await count(p, "#macroSensBody .heat-1, #macroSensBody .heat-2")) > 0);
check("row/col heads show actual values (.basev)", (await count(p, "#macroSensHead .basev")) === 7 && (await count(p, "#macroSensBody th .basev")) === 7);
check("tornado: 3 rows sorted by range", (await count(p, "#sensTornado text.tn-label")) === 3);
const firstCellBefore = await p.ev("document.querySelector('#macroSensBody td .cell-main').textContent");
const timingBefore = await txt(p, "timing");
await setVal(p, "sensMetric", "companyProfitPreTax"); await sleep(120);
check("metric switch: cells now in 억", (await p.ev("document.querySelector('#macroSensBody td .cell-main').textContent")).endsWith("억") && firstCellBefore.endsWith("%"), await p.ev("document.querySelector('#macroSensBody td .cell-main').textContent"));
check("metric switch: labels follow", (await p.ev("[...document.querySelectorAll('[data-sens-metric-label]')].every(e=>e.textContent==='당사 누적 순이익 (세전)')")) === true);
check("metric switch: no full recalc (hero unchanged)", (await txt(p, "heroBidPrice")) === "22.51" && (await txt(p, "timing")) === timingBefore);
await setVal(p, "sensMetric", "equityIrr"); await sleep(80);

console.log("=== 6) reset to defaults ===");
await setVal(p, "contractCapacityMW", 80);
await setVal(p, "targetCompanyProfit", 150);
await setVal(p, "operationYears", 10);
await setVal(p, "kchLeaseBase", 3);
await setVal(p, "capexInputMode", "lumpsum");
await setVal(p, "bidPrice", 30); // breaks the 6.5 link (manual mode)
await sleep(300);
check("precondition: hero changed", (await txt(p, "heroBidPrice")) !== "22.51", await txt(p, "heroBidPrice"));
check("sens tab re-rendered on input while visible", (await val(p, "sensBaseIrr")) !== "" );
await click(p, "reset"); await sleep(600);
check("reset → contractCapacityMW 96", (await val(p, "contractCapacityMW")) === "96");
check("reset → targetCompanyProfit 100", (await val(p, "targetCompanyProfit")) === "100");
check("reset → kchLeaseBase 1.5", (await val(p, "kchLeaseBase")) === "1.5");
check("reset → capexInputMode itemized + items visible", (await val(p, "capexInputMode")) === "itemized" && (await p.ev("getComputedStyle(document.getElementById('capexItemizedWrap')).display")) !== "none");
check("reset → opRate grid back to 15 rows", (await count(p, "#opRateGrid [data-oprate-index]")) === 15);
check("reset → heroBidPrice 22.51", (await txt(p, "heroBidPrice")) === "22.51", await txt(p, "heroBidPrice"));
check("reset → 6.5 link restored (bidPrice 23.63)", (await val(p, "bidPrice")) === "23.63", await val(p, "bidPrice"));
await click(p, "tab-summary"); await sleep(150);
check("summary re-rendered after returning (17 rows, hero price)", (await count(p, "#summaryDetail tbody tr")) === 17 && (await p.ev("document.querySelector('#summaryBasis tr.strong td').textContent")) === "22.51 원/kWh");

console.log("=== 7) scenarios — chart + comparison table (columns = scenarios, win/lose) ===");
await click(p, "tab-scenario");
check("empty state message in chart", (await p.ev("document.getElementById('scenarioPriceChart').textContent")).includes("저장된 시나리오가 없습니다"));
await setVal(p, "scenarioName", "리디자인 검증");
await click(p, "saveScenarioBtn"); await sleep(500);
check("scenario chart has 1 bar", (await count(p, ".price-bar-row")) === 1);
const savedCapex = await p.ev("JSON.parse(localStorage.getItem('essBidPriceScenarios.v1'))[0].state.capexItems");
check("saved capexItems in index order (14칸 · 보험 6 @11 · 부지 5 @12 · 기타 0 @13)", savedCapex.length === 14 && savedCapex[11] === "6" && savedCapex[12] === "5" && savedCapex[13] === "0", JSON.stringify(savedCapex));
check("single scenario → no win/lose", (await count(p, "#scenarioCompareBody .win, #scenarioCompareBody .lose")) === 0);
await setVal(p, "contractCapacityMW", 90); await sleep(300);
await setVal(p, "scenarioName", "용량 90MW");
await click(p, "saveScenarioBtn"); await sleep(500);
check("scenario chart has 2 bars", (await count(p, ".price-bar-row")) === 2);
check("compare table: 2 group-head rows", (await count(p, "#scenarioCompareBody tr.group-head")) === 2);
check("compare table: head = 구분 + 2 scenarios", (await count(p, "#scenarioCompareHead th")) === 3);
check("compare table: win & lose marked", (await count(p, "#scenarioCompareBody td.win")) > 0 && (await count(p, "#scenarioCompareBody td.lose")) > 0);
check("lower bid price = win", (await p.ev(`(()=>{const tr=[...document.querySelectorAll('#scenarioCompareBody tr')].find(r=>r.firstElementChild.textContent==='적정 입찰단가(원/kWh)'); const tds=[...tr.querySelectorAll('td')]; const nums=tds.map(t=>parseFloat(t.textContent.replace(/,/g,''))); const w=tds.findIndex(t=>t.classList.contains('win')); return nums[w]===Math.min(...nums);})()`)) === true);
check("reference row (연간 매출, values differ) is not colored", (await p.ev(`(()=>{const tr=[...document.querySelectorAll('#scenarioCompareBody tr')].find(r=>r.firstElementChild.textContent==='연간 매출(환산, 억원)'); const t=[...tr.querySelectorAll('td')]; return t[0].textContent!==t[1].textContent && !t.some(x=>x.classList.contains('win')||x.classList.contains('lose'));})()`)) === true);
check("scenario row buttons use .btn", (await p.ev("[...document.querySelectorAll('#scenarioList button')].every(b=>b.classList.contains('btn'))")) === true);
await click(p, "reset"); await sleep(600);

console.log("=== 8) KCH matrix ===");
await click(p, "tab-kch"); await sleep(80);
check("KCH matrix: 11 rows, 1 base cell, heat classes", (await count(p, "#kchSensBody tr")) === 11 && (await count(p, "#kchSensBody td.base")) === 1 && (await count(p, "#kchSensBody [class*='heat-']")) > 0);
check("KCH 설비용량·저장용량 = 계약용량 연동 (96 / 576, 읽기 전용)", (await val(p, "kchCapacityMW")) === "96" && (await val(p, "kchStorageMWh")) === "576" && (await p.ev("document.getElementById('kchCapacityMW').disabled && document.getElementById('kchStorageMWh').disabled")) === true,
  `${await val(p, "kchCapacityMW")} / ${await val(p, "kchStorageMWh")}`);
check("KCH 합산 IRR = 14.93% (수수료 + 당사 지분), 수수료만 50.76%는 설명으로", (await txt(p, "kchAchievedIrr")) === "14.93%" && (await txt(p, "kchIrrNote")).includes("50.76%"), `${await txt(p, "kchAchievedIrr")} | ${await txt(p, "kchIrrNote")}`);
check("KCH 민감도표 기준 칸 = 합산 IRR 14.9%", (await p.ev("document.querySelector('#kchSensBody td.base').textContent")) === "14.9%", await p.ev("document.querySelector('#kchSensBody td.base').textContent"));
check("KCH 민감도 축에 96 MW(현재)", (await p.ev("document.getElementById('kchSensHead').textContent")).includes("96 MW현재"), await p.ev("document.getElementById('kchSensHead').textContent"));
await setVal(p, "contractCapacityMW", 90); await sleep(500);
check("계약용량 90 → KCH 설비용량 90 · 저장용량 540 · 축 90 MW(현재)", (await val(p, "kchCapacityMW")) === "90" && (await val(p, "kchStorageMWh")) === "540" && (await p.ev("document.getElementById('kchSensHead').textContent")).includes("90 MW현재"));
check("용량이 바뀌어도 KCH 수취액 137.67 억원 불변", (await txt(p, "kchLifetimeTotal")) === "137.67 억원", await txt(p, "kchLifetimeTotal"));
await setVal(p, "contractCapacityMW", 96); await sleep(500);
check("계약용량 96으로 복귀 → 22.51", (await txt(p, "heroBidPrice")) === "22.51" && (await val(p, "kchCapacityMW")) === "96", await txt(p, "heroBidPrice"));

console.log("=== 9) 44px touch targets ===");
const heights = await p.ev(`(()=>{const h=(s)=>{const e=document.querySelector(s); return e? Math.round(e.getBoundingClientRect().height):-1}; return {num:h('#contractCapacityMW'), text:h('#projectName'), date:h('#codDate'), select:h('#solveMode'), btn:h('#reset'), tab:h('#tab-sens'), summary:h('.acc > summary'), capexItem:h('[data-capex-index="0"]')};})()`);
for (const [k, v] of Object.entries(heights)) check(`${k} ≥ 44px`, v >= 44, `${v}px`);
await click(p, "tab-sens"); await sleep(150);
check("sensMetric select ≥ 44px", (await p.ev("Math.round(document.getElementById('sensMetric').getBoundingClientRect().height)")) >= 44);

console.log("=== 10) responsive — no page-level horizontal scroll ===");
for (const w of [1440, 1180, 1024, 760, 375]) {
  await p.send("Emulation.setDeviceMetricsOverride", { width: w, height: 1000, deviceScaleFactor: 1, mobile: w <= 760 });
  await sleep(250);
  await p.ev("document.querySelectorAll('details.acc').forEach(d=>d.open=true)");
  let bad = [];
  for (const t of tabs) { await click(p, t); await sleep(60);
    const sw = await p.ev("document.documentElement.scrollWidth"), cw = await p.ev("document.documentElement.clientWidth");
    if (sw > cw + 1) bad.push(`${t} ${sw}>${cw}`);
  }
  check(`w=${w}: no horizontal overflow on any tab`, bad.length === 0, bad.join(", "));
  const cols = await p.ev("getComputedStyle(document.getElementById('layout')).gridTemplateColumns.split(' ').length");
  check(`w=${w}: layout columns = ${w > 1180 ? 2 : 1}`, cols === (w > 1180 ? 2 : 1), `${cols}`);
  const cardCols = await p.ev("getComputedStyle(document.getElementById('cards')).gridTemplateColumns.split(' ').length");
  check(`w=${w}: KPI cards ${w > 760 ? 3 : 1} per row`, cardCols === (w > 760 ? 3 : 1), `${cardCols}`);
}
await p.ev("document.querySelectorAll('details.acc').forEach((d,i)=>d.open=i<2)");
await p.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await click(p, "tab-summary"); await sleep(300);
await p.ev("window.scrollTo(0,0)");
await shot(p, "tabs-1440-light.png");
await p.ev("document.getElementById('tab-summary').scrollIntoView()"); await sleep(150);
await shot(p, "tabs-1440-summary.png");
await click(p, "tab-sens"); await sleep(300);
await p.ev("document.getElementById('tab-sens').scrollIntoView()"); await sleep(150);
await shot(p, "tabs-1440-sens.png");
await p.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 1400, deviceScaleFactor: 1, mobile: true });
await click(p, "tab-summary"); await sleep(300); await p.ev("window.scrollTo(0,0)");
await shot(p, "tabs-390-light.png");
await p.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await p.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
await click(p, "tab-sens"); await sleep(300); await p.ev("document.getElementById('tab-sens').scrollIntoView()"); await sleep(150);
await shot(p, "tabs-1440-dark-sens.png");
await click(p, "tab-summary"); await sleep(300); await p.ev("document.getElementById('tab-summary').scrollIntoView()"); await sleep(150);
await shot(p, "tabs-1440-dark-summary.png");

console.log("=== 11) console ===");
check("no page errors/exceptions", p.errors.length === 0, p.errors.join(" | "));
console.log(`\nRESULT: ${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}`);
process.exit(failures ? 1 : 0);
