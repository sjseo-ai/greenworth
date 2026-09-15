// Screen ↔ Excel cross-check: edit CAPEX item / 3rd-year operating rate / loan rate in the real artifact page (CDP),
// save two scenarios, pull them from localStorage as the same JSON shape the page downloads, then compare the screen
// numbers with computeScenario() on that JSON. Also writes the JSONs for a multi-scenario converter run.
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
const TOOL = "C:/Users/KCH/OneDrive/바탕 화면/앱 만들기/사업성모델 앱/ess-bidprice-xlsx.mjs";
const { computeScenario } = await import(pathToFileURL(TOOL).href);
const URL_ = "file:///" + `${SP}/redesign-wrapped.html`.replace(/^\//, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, detail = "") => { if (!ok) failures++; console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail !== "" ? " — " + detail : ""}`); };

const tab = await (await fetch("http://127.0.0.1:9335/json/new?" + encodeURIComponent(URL_), { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
const setVal = (sel, v) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); e.value=${JSON.stringify(String(v))}; e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const txt = (idv) => ev(`document.getElementById('${idv}').textContent.trim()`);

await send("Runtime.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await sleep(300); await ev("localStorage.clear()"); await send("Page.reload"); await sleep(1500);

// Scenario A — edited CAPEX item, 3rd-year rate, loan rate (the fields the old converter silently dropped or kept)
await ev("document.querySelectorAll('details.acc').forEach(d=>d.open=true)");
await setVal('[data-capex-index="0"]', 700);
await setVal('[data-capex-index="13"]', 15); // ③ 기타 부대비용
await setVal("#seniorFixedSharePct", 60); await sleep(300);     // 선순위 고정 60% · 변동 40%
await setVal('[data-cd-index="2"]', 4.0);                      // 3년차 CD 4.0%
await setVal("#rateResetMonths", "6");                         // 6개월 조정
await setVal("#fundingMode", "amount"); await sleep(300);      // 자금조달 금액 모드
await setVal("#equityAmount", 380); await sleep(400);
await setVal('[data-oprate-index="2"]', 90);
await setVal("#seniorRatePct", 5.5);
await sleep(400);
const screenA = { kchIrr: await txt("kchAchievedIrr"), tinv: await txt("kpiTotalInvestment"), price: await txt("heroBidPrice"), pirr: await txt("kpiPIrr"), npv: await txt("kpiNpv"), eirr: await txt("kpiEIrr"), bid: await ev("document.getElementById('bidPrice').value"), score: await txt("outScore") };
await ev("document.getElementById('tab-sens').click()"); await sleep(600);
screenA.sensBase = await ev("document.getElementById('sensBaseIrr').value");
await ev("document.getElementById('tab-scenario').click()");
await setVal("#scenarioName", "교차검증 A 배터리700·3년차90%·금리5.5");
await ev("document.getElementById('saveScenarioBtn').click()"); await sleep(500);
// Scenario B — defaults except contract capacity 90MW
await ev("document.getElementById('reset').click()"); await sleep(600);
await setVal("#contractCapacityMW", 90); await sleep(400);
await setVal("#capexInputMode", "lumpsum"); await sleep(300); // ① 공사비만 총액으로
await setVal("#capexLumpSum", 1000); await sleep(400);
const screenB = { tinv: await txt("kpiTotalInvestment"), price: await txt("heroBidPrice"), pirr: await txt("kpiPIrr") };
await setVal("#scenarioName", "교차검증 B 용량90MW");
await ev("document.getElementById('saveScenarioBtn').click()"); await sleep(500);
const list = JSON.parse(await ev("localStorage.getItem('essBidPriceScenarios.v1')"));
await ev("localStorage.clear()");
check("two scenarios saved in the page", list.length === 2, String(list.length));

const toJson = (s) => ({ exportedAt: s.savedAt, tool: "ESS 적정 입찰단가 프로토타입", scenarioName: s.name, savedAt: s.savedAt, inputs: s.state, kpi: s.kpi });
const files = list.map((s, i) => { const p = `${SP}/crosscheck-${i === 0 ? "A" : "B"}.json`; writeFileSync(p, JSON.stringify(toJson(s), null, 2), "utf8"); return p; });
console.log("JSON:", files.join(" , "));

const pct = (v) => `${(v * 100).toFixed(2)}%`;
const cA = computeScenario(list[0].state, { label: list[0].name });
const cB = computeScenario(list[1].state, { label: list[1].name });
check("A: edited inputs really in JSON (capex 700, 3rd-year 90, rate 5.5)", list[0].state.capexItems[0] === "700" && list[0].state.opRates[2] === "90" && list[0].state.fields.seniorRatePct === "5.5",
  `${list[0].state.capexItems[0]} / ${list[0].state.opRates[2]} / ${list[0].state.fields.seniorRatePct}`);
check("A: price = screen", cA.solved.price.toFixed(2) === screenA.price, `${cA.solved.price.toFixed(2)} vs ${screenA.price}`);
check("A: price differs from default 22.51 (edits honored)", screenA.price !== "22.51", screenA.price);
check("A: P-IRR = screen", pct(cA.solved.result.projectIrr) === screenA.pirr, `${pct(cA.solved.result.projectIrr)} vs ${screenA.pirr}`);
check("A: E-IRR = screen", pct(cA.solved.result.equityIrr) === screenA.eirr, `${pct(cA.solved.result.equityIrr)} vs ${screenA.eirr}`);
check("A: NPV = screen", `${cA.solved.result.projectNpv.toFixed(1)} 억원` === screenA.npv, `${cA.solved.result.projectNpv.toFixed(1)} vs ${screenA.npv}`);
check("A: 가격환산 입찰가격 = screen", cA.link.bidPrice65.toFixed(2) === screenA.bid, `${cA.link.bidPrice65.toFixed(2)} vs ${screenA.bid}`);
check("A: 가격평가점수 = screen", `${cA.ps.score.toFixed(2)} 점` === screenA.score, `${cA.ps.score.toFixed(2)} vs ${screenA.score}`);
const bi = 3;
check("A: sensitivity base E-IRR = screen", pct(cA.sens.macro[bi][bi].equityIrr) === screenA.sensBase, `${pct(cA.sens.macro[bi][bi].equityIrr)} vs ${screenA.sensBase}`);
check("B: price = screen", cB.solved.price.toFixed(2) === screenB.price, `${cB.solved.price.toFixed(2)} vs ${screenB.price}`);
check("B: P-IRR = screen", pct(cB.solved.result.projectIrr) === screenB.pirr, `${pct(cB.solved.result.projectIrr)} vs ${screenB.pirr}`);
check("A: 금리·자금조달 입력이 JSON에(고정 60 · CD 3년차 4 · 6개월 · 금액 모드 380)", list[0].state.fields.seniorFixedSharePct === "60" && list[0].state.cdRates[2] === "4" && list[0].state.fields.rateResetMonths === "6" && list[0].state.fields.fundingMode === "amount" && list[0].state.fields.equityAmount === "380",
  JSON.stringify({ w: list[0].state.fields.seniorFixedSharePct, cd: list[0].state.cdRates, m: list[0].state.fields.rateResetMonths, fm: list[0].state.fields.fundingMode, eq: list[0].state.fields.equityAmount }));
check("A: 자기자본 = 380억 (금액 모드)", Math.abs(cA.solved.result.funding.equityPrincipal - 380) < 1e-9);
check("A: KCH 합산 IRR = screen", pct(cA.kchRet.irr) === screenA.kchIrr, `${pct(cA.kchRet.irr)} vs ${screenA.kchIrr}`);
const eok1 = (v) => `${v.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} 억원`;
check("A: 총투자비 = screen (기타 부대비용 15억 포함)", eok1(cA.solved.result.totalInvestment) === screenA.tinv, `${eok1(cA.solved.result.totalInvestment)} vs ${screenA.tinv}`);
check("B: EPC 총액 1000억 모드 in JSON", list[1].state.fields.capexInputMode === "lumpsum" && list[1].state.fields.capexLumpSum === "1000", `${list[1].state.fields.capexInputMode} / ${list[1].state.fields.capexLumpSum}`);
check("B: 총투자비 = screen (① 총액 + ②·③ 항목)", eok1(cB.solved.result.totalInvestment) === screenB.tinv, `${eok1(cB.solved.result.totalInvestment)} vs ${screenB.tinv}`);
console.log(`\nRESULT: ${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}`);
process.exit(failures ? 1 : 0);
