// test-solar.mjs에 5단계 점검(진입 조건 · 입찰 사례 · 모듈 목록 관리)을 끼워 넣는다 — 이미 들어가 있으면 건너뜀
import { readFileSync, writeFileSync } from "node:fs";
import { snippets } from "./solar-lib.mjs";
const S = snippets("solar-test-add.txt");
let t = readFileSync("test-solar.mjs", "utf8");
const once = (a, b, label) => { const n = t.split(a).length - 1; if (n !== 1) throw new Error(`${label}: anchor x${n}`); t = t.replace(a, () => b); };
if (!t.includes("=== 6c) 상한가 진입 조건")) {
  once(`console.log("=== 7) 조합`, S.ENTRY_CASES + `\n\nconsole.log("=== 7) 조합`, "entry");
  once(`console.log("=== 8) 44px`, S.CATALOG + `\n\nconsole.log("=== 8) 44px`, "catalog");
  once(`const TABS = ["tab-summary", "tab-module", "tab-sens", "tab-scenario", "tab-price", "tab-kch", "tab-caveats"];`, `const TABS = ["tab-summary", "tab-module", "tab-sens", "tab-scenario", "tab-price", "tab-cases", "tab-kch", "tab-caveats"];`, "tabs");
  once(`check("확정 필요 항목 13개", (await count("#panel-caveats .todo-list li")) === 13,`, `check("확정 필요 항목 15개", (await count("#panel-caveats .todo-list li")) === 15,`, "caveats");
  once(`await click(t); await sleep(t === "tab-module" ? 2500 : 150);`, `await click(t); await sleep(t === "tab-module" || t === "tab-cases" ? 2500 : 150);`, "tabsleep");
  writeFileSync("test-solar.mjs", t, "utf8");
  console.log("test patched");
} else console.log("already patched");
