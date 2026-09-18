// 해상풍력 12 — 터빈 목록이 비거나 계산이 멈추는 경우 방어.
// ① turbineSpec()이 스펙 입력칸을 바로 읽어 쓰는데, 칸이 없으면(표를 그리기 전이거나 목록에서 사라진 터빈)
//    null.value 로 예외가 나 recalcAll 전체가 멈췄다 → 칸이 없으면 카탈로그·사용자 정의 값으로 되돌아간다.
// ② id가 빠진 사용자 추가 터빈이 저장돼 있으면 String(undefined)="undefined"가 검사를 통과해 들어오고,
//    화면에는 escapeHtml(undefined)="" 로 그려져 칸 id가 어긋났다 → id는 문자열일 때만 받는다.
// ③ 어떤 이유로든 목록이 비면 기본 카탈로그로 되돌려 선택 목록이 빈 채로 남지 않게 한다.
// prototypes/src/offshore-wind.html을 제자리에서 고친다(한 번만 적용). 실행 후 npm run build:prototypes
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(HERE, "../../src/offshore-wind.html");
let s = readFileSync(TARGET, "utf8").replace(/\r\n/g, "\n");
const once = (from, to, label) => {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`${label}: expected 1, found ${n}`);
  s = s.replace(from, () => to);
};

// ① 스펙 칸이 없으면 정의값으로 — 계산이 예외로 멈추지 않게
once(`  function turbineSpec(id) {
    const g = (fld) => +$(\`tb-\${id}-\${fld}\`).value || 0;
    return { price: g('price'), mw: g('mw'), rotor: g('rotor'), avail: g('avail'), degA: g('degA'), local: g('local') };
  }`,
  `  // 스펙 칸(터빈 비교 탭 표)은 표를 그린 뒤에만 있다. 표가 아직 없거나 목록에서 사라진 터빈이면
  // 칸 대신 카탈로그·사용자 정의 값을 쓴다 — 예전에는 여기서 예외가 나 화면 전체 계산이 멈췄다.
  function turbineSpec(id) {
    const def = turbineById(id) || {};
    const g = (fld) => {
      const el = $(\`tb-\${id}-\${fld}\`);
      const v = el ? +el.value : +def[fld];
      return Number.isFinite(v) ? v : 0;
    };
    return { price: g('price'), mw: g('mw'), rotor: g('rotor'), avail: g('avail'), degA: g('degA'), local: g('local') };
  }`, "turbineSpec guard");

// ② id가 문자열일 때만 사용자 추가 터빈으로 받는다
once(`      return Array.isArray(v) ? v.filter((t) => validTurbine(t) && /^[A-Za-z0-9_]+$/.test(String(t.id))) : [];`,
  `      // String(undefined)이 "undefined"라 정규식을 통과해 버리므로 문자열인지 먼저 본다(id가 어긋나면 스펙 칸을 못 찾는다).
      return Array.isArray(v) ? v.filter((t) => validTurbine(t) && typeof t.id === 'string' && /^[A-Za-z0-9_]+$/.test(t.id)) : [];`,
  "custom turbine id guard");

// ③ 목록이 비면 기본 카탈로그로 되돌린다
once(`    const list = allTurbines(), keep = {};`,
  `    let list = allTurbines();
    if (!list.length) list = TURBINE_CATALOG.slice(); // 선택 목록이 빈 채로 남지 않게(정상 경로에서는 일어나지 않는다)
    const keep = {};`, "empty list guard");

writeFileSync(TARGET, s, "utf8");
console.log(`wind-12-turbine-guard: ${s.split("\n").length} lines`);
