// Offshore wind draft verification: turbine-derived utilization, REC weight ↔ bid conversion, tracks/preferential price,
// selection score, turbine compare tab, combos, PPA, tabs, scenario, reset, 44px, responsive, screenshots.
import { readFileSync, writeFileSync } from "node:fs";
const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
const WRAPPED = `${SP}/wind-wrapped.html`;
writeFileSync(WRAPPED, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>\n' + readFileSync(`${SP}/wind-bid-price-prototype.html`, "utf8") + "\n</body></html>", "utf8");
const URL_ = "file:///" + WRAPPED.replace(/^\//, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, detail = "") => { if (!ok) failures++; console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail !== "" ? " — " + detail : ""}`); };

const tab = await (await fetch("http://127.0.0.1:9335/json/new?" + encodeURIComponent(URL_), { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const errors = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
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
const txt = (i) => ev(`document.getElementById(${JSON.stringify(i)}).textContent.trim()`);
const val = (i) => ev(`document.getElementById(${JSON.stringify(i)}).value`);
const num = async (i) => parseFloat(String(await txt(i)).replace(/,/g, ""));
const setVal = (i, v) => ev(`(()=>{const e=document.getElementById(${JSON.stringify(i)}); e.value=${JSON.stringify(String(v))}; e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const count = (sel) => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const click = (i) => ev(`document.getElementById(${JSON.stringify(i)}).click()`);
const clickSel = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).click()`);
const shown = (i) => ev(`getComputedStyle(document.getElementById(${JSON.stringify(i)})).display !== 'none'`);
const shot = async (file) => { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${SP}/${file}`, Buffer.from(r.result.data, "base64")); console.log("     screenshot:", file); };
const noteBid = async () => parseFloat((await txt("heroBidNote")).match(/= ([\d,.]+) 원\/kWh/)?.[1].replace(/,/g, "") ?? "NaN");
// 페이지와 같은 식으로 기대값 계산
const SPEC = { doosan10: [10, 205, 95, 24], unison10: [10, 210, 94, 23], vestas15: [15, 236, 97, 29], sgre14: [14, 236, 97, 28], ge147: [14.7, 220, 96, 27], mingyang16: [16, 242, 95, 18] };
const expY1 = (mw, rotor, avail, base = 40, wake = 8, elec = 3) => { const sp = mw * 1e6 / (Math.PI * (rotor / 2) ** 2); return Math.round(base * (320 / sp) ** 0.25 * avail / 100 * (1 - wake / 100) * (1 - elec / 100) * 100) / 100; };
const expBid = (R, w, pref, smp = 86.35) => smp + (R - pref - smp) / w;

await send("Runtime.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
await sleep(400); await ev("localStorage.clear()"); await send("Page.reload"); await sleep(2200);

console.log("=== 1) 기본 = 공공주도형 + 두산 DS205-10MW ===");
const heroBase = await num("heroBidPrice");
console.log("     수령단가", heroBase, "· P-IRR", await txt("kpiPIrr"), "· 총사업비", await txt("kpiTotalInvestment"), "· 발전량", await txt("kpiGeneration"));
console.log("     히어로:", await txt("heroBidNote"));
check("수령단가가 그럴듯한 범위(150~450원/kWh)", heroBase > 150 && heroBase < 450, String(heroBase));
check("산정 상태 ok", (await ev("document.getElementById('solveStatus').className")).includes("ok"), await txt("solveStatus"));
check("조합 ① · 두산 · 터빈 값 적용 중", (await txt("comboActive")).includes("공공주도형") && (await txt("comboActive")).includes("두산") && (await txt("turbineLinkState")).includes("적용 중"), `${await txt("comboActive")} / ${await txt("turbineLinkState")}`);
check("1년차 순이용률 34.38 = 식과 일치", (await val("year1RatePct")) === String(expY1(10, 205, 95)), `${await val("year1RatePct")} vs ${expY1(10, 205, 95)}`);
check("EPC 72 = 터빈 24 + BOP 48 → ① 7,200억 · 10기", (await val("epcUnitPrice")) === "72" && (await val("turbinePriceDisplay")) === "24.0" && (await val("epcUnitPriceTotal")) === "7,200.0" && (await val("turbineCountDisplay")) === "10",
  `${await val("epcUnitPrice")} · ${await val("turbinePriceDisplay")} · ${await val("epcUnitPriceTotal")} · ${await val("turbineCountDisplay")}`);
check("가중치 3.70(15km·25m) · 우대 3.66 · 상한 171.229", (await val("recWeightDisplay")) === "3.70" && (await val("preferentialDisplay")) === "3.66" && (await val("priceCapPerKWh")) === "171.229");
check("히어로 입찰가격 = SMP + (R − 3.66 − SMP) ÷ 3.7", Math.abs((await noteBid()) - expBid(heroBase, 3.7, 3.66)) < 0.011, `${await noteBid()} vs ${expBid(heroBase, 3.7, 3.66).toFixed(2)}`);
check("기본 산정 기준 = 목표 P-IRR 6% 달성", (await val("solveMode")) === "irr" && (await txt("kpiPIrr")) === "6.00%", await txt("kpiPIrr"));
check("기본값에서 입찰가격이 상한 이내(응찰 가능)", (await noteBid()) <= 171.229 && !(await ev("document.getElementById('heroBidNote').className")).includes("bad"), await txt("heroBidNote"));
check("총사업비 구성 합계 = 총사업비 KPI", (await ev("document.querySelector('#capexBreakdownBody tr.strong td').textContent")) === (await txt("kpiTotalInvestment")));

console.log("=== 2) 터빈 6종 ===");
const heroByTurbine = {};
for (const [tb, [mw, rotor, avail, price]] of Object.entries(SPEC)) {
  await setVal("turbineMaker", tb); await sleep(800);
  heroByTurbine[tb] = await num("heroBidPrice");
  const y1 = String(expY1(mw, rotor, avail)), epc = String(price + 48);
  check(`${tb}: 1년차 ${y1}% · EPC ${epc} · 적용 중`, (await val("year1RatePct")) === y1 && (await val("epcUnitPrice")) === epc && (await txt("turbineLinkState")).includes("적용 중"),
    `${await val("year1RatePct")} · ${await val("epcUnitPrice")} · 대수 ${await val("turbineCountDisplay")} → 수령단가 ${heroByTurbine[tb]}`);
}
await setVal("turbineMaker", "vestas15"); await sleep(600);
check("Vestas 대수 7기", (await val("turbineCountDisplay")) === "7", await val("turbineCountDisplay"));
await setVal("turbineMaker", "doosan10"); await sleep(800);
check("두산 복귀 → 기본 수령단가 · 조합 ①", (await num("heroBidPrice")) === heroBase && (await txt("comboActive")).includes("공공주도형"));
await setVal("tb-doosan10-price", 26); await sleep(700);
check("선택 터빈 단가 26 → EPC 74 따라감", (await val("epcUnitPrice")) === "74");
await setVal("tb-vestas15-price", 40); await sleep(700);
check("비선택 터빈 수정 → C·D 그대로", (await val("epcUnitPrice")) === "74");
await setVal("tb-doosan10-price", 24); await sleep(500); await setVal("tb-vestas15-price", 29); await sleep(500);
await setVal("wakeLossPct", 12); await sleep(700);
check("후류 손실 12% → 1년차 순이용률 재계산", (await val("year1RatePct")) === String(expY1(10, 205, 95, 40, 12)), await val("year1RatePct"));
await setVal("wakeLossPct", 8); await sleep(600);
await setVal("year1RatePct", 30); await sleep(600);
check("순이용률 직접 수정 → 사용자 조정", (await txt("turbineLinkState")).includes("사용자 조정") && (await txt("comboActive")) === "사용자 조정");
await click("applyTurbineBtn"); await sleep(800);
check("터빈 값 다시 적용 → 기본 복귀", (await num("heroBidPrice")) === heroBase && (await txt("turbineLinkState")).includes("적용 중"));

console.log("=== 3) REC 가중치 · 트랙 · 우대가격 · 하부구조 ===");
await setVal("connectDistanceKm", 20); await setVal("waterDepthM", 35); await sleep(800);
check("20km · 35m → 3.7 + 3.7 − 2.5 = 4.90 · 수령단가 불변 · 입찰가격 하락", (await val("recWeightDisplay")) === "4.90" && (await num("heroBidPrice")) === heroBase && Math.abs((await noteBid()) - expBid(heroBase, 4.9, 3.66)) < 0.011, `${await noteBid()}`);
await setVal("weightMode", "none"); await sleep(800);
check("RPS 개편(가중치 1.0) → 입찰가격 = R − 3.66 · 거리·수심 칸 숨김", (await val("recWeightDisplay")) === "1.00" && Math.abs((await noteBid()) - (heroBase - 3.66)) < 0.011 && !(await shown("connectDistanceField")), `${await noteBid()}`);
check("가중치 1.0이면 상한 초과 경고", (await ev("document.getElementById('heroBidNote').className")).includes("bad"), await txt("heroBidNote"));
await setVal("weightMode", "manual"); await setVal("weightManual", 3); await sleep(800);
check("직접 입력 3.0", (await val("recWeightDisplay")) === "3.00" && (await shown("weightManualField")));
await setVal("weightMode", "calc"); await setVal("connectDistanceKm", 15); await setVal("waterDepthM", 25); await sleep(800);
await setVal("prefMode", "rnd"); await sleep(800);
check("R&D 실증 우대 → 31.50 · 입찰가격 7.52 더 낮음", (await val("preferentialDisplay")) === "31.50" && Math.abs((await noteBid()) - expBid(heroBase, 3.7, 31.5)) < 0.011, `${await noteBid()}`);
await setVal("prefMode", "base"); await sleep(600);
await setVal("tenderTrack", "general"); await sleep(800);
check("일반형 → 우대 칸 숨김 · 우대 0 · 배지 일반형 · 안보 배점 6점", !(await shown("prefModeField")) && Math.abs((await noteBid()) - expBid(heroBase, 3.7, 0)) < 0.011 && (await txt("salesFlag")) === "일반형" && (await txt("maxSecurity")) === "6점");
await setVal("tenderTrack", "public"); await sleep(600);
await setVal("foundationType", "floating"); await sleep(700);
check("부유식 → 상한 175.1", (await val("priceCapPerKWh")) === "175.1");
await setVal("foundationType", "fixed"); await sleep(600);
check("고정식 복귀 → 171.229 · 조합 ①", (await val("priceCapPerKWh")) === "171.229" && (await txt("comboActive")).includes("공공주도형"));

console.log("=== 4) 선정평가 ===");
await click("tab-price"); await sleep(400);
const bid = parseFloat(await val("bidPrice"));
const expPrice = Math.round(Math.max(0, (171.229 - bid) / 171.229 * 50) * 100) / 100;
console.log(`     입찰가격 ${bid} → 가격 ${await txt("outScore")} · 비가격 ${await txt("outNonPrice")} · 합계 ${await txt("outTotal")}`);
check("비가격 7 + 19 + 2 + 13 = 41.0 · 배점 8/22/2/18", (await num("outNonPrice")) === 41 && (await txt("maxIndustry")) === "22점" && (await txt("maxOther")) === "18점");
check("입찰가격 점수 = (상한 − 입찰) ÷ 상한 × 50", Math.abs((await num("outScore")) - expPrice) < 0.005, `${await num("outScore")} vs ${expPrice}`);
check("합계 = 비가격 + 가격", Math.abs((await num("outTotal")) - (41 + expPrice)) < 0.011);
check("R&D 우대 환산 −7.52원", (await txt("outRndValue")).startsWith("−7.52원"), await txt("outRndValue"));
await setVal("scoreSecurity", 9); await sleep(400);
check("안보 9 > 배점 8 → 경고 · 8까지만 합산(42.0)", (await ev("document.getElementById('nonPriceWarn').className")).includes("show") && (await num("outNonPrice")) === 42, await txt("outNonPrice"));
await setVal("scoreSecurity", 7); await sleep(400);
check("예상 점수 복귀 → 조합 ① 유지", (await txt("comboActive")).includes("공공주도형"), await txt("comboActive"));

console.log("=== 5) 터빈 비교 탭 ===");
await click("gotoTurbineTab"); await sleep(3500);
const solveCells = await ev("[...document.querySelectorAll('td[id$=-solve]')].map(td=>td.textContent)");
check("6개 터빈 산정", solveCells.length === 6 && solveCells.every((t) => /원$/.test(t)), solveCells.join(" | "));
for (const tb of Object.keys(SPEC)) console.log(`     ${tb.padEnd(11)} ${await txt(`tb-${tb}-rated`)} · 비출력 ${await txt(`tb-${tb}-sp`)} · 순이용률 ${await txt(`tb-${tb}-y1`)} · EPC ${await txt(`tb-${tb}-epc`)} · 수령 ${await txt(`tb-${tb}-solve`)} · 입찰 ${await txt(`tb-${tb}-bid`)}`);
for (const tb of ["doosan10", "vestas15", "mingyang16"]) check(`${tb} 비교값 = 선택 시 히어로 값`, parseFloat((await txt(`tb-${tb}-solve`)).replace(/,/g, "")) === heroByTurbine[tb], `${await txt(`tb-${tb}-solve`)} vs ${heroByTurbine[tb]}`);
check("선택 터빈(두산) 행 강조 · best 표시", (await ev(`document.querySelector('[data-tb-row="doosan10"]').classList.contains('is-picked')`)) && (await count("#turbineTableBody td.best")) >= 1);
check("결과·스펙 표 1440px 가로 스크롤 없음", (await ev("['turbineTableBody','turbineSpecBody'].every(id=>{const w=document.getElementById(id).closest('.table-wrap'); return w.scrollWidth<=w.clientWidth+1;})")) === true,
  await ev("['turbineTableBody','turbineSpecBody'].map(id=>{const w=document.getElementById(id).closest('.table-wrap'); return w.scrollWidth+'/'+w.clientWidth;}).join(' ')"));
await clickSel('[data-tb-pick="sgre14"]'); await sleep(2500);
check("선택 버튼 → SGRE · EPC 76", (await val("turbineMaker")) === "sgre14" && (await val("epcUnitPrice")) === "76");
await click("reset"); await sleep(1300);

console.log("=== 6) 조합 ② · PPA · 탭 · 시나리오 · 되돌리기 ===");
await clickSel('[data-combo="general"]'); await sleep(1000);
check("조합 ② → Vestas · 일반형 · 우대 없음 · 예상 점수 4/14/3/10", (await val("turbineMaker")) === "vestas15" && (await val("tenderTrack")) === "general" && (await val("prefMode")) === "none" && (await val("scoreIndustry")) === "14" && (await txt("comboActive")).includes("일반형"), await txt("comboActive"));
await setVal("turbineMaker", "ge147"); await sleep(800);
check("같은 원산지(외산) GE로 바꿔도 조합 ② 유지", (await txt("comboActive")).includes("GE"), await txt("comboActive"));
await clickSel('[data-combo="public"]'); await sleep(1000);
check("조합 ① → 두산 · 기본 수령단가", (await val("turbineMaker")) === "doosan10" && (await num("heroBidPrice")) === heroBase);
await setVal("salesStructure", "ppa"); await sleep(800);
check("PPA → 가중치·트랙·상한 숨김 · 히어로 PPA", !(await shown("recWeightWrap")) && !(await shown("tenderTrackField")) && (await txt("heroLabel")).includes("PPA"));
await click("reset"); await sleep(1100);
const TABS = ["tab-summary", "tab-turbine", "tab-sens", "tab-scenario", "tab-price", "tab-cases", "tab-kch", "tab-caveats"];
for (const t of TABS) {
  await click(t); await sleep(t === "tab-turbine" ? 3000 : t === "tab-cases" ? 5000 : 150);
  check(`${t} → 패널 표시`, (await ev(`document.getElementById(document.getElementById('${t}').dataset.panel).hidden`)) === false);
}
check("확정 필요 항목 14개 · 터빈 근거 6개", (await count("#panel-caveats .todo-list li")) === 14 && (await count("#panel-turbine .todo-list li")) === 6);
check("민감도 7행", (await count("#macroSensBody tr")) === 7 || (await ev("(async()=>{document.getElementById('tab-sens').click(); await new Promise(r=>setTimeout(r,800)); return document.querySelectorAll('#macroSensBody tr').length;})()")) === 7);
await click("tab-scenario");
await setVal("scenarioName", "공공주도형 두산"); await click("saveScenarioBtn"); await sleep(600);
await clickSel('[data-combo="general"]'); await sleep(1000);
await setVal("scenarioName", "일반형 Vestas"); await click("saveScenarioBtn"); await sleep(700);
check("시나리오 2개 · 터빈·트랙 저장", (await count(".price-bar-row")) === 2 && (await ev(`JSON.parse(localStorage.getItem('windBidPriceScenarios.v1')).map(s=>s.kpi.turbine+'|'+s.kpi.track).join(' / ')`)).includes("Vestas"),
  await ev(`JSON.parse(localStorage.getItem('windBidPriceScenarios.v1')).map(s=>s.kpi.turbine+'|'+s.kpi.track).join(' / ')`));
await click("reset"); await sleep(1100);
check("되돌리기 → 두산 · 공공주도형 · 기본 수령단가", (await val("turbineMaker")) === "doosan10" && (await val("tenderTrack")) === "public" && (await num("heroBidPrice")) === heroBase);

console.log("=== 6a) 상한가 진입 조건 ===");
await click("tab-price"); await sleep(1500);
check("기본(상한 이내) → 여유 행 · 상한가 입찰 시 P-IRR > 6%", (await txt("entryNote")).includes("상한가 이내") && parseFloat(await ev("document.getElementById('entryTarget').dataset.value")) > 0.06,
  `${await txt("entryGap")} / ${await txt("entryTarget")}`);
await setVal("targetIrrPct", 7.5); await sleep(2500);
const heroOver = await num("heroBidPrice"), bidOver = await noteBid();
console.log(`     목표 P-IRR 7.5% → 수령단가 ${heroOver} · 입찰가격 ${bidOver}`);
check("목표 7.5% → 상한 초과 · 인하 필요폭 = 입찰가격 − 상한", bidOver > 171.229 && (await txt("entryNote")).includes("응찰할 수 없습니다") && Math.abs(parseFloat(await ev("document.getElementById('entryGap').dataset.value")) - (bidOver - 171.229)) < 0.011,
  await txt("entryGap"));
for (const idv of ["entryTarget", "entryEpc", "entryCf", "entryOpex", "entryWeight", "entryRnd"]) console.log(`     ${idv}: ${await txt(idv)}`);
const needIrr = parseFloat(await ev("document.getElementById('entryTarget').dataset.value"));
const needEpc = parseFloat(await ev("document.getElementById('entryEpc').dataset.value"));
const needW = parseFloat(await ev("document.getElementById('entryWeight').dataset.value"));
const needCf = parseFloat(await ev("document.getElementById('entryCf').dataset.value"));
check("진입 조건 값들이 모두 숫자(EPC·이용률·가중치·목표)", [needIrr, needEpc, needW, needCf].every(Number.isFinite), [needIrr, needEpc, needW, needCf].join(" / "));
await setVal("targetIrrPct", (Math.floor(needIrr * 10000) / 100).toFixed(2)); await sleep(1500);
check("목표를 제시값으로 낮추면 → 입찰가격 ≤ 상한 (차이 0.1원 이내)", (await noteBid()) <= 171.229 + 1e-9 && (await noteBid()) > 171.229 - 0.1, String(await noteBid()));
await setVal("targetIrrPct", 7.5); await sleep(1500);
await setVal("epcUnitPrice", (Math.floor(needEpc * 100) / 100).toFixed(2)); await sleep(1500);
check("EPC를 제시값으로 낮추면 → 입찰가격 ≤ 상한 (0.1원 이내)", (await noteBid()) <= 171.229 + 1e-9 && (await noteBid()) > 171.229 - 0.1, `${await val("epcUnitPrice")} → ${await noteBid()}`);
await click("applyTurbineBtn"); await sleep(1500);
await setVal("weightMode", "manual"); await setVal("weightManual", (Math.ceil(needW * 1000) / 1000).toFixed(3)); await sleep(1500);
check("가중치를 제시값으로 → 입찰가격 ≤ 상한 (0.1원 이내)", (await noteBid()) <= 171.229 + 1e-9 && (await noteBid()) > 171.229 - 0.1, String(await noteBid()));
await setVal("weightMode", "calc"); await sleep(800);
await setVal("year1RatePct", (Math.ceil(needCf * 100) / 100).toFixed(2)); await sleep(1500);
check("순이용률을 제시값으로 → 입찰가격 ≤ 상한 (0.2원 이내)", (await noteBid()) <= 171.229 + 1e-9 && (await noteBid()) > 171.229 - 0.2, `${await val("year1RatePct")} → ${await noteBid()}`);
check("히어로 초과 문구에 진입 조건 안내 (목표 7.5%, 기본 이용률)", await (async () => { await click("applyTurbineBtn"); await sleep(1500); return (await txt("heroBidNote")).includes("진입 조건"); })(), await txt("heroBidNote"));
await click("reset"); await sleep(1500);

console.log("=== 6a-2) 입찰 사례 ===");
await click("tab-cases"); await sleep(6000);
check("사례 18건 · 입력 칸 · 상세 18개", (await count("#caseInputBody tr")) === 18 && (await count("#caseResultBody tr")) === 18 && (await count("#caseSourceList li")) === 18);
check("신안우이 보도값 87.2 · 29.6 · 상한 167.778", (await val("cs-c23_sinanui-capex")) === "87.2" && (await val("cs-c23_sinanui-cf")) === "29.6");
check("발전량 환산 이용률 — 한빛 834GWh → 28 · 낙월 900GWh → 28.2 · 안마 1,400GWh → 30", (await val("cs-c26_hanbit-cf")) === "28" && (await val("cs-c23_nakwol-cf")) === "28.2" && (await val("cs-c24_anma-cf")) === "30",
  `${await val("cs-c26_hanbit-cf")} / ${await val("cs-c23_nakwol-cf")} / ${await val("cs-c24_anma-cf")}`);
check("거리·수심 가중치 — 태안 30km·30m → 4.5 · 반딧불이 70km·200m → 4.9 · 나머지 빈 칸", (await val("cs-c24_taean-w")) === "4.5" && (await val("cs-c24_bandi-w")) === "4.9" && (await val("cs-c23_sinanui-w")) === "",
  `${await val("cs-c24_taean-w")} / ${await val("cs-c24_bandi-w")}`);
check("EPC 역산 사례(야월·고창) — 총사업비 칸 비움 · 표시 'EPC 금액 역산'", (await val("cs-c24_yawol-capex")) === "" && (await ev("document.querySelector('#caseResultBody [data-cs-row=\"c24_yawol\"] .sub').textContent")).includes("EPC 금액 역산"));
check("사례 상세에 사업자·터빈·EPC — 낙월 Vensys · 신안우이 한화오션·현대건설 · 야월 두산 EPC 5,750억", (await ev("document.querySelector('[data-cs-detail=\"c23_nakwol\"]').textContent")).includes("Vensys")
  && (await ev("document.querySelector('[data-cs-detail=\"c23_sinanui\"]').textContent")).includes("현대건설") && (await ev("document.querySelector('[data-cs-detail=\"c24_yawol\"]').textContent")).includes("5,750"));
check("사례 상세에 EIASS 사업코드 — 낙월 ME2019C003 · 해송 ME2024C009 · 고창 미확인 표시", (await ev("document.querySelector('[data-cs-detail=\"c23_nakwol\"]').textContent")).includes("ME2019C003")
  && (await ev("document.querySelector('[data-cs-detail=\"c26_haesong3\"]').textContent")).includes("ME2024C009") && (await ev("document.querySelector('[data-cs-detail=\"c23_gochang\"]').textContent")).includes("확인되지 않음"));
check("EIASS 협의 사업비 기본값 — 안마 62.2 · 금오도 53.8 · 해울이 70.5 · 해송3 빈 칸(등록 사업비 과소)", (await val("cs-c24_anma-capex")) === "62.2" && (await val("cs-c26_geumo-capex")) === "53.8" && (await val("cs-c26_haeuli2-capex")) === "70.5" && (await val("cs-c26_haesong3-capex")) === "",
  `${await val("cs-c24_anma-capex")} / ${await val("cs-c26_geumo-capex")} / ${await val("cs-c26_haeuli2-capex")} / ${await val("cs-c26_haesong3-capex")}`);
check("EIASS 등록 제원 — 금오도 8,601억원·5.56MW×30기 · 안마 결과 표 'EIASS 협의 사업비' · 해송3 '사업비 미공개'", (await ev("document.querySelector('[data-cs-detail=\"c26_geumo\"]').textContent")).includes("8,601억원")
  && (await ev("document.querySelector('[data-cs-detail=\"c26_geumo\"]').textContent")).includes("5.56MW×30기")
  && (await ev("document.querySelector('#caseResultBody [data-cs-row=\"c24_anma\"] .sub').textContent")).includes("EIASS 협의 사업비")
  && (await ev("document.querySelector('#caseResultBody [data-cs-row=\"c26_haesong3\"] .sub').textContent")).includes("사업비 미공개"));
const sinanInv = parseFloat(await txt("cs-c23_sinanui-inv"));
check("신안우이 총사업비(계산) ≈ 87.2억/MW (±5%)", Math.abs(sinanInv / 87.2 - 1) < 0.05, String(sinanInv));
console.log(`     요약: ${await txt("caseSummary")}`);
for (const cid of ["c23_sinanui", "c24_anma", "c25_aphae", "c26_hanbit", "c26_haeuli2"]) console.log(`     ${cid}: 입찰 ${await txt(`cs-${cid}-bid`)} · 수령 ${await txt(`cs-${cid}-r`)} · 사업비 ${await txt(`cs-${cid}-inv`)} · P-IRR ${await txt(`cs-${cid}-pirr`)} · E-IRR ${await txt(`cs-${cid}-eirr`)} · 최대 인하 ${await txt(`cs-${cid}-max`)}`);
const pirr0 = parseFloat(await txt("cs-c24_anma-pirr"));
check("모든 사례 P-IRR 숫자 · 요약 범위 표시", (await ev("[...document.querySelectorAll('td[id$=-pirr]')].filter(td=>/%$/.test(td.textContent)).length")) === 18 && (await txt("caseSummary")).includes("중앙값"));
check("2023 신안우이 상한가 입찰 수령단가 = 86.35 + (167.778 − 86.35) × 가중치", Math.abs(parseFloat(await txt("cs-c23_sinanui-r")) - (86.35 + (167.778 - 86.35) * 3.7)) < 0.011, await txt("cs-c23_sinanui-r"));
check("공공주도형 사례(압해)는 우대 3.66 반영", Math.abs(parseFloat(await txt("cs-c25_aphae-r")) - (86.35 + (176.565 - 86.35) * 3.7 + 3.66)) < 0.011, await txt("cs-c25_aphae-r"));
await setVal("caseDiscountAll", 5); await click("applyCaseDiscount"); await sleep(6000);
check("인하율 5% 일괄 → 입력 칸 5 · 안마 P-IRR 하락", (await val("cs-c24_anma-disc")) === "5" && parseFloat(await txt("cs-c24_anma-pirr")) < pirr0, `${pirr0} → ${await txt("cs-c24_anma-pirr")}`);
await setVal("cs-c23_sinanui-capex", 110); await sleep(3000);
check("신안우이 사업비 110 → 총사업비(계산) 약 110 · P-IRR 하락", Math.abs(parseFloat(await txt("cs-c23_sinanui-inv")) / 110 - 1) < 0.05, await txt("cs-c23_sinanui-inv"));
await click("resetCaseDiscount"); await sleep(5000);
check("0% 복귀 → 입력 칸 0", (await val("cs-c24_anma-disc")) === "0" && Math.abs(parseFloat(await txt("cs-c24_anma-pirr")) - pirr0) < 0.005);
check("사례 표 1440px 가로 스크롤 없음", (await ev("['caseInputBody','caseResultBody'].every(id=>{const w=document.getElementById(id).closest('.table-wrap'); return w.scrollWidth<=w.clientWidth+1;})")) === true,
  await ev("['caseInputBody','caseResultBody'].map(id=>{const w=document.getElementById(id).closest('.table-wrap'); return w.scrollWidth+'/'+w.clientWidth;}).join(' ')"));
await click("reset"); await sleep(1500);

console.log("=== 6b) 터빈 목록 관리 ===");
await click("tab-turbine"); await sleep(2500);
check("기본 목록 6종 · 기준일 · 사용자 추가 0종", (await txt("catalogInfo")) === "기본 목록 6종 (기준일 2026-09-14) · 사용자 추가 0종", await txt("catalogInfo"));
check("선택 목록 옵션 6개 · 근거 6개 · 삭제 버튼 없음", (await count("#turbineMaker option")) === 6 && (await count("#turbineSourceList li")) === 6 && (await count("[data-tb-del]")) === 0);
await setVal("newTbMaker", "Vestas"); await setVal("newTbModel", "V236-15.0MW"); await click("addTurbineBtn"); await sleep(400);
check("이미 있는 모델 추가 → 오류 안내", (await ev("document.getElementById('turbineFormMsg').className")).includes("warn") && (await txt("turbineFormMsg")).includes("이미 목록"), await txt("turbineFormMsg"));
await setVal("newTbMaker", ""); await click("addTurbineBtn"); await sleep(300);
check("제조사 비우고 추가 → 필수값 안내", (await txt("turbineFormMsg")).includes("제조사와 모델명"), await txt("turbineFormMsg"));
await setVal("newTbMaker", "두산에너빌리티"); await setVal("newTbModel", "DS220-15MW (테스트)"); await setVal("newTbOrigin", "domestic");
await setVal("newTbMw", 15); await setVal("newTbRotor", 220); await setVal("newTbPrice", 30); await setVal("newTbAvail", 95); await setVal("newTbDegA", 0.2); await setVal("newTbLocal", 60); await setVal("newTbSource", "테스트 입력");
await click("addTurbineBtn"); await sleep(1500);
const newId = await ev("[...document.querySelectorAll('#turbineMaker option')].find(o=>o.textContent.includes('DS220-15MW'))?.value");
check("새 터빈 추가 → 옵션 7개 · (사용자 추가) · 저장소 1건 · 폼 비움", !!newId && (await count("#turbineMaker option")) === 7 && (await ev(`document.querySelector('#turbineMaker option[value="${newId}"]').textContent`)).includes("사용자 추가")
  && (await ev("JSON.parse(localStorage.getItem('windCustomTurbines.v1')).length")) === 1 && (await val("newTbModel")) === "", String(newId));
check("정보 줄 사용자 추가 1종 · 제목 국산 3 · 외산 4 · 근거에 입력 문구", (await txt("catalogInfo")).endsWith("사용자 추가 1종") && (await txt("turbineCountHead")) === "국산 3 · 외산 4" && (await txt("turbineSourceList")).includes("테스트 입력"));
check("선택 중이던 두산은 그대로", (await val("turbineMaker")) === "doosan10");
await clickSel(`[data-tb-pick="${newId}"]`); await sleep(2500);
check("새 터빈 선택 → EPC 78 · 순이용률 식 일치 · 대수 7기", (await val("turbineMaker")) === newId && (await val("epcUnitPrice")) === "78" && (await val("year1RatePct")) === String(expY1(15, 220, 95)) && (await val("turbineCountDisplay")) === "7",
  `${await val("epcUnitPrice")} · ${await val("year1RatePct")} · ${await val("turbineCountDisplay")}`);
check("비교표 7행 모두 산정 · 새 터빈 행 강조", (await ev("[...document.querySelectorAll('td[id$=-solve]')].filter(td=>/원$/.test(td.textContent)).length")) === 7
  && (await ev(`document.querySelector('#turbineTableBody [data-tb-row="${newId}"]').classList.contains('is-picked')`)) === true);
await setVal(`tb-${newId}-price`, 32); await sleep(1500);
check("사용자 추가 터빈 단가 32 → EPC 80 · 저장된 정의도 32", (await val("epcUnitPrice")) === "80" && (await ev("JSON.parse(localStorage.getItem('windCustomTurbines.v1'))[0].price")) === "32");
check("삭제 버튼은 사용자 추가 터빈에만", (await count("[data-tb-del]")) === 1);
await click("tab-scenario"); await setVal("scenarioName", "신규터빈 시나리오"); await click("saveScenarioBtn"); await sleep(800);
check("시나리오에 사용자 추가 터빈 정의 포함", (await ev(`JSON.parse(localStorage.getItem('windBidPriceScenarios.v1')).find(s=>s.name==='신규터빈 시나리오').state.customTurbines.length`)) === 1);
await click("tab-turbine"); await sleep(2000);
await clickSel(`[data-tb-del="${newId}"]`); await sleep(1500);
check("선택 중인 사용자 터빈 삭제 → 두산으로 · 옵션 6개 · 저장소 0건", (await val("turbineMaker")) === "doosan10" && (await count("#turbineMaker option")) === 6 && (await ev("JSON.parse(localStorage.getItem('windCustomTurbines.v1')).length")) === 0
  && (await num("heroBidPrice")) === heroBase, `${await val("turbineMaker")} · ${await num("heroBidPrice")}`);
await click("tab-scenario"); await sleep(300);
await ev(`(()=>{const sid=JSON.parse(localStorage.getItem('windBidPriceScenarios.v1')).find(s=>s.name==='신규터빈 시나리오').id; document.querySelector('[data-load-scenario="'+sid+'"]').click();})()`); await sleep(2000);
check("시나리오 불러오기 → 사용자 터빈 복원 · 선택 · EPC 80", (await val("turbineMaker")) === newId && (await count("#turbineMaker option")) === 7 && (await val("epcUnitPrice")) === "80" && (await ev("JSON.parse(localStorage.getItem('windCustomTurbines.v1')).length")) === 1,
  `${await val("turbineMaker")} · ${await val("epcUnitPrice")}`);
await click("tab-turbine"); await sleep(2000);
const docNode = await send("DOM.getDocument", {});
const fileNode = await send("DOM.querySelector", { nodeId: docNode.result.root.nodeId, selector: "#importTurbinesFile" });
await send("DOM.setFileInputFiles", { nodeId: fileNode.result.nodeId, files: [`${SP}/turbine-import-test.json`.replace(/\//g, "\\")] }); await sleep(2000);
check("터빈 JSON 불러오기 → 추가 1 · 갱신 1 · 건너뜀 1", ["추가 1종", "갱신 1종", "건너뜀 1종"].every((s) => String(docNode && true) && true) && (await txt("turbineFormMsg")).includes("추가 1종") && (await txt("turbineFormMsg")).includes("갱신 1종") && (await txt("turbineFormMsg")).includes("건너뜀 1종"), await txt("turbineFormMsg"));
check("불러온 SGRE 21MW는 안전한 id로 추가 · 옵션 8개", (await count("#turbineMaker option")) === 8 && (await ev("[...document.querySelectorAll('#turbineMaker option')].some(o=>o.textContent.includes('SG 21-276 DD') && /^u[a-z0-9]+$/.test(o.value))")) === true);
check("같은 모델 갱신 → 저장된 단가 35", (await ev("JSON.parse(localStorage.getItem('windCustomTurbines.v1')).find(t=>t.model==='DS220-15MW (테스트)').price")) === 35);
await click("exportTurbinesBtn"); await sleep(400);
check("내보내기(뷰어 밖) → 다운로드 불가 안내", (await txt("turbineFormMsg")).includes("다운로드 기능"), await txt("turbineFormMsg"));
await ev("localStorage.removeItem('windCustomTurbines.v1'); localStorage.removeItem('windBidPriceScenarios.v1')");
await send("Page.reload"); await sleep(2500);
check("저장소 비우고 새로고침 → 기본 목록 6종으로 복귀", (await count("#turbineMaker option")) === 6 && (await num("heroBidPrice")) === heroBase);

console.log("=== 7) 44px · 반응형 ===");
const hs = await ev(`(()=>{const h=(s)=>{const e=document.querySelector(s); return e? Math.round(e.getBoundingClientRect().height):-1}; return {turbine:h('#turbineMaker'), weightMode:h('#weightMode'), track:h('#tenderTrack'), combo:h('[data-combo]'), applyTurbine:h('#applyTurbineBtn')};})()`);
await click("tab-price"); await sleep(300);
Object.assign(hs, await ev(`(()=>{const h=(s)=>{const e=document.querySelector(s); return e? Math.round(e.getBoundingClientRect().height):-1}; return {score:h('#scoreSecurity'), bid:h('#bidPrice')};})()`));
await click("tab-turbine"); await sleep(3000);
Object.assign(hs, await ev(`(()=>{const h=(s)=>{const e=document.querySelector(s); return e? Math.round(e.getBoundingClientRect().height):-1}; return {tbInput:h('#tb-doosan10-price'), tbPick:h('[data-tb-pick]')};})()`));
for (const [k, v] of Object.entries(hs)) check(`${k} ≥ 44px`, v >= 44, `${v}px`);
for (const w of [1440, 1180, 760, 375]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 1000, deviceScaleFactor: 1, mobile: w <= 760 });
  await sleep(250);
  await ev("document.querySelectorAll('details.acc').forEach(d=>d.open=true)");
  const bad = [];
  for (const t of TABS) {
    await click(t); await sleep(t === "tab-turbine" ? 500 : t === "tab-cases" ? 3000 : 60);
    const sw = await ev("document.documentElement.scrollWidth"), cw = await ev("document.documentElement.clientWidth");
    if (sw > cw + 1) bad.push(`${t} ${sw}>${cw}`);
  }
  check(`w=${w}: 가로 넘침 없음`, bad.length === 0, bad.join(", "));
}
await ev("document.querySelectorAll('details.acc').forEach((d,i)=>d.open=(i===2))");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1500, deviceScaleFactor: 1, mobile: false });
await click("tab-summary"); await sleep(500); await ev("window.scrollTo(0,0); document.querySelector('.col-input').scrollTop = 0;");
await shot("wind-1440.png");
await click("tab-turbine"); await sleep(3000);
await ev("window.scrollTo(0, document.getElementById('panel-turbine').getBoundingClientRect().top + window.scrollY - 70)"); await sleep(200);
await shot("wind-1440-turbine.png");
await click("tab-price"); await sleep(400);
await ev("window.scrollTo(0, document.getElementById('panel-price').getBoundingClientRect().top + window.scrollY - 70); (()=>{const col=document.querySelector('.col-input'); col.scrollTop = document.getElementById('recWeightWrap').offsetTop - 200;})()"); await sleep(200);
await shot("wind-1440-price.png");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 1500, deviceScaleFactor: 1, mobile: true });
await sleep(300); await ev("window.scrollTo(0,0)"); await shot("wind-390.png");
await ev("localStorage.clear()");
check("페이지 오류 0건", errors.length === 0, errors.join(" | "));
console.log(`\nRESULT: ${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}`);
process.exit(failures ? 1 : 0);
