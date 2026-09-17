const FILE_URL = "file:///C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad/ess-bid-price-prototype.html";
const tab = await (await fetch("http://127.0.0.1:9335/json/new?" + encodeURIComponent(FILE_URL), { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl); let id = 0; const pending = new Map(); const errs = [];
ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") errs.push(m.params.exceptionDetails.text); if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errs.push("console.error"); });
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result?.result?.value;
await send("Runtime.enable"); await new Promise((r) => setTimeout(r, 1500));
console.log("caption mentions .bat:", await ev("document.body.innerText.includes('ESS_엑셀변환.bat')"));
console.log("heroBidPrice:", await ev("document.getElementById('heroBidPrice').textContent"));
console.log("errors/exceptions:", errs.length ? errs : "none");
process.exit(errs.length ? 1 : 0);
