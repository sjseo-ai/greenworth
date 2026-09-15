// 해상풍력 2c — 히어로 입찰가격 문구 · 선정평가 계산 · 리스너 · 시나리오 항목 · 저장키·파일명·요약·KCH 축
import { open, OUT } from "./wind-lib.mjs";
const f = open(OUT);

// ── 히어로 · 선정평가 ─────────────────────────────────────────
f.between(`  // 히어로 숫자(수령단가) 아래 한 줄`, `        <td style="text-align:left;color:var(--ink-faint);font-size:11px;">\${r.note}</td>
      </tr>\`).join('');
  }`, `  // 히어로 숫자(수령단가) 아래 한 줄 — 고정가격계약이면 REC 가중치·우대가격으로 환산한 입찰가격과 상한가 여유를, PPA면 계약 조건을 보여준다.
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
      + (cap > 0 ? \` · 상한가 \${fmt(cap, 3)} 대비 <strong>\${over ? \`\${fmt(bid - cap, 2)}원 초과 — 응찰 불가\` : \`\${fmt(cap - bid, 2)}원 여유\`}</strong>\` : '');
  }

  const NON_PRICE_KEYS = ['scoreSecurity', 'scoreIndustry', 'scoreProgress', 'scoreOther'];
  function recalcPriceScore() {
    const bid = +$('bidPrice').value, pts = +$('priceCap').value, capPrice = +$('priceCapPerKWh').value || 0;
    const isFixed = $('salesStructure').value === 'fixed', isPublic = $('tenderTrack').value === 'public';
    const track = TRACKS[$('tenderTrack').value] || TRACKS.general, w = isFixed ? recWeightOf() : 1;
    // 1단계 비가격 — 트랙별 배점을 넘는 예상 점수는 배점까지만 합산하고 경고한다.
    const overKeys = NON_PRICE_KEYS.filter((k) => (+$(k).value || 0) > track.max[k]);
    const nonPrice = NON_PRICE_KEYS.reduce((a, k) => a + Math.min(track.max[k], Math.max(0, +$(k).value || 0)), 0);
    const npWarn = $('nonPriceWarn');
    if (overKeys.length) {
      npWarn.className = 'warn show';
      npWarn.textContent = \`\${track.label} 배점을 넘는 예상 점수가 있습니다(\${overKeys.map((k) => \`\${$(k).getAttribute('aria-label').replace(' 예상 점수', '')} \${$(k).value} > \${track.max[k]}\`).join(', ')}) — 배점까지만 합산합니다.\`;
    } else npWarn.className = 'warn';
    $('priceCapDisplay').value = fmt(capPrice, 3);
    $('priceTabNote').innerHTML = isFixed
      ? \`<strong>2026년 상반기 풍력 공고 — 1단계 사업내역서(비가격) 50점 + 2단계 입찰가격 50점 합산(\${track.label}). </strong>입찰가격은 SMP+1REC 기준이라 REC 가중치가 클수록 같은 수령단가를 더 낮은 입찰가격으로 받을 수 있고, 공공주도형 우대가격도 입찰가격을 낮춥니다. 비가격 배점은 2025년 상반기 보도 기준, 예상 점수는 가정입니다.\`
      : '<strong>지금 판매 구조는 기업PPA라 경쟁입찰 선정평가가 적용되지 않습니다. </strong>아래는 같은 사업을 고정가격계약으로 응찰한다고 가정한 참고 계산입니다.';
    // 상한가격 경고 — 연동 상태면 입찰가격에 KCH 수수료 환산분(수령단가 기준 ÷ 가중치)이 얹혀 있어, SPC 자체와 구분해 알려준다.
    const warnEl = $('priceCapWarn');
    if (isFixed && capPrice > 0 && Number.isFinite(bid) && bid > capPrice) {
      warnEl.className = 'warn show';
      const kchAdd = (parseFloat(String($('kchFeeEquivalentDisplay').value).replace(/[,+]/g, '')) || 0) / w, spcBid = bid - kchAdd;
      warnEl.textContent = linked && kchAdd > 0 && spcBid <= capPrice
        ? \`입찰가격 \${fmt(bid, 2)}원/kWh가 상한가격 \${fmt(capPrice, 3)}원/kWh를 \${fmt(bid - capPrice, 2)}원 초과합니다 — SPC 자체(\${fmt(spcBid, 2)}원)로는 \${fmt(capPrice - spcBid, 2)}원 여유가 있지만, KCH 개발수수료 환산분(입찰가격 기준 \${fmt(kchAdd, 2)}원)을 모두 얹으면 넘습니다.\`
        : \`입찰가격 \${fmt(bid, 2)}원/kWh가 상한가격 \${fmt(capPrice, 3)}원/kWh를 \${fmt(bid - capPrice, 2)}원 초과합니다 — 이 조건으로는 응찰할 수 없습니다(터빈·EPC·이용률·가중치·목표 수익 재검토 필요).\`;
    } else warnEl.className = 'warn';
    $('outNonPrice').textContent = fmt(nonPrice, 1) + ' 점';
    if (!(capPrice > 0) || !Number.isFinite(bid) || !(pts > 0)) {
      ['outScore', 'outTotal', 'outPerWon', 'outPerPoint', 'outWeightValue', 'outRndValue'].forEach((id) => { $(id).textContent = '—'; });
      $('sensBody').innerHTML = '';
      return;
    }
    // 2단계 입찰가격 점수 — 태양광 공고 산식 [(상한 − 입찰) ÷ 상한] × 배점을 준용한 가정, 소수 둘째자리. 상한 초과는 0점.
    const priceScore = Math.round(Math.max(0, (capPrice - bid) / capPrice * pts) * 100) / 100;
    $('outScore').textContent = fmt(priceScore, 2) + ' 점';
    $('outTotal').textContent = fmt(nonPrice + priceScore, 2) + ' 점';
    const perPoint = capPrice / pts, perWon = pts / capPrice;
    $('outPerWon').textContent = \`+\${fmt(perWon, 3)} 점\`;
    $('outPerPoint').textContent = \`\${fmt(perPoint, 2)} 원/kWh 인하\`;
    $('outWeightSub').textContent = \`= 입찰가격 1 ÷ 가중치 \${fmt(w, 2)} 원 인하\`;
    $('outWeightValue').textContent = \`−\${fmt(1 / w, 2)}원 · +\${fmt(perWon / w, 3)}점\`;
    const rndBid = 27.84 / w;
    $('outRndSub').textContent = \`= 27.84 ÷ 가중치 \${fmt(w, 2)}만큼 입찰가격 인하\${isPublic ? '' : ' (일반형은 미적용)'}\`;
    $('outRndValue').textContent = \`−\${fmt(rndBid, 2)}원 · +\${fmt(rndBid * perWon, 2)}점\`;
    const rows = [];
    for (let dp = 5; dp >= -5; dp--) {
      const target = priceScore + dp, ok = target >= 0 && target <= pts;
      const targetPrice = ok ? capPrice * (1 - target / pts) : NaN;
      const note = dp === 0 ? '현재 입찰가격' : dp > 0 ? '점수 상승 → 가격 인하 필요' : '점수 하락 → 가격 인상 시 발생';
      rows.push({ dp, target, ok, targetPrice, delta: targetPrice - bid, note });
    }
    $('sensBody').innerHTML = rows.map((r) => \`
      <tr class="\${r.dp === 0 ? 'current-row' : ''}">
        <td>\${r.dp > 0 ? '+' + r.dp : r.dp}</td><td>\${fmt(r.target, 2)}</td>
        <td>\${r.ok ? fmt(r.targetPrice, 2) : '—'}</td>
        <td>\${r.ok ? (r.dp === 0 ? '0.00' : (r.delta >= 0 ? '+' : '') + fmt(r.delta, 2)) : '—'}</td>
        <td style="text-align:left;color:var(--ink-faint);font-size:11px;">\${r.note}</td>
      </tr>\`).join('');
  }`);

// ── 리스너 ────────────────────────────────────────────────────
f.between(`  // 공고 회차 선택 → 구간·배점·우대가격 칸을 채운다`, `    $('moduleMaker').value = b.dataset.mkPick;
    applyModuleDerived();
    recalcAll();
  }));`, `  // 하부구조 선택 → 공고 상한가격을 채운다(공통 recalcAll 리스너보다 먼저 등록)
  $('foundationType').addEventListener('input', () => { $('priceCapPerKWh').value = String(PRICE_CAPS[$('foundationType').value]); });
  // 터빈 선택 → 터빈 단가·1년차 순이용률·성능저하를 C·D 입력에 주입(공통 recalcAll 리스너보다 먼저 등록해 주입값으로 재계산)
  $('turbineMaker').addEventListener('input', applyTurbineDerived);
  // 터빈 스펙·보정 기준·BOP 단가·부지 이용률·손실을 고치면, 직전까지 터빈 값이 적용 중이었을 때만 다시 주입한다
  // (사용자가 C·D를 직접 조정한 상태는 덮어쓰지 않는다). 선택하지 않은 터빈의 스펙은 비교 탭에만 영향.
  const TURBINE_UPSTREAM_IDS = ['siteBaseRatePct', 'wakeLossPct', 'electricalLossPct', 'bosUnitPrice', 'refSpecificPower', 'powerCurveExp'];
  [...TURBINE_UPSTREAM_IDS.map((id) => $(id)), ...document.querySelectorAll('input[id^="tb-"]')].forEach((el) => el.addEventListener('input', () => {
    const own = el.id.startsWith('tb-') ? el.id.split('-')[1] : null;
    if (turbineLinked && (!own || own === $('turbineMaker').value)) applyTurbineDerived();
  }));
  $('applyTurbineBtn').addEventListener('click', () => { applyTurbineDerived(); recalcAll(); });
  $('gotoTurbineTab').addEventListener('click', () => $('tab-turbine').click());
  document.querySelectorAll('[data-tb-pick]').forEach((b) => b.addEventListener('click', () => {
    $('turbineMaker').value = b.dataset.tbPick;
    applyTurbineDerived();
    recalcAll();
  }));`);
f.rep(`  ['priceCap', 'devProgress', 'insuranceScore', 'communityScore', 'operatingMonths'].forEach((id) => $(id).addEventListener('input', recalcPriceScore));`,
  `  // 비가격 예상 점수·배점은 모델 계산과 무관 — 점수만 다시 매기고, 조합 표시(예상 점수 포함)를 맞춘다.
  ['priceCap', 'scoreSecurity', 'scoreIndustry', 'scoreProgress', 'scoreOther'].forEach((id) => $(id).addEventListener('input', () => { recalcPriceScore(); syncComboState(); }));`);
f.rep(`el.id === 'priceCap' || ['devProgress', 'insuranceScore', 'communityScore', 'operatingMonths'].includes(el.id) ||`,
  `el.id === 'priceCap' || ['scoreSecurity', 'scoreIndustry', 'scoreProgress', 'scoreOther'].includes(el.id) ||`);

// ── 시나리오 비교 항목 ────────────────────────────────────────
f.rep(`moduleMaker: MAKER_BY_ID[$('moduleMaker').value]?.name || '',
      carbonGrade: \`\${$('carbonGrade').value}등급 (우대 \${fmt(carbonGradeTable()[$('carbonGrade').value]?.premium || 0, 0)}원)\`,`,
  `turbine: \`\${TURBINE_BY_ID[$('turbineMaker').value]?.maker || ''} \${TURBINE_BY_ID[$('turbineMaker').value]?.model || ''}\`.trim(),
      track: \`\${TRACKS[$('tenderTrack').value]?.label || ''} · 가중치 \${fmt(recWeightOf(), 2)}\`,`);
f.rep(`    ['모듈사', (s) => s.kpi.moduleMaker || '—'],
    ['탄소 등급', (s) => s.kpi.carbonGrade || '—'],`, `    ['터빈', (s) => s.kpi.turbine || '—'],
    ['입찰 트랙', (s) => s.kpi.track || '—'],`);
f.rep(`'모듈사', '탄소 등급',`, `'터빈', '입찰 트랙',`);

// ── 문구 · 저장키 · 파일명 · 요약 · KCH 축 ─────────────────────
f.rep(`['설비용량 (AC)', `, `['설비용량', `);
f.rep(`\`1년차 이용률 \${fmt(model.revenue.operatingRatesPct[0] || 0, 1)}% · 손실 \${fmt(model.revenue.curtailmentPct, 1)}% · 고정가격 \${fmt(model.revenue.contractYears, 0)}년\``,
  `\`1년차 순이용률 \${fmt(model.revenue.operatingRatesPct[0] || 0, 1)}% · 출력제어 \${fmt(model.revenue.curtailmentPct, 1)}% · 계약 \${fmt(model.revenue.contractYears, 0)}년 · REC 가중치 \${fmt(model.revenue.recWeightApplied, 2)}\``);
f.rep(`[30, 40, 50, 60, 70, 80, `, `[60, 80, 100, 120, 150, 200, `);
f.rep(`30~80MW 눈금에 현재 용량(태양광 설비용량, 기본 50MW)`, `60~200MW 눈금에 현재 용량(해상풍력 설비용량, 기본 100MW)`);
f.rep(`'solarBidPriceScenarios.v1'`, `'windBidPriceScenarios.v1'`);
f.rep(`'solarBidPriceActiveTab.v1'`, `'windBidPriceActiveTab.v1'`);
f.rep(`tool: '태양광 적정 입찰가격 프로토타입 (초안)',`, `tool: '해상풍력 적정 입찰가격 프로토타입 (초안)',`);
f.rep(`태양광_시나리오_`, `해상풍력_시나리오_`, 2);
f.rep(`['태양광 적정 입찰가격 프로토타입(초안) — 시나리오 검증용 데이터 내보내기']`, `['해상풍력 적정 입찰가격 프로토타입(초안) — 시나리오 검증용 데이터 내보내기']`);

f.save("wind-2c");
