// 해상풍력 13 — 히어로에 "적정 수령단가"와 "입찰가격(SMP+1REC)"을 같은 크기로 나란히 보여준다.
// 입찰서에 실제로 써내는 값은 입찰가격인데 지금은 작은 설명 줄 안에만 있어, 두 값을 병용 표기한다.
// 기업PPA 구조에서는 경쟁입찰 환산이 성립하지 않으므로 입찰가격 칸을 숨긴다.
// prototypes/src/offshore-wind.html을 제자리에서 고친다(한 번만 적용). 실행 후 npm run build:prototypes
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(HERE, "../../src/offshore-wind.html");
let s = readFileSync(TARGET, "utf8").replace(/\r\n/g, "\n");
const times = (from, to, n, label) => {
  const found = s.split(from).length - 1;
  if (found !== n) throw new Error(`${label}: expected ${n}, found ${found}`);
  s = s.split(from).join(to);
};
const once = (from, to, label) => times(from, to, 1, label);

// ── 스타일 — 큰 숫자 두 개를 나란히, 좁은 화면에서는 위아래로 ──
once(`  .hero-unit { font-size: 16px; font-weight: 600; color: var(--ink-2); margin-left: 6px; }`,
  `  .hero-unit { font-size: 16px; font-weight: 600; color: var(--ink-2); margin-left: 6px; }
  /* 수령단가(받는 값)와 입찰가격(써내는 값)을 같은 크기로 나란히 — 둘 다 결론이라 한쪽만 키우지 않는다.
     두 개를 한 줄에 두므로 숫자는 52 → 42px로 줄이고, 아주 좁은 화면에서만 위아래로 쌓는다. */
  .hero-prices { display: flex; flex-wrap: nowrap; align-items: flex-start; gap: 12px 22px; }
  .hero-price { flex: 1 1 0; min-width: 0; }
  .hero-price + .hero-price { padding-left: 22px; border-left: 1px solid var(--line); }
  .hero-prices .hero-num { font-size: 42px; }
  .hero-num.alt { color: var(--ink); }
  .hero-num.alt.over { color: var(--danger); }
  .hero-cap { margin-top: 4px; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .hero-cap.bad { color: var(--danger); font-weight: 600; }
  @media (max-width: 560px) {
    .hero-prices { flex-direction: column; }
    .hero-price + .hero-price { padding-left: 0; border-left: 0; border-top: 1px solid var(--line); padding-top: 10px; }
  }`, "hero css");

// 히어로 왼쪽(숫자 두 개)이 넓어야 한 줄에 들어간다 — 오른쪽 범위 상자보다 조금 더 준다.
once(`  .hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 16px 24px; align-items: start; padding: 18px 20px; border-color: var(--accent); }`,
  `  .hero { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 16px 24px; align-items: start; padding: 18px 20px; border-color: var(--accent); }`,
  "hero grid");

// ── 히어로 — 큰 숫자 두 칸 ─────────────────────────────────────
once(`          <div class="k hero-label" id="heroLabel">적정 수령단가 <span style="font-weight:500;color:var(--muted);" id="heroLabelSub">(SMP+REC 합산 고정가)</span></div>
          <div><span class="hero-num" id="heroBidPrice">–</span><span class="hero-unit">원/kWh</span></div>`,
  `          <div class="hero-prices">
            <div class="hero-price">
              <div class="k hero-label" id="heroLabel">적정 수령단가 <span style="font-weight:500;color:var(--muted);" id="heroLabelSub">(받는 값)</span></div>
              <div><span class="hero-num" id="heroBidPrice">–</span><span class="hero-unit">원/kWh</span></div>
            </div>
            <div class="hero-price" id="heroTenderBox">
              <div class="k hero-label">입찰가격 <span style="font-weight:500;color:var(--muted);">(SMP+1REC · 써내는 값)</span></div>
              <div><span class="hero-num alt" id="heroTenderPrice">–</span><span class="hero-unit">원/kWh</span></div>
              <div class="hero-cap" id="heroTenderCap"></div>
            </div>
          </div>`, "hero markup");

// ── 산정 실패 시 두 숫자 모두 비운다 ───────────────────────────
times(`      $('heroBidPrice').textContent = '—';`,
  `      $('heroBidPrice').textContent = '—'; $('heroTenderPrice').textContent = '—'; $('heroTenderCap').textContent = '';`,
  2, "hero reset");

// ── 입찰가격 숫자·상한가 여유 채우기 ───────────────────────────
once(`  // 히어로 숫자(수령단가) 아래 한 줄 — 고정가격계약이면 REC 가중치·우대가격으로 환산한 입찰가격과 상한가 여유를, PPA면 계약 조건을 보여준다.
  function renderHeroPriceNote(model, price) {
    const rv = model.revenue, el = $('heroBidNote');
    if (rv.salesStructure !== 'fixed') {
      const escTxt = rv.contractEscalationPct ? \`연 \${fmt(rv.contractEscalationPct, 1)}% 상승\` : '정액';
      el.className = 'hero-note';
      el.innerHTML = \`기업PPA 단가(전력+REC 합산) · 계약 \${fmt(rv.contractYears, 0)}년 · \${escTxt} — 경쟁입찰 상한가·REC 가중치·우대가격이 적용되지 않습니다.\`;
      return;
    }
    const bid = bidFromReceived(price, rv), cap = rv.priceCapPerKWh || 0, over = cap > 0 && bid > cap;
    el.className = over ? 'hero-note bad' : 'hero-note';
    el.innerHTML = \`써낼 입찰가격(SMP+1REC, SPC 기준) = 기준 SMP \${fmt(rv.smpRefPerKWh, 2)} + (수령단가 − 우대 \${fmt(rv.preferentialPerKWh, 2)} − SMP) ÷ 가중치 \${fmt(rv.recWeightApplied, 2)} = <strong>\${fmt(bid, 2)} 원/kWh</strong>\`
      + (cap > 0 ? \` · 상한가 \${fmt(cap, 3)} 대비 <strong>\${over ? \`\${fmt(bid - cap, 2)}원 초과 — 응찰 불가 (진입 조건: 선정평가 탭)\` : \`\${fmt(cap - bid, 2)}원 여유\`}</strong>\` : '');
  }`,
  `  // 히어로의 두 번째 큰 숫자(입찰가격)와 그 아래 설명 줄 — 고정가격계약이면 REC 가중치·우대가격으로 환산한
  // 입찰가격과 상한가 여유를, 기업PPA면 입찰가격 칸을 숨기고 계약 조건만 보여준다.
  function renderHeroPriceNote(model, price) {
    const rv = model.revenue, el = $('heroBidNote'), box = $('heroTenderBox');
    if (rv.salesStructure !== 'fixed') {
      box.style.display = 'none';
      const escTxt = rv.contractEscalationPct ? \`연 \${fmt(rv.contractEscalationPct, 1)}% 상승\` : '정액';
      el.className = 'hero-note';
      el.innerHTML = \`기업PPA 단가(전력+REC 합산) · 계약 \${fmt(rv.contractYears, 0)}년 · \${escTxt} — 경쟁입찰 상한가·REC 가중치·우대가격이 적용되지 않습니다.\`;
      return;
    }
    box.style.display = '';
    const bid = bidFromReceived(price, rv), cap = rv.priceCapPerKWh || 0, over = cap > 0 && bid > cap;
    const num = $('heroTenderPrice'), capEl = $('heroTenderCap');
    num.textContent = fmt(bid, 2);
    num.className = over ? 'hero-num alt over' : 'hero-num alt';
    capEl.className = over ? 'hero-cap bad' : 'hero-cap';
    capEl.textContent = cap > 0
      ? (over ? \`상한가 \${fmt(cap, 3)} 대비 \${fmt(bid - cap, 2)}원 초과 — 응찰 불가\` : \`상한가 \${fmt(cap, 3)} 대비 \${fmt(cap - bid, 2)}원 여유\`)
      : '상한가 미입력';
    el.className = over ? 'hero-note bad' : 'hero-note';
    el.innerHTML = \`입찰가격 환산 = 기준 SMP \${fmt(rv.smpRefPerKWh, 2)} + (수령단가 − 우대 \${fmt(rv.preferentialPerKWh, 2)} − SMP) ÷ 가중치 \${fmt(rv.recWeightApplied, 2)}\`
      + (over ? ' · <strong>상한가를 넘어 이 조건으로는 응찰할 수 없습니다 (진입 조건: 선정평가 탭)</strong>' : '');
  }`, "hero note");

// 수령단가 라벨의 괄호 — 산식은 아래 설명 줄에 있으니 두 라벨을 짧게 맞춰 숫자가 같은 높이에 오게 한다.
once(`    $('heroLabelSub').textContent = isFixed ? '(SMP+1REC×가중치 + 우대가격)' : '(전력+REC 합산)';`,
  `    $('heroLabelSub').textContent = isFixed ? '(받는 값)' : '(전력+REC 합산)';`, "hero label sub");

writeFileSync(TARGET, s, "utf8");
console.log(`wind-13-hero-bid: ${s.split("\n").length} lines`);
