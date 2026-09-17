// EIASS view() 동작 확인 — 함수 본문, window.open·폼 제출 가로채기, 새로 열린 탭 URL
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const term = process.argv[2] || "낙월", code = process.argv[3] || "ME2019C003";
const tab = await (await fetch("http://127.0.0.1:9335/json/new?about:blank", { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const events = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Page.windowOpen" || m.method === "Page.frameRequestedNavigation" || m.method === "Page.frameNavigated") events.push({ method: m.method, url: m.params.url || m.params.frame?.url, name: m.params.windowName || m.params.frame?.name });
});
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send("Page.enable"); await send("Runtime.enable");
await send("Security.setIgnoreCertificateErrors", { ignore: true });
await send("Page.navigate", { url: "https://www.eiass.go.kr/biz/base/info/searchListNew.do?menu=biz&biz_gubn=" });
await sleep(6000);
await ev(`(()=>{ document.getElementById('sVal').value = ${JSON.stringify(term)}; getSearch(1); })()`);
await sleep(8000);
console.log("view fn:", String(await ev("typeof view === 'function' ? view.toString() : 'view 없음'")).slice(0, 1500));
await ev(`(()=>{
  window.__opened = []; window.__submits = [];
  const oo = window.open; window.open = function (u, n, f) { window.__opened.push({ u: String(u), n: String(n), f: String(f) }); return oo.apply(this, arguments); };
  const os = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function () { window.__submits.push({ action: this.action, target: this.target, method: this.method, data: [...new FormData(this).entries()].slice(0, 30) }); return os.apply(this, arguments); };
})()`);
const clicked = await ev(`(()=>{ const a = [...document.querySelectorAll('a')].find((x) => ((x.getAttribute('href') || '') + (x.getAttribute('onclick') || '')).includes(${JSON.stringify(code)}) && ((x.getAttribute('href') || '') + (x.getAttribute('onclick') || '')).includes("eia")); if (!a) return 'no link'; a.click(); return (a.getAttribute('href') || '') + ' ' + (a.getAttribute('onclick') || ''); })()`);
console.log("clicked:", clicked);
await sleep(6000);
console.log("opened:", JSON.stringify(await ev("window.__opened")));
console.log("submits:", JSON.stringify(await ev("window.__submits")));
console.log("location:", await ev("location.href"));
console.log("events:", JSON.stringify(events.slice(-10)));
const targets = await (await fetch("http://127.0.0.1:9335/json/list")).json();
console.log("tabs:", JSON.stringify(targets.filter((t) => t.url.includes("eiass")).map((t) => t.url)));
process.exit(0);
