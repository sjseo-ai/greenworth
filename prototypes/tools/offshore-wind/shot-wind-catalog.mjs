// 터빈 비교 탭 "새 터빈 등록" 구역 스크린샷 — 사용자 터빈 1종을 추가한 상태로 1440px · 390px
import { writeFileSync } from "node:fs";
const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
const URL_ = "file:///" + `${SP}/wind-wrapped.html`.replace(/^\//, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tab = await (await fetch("http://127.0.0.1:9335/json/new?" + encodeURIComponent(URL_), { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const errors = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text);
});
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
const setVal = (i, v) => ev(`(()=>{const e=document.getElementById(${JSON.stringify(i)}); e.value=${JSON.stringify(String(v))}; e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const shot = async (file) => { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${SP}/${file}`, Buffer.from(r.result.data, "base64")); console.log("screenshot:", file); };

await send("Runtime.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1500, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
await sleep(300); await ev("localStorage.clear()"); await send("Page.reload"); await sleep(2200);
await ev("document.getElementById('tab-turbine').click()"); await sleep(2500);
await setVal("newTbMaker", "Siemens Gamesa"); await setVal("newTbModel", "SG 21-276 DD"); await setVal("newTbMw", 21.5); await setVal("newTbRotor", 276);
await setVal("newTbPrice", 30); await setVal("newTbSource", "제조사 발표(예시), 국내 형식인증 전");
await ev("document.getElementById('addTurbineBtn').click()"); await sleep(3000);
await ev("window.scrollTo(0, document.getElementById('turbineSpecBody').closest('.table-wrap').getBoundingClientRect().top + window.scrollY - 120)"); await sleep(300);
await shot("wind-catalog-1440.png");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 1400, deviceScaleFactor: 1, mobile: true });
await sleep(500);
await ev("window.scrollTo(0, document.getElementById('newTbMaker').getBoundingClientRect().top + window.scrollY - 160)"); await sleep(300);
await shot("wind-catalog-390.png");
console.log("options:", await ev("document.querySelectorAll('#turbineMaker option').length"), "· msg:", await ev("document.getElementById('turbineFormMsg').textContent"));
await ev("localStorage.clear()");
console.log("errors:", errors.length ? errors.join(" | ") : "0");
process.exit(0);
