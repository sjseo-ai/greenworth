// 해상풍력 11 — 입력 중 화면이 멈추는 문제.
// ① 키를 칠 때마다 전체 재계산이 동기로 돌아, DSCR 부채 사이징 모드에서는 한 글자에 0.5~1초씩
//    화면이 붙잡혔다(4글자 = 2~3초). 입력 리스너를 디바운스해 마지막 입력 뒤 한 번만 계산한다.
// ② DSCR 사이징 자체를 싸게 — 직전 결과를 출발점으로 쓰고(이분탐색 중엔 가격이 조금씩만 변해 1~2회면 수렴),
//    확정 한도 확인용 추가 계산은 수렴하지 못한 드문 경우에만 돌린다.
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

// ── ① 입력 디바운스 ────────────────────────────────────────────
const recalcDef = `  function recalcAll() {
    const t0 = performance.now();
    try { recalcAllCore(); }
    finally { const t = $('timing'); if (t) t.textContent = \`재계산 \${Math.round(performance.now() - t0)}ms\`; }
  }`;
once(recalcDef, `${recalcDef}
  // 입력 중에는 마지막 한 번만 계산한다 — 키를 칠 때마다 전체 재계산이 동기로 돌면(특히 DSCR 부채 사이징 모드)
  // 타이핑이 그대로 멈춰 보인다. 버튼·목록 선택처럼 값이 한 번에 바뀌는 곳은 예전처럼 즉시 계산한다.
  const RECALC_DEBOUNCE_MS = 140;
  let recalcTimer = 0, recalcWantsKch = false;
  function scheduleRecalc(withKch) {
    recalcWantsKch = recalcWantsKch || !!withKch;
    clearTimeout(recalcTimer);
    recalcTimer = setTimeout(() => {
      recalcTimer = 0;
      const wantsKch = recalcWantsKch; recalcWantsKch = false;
      if (wantsKch) kchRecalc(); else recalcAll();
    }, RECALC_DEBOUNCE_MS);
  }`, "debounce helper");

once(`    grid.querySelectorAll('[data-oprate-index]').forEach((el) => el.addEventListener('input', recalcAll));`,
  `    grid.querySelectorAll('[data-oprate-index]').forEach((el) => el.addEventListener('input', () => scheduleRecalc(false)));`, "oprate listener");
once(`    grid.querySelectorAll('[data-cd-index]').forEach((el) => el.addEventListener('input', recalcAll));`,
  `    grid.querySelectorAll('[data-cd-index]').forEach((el) => el.addEventListener('input', () => scheduleRecalc(false)));`, "cd listener");
once(`    if (turbineLinked && own === $('turbineMaker').value) applyTurbineDerived();
    recalcAll();`, `    if (turbineLinked && own === $('turbineMaker').value) applyTurbineDerived();
    scheduleRecalc(false);`, "turbine panel listener");
once(`    el.addEventListener('input', el.id === 'contractCapacityMW' ? kchRecalc : recalcAll);`,
  `    el.addEventListener('input', () => scheduleRecalc(el.id === 'contractCapacityMW'));`, "generic listener");

// ── ② DSCR 사이징 비용 절감 ────────────────────────────────────
once(`  // 마지막 사이징 결과 — F. 자금조달 표시용(계산에는 쓰지 않는다)
  let lastDscrSizing = null;`,
  `  // 마지막 사이징 결과 — F. 자금조달 표시용(계산에는 쓰지 않는다)
  let lastDscrSizing = null;
  // 직전 사이징 한도 — 다음 사이징의 출발점으로만 쓴다(결과는 늘 아래 반복으로 다시 맞춘다).
  let dscrSeedSenior = null;`, "seed decl");

once(`    // 출발점 — 비율 모드로 구한 선순위(수렴을 빠르게 하기 위한 씨앗값)
    const seed = cloneModel(probeBase);
    seed.finance.fundingMode = 'ratio';
    let senior = Math.max(0, solveInvestment(seed, buildCalendar(seed.project)).seniorPrincipal);
    let ok = false;
    for (let i = 0; i < 6; i++) {
      const probe = cloneModel(probeBase);
      probe.finance.sizedSeniorAmount = senior;
      const r = analyzeEss(probe);
      if (r.errors && r.errors.length) break;
      ok = true;
      const next = seniorCapFromDscr(probe, r.detail, target).cap;
      const done = Math.abs(next - senior) < 0.05;
      senior = next;
      if (done) break;
    }
    // 확정된 한도로 한 번 더 돌려 실제 최소 DSCR을 확인한다(사이징 기준 DSCR은 목표와 같아야 정상).
    let minDscr = NaN, minSenior = NaN, minAll = NaN;
    if (ok) {
      const verify = cloneModel(probeBase);
      verify.finance.sizedSeniorAmount = senior;
      const rv = analyzeEss(verify);
      if (!(rv.errors && rv.errors.length)) ({ minDscr, minSenior, minAll } = seniorCapFromDscr(verify, rv.detail, target));
    }
    lastDscrSizing = { senior, target, minDscr, minSenior, minAll, scopeAll: f.dscrDebtScope === 'all', ok };`,
  `    // 출발점 — 직전 사이징 한도. 역산(이분탐색) 중에는 단가가 조금씩만 변해 1~2회면 수렴한다.
    // 처음이라 직전 값이 없으면 비율 모드로 구한 선순위에서 시작한다.
    let senior = Number.isFinite(dscrSeedSenior) && dscrSeedSenior > 0 ? dscrSeedSenior : (() => {
      const seed = cloneModel(probeBase);
      seed.finance.fundingMode = 'ratio';
      return Math.max(0, solveInvestment(seed, buildCalendar(seed.project)).seniorPrincipal);
    })();
    let ok = false, converged = false, minDscr = NaN, minSenior = NaN, minAll = NaN;
    for (let i = 0; i < 6; i++) {
      const probe = cloneModel(probeBase);
      probe.finance.sizedSeniorAmount = senior;
      const r = analyzeEss(probe);
      if (r.errors && r.errors.length) break;
      ok = true;
      const m = seniorCapFromDscr(probe, r.detail, target);
      ({ minDscr, minSenior, minAll } = m);
      converged = Math.abs(m.cap - senior) < 0.05;
      senior = m.cap;
      // 수렴했으면 위 최소 DSCR은 확정 한도(오차 0.05억 이내)의 값이라 따로 확인하지 않아도 된다.
      if (converged) break;
    }
    // 반복 안에서 수렴하지 못한 드문 경우에만 확정 한도로 한 번 더 확인한다.
    if (ok && !converged) {
      const verify = cloneModel(probeBase);
      verify.finance.sizedSeniorAmount = senior;
      const rv = analyzeEss(verify);
      if (!(rv.errors && rv.errors.length)) ({ minDscr, minSenior, minAll } = seniorCapFromDscr(verify, rv.detail, target));
    }
    dscrSeedSenior = ok ? senior : null;
    lastDscrSizing = { senior, target, minDscr, minSenior, minAll, scopeAll: f.dscrDebtScope === 'all', ok };`,
  "sizing loop");

writeFileSync(TARGET, s, "utf8");
console.log(`wind-11-responsive: ${s.split("\n").length} lines`);
