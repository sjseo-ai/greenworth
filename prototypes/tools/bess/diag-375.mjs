const WRAPPED = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad/redesign-wrapped.html";
const tab = await (await fetch("http://127.0.0.1:9335/json/new?" + encodeURIComponent("file:///" + WRAPPED), { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl); let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result?.result?.value;
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
await new Promise((r) => setTimeout(r, 1500));
await ev("document.querySelectorAll('details.acc').forEach(d=>d.open=true)");
for (const t of ["tab-scenario", "tab-sens", "tab-kch"]) {
  await ev(`document.getElementById('${t}').click()`);
  await new Promise((r) => setTimeout(r, 150));
  const out = await ev(`(() => {
    const cw = document.documentElement.clientWidth;
    const insideScroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true; } return false; };
    const bad = [...document.querySelectorAll('body *')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > cw + 1 && !insideScroller(el); });
    // keep only outermost offenders (drop those whose ancestor is also an offender)
    const set = new Set(bad);
    const top = bad.filter(el => { for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return false; return true; });
    return JSON.stringify({ cw, sw: document.documentElement.scrollWidth, offenders: top.slice(0, 8).map(el => ({ tag: el.tagName, id: el.id, cls: String(el.className).slice(0, 40), w: Math.round(el.getBoundingClientRect().width), right: Math.round(el.getBoundingClientRect().right), gtc: getComputedStyle(el).gridTemplateColumns?.slice(0, 60) })),
      leafOffenders: bad.filter(el => el.children.length === 0).slice(0, 8).map(el => ({ tag: el.tagName, id: el.id, cls: String(el.className).slice(0, 30), text: (el.textContent || '').trim().slice(0, 30), w: Math.round(el.getBoundingClientRect().width), right: Math.round(el.getBoundingClientRect().right) })) });
  })()`);
  console.log(t, out);
}
process.exit(0);
