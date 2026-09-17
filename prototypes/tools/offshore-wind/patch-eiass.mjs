import { readFileSync, writeFileSync } from "node:fs";
const once = (s, a, b, label) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error(`${label}: anchor x${n}`); return s.replace(a, () => b); };
let w = readFileSync("wind-4.mjs", "utf8");
const applyLine = 'CASES.forEach((c) => { c.eiass = EIASS[c.id] || "EIASS 사업 검색에서 확인되지 않음(100MW 안팎 규모 · 다른 사업명 등록 가능성)"; });';
w = once(w, applyLine, applyLine + "\n" + readFileSync("snip-eiass-reg.txt", "utf8").trimEnd(), "reg");
w = once(w, "inp(c, 'capex', c.capexPerMW, 0.5,", "inp(c, 'capex', c.capexPerMW ?? (c.epcAmount ? null : c.eiassCapexPerMW), 0.5,", "input");
w = once(w, "c.epcAmount ? 'EPC 금액 역산' : '사업비 미공개'", "c.epcAmount ? 'EPC 금액 역산' : c.eiassCapexPerMW != null ? 'EIASS 협의 사업비' : '사업비 미공개'", "sub");
w = once(w, "part('환경영향평가(EIASS)', c.eiass)", "part('환경영향평가(EIASS)', c.eiass) + part('EIASS 등록 제원', c.eiassReg)", "detail");
w = once(w, "EIASS 평가서 원문(발전량·수심·이격거리 등)은 원문 뷰어 방식이라 자동으로 읽지 못해 수치는 보도 기준 — 원문 확인 시 교체 필요.",
  "13개 사업은 EIASS 사업 상세 표에서 협의 등록 규모·사업비·사업시행자·평가대행자까지 반영(평가 당시 값이라 입찰 용량·최신 사업비와 다를 수 있음 — 해송은 등록 사업비 4,575억원이 1,008MW에 비해 지나치게 작아 제외). 평가서 본문(발전량·수심·이격거리)은 문서 뷰어 방식이라 읽지 못해 보도 기준.", "caveat1");
w = once(w, "EPC 역산은 고창·야월,", "EIASS 협의 사업비(등록 사업비 ÷ 등록 규모)는 안마·반딧불이·금오도·해울이, EPC 역산은 고창·야월,", "caveat2");
writeFileSync("wind-4.mjs", w, "utf8");
let t = readFileSync("test-wind.mjs", "utf8");
const anchor = "const sinanInv = parseFloat(";
t = once(t, anchor, readFileSync("snip-test.txt", "utf8") + anchor, "test");
writeFileSync("test-wind.mjs", t, "utf8");
console.log("patched");
