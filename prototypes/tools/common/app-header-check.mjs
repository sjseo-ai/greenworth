// GreenWorth 앱 헤더의 "입찰단가 프로토타입" 링크 — 표시 · 이동 · 1440/375px 가로 넘침 · 스크린샷
import { writeFileSync } from "node:fs";
const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
const APP = encodeURI("file:///C:/Users/KCH/OneDrive/바탕 화면/앱 만들기/사업성모델 앱/index.html");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, detail = "") => { if (!ok) failures++; console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail !== "" ? " — " + detail : ""}`); };
const tab = await (await fetch("http://127.0.0.1:9335/json/new?about:blank", { method: "PUT" })).json();
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
const shot = async (file) => { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${SP}/${file}`, Buffer.from(r.result.data, "base64")); };
await send("Runtime.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: APP }); await sleep(2500);
const link = 'document.querySelector(\'.header-actions a[href="prototypes/index.html"]\')';
check("앱 헤더에 입찰단가 프로토타입 링크", (await ev(`${link}?.textContent`)) === "입찰단가 프로토타입");
check("링크 높이 44px 이상", (await ev(`Math.round(${link}.getBoundingClientRect().height)`)) >= 44, String(await ev(`Math.round(${link}.getBoundingClientRect().height)`)));
await shot("site-app-1440.png");
await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 900, deviceScaleFactor: 1, mobile: true }); await sleep(600);
check("앱 375px 가로 넘침 없음", !(await ev("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")),
  `${await ev("document.documentElement.scrollWidth")}/${await ev("document.documentElement.clientWidth")}`);
await shot("site-app-375.png");
await ev(`${link}.click()`); await sleep(1500);
check("링크 → 프로토타입 목록으로 이동", (await ev("location.pathname")).endsWith("/prototypes/index.html") && (await ev("document.querySelectorAll('.card').length")) === 3);
check("페이지 오류 0건", errors.length === 0, errors.join(" | "));
console.log(`\nRESULT: ${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}`);
process.exit(failures ? 1 : 0);
