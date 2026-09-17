// 한국에너지공단 태양광 모듈 탄소검증 제품 정보(공공데이터 15085909, 2026-06-10) — 사별 등급 분포 분석
import { readFileSync, writeFileSync } from "node:fs";
const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
const TODAY = "2026-09-14";

function parseCsv(text) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.length > 1);
}
const [head, ...body] = parseCsv(readFileSync(`${SP}/carbon_modules.csv`, "utf8"));
const col = Object.fromEntries(head.map((h, i) => [h.trim(), i]));
const recs = body.map((r) => ({
  company: r[col["기업명"]].trim(), factory: r[col["공장명"]].trim(), model: r[col["모델명"]].trim(),
  watt: +r[col["출력(W)"]], co2: +r[col["탄소배출량"]], method: r[col["검증방법"]].trim(),
  issued: r[col["검증인정서발급일"]].trim(), expires: r[col["검증인정서만료일"]].trim(),
}));
// 2026년 1차 공고(신규설비) 등급 구간
const gradeOf = (v) => (v <= 630 ? 1 : v <= 655 ? 2 : v <= 710 ? 3 : 4);
const q = (arr, p) => { const a = [...arr].sort((x, y) => x - y); if (!a.length) return NaN; const k = (a.length - 1) * p, lo = Math.floor(k), hi = Math.ceil(k); return a[lo] + (a[hi] - a[lo]) * (k - lo); };

const GROUPS = {
  "한화솔루션(주)": { key: "hanwha", families: [/Q\.TRON/i, /Q\.PEAK/i] },
  "에이치디현대에너지솔루션(주)": { key: "hyundai", families: [/HiN-T/i, /HiS-/i, /HiN-/i] },
  "(주)신성이엔지": { key: "shinsung", families: [/BD/i, /SS-DM/i] },
  "한솔에너지온": { key: "hansol", families: [/TOP|N|HS/i] },
};
const out = { dataset: "한국에너지공단_태양광 모듈 탄소검증 제품 정보 (공공데이터포털 15085909, 수정 2026-06-10)", asOf: TODAY, total: recs.length, companies: {} };
console.log(`total records ${recs.length}; methods: ${[...new Set(recs.map((r) => r.method))].join(" / ")}`);
for (const [name, g] of Object.entries(GROUPS)) {
  const all = recs.filter((r) => r.company === name);
  const valid = all.filter((r) => r.expires >= TODAY);
  const vals = valid.map((r) => r.co2);
  const gc = [1, 2, 3, 4].map((k) => valid.filter((r) => gradeOf(r.co2) === k).length);
  const recent = valid.filter((r) => r.issued >= "2025-01-01");
  const best = [...valid].sort((a, b) => a.co2 - b.co2).slice(0, 5);
  const factories = [...new Set(valid.map((r) => r.factory))];
  const fam = g.families.map((re) => {
    const f = valid.filter((r) => re.test(r.model));
    return { pattern: String(re), n: f.length, min: Math.min(...f.map((r) => r.co2)), median: q(f.map((r) => r.co2), 0.5), grades: [1, 2, 3, 4].map((k) => f.filter((r) => gradeOf(r.co2) === k).length) };
  });
  out.companies[g.key] = { name, all: all.length, valid: valid.length, recentValid: recent.length, grades: gc, min: Math.min(...vals), p25: q(vals, 0.25), median: q(vals, 0.5), max: Math.max(...vals), factories, best: best.map((r) => ({ model: r.model, watt: r.watt, co2: r.co2, factory: r.factory, expires: r.expires })), families: fam,
    recentGrades: [1, 2, 3, 4].map((k) => recent.filter((r) => gradeOf(r.co2) === k).length), recentMedian: q(recent.map((r) => r.co2), 0.5) };
  const c = out.companies[g.key];
  console.log(`\n== ${name} (${g.key}) — 전체 ${c.all} · 유효 ${c.valid} · 2025년 이후 발급 유효 ${c.recentValid}`);
  console.log(`   유효 등급 분포 1/2/3/4 = ${gc.join(" / ")} · 배출량 최저 ${c.min} · 25% ${c.p25.toFixed(1)} · 중앙 ${c.median.toFixed(1)} · 최고 ${c.max}`);
  console.log(`   2025년 이후 발급분 등급 1/2/3/4 = ${c.recentGrades.join(" / ")} · 중앙 ${Number.isFinite(c.recentMedian) ? c.recentMedian.toFixed(1) : "—"}`);
  console.log(`   공장: ${factories.join(", ")}`);
  fam.forEach((f) => console.log(`   계열 ${f.pattern}: ${f.n}건 · 최저 ${f.min} · 중앙 ${Number.isFinite(f.median) ? f.median.toFixed(1) : "—"} · 등급 ${f.grades.join("/")}`));
  best.forEach((r) => console.log(`   최저 ${r.co2} · ${r.model} ${r.watt}W · ${r.factory} · ~${r.expires}`));
}
const others = [...new Set(recs.map((r) => r.company))].filter((n) => !GROUPS[n]);
console.log(`\n기타 기업: ${others.join(", ")}`);
console.log(`진코/트리나/자솔라 검증 제품: ${recs.filter((r) => /jinko|trina|ja solar|진코|트리나|자솔라|징코/i.test(r.company + r.model)).length}건`);
writeFileSync(`${SP}/carbon-summary.json`, JSON.stringify(out, null, 2), "utf8");
