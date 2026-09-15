// Extra visual-review screenshots: scenario/price/KCH tabs at 1440, result area + tabs at 390 (mobile).
// Uses redesign-wrapped.html produced by test-redesign.mjs (run that first).
import { writeFileSync } from "node:fs";
const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
const URL_ = "file:///" + `${SP}/redesign-wrapped.html`.replace(/^\//, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tab = await (await fetch("http://127.0.0.1:9335/json/new?" + encodeURIComponent(URL_), { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const errors = [];
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text); });
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
const shot = async (file) => { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${SP}/${file}`, Buffer.from(r.result.data, "base64")); console.log("screenshot:", file); };
const setVal = (idv, v) => ev(`(()=>{const e=document.getElementById('${idv}'); e.value='${v}'; e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const top = (sel) => ev(`(()=>{const e=document.querySelector('${sel}'); window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 64);})()`);

await send("Runtime.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
await sleep(300); await ev("localStorage.clear()"); await send("Page.reload"); await sleep(1500);

// two scenarios so the comparison table shows win/lose
await ev("document.getElementById('tab-scenario').click()");
await setVal("scenarioName", "기본안 96MW"); await ev("document.getElementById('saveScenarioBtn').click()"); await sleep(400);
await setVal("contractCapacityMW", "90"); await sleep(300);
await setVal("scenarioName", "용량 90MW"); await ev("document.getElementById('saveScenarioBtn').click()"); await sleep(400);
await ev("document.getElementById('reset').click()"); await sleep(500);
await ev("document.getElementById('tab-scenario').click()"); await sleep(150);
await top(".tabs"); await sleep(150); await shot("x-1440-scenario.png");
await top("#scenarioCompareWrap"); await sleep(150); await shot("x-1440-scenario-table.png");
await ev("document.getElementById('tab-price').click()"); await sleep(150); await top(".tabs"); await sleep(150); await shot("x-1440-price.png");
await ev("document.getElementById('tab-kch').click()"); await sleep(150); await top("#kchSensBody"); await sleep(150); await shot("x-1440-kch.png");
await ev("document.getElementById('tab-summary').click()"); await sleep(150); await top("#summaryDetail"); await sleep(150); await shot("x-1440-detail.png");

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
await sleep(300);
await top(".hero"); await sleep(150); await shot("x-390-cards.png");
await top(".tabs"); await sleep(150); await shot("x-390-summary.png");
await ev("document.getElementById('tab-sens').click()"); await sleep(300); await top(".tabs"); await sleep(150); await shot("x-390-sens.png");
await ev("localStorage.clear()");
console.log(errors.length ? "ERRORS: " + errors.join(" | ") : "no errors");
process.exit(0);
