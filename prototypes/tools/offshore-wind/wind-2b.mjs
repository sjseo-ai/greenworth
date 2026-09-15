// 해상풍력 2b — 계산 후반부: 표시 전환·터빈·조합, 터빈 비교 탭, 히어로·선정평가, 리스너, 시나리오 항목, 문구
import { open, OUT } from "./wind-lib.mjs";
const f = open(OUT);

// ── 표시 전환 · 터빈 · 조합 ───────────────────────────────────
f.between(`  // 판매 구조(고정가격계약 / 기업PPA)에 따라 라벨·보이는 입력·안내 문구를 바꾼다.`, `    syncSalesStructure(); syncComboState();
    recalcAll();
  }));`, `  // 판매 구조·입찰 트랙·가중치 산정 방식에 따라 라벨·보이는 입력·안내 문구를 바꾼다.
  function syncSalesStructure() {
    const isFixed = $('salesStructure').value === 'fixed', isPublic = $('tenderTrack').value === 'public';
    $('salesFlag').textContent = isFixed ? (isPublic ? '공공주도형' : '일반형') : '기업PPA';
    ['tenderTrackField', 'foundationField', 'priceCapField', 'recWeightWrap'].forEach((id) => { $(id).style.display = isFixed ? '' : 'none'; });
    $('prefModeField').style.display = isFixed && isPublic ? '' : 'none';
    $('ppaEscalationField').style.display = isFixed ? 'none' : '';
    const wm = $('weightMode').value;
    $('connectDistanceField').style.display = wm === 'calc' ? '' : 'none';
    $('waterDepthField').style.display = wm === 'calc' ? '' : 'none';
    $('weightManualField').style.display = wm === 'manual' ? '' : 'none';
    $('recWeightDisplay').value = fmt(recWeightOf(), 2);
    $('preferentialDisplay').value = fmt(isFixed && isPublic ? (PREF_PRICES[$('prefMode').value] || 0) : 0, 2);
    $('contractYearsLabel').textContent = isFixed ? '고정가격 계약기간' : 'PPA 계약기간';
    $('bidPriceDisplayLabel').textContent = isFixed ? '적정 수령단가' : '적정 PPA 단가';
    $('heroLabel').firstChild.textContent = isFixed ? '적정 수령단가 ' : '적정 PPA 단가 ';
    $('heroLabelSub').textContent = isFixed ? '(SMP+1REC×가중치 + 우대가격)' : '(전력+REC 합산)';
    $('salesHint').innerHTML = isFixed
      ? \`해상풍력 <strong>고정가격계약 경쟁입찰(\${isPublic ? '공공주도형' : '일반형'})</strong>을 가정합니다 — 입찰가격은 SMP+1REC 기준이고, SPC가 실제로 받는 <strong>수령단가</strong>는 REC 몫에 가중치를 곱하고 우대가격을 더한 값입니다. 이 페이지는 수령단가를 역산한 뒤 입찰가격으로 환산합니다. 발전량 = 설비용량 × 8,760h × 연차별 순이용률 × (1 − 출력제어).\`
      : '<strong>기업PPA(직접전력거래)</strong>를 가정합니다 — 단가는 전력+REC를 합친 값이고 계약기간은 당사자가 정합니다(경쟁입찰 상한가·REC 가중치·우대가격 미적용). 발전량 = 설비용량 × 8,760h × 연차별 순이용률 × (1 − 출력제어).';
    $('salesTermHint').innerHTML = isFixed
      ? '풍력 고정가격계약은 <strong>계약기간 20년</strong>입니다 — 30년까지 입력할 수 있게 열어 둔 것은 제도 개편·장기계약 검토용입니다.'
      : '기업PPA는 계약기간을 당사자가 정합니다(<strong>20~30년</strong>). 단가 상승률을 넣으면 n년차 단가 = 기본 단가 × (1 + 상승률)<sup>n−1</sup>로 오릅니다.';
    const cy = Math.max(0, +$('contractYears').value || 0), oy = Math.max(0, +$('operationYears').value || 0);
    const warnEl = $('contractYearsWarn');
    if (cy > oy) {
      warnEl.className = 'warn show';
      warnEl.textContent = \`계약기간 \${fmt(cy, 0)}년이 운영기간 \${fmt(oy, 0)}년보다 깁니다 — 운영기간을 넘는 계약분은 매출에 반영되지 않습니다. B. 사업개요의 운영기간·사업 종료연도도 함께 늘려 주세요.\`;
    } else warnEl.className = 'warn';
  }
  // ---------- 터빈 → 순이용률·성능저하·터빈 단가 ----------
  function turbineSpec(id) {
    const g = (fld) => +$(\`tb-\${id}-\${fld}\`).value || 0;
    return { price: g('price'), mw: g('mw'), rotor: g('rotor'), avail: g('avail'), degA: g('degA'), local: g('local') };
  }
  // 출력곡선 보정 = (기준 비출력 ÷ 터빈 비출력)^지수 — 같은 풍황이면 로터가 클수록(비출력이 낮을수록) 이용률이 높다는 근사.
  // 1년차 순이용률 = 부지 총이용률 × 출력곡선 보정 × 가용률 × (1 − 후류 손실) × (1 − 전기 손실)
  function turbineDerived(id) {
    const sp = turbineSpec(id);
    const specificPower = sp.rotor > 0 ? sp.mw * 1e6 / (Math.PI * (sp.rotor / 2) ** 2) : 0;
    const curveF = specificPower > 0 ? ((+$('refSpecificPower').value || specificPower) / specificPower) ** (+$('powerCurveExp').value || 0) : 1;
    const losses = (1 - rate(+$('wakeLossPct').value || 0)) * (1 - rate(+$('electricalLossPct').value || 0));
    const y1 = Math.round((+$('siteBaseRatePct').value || 0) * curveF * rate(sp.avail) * losses * 100) / 100;
    return { ...sp, specificPower, curveF, y1, epc: Math.round((sp.price + (+$('bosUnitPrice').value || 0)) * 10) / 10 };
  }
  // 지금 C·D 입력이 선택 터빈의 파생값과 그대로 일치하는지(= 터빈 값 적용 중). 상태를 따로 저장하지 않아 복원·되돌리기와 자동으로 맞는다.
  function turbineLinkActive() {
    const d = turbineDerived($('turbineMaker').value), near = (a, b) => Math.abs(a - b) < 1e-6;
    return $('capexInputMode').value === 'unitprice' && near(+$('epcUnitPrice').value, d.epc)
      && near(+$('year1RatePct').value, d.y1) && near(+$('degradationPct').value, d.degA);
  }
  function applyTurbineDerived() {
    const d = turbineDerived($('turbineMaker').value);
    $('capexInputMode').value = 'unitprice';
    $('epcUnitPrice').value = String(d.epc);
    $('year1RatePct').value = String(d.y1);
    $('degradationPct').value = String(d.degA);
    document.querySelectorAll('#opRateGrid [data-oprate-index]').forEach((el, i) => { el.value = defaultRatePctForYear(i + 1); });
    syncCapexModeVisibility();
  }
  function syncTurbineState() {
    const id = $('turbineMaker').value, d = turbineDerived(id), mw = Math.max(0, +$('contractCapacityMW').value || 0);
    turbineLinked = turbineLinkActive();
    $('turbinePriceDisplay').value = fmt(d.price, 1);
    $('turbineFactorDisplay').value = \`\${fmt(d.curveF, 4)} × \${fmt(d.avail, 1)}%\`;
    $('turbineCountDisplay').value = d.mw > 0 ? String(Math.ceil(mw / d.mw - 1e-9)) : '—';
    const el = $('turbineLinkState');
    el.textContent = turbineLinked ? \`● \${TURBINE_BY_ID[id].maker} \${TURBINE_BY_ID[id].model} 값 적용 중\` : '○ 사용자 조정 (터빈 값에서 벗어남)';
    el.className = turbineLinked ? 'module-state on' : 'module-state';
    document.querySelectorAll('[data-tb-row]').forEach((tr) => tr.classList.toggle('is-picked', tr.dataset.tbRow === id));
    // 선정평가 탭 — 입찰 트랙별 비가격 배점
    const track = TRACKS[$('tenderTrack').value] || TRACKS.general;
    $('trackLabel').textContent = track.label;
    Object.entries(track.max).forEach(([k, v]) => { $(k.replace('score', 'max')).textContent = \`\${v}점\`; });
  }
  // 지금 입력값이 어느 조합과 일치하는지 표시한다(트랙·우대·계약기간·예상 점수 + 터빈 원산지 + 터빈 값 적용 중).
  function syncComboState() {
    const id = $('turbineMaker').value, origin = TURBINE_BY_ID[id]?.origin, linked = turbineLinkActive();
    const on = Object.keys(COMBOS).find((k) => COMBOS[k].origin === origin && linked && Object.entries(COMBOS[k].fields).every(([fld, v]) => $(fld).value === v)) || null;
    document.querySelectorAll('[data-combo]').forEach((b) => b.classList.toggle('is-on', b.dataset.combo === on));
    $('comboActive').textContent = on ? \`\${COMBOS[on].label} · \${TURBINE_BY_ID[id].maker}\` : '사용자 조정';
  }
  document.querySelectorAll('[data-combo]').forEach((btn) => btn.addEventListener('click', () => {
    const c = COMBOS[btn.dataset.combo];
    Object.entries(c.fields).forEach(([fld, v]) => { $(fld).value = v; });
    if (TURBINE_BY_ID[$('turbineMaker').value]?.origin !== c.origin) $('turbineMaker').value = c.defaultTurbine; // 같은 원산지면 고른 터빈 유지
    applyTurbineDerived();
    syncSalesStructure(); syncComboState();
    recalcAll();
  }));`);

// ── 터빈 비교 탭 ──────────────────────────────────────────────
f.rep(`resultsDirty.module = true; }`, `resultsDirty.turbine = true; }`);
f.rep(`    else if (activeTabId === 'tab-module' && resultsDirty.module) { resultsDirty.module = false; renderModuleCompare(); }`,
  `    else if (activeTabId === 'tab-turbine' && resultsDirty.turbine) { resultsDirty.turbine = false; renderTurbineCompare(); }`);
f.between(`  // ---------- 모듈사 비교 탭 — 7개사를 같은 조건에서 각각 역산(탭이 보일 때만 7회 역산) ----------`, `  // ---------- 요약 탭`, `  // ---------- 터빈 비교 탭 — 6개 터빈을 같은 조건에서 각각 역산(탭이 보일 때만) ----------
  function renderTurbineCompare() {
    const base = readModel(), rv = base.revenue;
    const n = Math.max(1, Math.round(+$('operationYears').value) || 1), mw = rv.contractCapacityMW;
    const isFixed = rv.salesStructure === 'fixed', cap = isFixed ? (rv.priceCapPerKWh || 0) : 0;
    $('tbPriceHead').innerHTML = isFixed ? '적정<br>수령단가' : '적정<br>PPA 단가';
    const rows = TURBINE_LIST.map((tb) => {
      const d = turbineDerived(tb.id);
      const rates = Array.from({ length: n }, (_, i) => Math.round(d.y1 * (1 - rate(d.degA)) ** i * 100) / 100);
      const m = readModel();
      m.capex = { ...m.capex, items: [{ id: 'epcLumpSum', label: \`EPC 일괄계약 (\${tb.maker})\`, value: d.epc * mw, category: '기자재', group: 'construction' },
        ...m.capex.items.filter((it) => it.group !== 'construction')] };
      m.revenue = { ...m.revenue, operatingRatesPct: rates };
      const solved = solveCurrentModel(m);
      const ok = solved.ok && Number.isFinite(solved.price);
      return { tb, d, ok, price: ok ? solved.price : NaN, bid: ok ? (isFixed ? bidFromReceived(solved.price, rv) : solved.price) : NaN };
    });
    const minOf = (arr) => (arr.length ? Math.min(...arr) : NaN);
    const bestPrice = minOf(rows.filter((r) => r.ok).map((r) => r.price));
    const bestBid = minOf(rows.filter((r) => r.ok && !(cap > 0 && r.bid > cap)).map((r) => r.bid));
    rows.forEach((r) => {
      const id = r.tb.id, sEl = $(\`tb-\${id}-solve\`), bEl = $(\`tb-\${id}-bid\`);
      $(\`tb-\${id}-rated\`).textContent = \`\${fmt(r.d.mw, 1)}MW × \${r.d.mw > 0 ? Math.ceil(mw / r.d.mw - 1e-9) : '—'}기\`;
      $(\`tb-\${id}-sp\`).textContent = fmt(r.d.specificPower, 0);
      $(\`tb-\${id}-y1\`).textContent = \`\${fmt(r.d.y1, 2)}%\`;
      $(\`tb-\${id}-epc\`).textContent = fmt(r.d.epc, 1);
      if (!r.ok) { sEl.textContent = '산정 불가'; bEl.textContent = '—'; sEl.className = ''; bEl.className = ''; return; }
      sEl.textContent = \`\${fmt(r.price, 2)}원\`;
      sEl.className = Math.abs(r.price - bestPrice) < 0.005 ? 'best' : '';
      if (!isFixed) { bEl.textContent = '해당 없음(PPA)'; bEl.className = ''; bEl.title = ''; return; }
      const over = cap > 0 && r.bid > cap;
      bEl.textContent = \`\${fmt(r.bid, 2)}원\`;
      bEl.className = over ? 'over' : (Math.abs(r.bid - bestBid) < 0.005 ? 'best' : '');
      bEl.title = over ? \`상한가 \${fmt(cap, 3)}원/kWh 초과\` : '';
    });
    const warn = $('turbineCompareWarn'), overRows = rows.filter((r) => r.ok && cap > 0 && r.bid > cap);
    if (overRows.length) {
      warn.className = 'warn show';
      warn.textContent = \`상한가격 \${fmt(cap, 3)}원/kWh를 넘는 터빈: \${overRows.map((r) => \`\${r.tb.maker} \${r.tb.model}\`).join(', ')} — 이 조건으로는 응찰할 수 없습니다.\`;
    } else warn.className = 'warn';
  }

`, false);

f.save("wind-2b-part1");
