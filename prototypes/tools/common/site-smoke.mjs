// 사이트용 프로토타입 페이지 점검 — 목록(허브) → 각 페이지 로드 · 목록 링크 · 브라우저 다운로드 대체 · 375px 넘침 · 오류
import { writeFileSync } from "node:fs";
const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
const BASE = "file:///C:/Users/KCH/OneDrive/바탕 화면/앱 만들기/사업성모델 앱/prototypes/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, detail = "") => { if (!ok) failures++; console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail !== "" ? " — " + detail : ""}`); };
const tab = await (await fetch("http://127.0.0.1:9335/json/new?about:blank", { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const errors = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text + " " + (m.params.exceptionDetails.exception?.description ?? ""));
});
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send("Runtime.enable"); await send("Page.enable");
const size = (w) => send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: w <= 760 });
const go = async (url, wait = 4000) => { await send("Page.navigate", { url: encodeURI(url) }); await sleep(wait); };
const overflow = () => ev("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1");

await size(1440);
await go(BASE + "index.html", 1500);
check("허브 — 카드 3 · 페이지 링크 3 · 압축 링크 3 · 앱 링크", (await ev("document.querySelectorAll('.card').length")) === 3 && (await ev("document.querySelectorAll('.card a.btn.primary').length")) === 3
  && (await ev("document.querySelectorAll('a[href^=\"downloads/\"][href$=\".zip\"]').length")) === 3 && (await ev("!!document.querySelector('a[href=\"../index.html\"]')")));
await size(375); await sleep(300);
check("허브 375px 가로 넘침 없음", !(await overflow()));
const shotHub = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${SP}/site-hub-375.png`, Buffer.from(shotHub.result.data, "base64"));
await size(1440);

for (const [pid, name] of [["solar", "태양광"], ["offshore-wind", "해상풍력"], ["bess", "ESS"]]) {
  const before = errors.length;
  await go(BASE + `${pid}/index.html`, 6000);
  const hero = await ev("document.getElementById('heroBidPrice')?.textContent");
  check(`${pid} — 로드 · 제목 · 적정 단가 산정`, (await ev("document.title")).includes(name) && /\d/.test(String(hero)), `${await ev("document.title")} · ${hero}`);
  check(`${pid} — 목록 링크 · window.claude 없음 · 다운로드 대체 연결`, (await ev("document.querySelector('.gw-site-nav a')?.getAttribute('href')")) === "../index.html" && (await ev("typeof window.claude")) === "undefined"
    && (await ev("typeof window.greenworthBrowserDownloads.save")) === "function");
  // 다운로드 호출을 가로채 기록(실제 파일 저장 대신) → 시나리오 저장 시 JSON 파일 저장이 호출되는지
  await ev("window.__saves = []; window.greenworthBrowserDownloads.save = async (o) => { window.__saves.push(o.filename); };");
  await ev("document.getElementById('tab-scenario').click()"); await sleep(500);
  await ev("(()=>{const e=document.getElementById('scenarioName'); e.value='사이트 점검'; e.dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('saveScenarioBtn').click();})()"); await sleep(1500);
  const saves = await ev("window.__saves");
  check(`${pid} — 시나리오 저장 → 브라우저 다운로드로 JSON 저장 호출`, Array.isArray(saves) && saves.some((f) => /\.json$/.test(f)), JSON.stringify(saves));
  check(`${pid} — 시나리오 이름 예시에 실제 사업명 없음`, !(await ev("document.getElementById('scenarioName').placeholder")).includes("안좌"), await ev("document.getElementById('scenarioName').placeholder"));
  await size(375); await sleep(400);
  check(`${pid} — 375px 가로 넘침 없음`, !(await overflow()));
  if (pid === "solar") { const s = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${SP}/site-solar-375.png`, Buffer.from(s.result.data, "base64")); }
  await size(1440); await sleep(200);
  await ev("localStorage.clear()");
  check(`${pid} — 페이지 오류 0건`, errors.length === before, errors.slice(before).join(" | "));
}
await ev("document.querySelector('.gw-site-nav a').click()"); await sleep(1500);
check("페이지의 목록 링크 → 허브로 이동", (await ev("location.pathname")).endsWith("/prototypes/index.html"), await ev("location.pathname"));
console.log(`\nRESULT: ${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}`);
process.exit(failures ? 1 : 0);
