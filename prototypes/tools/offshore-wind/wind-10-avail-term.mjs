// 해상풍력 10 — 용어 통일: "가용률"(availability) → "가동률".
// 이 페이지에는 원래 ESS에서 가져온 잔재로 "가동률"이 순이용률(capacity factor)을 가리키는 곳이
// 몇 군데 남아 있었다. 그대로 두고 치환하면 한 페이지에서 "가동률"이 두 뜻이 되므로,
// 먼저 그 잔재를 화면 용어와 같은 "순이용률"로 바꾼 뒤 가용률 → 가동률을 적용한다.
// prototypes/src/offshore-wind.html을 제자리에서 고친다(한 번만 적용). 실행 후 npm run build:prototypes
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(HERE, "../../src/offshore-wind.html");
let s = readFileSync(TARGET, "utf8").replace(/\r\n/g, "\n");
const count = (t) => s.split(t).length - 1;
const times = (from, to, n, label) => {
  const found = count(from);
  if (found !== n) throw new Error(`${label}: expected ${n}, found ${found}`);
  s = s.split(from).join(to);
};

// ── 1) 순이용률을 가리키던 "가동률" 잔재 정리 (충돌 방지) ──────
const beforeCf = count("가동률");
if (beforeCf !== 8) throw new Error(`capacity-factor leftovers: expected 8, found ${beforeCf}`);
times(`운영연차별 가동률`, `운영연차별 순이용률`, 4, "cf: 운영연차별");           // 주석 2 · 스냅샷 주석 1 · CSV 절 제목 1
times(`연차별 기본 가동률 규칙`, `연차별 기본 순이용률 규칙`, 1, "cf: 규칙 주석");
times(`"기본 가동률"`, `"기본 순이용률"`, 1, "cf: 기본값 주석");
times(`{ h: '가동률', v: (d) => d.ratePct`, `{ h: '순이용률', v: (d) => d.ratePct`, 1, "cf: 상세표 열");
times(`['가동률(%)', (r) => r.ratePct`, `['순이용률(%)', (r) => r.ratePct`, 1, "cf: CSV 열");
if (count("가동률") !== 0) throw new Error(`capacity-factor leftovers remain: ${count("가동률")}`);

// ── 2) 가용률 → 가동률 ────────────────────────────────────────
const availBefore = count("가용률");
if (availBefore < 30) throw new Error(`availability terms: unexpectedly few (${availBefore})`);
s = s.split("가용률").join("가동률");
if (count("가용률") !== 0) throw new Error("availability terms remain");

writeFileSync(TARGET, s, "utf8");
console.log(`wind-10-avail-term: 가용률 ${availBefore}곳 → 가동률 · 순이용률 잔재 ${beforeCf}곳 정리 · ${s.split("\n").length} lines`);
