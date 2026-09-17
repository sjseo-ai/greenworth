import { pathToFileURL } from "node:url";
const { computeScenario } = await import(pathToFileURL("C:/Users/KCH/OneDrive/바탕 화면/앱 만들기/사업성모델 앱/ess-bidprice-xlsx.mjs").href);
const npv = (r, f) => f.reduce((t, v, y) => t + v / (1 + r) ** y, 0);
function irr(f) { let lo = -0.9999, hi = 1; while (npv(hi, f) > 0 && hi < 1024) hi *= 2; if (npv(lo, f) * npv(hi, f) > 0) return NaN; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (npv(m, f) > 0) lo = m; else hi = m; } return (lo + hi) / 2; }
const c = computeScenario({}, {}); const r = c.solved.result, d = r.detail, sh = 0.2;
const pct = (v) => (v * 100).toFixed(2) + "%";
const eq = d.map((x) => -(x.equityDraw + x.additionalEquity));
console.log("SPC E-IRR 배당세전 (현재: 배당+최종회수)      ", pct(r.equityIrr));
console.log("SPC E-IRR 배당만 (최종회수 제외)              ", pct(irr(d.map((x, i) => eq[i] + x.dividend))));
console.log("  최종회수 합계", d.reduce((t, x) => t + x.terminalRecovery, 0).toFixed(1), "억 / 배당 합계", d.reduce((t, x) => t + x.dividend, 0).toFixed(1), "억 / 출자", (-eq.reduce((a, b) => a + b, 0)).toFixed(1), "억");
const kchNet = c.kch.rows.map((x) => x.net);
console.log("KCH 탭 달성 IRR (현재: 수수료 전부 − KCH 비용)", pct(c.kch.achievedIrr));
// KCH 입장 전체: 수수료 순현금 + 당사 지분(20%) 출자·배당 — 연도 맞춤(KCH 탭 n=0 = 2026 = 사업 시작연도)
const n = Math.max(kchNet.length, d.length), all = [], divOnly = [];
for (let i = 0; i < n; i++) { const e = d[i] ? sh * (eq[i] + d[i].dividend) : 0; all.push((kchNet[i] || 0) + (d[i] ? sh * (eq[i] + d[i].dividend + d[i].terminalRecovery) : 0)); divOnly.push(e); }
console.log("당사 지분 IRR 배당만 (출자 20% vs 배당 20%)     ", pct(irr(divOnly)), "(= SPC 배당만과 같음, 지분율 무관)");
console.log("KCH 합산 IRR (수수료 + 지분 배당·회수)         ", pct(irr(all)));
