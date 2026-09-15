// Mechanical JS pass for the result-tabs redesign (anchor-based, fails loudly if an anchor is missing).
import { readFileSync, writeFileSync } from "node:fs";
const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
const SRC = `${SP}/ess-bid-price-prototype.html`;
let s = readFileSync(SRC, "utf8");
const must = (cond, what) => { if (!cond) throw new Error("anchor missing: " + what); };
const once = (from, to, what) => { const n = s.split(from).length - 1; must(n === 1, `${what} (found ${n})`); s = s.replace(from, to); };

// 1) sensitivity section → new result-tab renderers
const a = s.indexOf("  // ---------- Sensitivity 분석"), b = s.indexOf("  function recalcPriceScore() {");
must(a > 0 && b > a, "sensitivity section");
s = s.slice(0, a) + readFileSync(`${SP}/v2-sens.js`, "utf8") + s.slice(b);

// 2) placeholders → '—' (spec 규칙 6), script part only
const cut = s.indexOf("<script>");
let head = s.slice(0, cut), js = s.slice(cut);
js = js.replaceAll("'–'", "'—'").replaceAll("'N/A'", "'—'");
// 3) recalcAllCore: sensitivity is now lazy (only the visible tab renders)
const before = js;
js = js.replace(/renderMacroSensitivity\(\);\r?\n(\s*)renderEpcSensitivity\(\);/g, "markResultsDirty();\n$1renderActiveTab();");
must((before.match(/renderMacroSensitivity\(\);/g) || []).length === 3 && !/renderMacroSensitivity/.test(js), "3 sensitivity call sites");
s = head + js;

// 4) shared helpers after pct()
once("+ '%' : '—';\n", `+ '%' : '—';
  // 결과 탭 공통 헬퍼(result-tabs-design-spec.md 9.7) — SVG 문자열은 브라우저가 이스케이프해 주지 않으므로 esc()를 직접 쓴다.
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const ko = (v) => Math.round(v).toLocaleString('ko-KR');
  // 축 눈금을 보기 좋은 값(1·2·5 × 10ⁿ)으로 끊는다
  function niceStep(range, targetCount) {
    const raw = range / Math.max(1, targetCount);
    const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
    const norm = raw / mag;
    return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  }
  function ticksUpTo(max, count) {
    const step = niceStep(max, count), out = [];
    for (let n = 1; n * step <= max * 1.0001; n++) out.push(n * step);
    return out;
  }
  // 연속된 같은 구간을 하나로 묶는다(단계 띠용)
  function phaseSegments(items, keyOf) {
    const out = [];
    let cur = null;
    items.forEach((it, i) => {
      const key = keyOf(it);
      if (!cur || cur.key !== key) { cur = { key, from: i, to: i }; out.push(cur); } else cur.to = i;
    });
    return out;
  }
  // 기준 대비 좋고 나쁨을 5단계 색으로 — 기준값의 8%를 임계로 쓰고, 중간(heat-3)은 칠하지 않는다(spec 5장·규칙 5).
  function heatClass(value, base, higherIsBetter) {
    if (value == null || base == null || !Number.isFinite(value) || !Number.isFinite(base)) return '';
    const diff = (value - base) * (higherIsBetter ? 1 : -1);
    const scale = Math.abs(base) > 1e-9 ? Math.abs(base) * 0.08 : 1;
    if (diff > scale) return 'heat-5';
    if (diff > scale * 0.25) return 'heat-4';
    if (diff < -scale) return 'heat-1';
    if (diff < -scale * 0.25) return 'heat-2';
    return 'heat-3';
  }
`, "pct line");

// 5) result-tab state next to \`linked\`
once("  let linked = true;\n", `  let linked = true;
  // 결과 탭 상태 — 마지막 산정 결과(요약 탭이 그린다), 민감도 캐시(지표 전환 시 재계산 없이 다시 그림), 탭별 "다시 그려야 함" 표시.
  let lastSolved = null, sensCache = null, activeTabId = 'tab-summary';
  const resultsDirty = { summary: true, sens: true };
`, "let linked");

writeFileSync(SRC, s, "utf8");
console.log("ok");
