// EIASS(환경영향평가정보지원시스템) 사업 검색을 헤드리스 Chrome으로 직접 수행 — 검색어별 결과 목록 텍스트를 저장
import { writeFileSync } from "node:fs";
const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
const TERMS = process.argv.slice(2).length ? process.argv.slice(2) : ["해상풍력"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tab = await (await fetch("http://127.0.0.1:9335/json/new?about:blank", { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send("Page.enable"); await send("Runtime.enable");
await send("Security.setIgnoreCertificateErrors", { ignore: true });
const out = {};
for (const term of TERMS) {
  await send("Page.navigate", { url: "https://www.eiass.go.kr/biz/base/info/searchListNew.do?menu=biz&biz_gubn=" });
  await sleep(6000);
  const ready = await ev("typeof getSearch === 'function' && !!document.getElementById('sVal')");
  if (!ready) { out[term] = { error: "검색 페이지 로드 실패", title: await ev("document.title"), bodyLen: await ev("document.body ? document.body.innerText.length : 0") }; continue; }
  await ev(`(()=>{ document.getElementById('sVal').value = ${JSON.stringify(term)}; try { getSearch(1); } catch (e) { return String(e); } })()`);
  await sleep(8000);
  const rows = await ev(`(()=>{
    const pick = [...document.querySelectorAll('table tbody tr, ul li')].map((el) => el.innerText.replace(/\\s+/g, ' ').trim()).filter((t) => t.includes("태양"));
    return [...new Set(pick)].slice(0, 80);
  })()`);
  const links = await ev(`[...document.querySelectorAll('a[onclick], a[href*="view"], a[href*="View"]')].map((a) => ({ t: a.innerText.replace(/\\s+/g, ' ').trim(), on: a.getAttribute('onclick') || a.getAttribute('href') })).filter((x) => x.t.includes("태양")).slice(0, 80)`);
  out[term] = { count: rows ? rows.length : 0, rows, links };
  console.log(`[${term}] rows ${rows ? rows.length : 0} · links ${links ? links.length : 0}`);
  (rows || []).slice(0, 25).forEach((r) => console.log("   ", r.slice(0, 200)));
}
writeFileSync(`${SP}/eiass-results.json`, JSON.stringify(out, null, 2), "utf8");
process.exit(0);
