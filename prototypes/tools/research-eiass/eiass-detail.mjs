// EIASS 사업 상세 — 검색 후 결과 링크(view)를 눌러 상세 페이지 URL과 본문 텍스트를 저장하고, 규모·발전량·수심·이격거리 관련 줄을 뽑는다.
import { writeFileSync } from "node:fs";
const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
const TARGETS = [
  ["우이", "ME2021C012"], ["낙월", "ME2019C003"], ["안마", "ME2022C008"], ["태안", "ME2021C010"], ["금일", "ME2022C019"],
  ["야월", "ME2022C005"], ["반딧불이", "ME2022C023"], ["금오도", "ME2024C013"], ["한빛", "ME2024C001"], ["굴업도", "ME2023C026"],
  ["해송", "ME2024C009"], ["해울이", "ME2023C007"],
];
const only = process.argv.slice(2);
const list = only.length ? TARGETS.filter(([t]) => only.includes(t)) : TARGETS;
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
const KEY = /(발전|설비|용량|MW|㎿|kW|기\b|기\)|호기|터빈|풍력발전기|수심|이격|이안|해안선|km|㎞|발전량|GWh|MWh|이용률|사업비|억원|위치|면적|해저케이블|변전소|사업자|사업시행자|협의기관)/;
const out = {};
for (const [term, code] of list) {
  await send("Page.navigate", { url: "https://www.eiass.go.kr/biz/base/info/searchListNew.do?menu=biz&biz_gubn=" });
  await sleep(6000);
  await ev(`(()=>{ document.getElementById('sVal').value = ${JSON.stringify(term)}; getSearch(1); })()`);
  await sleep(8000);
  const clicked = await ev(`(()=>{ const a = [...document.querySelectorAll('a[href*="view("], a[onclick*="view("]')].find((x) => ((x.getAttribute('href') || '') + (x.getAttribute('onclick') || '')).includes(${JSON.stringify(code)}) && ((x.getAttribute('href') || '') + (x.getAttribute('onclick') || '')).includes("'eia'")); if (!a) return false; a.click(); return true; })()`);
  if (!clicked) { out[term] = { code, error: "링크를 찾지 못함" }; console.log(`[${term}] ${code} 링크 없음`); continue; }
  await sleep(9000);
  const href = await ev("location.href");
  const text = await ev("document.body ? document.body.innerText : ''");
  const frames = await ev(`[...document.querySelectorAll('iframe')].map((f) => { try { return f.contentDocument ? f.contentDocument.body.innerText : ''; } catch (e) { return ''; } }).join('\\n')`);
  const all = `${text || ''}\n${frames || ''}`;
  const lines = all.split(/\n+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s && s.length < 400 && KEY.test(s));
  out[term] = { code, href, length: all.length, lines: [...new Set(lines)].slice(0, 120), textHead: all.slice(0, 5000) };
  console.log(`\n[${term}] ${code} · ${href} · 본문 ${all.length}자`);
  [...new Set(lines)].slice(0, 40).forEach((l) => console.log("   ", l.slice(0, 220)));
}
writeFileSync(`${SP}/eiass-detail.json`, JSON.stringify(out, null, 2), "utf8");
process.exit(0);
