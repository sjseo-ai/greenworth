// 375px 선정평가 탭에서 뷰포트를 넘는 요소 찾기(스크롤 컨테이너 .table-wrap 안쪽은 제외)
const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
const URL_ = "file:///" + `${SP}/solar-wrapped.html`.replace(/^\//, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tab = await (await fetch("http://127.0.0.1:9335/json/new?" + encodeURIComponent(URL_), { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send("Runtime.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 1000, deviceScaleFactor: 1, mobile: true });
await sleep(300); await send("Page.reload"); await sleep(2000);
await ev("document.getElementById('tab-price').click()"); await sleep(500);
console.log("scrollWidth", await ev("document.documentElement.scrollWidth"), "clientWidth", await ev("document.documentElement.clientWidth"));
const rows = await ev(`(()=>{
  const vw = document.documentElement.clientWidth, out = [];
  document.querySelectorAll('#panel-price *').forEach((el) => {
    if (el.closest('.table-wrap') && !el.classList.contains('table-wrap')) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0) return;
    if (r.right > vw + 1) {
      const cs = getComputedStyle(el);
      out.push({ tag: el.tagName.toLowerCase(), id: el.id, cls: el.className && String(el.className).slice(0, 40), w: Math.round(r.width), right: Math.round(r.right), minW: cs.minWidth, gridCols: cs.gridTemplateColumns.slice(0, 60), text: (el.textContent || '').trim().slice(0, 40) });
    }
  });
  return out.slice(0, 25);
})()`);
rows.forEach((r) => console.log(JSON.stringify(r)));
process.exit(0);
