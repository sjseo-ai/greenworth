// 상한가 진입 조건(목표 7.5%로 상한 초과 상태) · 입찰 사례 탭 스크린샷
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
const shot = async (file) => { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${SP}/${file}`, Buffer.from(r.result.data, "base64")); console.log("screenshot:", file); };

await send("Runtime.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1500, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
await sleep(300); await ev("localStorage.clear()"); await send("Page.reload"); await sleep(2200);
await ev("(()=>{const e=document.getElementById('targetIrrPct'); e.value='7.5'; e.dispatchEvent(new Event('input',{bubbles:true}));})()"); await sleep(1500);
await ev("document.getElementById('tab-price').click()"); await sleep(2000);
await ev("window.scrollTo(0, document.getElementById('entryNote').getBoundingClientRect().top + window.scrollY - 520)"); await sleep(300);
await shot("wind-entry-1440.png");
await ev("document.getElementById('reset').click()"); await sleep(1500);
await ev("document.getElementById('tab-cases').click()"); await sleep(6000);
await ev("window.scrollTo(0, document.getElementById('panel-cases').getBoundingClientRect().top + window.scrollY - 70)"); await sleep(300);
await shot("wind-cases-1440.png");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 1400, deviceScaleFactor: 1, mobile: true });
await sleep(1500);
await ev("window.scrollTo(0, document.getElementById('caseSummary').getBoundingClientRect().top + window.scrollY - 80)"); await sleep(300);
await shot("wind-cases-390.png");
console.log("errors:", errors.length ? errors.join(" | ") : "0");
process.exit(0);
