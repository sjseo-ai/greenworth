// 태양광 초안 v2 — 계산 로직 편. make-solar-v2.mjs(마크업)를 실행한 뒤 이어서 실행한다.
import { readFileSync, writeFileSync } from "node:fs";
const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
let s = readFileSync(`${SP}/solar-bid-price-prototype.html`, "utf8");
const count = (hay, needle) => hay.split(needle).length - 1;
function rep(from, to, n = 1) {
  const c = count(s, from);
  if (c !== n) throw new Error(`rep: expected ${n}, found ${c}: ${from.slice(0, 90)}`);
  s = s.split(from).join(to);
}

// ── 상수: 탄소 등급 · 사업 구성 조합 ──────────────────────────
rep(`  // ---------- CAPEX / OPEX item definitions (태양광 50MW 예시, 프로젝트 총액, 억원) ----------`,
  `  // ---------- 탄소배출량 검증 등급 (2026년 1차 태양광 고정가격계약 경쟁입찰 · 신규설비 기준) ----------
  // 등급별로 선정평가 배점과 "우대가격"이 함께 정해진다. 최종 고정가격 = 입찰가격 + 우대가격이므로,
  // 우대가격을 받는 만큼 입찰가격을 낮게 써서 가격 점수를 더 받을 수 있다(1등급 16,000원/MWh = 16원/kWh).
  const CARBON_GRADES = {
    '1': { label: '1등급 (630kg·CO2/kW 이하)', score: 20, premium: 16 },
    '2': { label: '2등급 (630 초과 ~ 655 이하)', score: 15, premium: 7 },
    '3': { label: '3등급 (655 초과 ~ 710 이하)', score: 5, premium: 0 },
    '4': { label: '4등급 (710 초과 또는 미검증)', score: 1, premium: 0 },
  };
  // ---------- 사업 구성 조합 ----------
  // 기자재 원산지가 EPC 단가와 탄소 등급을 동시에 움직이고, 그에 따라 판매 구조까지 달라지는 두 조합.
  // 조합을 따로 저장하지 않고 "지금 입력값이 어느 조합과 일치하는지"로 판정한다(시나리오 저장·복원과 자동으로 맞는다).
  const COMBOS = {
    domestic: { label: '① 국산 기자재 + 고정가격계약', fields: { capexInputMode: 'unitprice', epcUnitPrice: '1150', salesStructure: 'fixed', carbonGrade: '1', contractYears: '20' } },
    china: { label: '② 중국산 기자재 + 기업PPA', fields: { capexInputMode: 'unitprice', epcUnitPrice: '950', salesStructure: 'ppa', carbonGrade: '4', contractYears: '20' } },
  };

  // ---------- CAPEX / OPEX item definitions (태양광 50MW 예시, 프로젝트 총액, 억원) ----------`);

// ── 매출 — PPA 단가 상승률 ────────────────────────────────────
rep(`    const share = contractShareForRow(model, row);
    const price = share * model.revenue.bidPricePerKWh + (1 - share) * (model.revenue.marketPricePerKWh || 0);`,
  `    const share = contractShareForRow(model, row);
    // PPA 단가 상승률: n년차 계약단가 = 기본 단가 × (1 + 상승률)^(n−1). 고정가격계약은 0(정액)이라 그대로다.
    const esc = (1 + rate(model.revenue.contractEscalationPct || 0)) ** Math.max(0, row.operationSequence - 1);
    const price = share * model.revenue.bidPricePerKWh * esc + (1 - share) * (model.revenue.marketPricePerKWh || 0);`);

// ── readModel — CAPEX 3개 입력 방식 ───────────────────────────
rep(`    const capexItems = $('capexInputMode').value === 'lumpsum'
      ? [{ id: 'epcLumpSum', label: 'EPC 총액(수기입력)', value: +$('capexLumpSum').value, category: '기자재', group: 'construction' },
        ...CAPEX_ITEMS.map(capexItemAt).filter((it) => it.group !== 'construction')]
      : CAPEX_ITEMS.map(capexItemAt);`,
  `    // ① 공사비 입력 방식 3가지 — 항목별 / EPC 단가 × 용량(일괄계약) / EPC 총액(일괄계약).
    // 단가 방식: ① 공사비(억원) = 단가(원/W) × 설비용량(MW) ÷ 100  (1원/W × 1MW = 100만원 = 0.01억원)
    const capexMode = $('capexInputMode').value;
    const epcLumpValue = capexMode === 'unitprice'
      ? (+$('epcUnitPrice').value || 0) * Math.max(0, +$('contractCapacityMW').value || 0) / 100
      : +$('capexLumpSum').value;
    if (capexMode === 'unitprice') $('epcUnitPriceTotal').value = fmt(epcLumpValue, 1);
    const capexItems = capexMode !== 'itemized'
      ? [{ id: 'epcLumpSum', label: capexMode === 'unitprice' ? 'EPC 일괄계약 (단가×용량)' : 'EPC 총액(수기입력)', value: epcLumpValue, category: '기자재', group: 'construction' },
        ...CAPEX_ITEMS.map(capexItemAt).filter((it) => it.group !== 'construction')]
      : CAPEX_ITEMS.map(capexItemAt);
    // 입력 방식을 바꿀 때 직전 방식의 ① 합계를 새 방식의 기본값으로 채우기 위해 기억해 둔다.
    lastEpcTotal = sum(capexItems.filter((it) => it.group === 'construction').map((it) => it.value));`);

// ── readModel — 판매 구조 ─────────────────────────────────────
rep(`    const contractYears = Math.max(0, +$('contractYears').value || 0);`,
  `    const contractYears = Math.max(0, +$('contractYears').value || 0);
    // 판매 구조 — 고정가격계약(경쟁입찰)이면 탄소 우대가격·상한가격이 있고, 기업PPA면 단가 상승률만 있다.
    // 모델이 푸는 bidPricePerKWh는 SPC가 실제로 받는 "수령단가"다. 고정가격계약의 입찰가격은 수령단가 − 우대가격.
    const salesStructure = $('salesStructure').value, isFixedSale = salesStructure === 'fixed';
    const carbonPremiumPerKWh = isFixedSale ? (CARBON_GRADES[$('carbonGrade').value]?.premium || 0) : 0;
    const contractEscalationPct = isFixedSale ? 0 : (+$('ppaEscalationPct').value || 0);
    const priceCapPerKWh = isFixedSale ? (+$('priceCapPerKWh').value || 0) : 0;`);
rep(`      revenue: { operatingRatesPct, bidPricePerKWh: 0, priceAdjustmentFactor, avgNonCompliancePct, contractCapacityMW, curtailmentPct, contractYears, marketPricePerKWh },`,
  `      revenue: { operatingRatesPct, bidPricePerKWh: 0, priceAdjustmentFactor, avgNonCompliancePct, contractCapacityMW, curtailmentPct, contractYears, marketPricePerKWh, salesStructure, carbonPremiumPerKWh, contractEscalationPct, priceCapPerKWh },`);

// ── 연차별 발전량 표 — PPA 라벨 ───────────────────────────────
rep(`    const priceLabel = (sh) => (sh >= 0.999 ? '고정가' : sh <= 0.001 ? '시장가' : \`혼합 \${fmt(sh * 100, 0)}%\`);`,
  `    const contractLabel = model.revenue.salesStructure === 'ppa' ? 'PPA' : '고정가';
    const priceLabel = (sh) => (sh >= 0.999 ? contractLabel : sh <= 0.001 ? '시장가' : \`혼합 \${fmt(sh * 100, 0)}%\`);`);

// ── 히어로 보조설명 + 가격환산 연동(우대가격 차감) ────────────
rep(`    $('bidPriceBaseDisplay').value = fmt(solved.price, 2);`,
  `    renderHeroPriceNote(model, solved.price);
    const carbonPremium = model.revenue.carbonPremiumPerKWh || 0;
    $('carbonPremiumDisplay').value = (carbonPremium > 0 ? '−' : '') + fmt(carbonPremium, 0);
    $('bidPriceBaseDisplay').value = fmt(solved.price, 2);`);
rep(`    if (linked) $('bidPrice').value = (solved.price + kchIncrementPerKWh).toFixed(2);`,
  `    // 고정가격계약은 우대가격이 최종 고정가격에 더해져 들어오므로, 써낼 입찰가격은 그만큼 낮아진다.
    if (linked) $('bidPrice').value = Math.max(0, solved.price - carbonPremium + kchIncrementPerKWh).toFixed(2);`);

// ── 히어로 보조설명 함수 ──────────────────────────────────────
rep(`  function recalcPriceScore() {
    const min = +$('minPrice').value, bid = +$('bidPrice').value, cap = +$('priceCap').value;
    if (!Number.isFinite(min) || !Number.isFinite(bid) || !Number.isFinite(cap) || bid === 0) {
      ['outScore','outA','outB1','outB2','outBavg'].forEach((id) => $(id).textContent = '—');
      $('sensBody').innerHTML = '';
      return;
    }
    const score = Math.round((min / bid * cap) * 100) / 100;`,
  `  // 히어로 숫자(수령단가) 아래 한 줄 — 고정가격계약이면 실제로 써낼 입찰가격과 상한가 여유를, PPA면 계약 조건을 보여준다.
  function renderHeroPriceNote(model, price) {
    const rv = model.revenue, el = $('heroBidNote');
    if (rv.salesStructure !== 'fixed') {
      const escTxt = rv.contractEscalationPct ? \`연 \${fmt(rv.contractEscalationPct, 1)}% 상승\` : '정액';
      el.className = 'hero-note';
      el.innerHTML = \`기업PPA 단가(전력+REC 합산) · 계약 \${fmt(rv.contractYears, 0)}년 · \${escTxt} — 경쟁입찰 상한가·탄소 우대가격이 적용되지 않습니다.\`;
      return;
    }
    const bid = price - (rv.carbonPremiumPerKWh || 0), cap = rv.priceCapPerKWh || 0, over = cap > 0 && bid > cap;
    el.className = over ? 'hero-note bad' : 'hero-note';
    el.innerHTML = \`써낼 입찰가격(SPC 기준) = 수령단가 − 탄소 우대가격 \${fmt(rv.carbonPremiumPerKWh, 0)} = <strong>\${fmt(bid, 2)} 원/kWh</strong>\`
      + (cap > 0 ? \` · 상한가 \${fmt(cap, 3)} 대비 <strong>\${over ? \`\${fmt(bid - cap, 2)}원 초과 — 응찰 불가\` : \`\${fmt(cap - bid, 2)}원 여유\`}</strong>\` : '');
  }

  function recalcPriceScore() {
    const min = +$('minPrice').value, bid = +$('bidPrice').value, cap = +$('priceCap').value;
    const isFixed = $('salesStructure').value === 'fixed';
    const grade = CARBON_GRADES[$('carbonGrade').value] || { score: 0, premium: 0 };
    const readiness = +$('readinessScore').value || 0;
    const carbonScore = isFixed ? grade.score : 0;
    $('carbonScoreDisplay').value = isFixed ? fmt(carbonScore, 0) : '0 (PPA)';
    $('priceTabNote').innerHTML = isFixed
      ? '<strong>2026년 1차 태양광 고정가격계약 경쟁입찰(신규설비) 기준 — 입찰가격 70점 + 탄소배출 20점 + 사업준비도 10점. </strong>최종 고정가격 = 입찰가격 + 탄소 우대가격(1등급 16원/kWh · 2등급 7원/kWh)이라, 우대가격을 받는 만큼 입찰가격을 낮게 써서 가격 점수를 더 받을 수 있습니다. 최저입찰가격·사업준비도 점수는 예시값이고, 배점·상한가·우대가격은 회차마다 바뀌므로 해당 회차 공고를 확인해야 합니다.'
      : '<strong>지금 조합은 기업PPA라 경쟁입찰 선정평가가 적용되지 않습니다. </strong>아래는 같은 사업을 고정가격계약으로 응찰한다고 가정했을 때의 참고 계산입니다(탄소 우대가격·탄소 점수는 0으로 둡니다).';
    // 상한가격 경고 — 써낼 입찰가격이 공고 상한을 넘으면 응찰 자체가 불가능하다.
    const capPrice = +$('priceCapPerKWh').value || 0, warnEl = $('priceCapWarn');
    if (isFixed && capPrice > 0 && Number.isFinite(bid) && bid > capPrice) {
      warnEl.className = 'warn show';
      // 연동 상태면 입찰가격에 KCH 개발수수료 환산분이 얹혀 있다 — SPC 자체는 상한 안인데 수수료 때문에 넘는지 구분해 알려준다.
      const kchAdd = parseFloat(String($('kchFeeEquivalentDisplay').value).replace(/[,+]/g, '')) || 0, spcBid = bid - kchAdd;
      warnEl.textContent = linked && kchAdd > 0 && spcBid <= capPrice
        ? \`입찰가격 \${fmt(bid, 2)}원/kWh가 상한가격 \${fmt(capPrice, 3)}원/kWh를 \${fmt(bid - capPrice, 2)}원 초과합니다 — SPC 자체(\${fmt(spcBid, 2)}원)로는 \${fmt(capPrice - spcBid, 2)}원 여유가 있지만, KCH 개발수수료 환산분 \${fmt(kchAdd, 2)}원을 모두 얹으면 넘습니다. 수수료 규모를 줄이거나 일부만 입찰가에 반영하는 방안을 검토하세요.\`
        : \`입찰가격 \${fmt(bid, 2)}원/kWh가 상한가격 \${fmt(capPrice, 3)}원/kWh를 \${fmt(bid - capPrice, 2)}원 초과합니다 — 이 조건으로는 응찰할 수 없습니다(EPC·이용률·목표 수익 재검토 필요).\`;
    } else warnEl.className = 'warn';
    if (!Number.isFinite(min) || !Number.isFinite(bid) || !Number.isFinite(cap) || bid === 0) {
      ['outScore','outCarbon','outReadiness','outTotal','outA','outB1','outB2','outBavg'].forEach((id) => $(id).textContent = '—');
      $('sensBody').innerHTML = '';
      return;
    }
    const score = Math.round((min / bid * cap) * 100) / 100;
    $('outCarbon').textContent = fmt(carbonScore, 0) + ' 점';
    $('outReadiness').textContent = fmt(readiness, 1) + ' 점';
    $('outTotal').textContent = fmt(score + carbonScore + readiness, 2) + ' 점';`);

// ── 표시 전환 — CAPEX 3방식 · 판매 구조 · 조합 ────────────────
rep(`  function syncCapexModeVisibility() {
    const itemized = $('capexInputMode').value === 'itemized';
    $('capexItemizedWrap').style.display = itemized ? '' : 'none';
    $('capexLumpSumWrap').style.display = itemized ? 'none' : '';
  }`,
  `  function syncCapexModeVisibility() {
    const mode = $('capexInputMode').value;
    $('capexItemizedWrap').style.display = mode === 'itemized' ? '' : 'none';
    $('capexUnitPriceWrap').style.display = mode === 'unitprice' ? '' : 'none';
    $('capexLumpSumWrap').style.display = mode === 'lumpsum' ? '' : 'none';
  }
  // 판매 구조(고정가격계약 / 기업PPA)에 따라 라벨·보이는 입력·안내 문구를 바꾼다.
  function syncSalesStructure() {
    const isFixed = $('salesStructure').value === 'fixed';
    $('salesFlag').textContent = isFixed ? '고정가격계약' : '기업PPA';
    $('carbonGradeField').style.display = isFixed ? '' : 'none';
    $('priceCapField').style.display = isFixed ? '' : 'none';
    $('ppaEscalationField').style.display = isFixed ? 'none' : '';
    $('contractYearsLabel').textContent = isFixed ? '고정가격 계약기간' : 'PPA 계약기간';
    $('bidPriceDisplayLabel').textContent = isFixed ? '적정 수령단가' : '적정 PPA 단가';
    $('heroLabel').firstChild.textContent = isFixed ? '적정 수령단가 ' : '적정 PPA 단가 ';
    $('heroLabelSub').textContent = isFixed ? '(입찰가격 + 탄소 우대가격)' : '(전력+REC 합산)';
    $('salesHint').innerHTML = isFixed
      ? '태양광 <strong>고정가격계약 경쟁입찰</strong>을 가정합니다 — 최종 고정가격 = <strong>입찰가격 + 탄소 우대가격</strong>이고, 이 페이지가 푸는 값은 SPC가 실제로 받는 <strong>수령단가</strong>입니다. 계약이 끝나면 남은 운영기간은 SMP + REC × 가중치 시장가로 팝니다. 발전량 = 설비용량 × 8,760h × 연차별 이용률 × (1 − 출력제어·손실률).'
      : '<strong>기업PPA(직접전력거래)</strong>를 가정합니다 — 단가는 전력+REC를 합친 값이고 계약기간은 당사자가 정합니다(경쟁입찰 상한가·탄소 우대가격이 적용되지 않습니다). 계약이 끝나면 남은 운영기간은 SMP + REC × 가중치 시장가로 팝니다. 발전량 = 설비용량 × 8,760h × 연차별 이용률 × (1 − 출력제어·손실률).';
    $('salesTermHint').innerHTML = isFixed
      ? '고정가격계약은 제도상 <strong>계약기간 20년</strong>입니다 — 30년까지 입력할 수 있게 열어 둔 것은 제도 변경·장기계약 검토용이니, 실제 응찰에는 20년을 쓰세요. 계약기간 동안 수령단가는 정액입니다.'
      : '기업PPA는 계약기간을 당사자가 정합니다(<strong>20~30년</strong>). 단가 상승률을 넣으면 n년차 단가 = 기본 단가 × (1 + 상승률)<sup>n−1</sup>로 오릅니다.';
    const cy = Math.max(0, +$('contractYears').value || 0), oy = Math.max(0, +$('operationYears').value || 0);
    const warnEl = $('contractYearsWarn');
    if (cy > oy) {
      warnEl.className = 'warn show';
      warnEl.textContent = \`계약기간 \${fmt(cy, 0)}년이 운영기간 \${fmt(oy, 0)}년보다 깁니다 — 운영기간을 넘는 계약분은 매출에 반영되지 않습니다. B. 사업개요의 운영기간·사업 종료연도도 함께 늘려 주세요.\`;
    } else warnEl.className = 'warn';
  }
  // 지금 입력값이 어느 조합과 일치하는지 표시한다(일치하지 않으면 "사용자 조정").
  function syncComboState() {
    const on = Object.keys(COMBOS).find((k) => Object.entries(COMBOS[k].fields).every(([id, v]) => $(id).value === v)) || null;
    document.querySelectorAll('[data-combo]').forEach((b) => b.classList.toggle('is-on', b.dataset.combo === on));
    $('comboActive').textContent = on ? COMBOS[on].label : '사용자 조정';
  }
  document.querySelectorAll('[data-combo]').forEach((btn) => btn.addEventListener('click', () => {
    Object.entries(COMBOS[btn.dataset.combo].fields).forEach(([id, v]) => { $(id).value = v; });
    syncCapexModeVisibility(); syncSalesStructure(); syncComboState();
    recalcAll();
  }));`);

// ── CAPEX 입력 방식 전환 — 직전 ① 합계를 새 방식에 채운다 ──────
rep(`  $('capexInputMode').addEventListener('input', () => {
    const itemized = $('capexInputMode').value === 'itemized';
    syncCapexModeVisibility();
    if (!itemized) {
      // 항목별 입력에서 총액 입력으로 전환할 때는, 전환 시점의 항목별 합계를 총액 기본값으로 채워 넣어 값이 갑자기 끊기지 않게 한다.
      // 총액이 대체하는 것은 ① 공사비뿐이므로 ① 항목 합계만 채운다(②·③은 계속 따로 더해진다)
      const itemizedSum = sum(CAPEX_ITEMS.map((it, i) => (it.group === 'construction' ? +document.querySelector(\`[data-capex-index="\${i}"]\`).value || 0 : 0)));
      $('capexLumpSum').value = itemizedSum.toFixed(1); // fmt()는 천단위 콤마를 넣어 number input에는 부적합(값이 비워짐) — 순수 숫자 문자열 사용
    }
    recalcAll();
  });`,
  `  $('capexInputMode').addEventListener('input', () => {
    const mode = $('capexInputMode').value;
    syncCapexModeVisibility();
    // 입력 방식을 바꿀 때 직전 방식의 ① 공사비 합계를 새 방식의 기본값으로 채워 값이 갑자기 끊기지 않게 한다.
    // 대체되는 것은 ① 공사비뿐이므로 ① 합계만 옮긴다(②·③은 계속 따로 더해진다).
    const prev = Number.isFinite(lastEpcTotal) ? lastEpcTotal : 0, mw = Math.max(0, +$('contractCapacityMW').value || 0);
    // fmt()는 천단위 콤마를 넣어 number input에는 부적합(값이 비워짐) — 순수 숫자 문자열을 쓴다.
    if (mode === 'lumpsum') $('capexLumpSum').value = prev.toFixed(1);
    else if (mode === 'unitprice' && mw > 0) $('epcUnitPrice').value = String(Math.round(prev * 100 / mw));
    syncComboState();
    recalcAll();
  });`);

// ── lastEpcTotal 선언 ─────────────────────────────────────────
rep(`  let linked = true;`,
  `  let lastEpcTotal = NaN; // 직전 계산의 ① 공사비 합계 — CAPEX 입력 방식 전환 시 새 방식의 기본값으로 옮겨 쓴다
  let linked = true;`);

// ── recalcAllCore 진입 시 판매 구조·조합 표시 갱신 ────────────
rep(`  function recalcAllCore() {`,
  `  function recalcAllCore() {
    syncSalesStructure(); syncComboState(); // 입력이 바뀔 때마다 라벨·경고·조합 표시를 현재 값에 맞춘다`);

// ── 리스너 · 복원/되돌리기/초기화에 동기화 추가 ───────────────
rep(`  ['minPrice','priceCap'].forEach((id) => $(id).addEventListener('input', recalcPriceScore));`,
  `  ['minPrice','priceCap','readinessScore'].forEach((id) => $(id).addEventListener('input', recalcPriceScore));`);
rep(`    if (el.id === 'bidPrice' || el.id === 'minPrice' || el.id === 'priceCap' || el.id === 'sensMetric' || el.id.startsWith('kch') || el.disabled) return;`,
  `    if (el.id === 'bidPrice' || el.id === 'minPrice' || el.id === 'priceCap' || el.id === 'readinessScore' || el.id === 'sensMetric' || el.id.startsWith('kch') || el.disabled) return;`);
rep(`    syncSolveModeVisibility();
    syncCapexModeVisibility();
    syncFundingModeVisibility();`,
  `    syncSolveModeVisibility();
    syncCapexModeVisibility();
    syncFundingModeVisibility();
    syncSalesStructure();
    syncComboState();`, 2);
rep(`  recalcAll();
  kchRecalc();
  renderScenarioList();`,
  `  syncCapexModeVisibility();
  syncSalesStructure();
  syncComboState();
  recalcAll();
  kchRecalc();
  renderScenarioList();`);

// ── 시나리오 비교 라벨 ────────────────────────────────────────
rep(`['적정 입찰가격(원/kWh)', (s) => s.kpi.heroBidPrice],`, `['적정 수령단가(원/kWh)', (s) => s.kpi.heroBidPrice],`);
rep(`'적정 입찰가격(원/kWh)': false,`, `'적정 수령단가(원/kWh)': false,`);

writeFileSync(`${SP}/solar-bid-price-prototype.html`, s, "utf8");
console.log("logic done:", s.split("\n").length, "lines");
