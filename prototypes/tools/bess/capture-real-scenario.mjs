// Loads the artifact in headless Chrome with a stubbed `downloads` capability, edits a few inputs (main model + KCH + 6.5),
// saves a scenario (which auto-downloads the scenario .json exactly as the real viewer would), and writes:
//   ess_real_scenario.json          — the artifact-produced JSON, byte-for-byte what a user would drag onto the .bat
//   ess_real_scenario.expected.json — the on-screen values at save time, for comparing against the generated .xlsx
import { writeFileSync } from "node:fs";

const CDP_PORT = 9335;
const FILE_URL = "file:///C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad/ess-bid-price-prototype.html";
const OUT_DIR = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function newTab(url) { const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(url)}`, { method: "PUT" }); return res.json(); }
class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl); this.id = 0; this.pending = new Map(); this.exceptions = [];
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) { this.pending.get(msg.id)(msg); this.pending.delete(msg.id); }
      if (msg.method === "Runtime.exceptionThrown") this.exceptions.push(msg.params.exceptionDetails.text + " " + (msg.params.exceptionDetails.exception?.description ?? ""));
    });
  }
  ready() { return new Promise((res, rej) => { this.ws.addEventListener("open", res, { once: true }); this.ws.addEventListener("error", rej, { once: true }); }); }
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve) => { this.pending.set(id, resolve); this.ws.send(JSON.stringify({ id, method, params })); }); }
}
async function evaluate(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error("evaluate failed: " + JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
}
const setInput = (cdp, id, v) => evaluate(cdp, `(function(){const el=document.getElementById(${JSON.stringify(id)}); el.value=${JSON.stringify(String(v))}; el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const text = (cdp, id) => evaluate(cdp, `document.getElementById(${JSON.stringify(id)}).textContent.trim()`);
const value = (cdp, id) => evaluate(cdp, `document.getElementById(${JSON.stringify(id)}).value`);

async function main() {
  const tab = await newTab("about:blank");
  const cdp = new CDP(tab.webSocketDebuggerUrl);
  await cdp.ready();
  await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.__saves = [];
    window.claude = { use: (name) => Promise.resolve(name === 'downloads' ? { save: (req) => { window.__saves.push(req); return Promise.resolve({ status: 'saved' }); } } : null) };
  ` });
  await cdp.send("Page.navigate", { url: FILE_URL });
  await sleep(1200);
  await evaluate(cdp, "localStorage.clear()");
  await cdp.send("Page.reload"); await sleep(1200);

  // Non-default inputs across all three areas (main model, KCH section, 6.5 calculator) so the JSON path is really exercised.
  await setInput(cdp, "contractCapacityMW", 80);
  await setInput(cdp, "seniorRatePct", 6.0);
  await setInput(cdp, "targetCompanyProfit", 120);
  await setInput(cdp, "kchLeaseBase", 3.0);
  await setInput(cdp, "kchDevFeeBase", 10);
  await setInput(cdp, "minPrice", 19);
  await sleep(500);

  const expected = {
    heroBidPrice: await text(cdp, "heroBidPrice"),
    kpiPIrr: await text(cdp, "kpiPIrr"),
    kpiNpv: await text(cdp, "kpiNpv"),
    kpiTotalInvestment: await text(cdp, "kpiTotalInvestment"),
    kpiCompanyProfit: await text(cdp, "kpiCompanyProfit"),
    kchLifetimeTotal: await text(cdp, "kchLifetimeTotal"),
    kchAchievedIrr: await text(cdp, "kchAchievedIrr"),
    kchNpv: await text(cdp, "kchNpv"),
    kchTotalRevenue: await text(cdp, "kchTotalRevenue"),
    kchTotalCost: await text(cdp, "kchTotalCost"),
    bidPriceBaseDisplay: await value(cdp, "bidPriceBaseDisplay"),
    kchFeeEquivalentDisplay: await value(cdp, "kchFeeEquivalentDisplay"),
    bidPrice65: await value(cdp, "bidPrice"),
    outScore: await text(cdp, "outScore"),
    outBavg: await text(cdp, "outBavg"),
  };

  await setInput(cdp, "scenarioName", "실JSON검증 80MW 금리6% 임대료3억");
  await evaluate(cdp, "document.getElementById('saveScenarioBtn').click()");
  await sleep(800);

  const saves = await evaluate(cdp, "window.__saves.map(s => ({ filename: s.filename, data: s.data }))");
  const jsonSave = saves.find((s) => s.filename.endsWith(".json"));
  if (!jsonSave) throw new Error("no .json download captured; saves=" + JSON.stringify(saves.map((s) => s.filename)));
  writeFileSync(`${OUT_DIR}/ess_real_scenario.json`, jsonSave.data, "utf8");
  writeFileSync(`${OUT_DIR}/ess_real_scenario.expected.json`, JSON.stringify(expected, null, 2), "utf8");
  console.log("captured:", jsonSave.filename, `(${jsonSave.data.length} chars)`);
  console.log("expected on-screen values:", JSON.stringify(expected));
  console.log("page exceptions:", cdp.exceptions.length ? cdp.exceptions : "none");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
