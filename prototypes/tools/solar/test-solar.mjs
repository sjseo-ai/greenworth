// Solar draft verification v4: per-maker carbon-verified products → grade/score/premium, module mixing rule,
// tender presets (구간·배점·우대가격), 공고 산식 선정평가, plus v3 module/combos/contract/EPC/tabs/reset/scenario/44px/responsive.
import { readFileSync, writeFileSync } from "node:fs";
const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
const WRAPPED = `${SP}/solar-wrapped.html`;
writeFileSync(WRAPPED, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>\n' + readFileSync(`${SP}/solar-bid-price-prototype.html`, "utf8") + "\n</body></html>", "utf8");
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
const noteHas = async (s) => (await txt("heroBidNote")).includes(s);

await send("Runtime.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
await sleep(400); await ev("localStorage.clear()"); await send("Page.reload"); await sleep(2000);

console.log("=== 1) 기본 = 한화큐셀 · 1등급 제품 · 2026년 상반기 공고 ===");
const heroBase = await num("heroBidPrice");
console.log("     적정 수령단가:", heroBase, "· 히어로:", await txt("heroBidNote"));
check("기본 수령단가 148.24 유지(기본 등급이 v3와 같음)", heroBase === 148.24, String(heroBase));
check("산정 상태 ok · 조합 ① · 한화큐셀 적용 중", (await ev("document.getElementById('solveStatus').className")).includes("ok") && (await txt("comboActive")).includes("한화큐셀") && (await txt("moduleLinkState")).includes("적용 중"), await txt("comboActive"));
check("적용 탄소배출량 611.89 → 1등급", (await val("carbonAppliedDisplay")) === "611.89 → 1등급", await val("carbonAppliedDisplay"));
check("C 판매 조건 등급 = 1 · 옵션 문구에 우대 +16원", (await val("carbonGrade")) === "1" && (await ev("document.getElementById('carbonGrade').options[0].textContent")).includes("+16원"));
check("히어로 입찰가격 = 수령단가 − 16", await noteHas((heroBase - 16).toFixed(2)), await txt("heroBidNote"));
check("공고 회차 = 2026년 상반기", (await val("tenderPreset")) === "2026h1");

console.log("=== 2) 사별 탄소검증 제품 표 ===");
const exp = { hanwha: ["q-peak-g10", "611.89", "1등급", "20점", "+16원"], hyundai: ["his-s490", "548.76", "1등급", "20점", "+16원"], shinsung: ["ss-cm610", "649.1", "2등급", "15점", "+7원"], hansol: ["hs505-ghd30", "560.18", "1등급", "20점", "+16원"], jinko: ["none", "", "미검증 (4등급)", "1점", "없음"], trina: ["none", "", "미검증 (4등급)", "1점", "없음"], ja: ["none", "", "미검증 (4등급)", "1점", "없음"] };
for (const [mk, [prod, co2, g, sc, pr]] of Object.entries(exp)) {
  const got = [await val(`mk-${mk}-product`), await val(`mk-${mk}-co2`), await txt(`mk-${mk}-cgrade`), await txt(`mk-${mk}-cscore`), await txt(`mk-${mk}-cprem`)];
  check(`${mk}: ${prod} · ${co2 || "미검증"} → ${g} · ${sc} · ${pr}`, JSON.stringify(got) === JSON.stringify([prod, co2, g, sc, pr]), got.join(" | "));
}
await setVal("mk-hanwha-product", "q-tron-min"); await sleep(800);
check("한화 제품을 Q.TRON 최저(648.47)로 → 2등급 · C 등급 2 · 적용 중 유지", (await val("mk-hanwha-co2")) === "648.47" && (await txt("mk-hanwha-cgrade")) === "2등급" && (await val("carbonGrade")) === "2" && (await txt("moduleLinkState")).includes("적용 중"), `${await val("mk-hanwha-co2")} · ${await val("carbonGrade")}`);
check("→ 히어로 입찰가격 = 수령단가 − 7 · 수령단가 불변", (await noteHas((heroBase - 7).toFixed(2))) && (await num("heroBidPrice")) === heroBase, await txt("heroBidNote"));
await setVal("mk-hanwha-co2", 700); await sleep(700);
check("배출량을 직접 700으로 → 제품 선택이 직접 입력 · 3등급", (await val("mk-hanwha-product")) === "custom" && (await val("carbonGrade")) === "3", `${await val("mk-hanwha-product")} · ${await val("carbonGrade")}`);
await setVal("mk-hanwha-product", "none"); await sleep(700);
check("미검증 제품 → 배출량 비움 · 4등급", (await val("mk-hanwha-co2")) === "" && (await val("carbonGrade")) === "4");
await setVal("mk-hanwha-product", "q-peak-g10"); await sleep(700);
check("Q.PEAK G10 복귀 → 1등급", (await val("carbonGrade")) === "1" && (await noteHas((heroBase - 16).toFixed(2))));
await setVal("mk-shinsung-product", "ss-dm550bl"); await sleep(700);
check("선택하지 않은 신성 제품 변경 → 표만 3등급, C 등급은 그대로 1", (await txt("mk-shinsung-cgrade")) === "3등급" && (await val("carbonGrade")) === "1");
await setVal("mk-shinsung-product", "ss-cm610"); await sleep(500);

console.log("=== 3) 모듈 혼용 — 배출량이 많은 제품 기준 ===");
await setVal("secondaryMaker", "shinsung"); await sleep(800);
check("한화(611.89) + 신성(649.10) 혼용 → 649.10 · 2등급", (await val("carbonAppliedDisplay")).startsWith("649.10 → 2등급") && (await val("carbonGrade")) === "2", await val("carbonAppliedDisplay"));
check("혼용해도 성능·단가는 주 모듈사(EPC 1,150 · 14.95%)", (await val("epcUnitPrice")) === "1150" && (await val("year1RatePct")) === "14.95");
await setVal("secondaryMaker", "jinko"); await sleep(800);
check("한화 + 진코(미검증) 혼용 → 미검증 · 4등급 · 우대 0", (await val("carbonAppliedDisplay")).startsWith("미검증 → 4등급") && (await val("carbonGrade")) === "4" && (await noteHas("우대가격 0")), await val("carbonAppliedDisplay"));
await setVal("secondaryMaker", "hyundai"); await sleep(800);
check("한화 + HD현대(548.76) → 더 많은 611.89 · 1등급", (await val("carbonAppliedDisplay")).startsWith("611.89 → 1등급"), await val("carbonAppliedDisplay"));
await setVal("secondaryMaker", ""); await sleep(700);

console.log("=== 4) 공고 기준값 · 회차 프리셋 ===");
await setVal("tenderPreset", "2025h1"); await sleep(800);
check("2025년 상반기 → 1등급 우대 12원 · 히어로 − 12 · 수령단가 불변", (await val("carbonP1")) === "12" && (await noteHas((heroBase - 12).toFixed(2))) && (await num("heroBidPrice")) === heroBase, await txt("heroBidNote"));
check("사별 표 우대가격도 +12원 · 신성 2등급 +9원", (await txt("mk-hanwha-cprem")) === "+12원" && (await txt("mk-shinsung-cprem")) === "+9원");
await setVal("carbonP1", 15); await sleep(700);
check("우대가격 직접 수정 → 회차 표시 = 직접 입력", (await val("tenderPreset")) === "custom");
await setVal("tenderPreset", "2026h1"); await sleep(800);
check("2026년 상반기 복귀 → 16원", (await val("carbonP1")) === "16" && (await noteHas((heroBase - 16).toFixed(2))));
await setVal("carbonT1", 600); await sleep(800);
check("1등급 구간을 600으로 → 한화 611.89가 2등급으로 내려감", (await txt("mk-hanwha-cgrade")) === "2등급" && (await val("carbonGrade")) === "2" && (await val("tenderPreset")) === "custom");
await setVal("carbonT1", 630); await sleep(800);
check("구간 복귀 → 1등급 · 회차 2026h1", (await val("carbonGrade")) === "1" && (await val("tenderPreset")) === "2026h1");

console.log("=== 5) 선정평가 — 공고 산식 ===");
await click("tab-price"); await sleep(400);
const bid = parseFloat(await val("bidPrice")), cap = 147.686;
const expPrice = Math.round(Math.max(0, (cap - bid) / cap * 70) * 100) / 100;
const pScore = await num("outScore"), cScore = await num("outCarbon"), nq = await num("outNonQuant"), tot = await num("outTotal");
console.log(`     입찰가격 ${bid} → 가격점수 ${pScore} · 탄소 ${cScore} · 비계량 ${nq} · 합계 ${tot}`);
check("입찰가격 점수 = (상한 − 입찰) ÷ 상한 × 70", Math.abs(pScore - expPrice) < 0.005, `${pScore} vs ${expPrice}`);
check("탄소 20 · 비계량 기본 3(가동 0개월) · 합계", cScore === 20 && Math.abs(nq - 3) < 0.005 && Math.abs(tot - (pScore + 20 + 3)) < 0.011, `${cScore} / ${nq} / ${tot}`);
check("상한가격 표시 147.686", (await val("priceCapDisplay")) === "147.686");
check("1점 = 상한 ÷ 70 = 2.11원 · 1원 = +0.474점", (await txt("outPerPoint")).startsWith("2.11") && (await txt("outPerWon")).includes("0.474"), `${await txt("outPerPoint")} / ${await txt("outPerWon")}`);
check("1등급↔2등급 = 5점×2.11 + 우대 9 = 19.55원", (await txt("outGradeGap")).startsWith("19.55"), await txt("outGradeGap"));
check("탄소 점수 설명에 적용 배출량·모듈사", (await txt("outCarbonSub")).includes("611.89") && (await txt("outCarbonSub")).includes("한화큐셀"), await txt("outCarbonSub"));
await setVal("devProgress", "2"); await setVal("insuranceScore", "2"); await setVal("communityScore", "3"); await setVal("operatingMonths", 30); await sleep(500);
check("비계량 2 + 2 + 3 + 1.5 = 8.5", Math.abs((await num("outNonQuant")) - 8.5) < 0.005, await txt("outNonQuant"));
const row0 = await ev("[...document.querySelectorAll('#sensBody tr')].find(tr=>tr.classList.contains('current-row')).children[2].textContent");
check("점수 변동표 현재행 목표가 = 현재 입찰가격 근처", Math.abs(parseFloat(row0) - bid) < 0.02, `${row0} vs ${bid}`);
await setVal("bidPrice", 200); await sleep(400);
check("상한 초과 입찰 → 가격 점수 0 · 경고", (await num("outScore")) === 0 && (await ev("document.getElementById('priceCapWarn').className")).includes("show"));
await click("relinkBtn"); await sleep(800);
await setVal("carbonGrade", "2"); await sleep(600);
check("C에서 등급 직접 2 → 탄소 15점 · 설명 직접 고른 등급 · 사용자 조정", (await val("carbonScoreDisplay")) === "15" && (await txt("outCarbonSub")).includes("직접") && (await txt("moduleLinkState")).includes("사용자 조정"));
await click("reset"); await sleep(1200);

console.log("=== 6) 모듈사 전환 · 비교 탭 ===");
for (const [mk, epc, grade] of [["hyundai", "1150", "1"], ["shinsung", "1080", "2"], ["jinko", "955", "4"]]) {
  await setVal("moduleMaker", mk); await sleep(800);
  check(`${mk} → EPC ${epc} · ${grade}등급`, (await val("epcUnitPrice")) === epc && (await val("carbonGrade")) === grade, `${await val("epcUnitPrice")} · ${await val("carbonGrade")}`);
}
await setVal("moduleMaker", "hanwha"); await sleep(800);
await click("tab-module"); await sleep(3000);
const solveCells = await ev("[...document.querySelectorAll('td[id$=-solve]')].map(td=>td.textContent)");
check("비교 탭 7개사 산정", solveCells.length === 7 && solveCells.every((t) => /원$/.test(t)), solveCells.join(" | "));
check("비교 입찰가격 — 국산 1등급 −16 · 신성 −7", (await txt("mk-hyundai-bid")).includes("−16") && (await txt("mk-shinsung-bid")).includes("−7"));
await setVal("mk-trina-co2", 600); await sleep(3000);
check("트리나에 배출량 600 입력 → 비교표 −16 · 선택 목록 직접 입력", (await txt("mk-trina-bid")).includes("−16") && (await val("mk-trina-product")) === "custom", await txt("mk-trina-bid"));
await setVal("mk-trina-product", "none"); await sleep(2500);
check("트리나 미검증 복귀 → −표시 없음", !(await txt("mk-trina-bid")).includes("−"), await txt("mk-trina-bid"));
check("결과·스펙·탄소 표 1440px 가로 스크롤 없음", (await ev("['moduleTableBody','moduleSpecBody','moduleCarbonBody'].every(id=>{const w=document.getElementById(id).closest('.table-wrap'); return w.scrollWidth<=w.clientWidth+1;})")) === true,
  await ev("['moduleTableBody','moduleSpecBody','moduleCarbonBody'].map(id=>{const w=document.getElementById(id).closest('.table-wrap'); return w.scrollWidth+'/'+w.clientWidth;}).join(' ')"));
await click("reset"); await sleep(1200);

console.log("=== 6c) 상한가 진입 조건 ===");
await click("tab-price"); await sleep(1500);
check("기본 — 상한가 이내 · 여유 행 best · 상한가 입찰 시 목표 지표", (await txt("entryNote")).includes("상한가 이내") && (await ev("document.getElementById('entryGap').className")) === "best" && !!(await ev("!!document.getElementById('entryTarget')")), await txt("entryNote"));
const gapDefault = parseFloat(await ev("document.getElementById('entryGap').dataset.value"));
check("여유 = 상한가 − (수령단가 − 16)", Math.abs(-gapDefault - (147.686 - (heroBase - 16))) < 0.02, String(gapDefault));
await setVal("solveMode", "irr"); await sleep(800);
let overT = null;
for (const t of [10, 12, 14, 16, 20]) {
  await setVal("targetIrrPct", t); await sleep(1500);
  if ((await txt("entryNote")).includes("넘어")) { overT = t; break; }
}
check("목표 IRR 상향 → 상한가 초과 안내 · 인하 필요 행 over", overT != null && (await ev("document.getElementById('entryGap').className")) === "over", `목표 ${overT}% · ${await txt("entryNote")}`);
const R1 = await num("heroBidPrice"), gap1 = parseFloat(await ev("document.getElementById('entryGap').dataset.value"));
check("인하 필요 = 수령단가 − 16 − 상한가", Math.abs(gap1 - (R1 - 16 - 147.686)) < 0.02, `${gap1} vs ${R1}`);
const epcReq = parseFloat(await ev("document.getElementById('entryEpc').dataset.value"));
await setVal("epcUnitPrice", epcReq.toFixed(1)); await sleep(1800);
check("제시 EPC 단가 적용 → 입찰가격 ≈ 상한가(±0.3원)", Math.abs((await num("heroBidPrice")) - 16 - 147.686) < 0.3, `${await num("heroBidPrice")} · EPC ${epcReq.toFixed(1)}`);
await setVal("epcUnitPrice", "1150"); await sleep(1500);
const cfReq = parseFloat(await ev("document.getElementById('entryCf').dataset.value"));
await setVal("year1RatePct", cfReq.toFixed(2)); await sleep(1800);
check("제시 1년차 이용률 적용 → 입찰가격 ≈ 상한가(±0.3원)", Math.abs((await num("heroBidPrice")) - 16 - 147.686) < 0.3, `${await num("heroBidPrice")} · ${cfReq.toFixed(2)}%`);
await setVal("year1RatePct", "14.95"); await sleep(1200);
check("O&M 행 · 목표 행 표시", !!(await ev("!!document.getElementById('entryOpex')")) && (await txt("entryTarget")).includes("낮추면"));
await setVal("carbonGrade", "3"); await sleep(1800);
check("탄소 3등급으로 → 1·2등급 전환 행", !!(await ev("!!document.getElementById('entryGrade1')")) && !!(await ev("!!document.getElementById('entryGrade2')")), await txt("entryNote"));
check("히어로 초과 안내에 진입 조건 위치", (await txt("heroBidNote")).includes("진입 조건"), await txt("heroBidNote"));
await click("reset"); await sleep(1500);

console.log("=== 6d) 입찰 사례 ===");
await click("tab-cases"); await sleep(8000);
check("회차 6 · 대형 사업 10 · 상세 6 + 10", (await count("#roundInputBody tr")) === 6 && (await count("#roundResultBody tr")) === 6 && (await count("#caseInputBody tr")) === 10 && (await count("#caseResultBody tr")) === 10
  && (await count("#roundSourceList li")) === 6 && (await count("#caseSourceList li")) === 10);
check("회차 기본값 — 2023 하반기 150.947 · 2026 1차 상한가 147.686 · 우대 칸 비움", (await val("rd-r23h2-price")) === "150.947" && (await val("rd-r26-price")) === "147.686" && (await val("rd-r25h1-prem")) === "");
check("수령단가 — 2023 하반기 150.95(우대 없음) · 2025 상반기 154.655 + 12 · 2026 147.686 + 16", (await txt("rd-r23h2-recv")) === "150.95원" && (await txt("rd-r25h1-recv")).startsWith("166.6") && (await txt("rd-r26-recv")) === "163.69원",
  `${await txt("rd-r23h2-recv")} / ${await txt("rd-r25h1-recv")} / ${await txt("rd-r26-recv")}`);
check("대형 사업 기본값 — 해남 529GWh → 15.1 · 합천댐 15.7 · 신안 증도 16.9 · 솔라시도 사업비 빈 칸", (await val("cs-p_haenam400-cf")) === "15.1" && (await val("cs-p_hapcheon41-cf")) === "15.7" && (await val("cs-p_jeungdo-capex")) === "16.9" && (await val("cs-p_solaseado98-capex")) === "",
  `${await val("cs-p_haenam400-cf")} / ${await val("cs-p_hapcheon41-cf")} / ${await val("cs-p_jeungdo-capex")}`);
const hInv = parseFloat(await txt("cs-p_haenam400-inv"));
check("해남 총사업비(계산) ≈ 17.1억/MW (±5%)", Math.abs(hInv / 17.1 - 1) < 0.05, String(hInv));
check("모든 회차·사례 P-IRR · 적정 수령단가 산정 · 요약 중앙값", (await ev("[...document.querySelectorAll('#roundResultBody td[id$=-pirr], #caseResultBody td[id$=-pirr]')].filter(td=>/%$/.test(td.textContent)).length")) === 16
  && (await ev("[...document.querySelectorAll('#caseResultBody td[id$=-need]')].filter(td=>/원$/.test(td.textContent)).length")) === 10 && (await txt("caseSummary")).includes("중앙값"), await txt("caseSummary"));
console.log(`     요약: ${await txt("caseSummary")}`);
for (const rid of ["r22h1", "r23h2", "r24", "r25h1", "r26"]) console.log(`     ${rid}: 수령 ${await txt(`rd-${rid}-recv`)} · P-IRR ${await txt(`rd-${rid}-pirr`)} · 목표 대비 ${await txt(`rd-${rid}-gap`)} · 상한가 P-IRR ${await txt(`rd-${rid}-cappirr`)}`);
for (const cid of ["p_haenam400", "p_sanaeho410", "p_jeungdo", "p_gsdangjin", "p_daeho98", "p_hapcheon41", "p_imha47"]) console.log(`     ${cid}: 사업비 ${await txt(`cs-${cid}-inv`)} · 적정 ${await txt(`cs-${cid}-need`)} · P-IRR ${await txt(`cs-${cid}-pirr`)} · ${await txt(`cs-${cid}-fit`)}`);
const needH = parseFloat(String(await txt("cs-p_haenam400-need")).replace(/,/g, ""));
await setVal("cs-p_haenam400-r", needH.toFixed(2)); await sleep(6000);
check("검산 — 해남 적정 수령단가를 가정 단가로 넣으면 P-IRR = 목표 8%(±0.03%p)", Math.abs(parseFloat(await txt("cs-p_haenam400-pirr")) - 8) < 0.03, await txt("cs-p_haenam400-pirr"));
check("상세 — 사내호 ME2026C006 · 4,890억원 / GS 당진 ME2021C014 · 218.2MW / 대호호 GG20210184 / 해남 400MW 미확인", (await ev("document.querySelector('[data-cs-detail=\"p_sanaeho410\"]').textContent")).includes("4,890억원")
  && (await ev("document.querySelector('[data-cs-detail=\"p_gsdangjin\"]').textContent")).includes("218.2MW") && (await ev("document.querySelector('[data-cs-detail=\"p_daeho98\"]').textContent")).includes("GG20210184")
  && (await ev("document.querySelector('[data-cs-detail=\"p_haenam400\"]').textContent")).includes("확인되지 않음"));
check("회차 상세 — 2022 상반기 상한가 160.603 · 접수 1,043MW · 2024 선정 429개소", (await ev("document.querySelector('[data-rd-detail=\"r22h1\"]').textContent")).includes("160.603") && (await ev("document.querySelector('[data-rd-detail=\"r22h1\"]').textContent")).includes("1,043")
  && (await ev("document.querySelector('[data-rd-detail=\"r24\"]').textContent")).includes("429개소"));
const pirrR24 = parseFloat(await txt("rd-r24-pirr"));
await setVal("rd-r24-price", 140); await sleep(6000);
check("2024 적용 입찰가 140으로 → P-IRR 하락", parseFloat(await txt("rd-r24-pirr")) < pirrR24, `${pirrR24} → ${await txt("rd-r24-pirr")}`);
check("사례 표 1440px 가로 스크롤 없음", (await ev("[...document.querySelectorAll('#panel-cases .table-wrap')].every(w=>w.scrollWidth<=w.clientWidth+1)")) === true,
  await ev("[...document.querySelectorAll('#panel-cases .table-wrap')].map(w=>w.scrollWidth+'/'+w.clientWidth).join(' ')"));
await ev("window.scrollTo(0, document.getElementById('panel-cases').getBoundingClientRect().top + window.scrollY - 70)"); await sleep(200);
await shot("solar-1440-cases.png");
await click("reset"); await sleep(1500);

console.log("=== 7) 조합 · 계약기간 · 시나리오 · 되돌리기 ===");
await clickSel('[data-combo="china"]'); await sleep(1000);
check("조합 ② → 진코솔라 · PPA · 탄소 칸 숨김", (await val("moduleMaker")) === "jinko" && (await val("salesStructure")) === "ppa" && !(await shown("carbonGradeField")));
await clickSel('[data-combo="domestic"]'); await sleep(1000);
check("조합 ① 복귀 → 기본 수령단가", (await num("heroBidPrice")) === heroBase);
await setVal("contractYears", 30); await sleep(600);
check("계약 30년 > 운영 20년 → 경고", (await ev("document.getElementById('contractYearsWarn').className")).includes("show"));
await click("reset"); await sleep(1000);
const TABS = ["tab-summary", "tab-module", "tab-sens", "tab-scenario", "tab-price", "tab-cases", "tab-kch", "tab-caveats"];
for (const t of TABS) {
  await click(t); await sleep(t === "tab-module" || t === "tab-cases" ? 2500 : 150);
  check(`${t} → 패널 표시`, (await ev(`document.getElementById(document.getElementById('${t}').dataset.panel).hidden`)) === false);
}
check("확정 필요 항목 15개", (await count("#panel-caveats .todo-list li")) === 15, String(await count("#panel-caveats .todo-list li")));
await click("tab-scenario");
await setVal("scenarioName", "한화 1등급"); await click("saveScenarioBtn"); await sleep(600);
await setVal("mk-hanwha-product", "q-tron-min"); await sleep(800);
await setVal("scenarioName", "한화 Q.TRON 2등급"); await click("saveScenarioBtn"); await sleep(700);
check("탄소 제품별 시나리오 2개 · 탄소 등급 저장", (await count(".price-bar-row")) === 2 && (await ev(`JSON.parse(localStorage.getItem('solarBidPriceScenarios.v1')).map(s=>s.kpi.carbonGrade).join(',')`)).startsWith("1등급"), await ev(`JSON.parse(localStorage.getItem('solarBidPriceScenarios.v1')).map(s=>s.kpi.carbonGrade).join(',')`));
await click("reset"); await sleep(1100);
check("되돌리기 → 한화 Q.PEAK G10 · 1등급 · 2026h1 · 기본 수령단가", (await val("mk-hanwha-product")) === "q-peak-g10" && (await val("carbonGrade")) === "1" && (await val("tenderPreset")) === "2026h1" && (await num("heroBidPrice")) === heroBase);

console.log("=== 7a) 모듈 목록 관리 ===");
await click("reset"); await sleep(1500);
await click("tab-module"); await sleep(3000);
check("기본 목록 7종 · 기준일 · 사용자 추가 0종", (await txt("moduleCatalogInfo")) === "기본 목록 7종 (기준일 2026-09-14) · 사용자 추가 0종", await txt("moduleCatalogInfo"));
check("선택 7 · 혼용 8(혼용 없음 포함) · 세 표 7행 · 근거 7 · 삭제 버튼 없음", (await count("#moduleMaker option")) === 7 && (await count("#secondaryMaker option")) === 8 && (await count("#moduleTableBody tr")) === 7
  && (await count("#moduleCarbonBody tr")) === 7 && (await count("#moduleSpecBody tr")) === 7 && (await count("#moduleSourceList li")) === 7 && (await count("[data-mk-del]")) === 0);
check("스펙 칸 표기 — 한화 −0.29 · 1.5 · 0.33 · HD현대 −0.30 · 진코 205", (await val("mk-hanwha-gamma")) === "-0.29" && (await val("mk-hanwha-deg1")) === "1.5" && (await val("mk-hanwha-degA")) === "0.33"
  && (await val("mk-hyundai-gamma")) === "-0.30" && (await val("mk-jinko-price")) === "205");
await setVal("newMkName", "한화큐셀"); await setVal("newMkModel", "Q.TRON XL-G2.3/BFG"); await click("addModuleBtn"); await sleep(400);
check("이미 있는 모델 → 오류 안내", (await ev("document.getElementById('moduleFormMsg').className")).includes("warn") && (await txt("moduleFormMsg")).includes("이미 목록"), await txt("moduleFormMsg"));
await setVal("newMkName", ""); await click("addModuleBtn"); await sleep(300);
check("제조사 비움 → 필수값 안내", (await txt("moduleFormMsg")).includes("제조사와 모델명"), await txt("moduleFormMsg"));
await setVal("newMkName", "한화큐셀"); await setVal("newMkModel", "Q.TRON G3 (테스트)"); await setVal("newMkOrigin", "domestic"); await setVal("newMkPrice", 390);
await setVal("newMkGamma", -0.26); await setVal("newMkBif", 85); await setVal("newMkDeg1", 1); await setVal("newMkDegA", 0.3); await setVal("newMkCo2", 600); await setVal("newMkSource", "테스트 입력");
await click("addModuleBtn"); await sleep(3000);
const newMk = await ev("[...document.querySelectorAll('#moduleMaker option')].find(o=>o.textContent.includes('Q.TRON G3'))?.value");
check("새 모듈 추가 → 옵션 8 · 혼용 9 · (사용자 추가) · 저장소 1건 · 폼 비움", !!newMk && (await count("#moduleMaker option")) === 8 && (await count("#secondaryMaker option")) === 9
  && (await ev(`document.querySelector('#moduleMaker option[value="${newMk}"]').textContent`)).includes("사용자 추가") && (await ev("JSON.parse(localStorage.getItem('solarCustomModules.v1')).length")) === 1 && (await val("newMkModel")) === "", String(newMk));
check("탄소 표 — 배출량 600 → 1등급 · +16원 · 제목 국산 5종 · 근거 문구", (await val(`mk-${newMk}-co2`)) === "600" && (await txt(`mk-${newMk}-cgrade`)) === "1등급" && (await txt(`mk-${newMk}-cprem`)) === "+16원"
  && (await txt("moduleCountHead")) === "국산 5종 · 중국산 3종" && (await txt("moduleSourceList")).includes("테스트 입력"), `${await txt(`mk-${newMk}-cgrade`)} · ${await txt("moduleCountHead")}`);
check("선택 중이던 한화 그대로 · 수령단가 불변", (await val("moduleMaker")) === "hanwha" && (await num("heroBidPrice")) === heroBase);
await clickSel(`[data-mk-pick="${newMk}"]`); await sleep(3500);
check("새 모듈 선택 → EPC 390 + 750 = 1,140 · 1등급 · 비교표 8행 산정 · 행 강조", (await val("moduleMaker")) === newMk && (await val("epcUnitPrice")) === "1140" && (await val("carbonGrade")) === "1"
  && (await ev("[...document.querySelectorAll('#moduleTableBody td[id$=-solve]')].filter(td=>/원$/.test(td.textContent)).length")) === 8
  && (await ev(`document.querySelector('#moduleTableBody [data-mk-row="${newMk}"]').classList.contains('is-picked')`)) === true, `${await val("epcUnitPrice")} · ${await val("carbonGrade")}`);
await setVal(`mk-${newMk}-price`, 400); await sleep(3000);
check("사용자 모듈 단가 400 → EPC 1,150 · 저장된 정의 400", (await val("epcUnitPrice")) === "1150" && (await ev("JSON.parse(localStorage.getItem('solarCustomModules.v1'))[0].price")) === 400);
await setVal(`mk-${newMk}-product`, "none"); await sleep(2500);
check("사용자 모듈 미검증 제품 → 배출량 비움 · 4등급", (await val(`mk-${newMk}-co2`)) === "" && (await val("carbonGrade")) === "4");
await setVal(`mk-${newMk}-product`, "verified"); await sleep(2500);
check("검증 제품 복귀 → 600 · 1등급", (await val(`mk-${newMk}-co2`)) === "600" && (await val("carbonGrade")) === "1");
check("삭제 버튼은 사용자 추가 모듈에만", (await count("[data-mk-del]")) === 1);
await click("tab-scenario"); await setVal("scenarioName", "신규모듈 시나리오"); await click("saveScenarioBtn"); await sleep(900);
check("시나리오에 사용자 추가 모듈 정의 포함", (await ev(`JSON.parse(localStorage.getItem('solarBidPriceScenarios.v1')).find(s=>s.name==='신규모듈 시나리오').state.customModules.length`)) === 1);
await click("tab-module"); await sleep(3000);
await clickSel(`[data-mk-del="${newMk}"]`); await sleep(3000);
check("선택 중인 사용자 모듈 삭제 → 한화 · 옵션 7 · 저장소 0 · 기본 수령단가", (await val("moduleMaker")) === "hanwha" && (await count("#moduleMaker option")) === 7 && (await ev("JSON.parse(localStorage.getItem('solarCustomModules.v1')).length")) === 0
  && (await num("heroBidPrice")) === heroBase, `${await val("moduleMaker")} · ${await num("heroBidPrice")}`);
await click("tab-scenario"); await sleep(300);
await ev(`(()=>{const sid=JSON.parse(localStorage.getItem('solarBidPriceScenarios.v1')).find(s=>s.name==='신규모듈 시나리오').id; document.querySelector('[data-load-scenario="'+sid+'"]').click();})()`); await sleep(2500);
check("시나리오 불러오기 → 사용자 모듈 복원 · 선택 · EPC 1,150 · 1등급", (await val("moduleMaker")) === newMk && (await count("#moduleMaker option")) === 8 && (await val("epcUnitPrice")) === "1150" && (await val("carbonGrade")) === "1"
  && (await ev("JSON.parse(localStorage.getItem('solarCustomModules.v1')).length")) === 1, `${await val("moduleMaker")} · ${await val("epcUnitPrice")} · ${await val("carbonGrade")}`);
await click("tab-module"); await sleep(3000);
const docNodeS = await send("DOM.getDocument", {});
const fileNodeS = await send("DOM.querySelector", { nodeId: docNodeS.result.root.nodeId, selector: "#importModulesFile" });
await send("DOM.setFileInputFiles", { nodeId: fileNodeS.result.nodeId, files: [`${SP}/solar-module-import-test.json`.replace(/\//g, "\\")] }); await sleep(3500);
check("모듈 JSON 불러오기 → 추가 1 · 갱신 1 · 건너뜀 1", (await txt("moduleFormMsg")).includes("추가 1종") && (await txt("moduleFormMsg")).includes("갱신 1종") && (await txt("moduleFormMsg")).includes("건너뜀 1종"), await txt("moduleFormMsg"));
const longi = await ev("[...document.querySelectorAll('#moduleMaker option')].find(o=>o.textContent.includes('Hi-MO 9'))?.value");
check("불러온 LONGi는 안전한 id · 중국산 그룹 · 배출량 없음 → 미검증 제품만", /^m[a-z0-9]+$/.test(String(longi)) && (await count("#moduleMaker option")) === 9
  && (await ev(`document.querySelector('#moduleMaker option[value="${longi}"]').parentElement.label`)) === "중국산" && (await ev(`[...document.getElementById('mk-${longi}-product').options].map(o=>o.value).join(',')`)) === "none,custom", String(longi));
check("같은 모델 갱신 → 저장된 단가 410", (await ev("JSON.parse(localStorage.getItem('solarCustomModules.v1')).find(t=>t.model==='Q.TRON G3 (테스트)').price")) === 410);
await click("exportModulesBtn"); await sleep(400);
check("내보내기(뷰어 밖) → 다운로드 불가 안내", (await txt("moduleFormMsg")).includes("다운로드 기능"), await txt("moduleFormMsg"));
await ev("localStorage.removeItem('solarCustomModules.v1'); localStorage.removeItem('solarBidPriceScenarios.v1')");
await send("Page.reload"); await sleep(3500);
check("저장소 비우고 새로고침 → 기본 7종 · 기본 수령단가", (await count("#moduleMaker option")) === 7 && (await num("heroBidPrice")) === heroBase, `${await count("#moduleMaker option")} · ${await num("heroBidPrice")}`);

console.log("=== 8) 44px · 반응형 ===");
const hsel = `(()=>{const h=(s)=>{const e=document.querySelector(s); return e? Math.round(e.getBoundingClientRect().height):-1}; return {maker:h('#moduleMaker'), secondary:h('#secondaryMaker'), combo:h('[data-combo]'), tab:h('#tab-price'), reset:h('#reset')};})()`;
const hs = await ev(hsel);
await click("tab-price"); await sleep(300);
Object.assign(hs, await ev(`(()=>{const h=(s)=>{const e=document.querySelector(s); return e? Math.round(e.getBoundingClientRect().height):-1}; return {tender:h('#tenderPreset'), carbonT1:h('#carbonT1'), devProgress:h('#devProgress'), months:h('#operatingMonths')};})()`));
await click("tab-module"); await sleep(2500);
Object.assign(hs, await ev(`(()=>{const h=(s)=>{const e=document.querySelector(s); return e? Math.round(e.getBoundingClientRect().height):-1}; return {mkProduct:h('#mk-hanwha-product'), mkCo2:h('#mk-hanwha-co2'), mkPick:h('[data-mk-pick]')};})()`));
for (const [k, v] of Object.entries(hs)) check(`${k} ≥ 44px`, v >= 44, `${v}px`);
for (const w of [1440, 1180, 760, 375]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 1000, deviceScaleFactor: 1, mobile: w <= 760 });
  await sleep(250);
  await ev("document.querySelectorAll('details.acc').forEach(d=>d.open=true)");
  const bad = [];
  for (const t of TABS) {
    await click(t); await sleep(t === "tab-module" ? 400 : 60);
    const sw = await ev("document.documentElement.scrollWidth"), cw = await ev("document.documentElement.clientWidth");
    if (sw > cw + 1) bad.push(`${t} ${sw}>${cw}`);
  }
  check(`w=${w}: 가로 넘침 없음`, bad.length === 0, bad.join(", "));
}
await ev("document.querySelectorAll('details.acc').forEach((d,i)=>d.open=(i===2))");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1500, deviceScaleFactor: 1, mobile: false });
await click("tab-module"); await sleep(2500);
await ev("window.scrollTo(0, document.getElementById('moduleCarbonBody').closest('.table-wrap').getBoundingClientRect().top + window.scrollY - 700)"); await sleep(200);
await shot("solar-1440-carbon.png");
await click("tab-price"); await sleep(400);
await ev("window.scrollTo(0, document.getElementById('panel-price').getBoundingClientRect().top + window.scrollY - 70)"); await sleep(200);
await shot("solar-1440-price.png");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 1500, deviceScaleFactor: 1, mobile: true });
await sleep(300); await ev("window.scrollTo(0, document.getElementById('panel-price').getBoundingClientRect().top + window.scrollY - 10)"); await shot("solar-390-price.png");
await ev("localStorage.clear()");
check("페이지 오류 0건", errors.length === 0, errors.join(" | "));
console.log(`\nRESULT: ${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}`);
process.exit(failures ? 1 : 0);
