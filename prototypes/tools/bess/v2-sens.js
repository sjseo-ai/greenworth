  // ---------- 결과 탭 공통 — 보이는 탭만 계산한다(result-tabs-design-spec.md 규칙 10) ----------
  // recalcAllCore()는 hero·KPI 카드·가격환산처럼 항상 보이는 값만 즉시 갱신하고, 요약(차트·상세표)·민감도(98회 재계산)는
  // "다시 그려야 함" 표시만 한 뒤 지금 열려 있는 탭 하나만 그린다. 숨은 탭은 열리는 순간 그린다.
  // 내보내기(CSV·JSON)는 이 화면 캐시를 쓰지 않고 captureDetailSnapshot()으로 따로 다시 계산하므로 영향이 없다.
  function markResultsDirty() { resultsDirty.summary = true; resultsDirty.sens = true; }
  function renderActiveTab() {
    if (activeTabId === 'tab-summary' && resultsDirty.summary) { resultsDirty.summary = false; renderSummaryTab(); }
    else if (activeTabId === 'tab-sens' && resultsDirty.sens) { resultsDirty.sens = false; computeSensitivity(); renderSensitivityView(); }
  }

  // ---------- 요약 탭 — 연도별 현금흐름 차트 · 산출 근거(kv) · 경고 · 연도별 상세 (spec 4장) ----------
  const PHASE_LABELS = { development: '개발', construction: '공사', operation: '운영' };
  // analyzeEss() detail의 phase 문구('개발' / '개발·공사' / '운영 N년차')를 차트 단계 3종으로 묶는다.
  const phaseKeyOf = (d) => (d.operatingDays > 0 ? 'operation' : d.phase === '개발' ? 'development' : 'construction');

  // 위 = 매출, 아래 = 투자비(CAPEX 집행)+운영비, 오른쪽 축 = 누적 세후 프로젝트 현금흐름. 위아래 최대값 비율로 영점을 옮기고
  // (같은 px/억 스케일), 단계 이름은 막대에 가리지 않게 차트 아래 띠로 뺀다. 좁은 띠(<46px)는 글씨 없이 툴팁만 남긴다.
  function cashflowChartSvg(rows) {
    const W = 940, H = 360, RIBBON = 20;
    const M = { top: 16, right: 70, bottom: 52, left: 68 };
    if (!rows.length) return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}"></svg>`;
    const iw = W - M.left - M.right, ih = H - M.top - M.bottom;
    const bars = rows.map((d) => ({ year: d.calendarYear, phase: phaseKeyOf(d), up: Math.max(0, d.revenue), capex: Math.max(0, d.capexDraw), opex: Math.max(0, d.opex) }));
    let running = 0;
    const cum = rows.map((d) => (running += d.projectFlow));
    const barTop = Math.max(1, ...bars.map((b) => b.up));
    const barBottom = Math.max(1, ...bars.map((b) => b.capex + b.opex));
    const k = ih / (barTop + barBottom);
    const zeroY = M.top + barTop * k;
    const slot = iw / bars.length, bw = Math.max(3, slot * 0.66);
    const xOf = (i) => M.left + i * slot + (slot - bw) / 2;
    const cx = (i) => M.left + (i + 0.5) * slot;
    const cMin = Math.min(0, ...cum), cMax = Math.max(0, ...cum), cSpan = (cMax - cMin) || 1;
    const yC = (v) => M.top + (ih * (cMax - v)) / cSpan;
    const n1 = (v) => fmt(v, 1);
    const p = [`<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="연도별 현금흐름 차트 — 매출은 위쪽 막대, 투자비·운영비는 아래쪽 막대, 누적 세후 현금흐름은 꺾은선(오른쪽 축)">`];
    const segs = phaseSegments(bars, (b) => b.phase);
    segs.forEach((sg) => {
      if (sg.key === 'operation') return; // 가장 긴 운영 구간은 칠하지 않는다(차트가 탁해짐)
      p.push(`<rect class="ph-band-${sg.key}" x="${(M.left + sg.from * slot).toFixed(1)}" y="${M.top}" width="${((sg.to - sg.from + 1) * slot).toFixed(1)}" height="${ih}"/>`);
    });
    ticksUpTo(barTop, 3).forEach((v) => {
      const y = (zeroY - v * k).toFixed(1);
      p.push(`<line class="cf-grid" x1="${M.left}" x2="${M.left + iw}" y1="${y}" y2="${y}"/><text class="cf-axis" x="${M.left - 8}" y="${(+y + 4).toFixed(1)}" text-anchor="end">${ko(v)}</text>`);
    });
    ticksUpTo(barBottom, 2).forEach((v) => {
      const y = (zeroY + v * k).toFixed(1);
      p.push(`<line class="cf-grid" x1="${M.left}" x2="${M.left + iw}" y1="${y}" y2="${y}"/><text class="cf-axis" x="${M.left - 8}" y="${(+y + 4).toFixed(1)}" text-anchor="end">−${ko(v)}</text>`);
    });
    const cStep = niceStep(cSpan, 4);
    for (let n = Math.ceil(cMin / cStep); n <= Math.floor(cMax / cStep); n++) {
      p.push(`<text class="cf-axis" x="${W - M.right + 8}" y="${(yC(n * cStep) + 4).toFixed(1)}">${n < 0 ? '−' : ''}${ko(Math.abs(n * cStep))}</text>`);
    }
    p.push(`<text class="cf-axis" x="${M.left - 8}" y="11" text-anchor="end">억원</text><text class="cf-axis" x="${W - M.right + 8}" y="11">누적</text>`);
    bars.forEach((b, i) => {
      // 한 해의 막대 3개에 같은 툴팁 — 어느 막대에 올려도 그 해 전체가 보인다
      const tip = `<title>${esc(`${b.year}년 · 매출 ${n1(b.up)} · 투자비 ${n1(b.capex)} · 운영비 ${n1(b.opex)} · 누적 ${n1(cum[i])} (억원)`)}</title>`;
      const x = xOf(i).toFixed(1), w = bw.toFixed(1);
      if (b.up > 0) p.push(`<rect class="cf-rev" x="${x}" y="${(zeroY - b.up * k).toFixed(1)}" width="${w}" height="${(b.up * k).toFixed(1)}">${tip}</rect>`);
      if (b.capex > 0) p.push(`<rect class="cf-capex" x="${x}" y="${zeroY.toFixed(1)}" width="${w}" height="${(b.capex * k).toFixed(1)}">${tip}</rect>`);
      if (b.opex > 0) p.push(`<rect class="cf-opex" x="${x}" y="${(zeroY + b.capex * k).toFixed(1)}" width="${w}" height="${(b.opex * k).toFixed(1)}">${tip}</rect>`);
    });
    p.push(`<line class="cf-zero" x1="${M.left}" x2="${M.left + iw}" y1="${zeroY.toFixed(1)}" y2="${zeroY.toFixed(1)}"/>`);
    p.push(`<polyline class="cf-cum" points="${cum.map((v, i) => `${cx(i).toFixed(1)},${yC(v).toFixed(1)}`).join(' ')}"/>`);
    cum.forEach((v, i) => p.push(`<circle class="cf-cum-dot" cx="${cx(i).toFixed(1)}" cy="${yC(v).toFixed(1)}" r="2.5"><title>${esc(`${bars[i].year}년 누적 세후 현금흐름 ${n1(v)} 억원`)}</title></circle>`));
    const be = cum.findIndex((v, i) => i > 0 && v >= 0 && cum[i - 1] < 0);
    if (be > 0) p.push(`<line class="cf-be" x1="${cx(be).toFixed(1)}" x2="${cx(be).toFixed(1)}" y1="${M.top}" y2="${M.top + ih}"><title>${esc(`손익분기 ${bars[be].year}년 — 누적 세후 현금흐름이 0 이상으로 돌아선 해`)}</title></line>`);
    const ry = M.top + ih + 6;
    segs.forEach((sg) => {
      const x = M.left + sg.from * slot, w = (sg.to - sg.from + 1) * slot, span = sg.to - sg.from + 1, label = PHASE_LABELS[sg.key];
      p.push(`<rect class="ph-rib-${sg.key}" x="${x.toFixed(1)}" y="${ry}" width="${w.toFixed(1)}" height="${RIBBON}"><title>${esc(`${label} ${bars[sg.from].year}~${bars[sg.to].year} (${span}개 연도)`)}</title></rect>`);
      if (w >= 46) p.push(`<text class="ph-txt ph-txt-${sg.key}" x="${(x + w / 2).toFixed(1)}" y="${ry + 14}" text-anchor="middle">${label} ${span}년</text>`);
    });
    const boundaries = new Set(segs.map((sg) => sg.from));
    bars.forEach((b, i) => {
      if (!(i === 0 || i === bars.length - 1 || boundaries.has(i) || b.year % 5 === 0)) return; // 처음·끝·단계 경계·5년 배수만
      p.push(`<text class="cf-axis" x="${cx(i).toFixed(1)}" y="${ry + RIBBON + 14}" text-anchor="middle">${b.year}</text>`);
    });
    p.push('</svg>');
    return p.join('');
  }
  const legendItem = (color, label) => `<span><i style="background:${color}"></i>${label}</span>`;

  // 연도별 상세 — 비용은 크기(양수)로, 부호가 뜻을 갖는 값(EBITDA·현금흐름)만 음수를 빨갛게. 값이 전부 0인 칼럼은 만들지 않는다.
  const SUMMARY_DETAIL_COLS = [
    { h: '연도', v: (d) => d.calendarYear, text: true },
    { h: '단계', v: (d) => d.phase, text: true },
    { h: '가동률', v: (d) => d.ratePct, f: (v) => (v == null ? '—' : fmt(v, 1) + '%') },
    { h: '방전량 (MWh)', v: (d) => d.generationMWh, dp: 0 },
    { h: '매출', v: (d) => d.revenue },
    { h: 'OPEX', v: (d) => d.opex },
    { h: 'EBITDA', v: (d) => d.ebitda },
    { h: 'CAPEX 집행', v: (d) => d.capexDraw },
    { h: '원리금 상환', v: (d) => d.debtService },
    { h: 'DSCR', v: (d) => d.dscr, f: (v) => (v == null ? '—' : fmt(v, 2) + '배') },
    { h: '법인세', v: (d) => d.corporateTax },
    { h: '배당', v: (d) => d.dividend },
    { h: '최종 회수', v: (d) => d.terminalRecovery },
    { h: '프로젝트 CF (세후)', v: (d) => d.projectFlow },
    { h: '당사 지분 CF (세전)', v: (d) => d.companyEquityFlow },
  ];

  function renderWarnings() {
    const host = $('warnings');
    const msgs = [...new Set(Array.from(document.querySelectorAll('.warn.show'))
      .filter((e) => e.id !== 'scenarioStorageWarn').map((e) => e.textContent.trim()).filter(Boolean))];
    host.hidden = msgs.length === 0; // 비면 숨긴다 — 빈 상자가 여백을 만든다
    host.innerHTML = msgs.length ? '<strong>입력 확인 필요</strong><ul>' + msgs.map((w) => `<li>${escapeHtml(w)}</li>`).join('') + '</ul>' : '';
  }

  function renderSummaryTab() {
    const chartHost = $('summaryChart'), basisHost = $('summaryBasis'), detailHost = $('summaryDetail');
    renderWarnings();
    if (!lastSolved || !lastSolved.ok) {
      const reason = lastSolved ? lastSolved.reason : '계산 전입니다.';
      chartHost.innerHTML = `<p class="hint-block">${escapeHtml(reason)}</p><div class="chart-wrap">${cashflowChartSvg([])}</div>`;
      basisHost.innerHTML = `<table class="kv"><tbody><tr><th>적정 입찰단가<span class="sub">${escapeHtml(reason)}</span></th><td>—</td></tr></tbody></table>`;
      detailHost.innerHTML = '';
      return;
    }
    const { price, result: r, model } = lastSolved;
    chartHost.innerHTML = '<div class="legend">'
      + legendItem('var(--c-rev)', '매출 (위쪽 막대)') + legendItem('var(--c-capex)', '투자비 (아래쪽)') + legendItem('var(--c-opex)', '운영비 (아래쪽)')
      + legendItem('var(--c-cum)', '누적 세후 프로젝트 현금흐름 · 오른쪽 축') + legendItem('var(--c-be)', '손익분기 시점')
      + legendItem('var(--ph-dev-rib)', '개발') + legendItem('var(--ph-con-rib)', '공사') + legendItem('var(--ph-op-rib)', '운영')
      + `</div><div class="chart-wrap">${cashflowChartSvg(r.detail)}</div>`;

    const f = r.funding, pj = model.project, fin = model.finance;
    const first = r.detail[0], last = r.detail[r.detail.length - 1];
    const opRows = r.detail.filter((d) => d.operatingDays > 0);
    const selText = (id) => { const s = $(id); return s.options[s.selectedIndex] ? s.options[s.selectedIndex].textContent : s.value; };
    const eok = (v) => `${fmt(v, 1)} 억원`;
    const pad2 = (n) => String(n).padStart(2, '0');
    const target = $('solveMode').value === 'companyProfit'
      ? [`${fmt(+$('targetCompanyProfit').value, 1)} 억원`, `당사 이익 목표 · ${selText('companyProfitKind')}`]
      : [`${fmt(+$('targetIrrPct').value, 2)}%`, `목표 IRR · ${selText('irrKind')}`];
    // [라벨, 값, 보조 설명] — 계층은 전각 공백(U+3000)으로 들여쓴다. 오해가 반복되는 지점엔 그 자리에 설명을 둔다.
    const rows = [
      ['적정 입찰단가', `${fmt(price, 2)} 원/kWh`],
      ['산정 기준', target[0], target[1]],
      ['계약용량 (입찰물량)', `${fmt(model.revenue.contractCapacityMW, 0)} MW`, '매출·방전량은 설치용량이 아니라 이 값 기준'],
      ['총투자비', eok(f.totalInvestment)],
      ['　직접공사비 (명목)', eok(f.nominalDirectCapex), '건설비 물가상승 반영 · 감가상각 대상'],
      ['　예비비', eok(f.contingency)],
      ['　건설기간 이자 (IDC)', eok(f.constructionInterest)],
      ['　금융수수료', eok(f.financeFee)],
      ['　DSRA', eok(f.dsra), '사업 종료 시 회수'],
      ['자금조달', eok(f.equityPrincipal + f.seniorPrincipal + f.bondPrincipal), '총투자비와 같아야 함'],
      [`　자기자본 (${fmt(fin.equityPct, 1)}%)`, eok(f.equityPrincipal)],
      [`　선순위대출 (금리 ${fmt(fin.seniorRatePct, 2)}%)`, eok(f.seniorPrincipal)],
      [`　주민참여채권 (${fmt(fin.residentBondPct, 1)}%)`, eok(f.bondPrincipal)],
      ['사업기간', `${first.calendarYear} ~ ${last.calendarYear}`, `${r.detail.length}개 연도`],
      ['　개발·공사', `${first.calendarYear} ~ ${pj.codYear}`, `COD ${pj.codYear}-${pad2(pj.codMonth)}-${pad2(pj.codDay)}`],
      ['　운영', opRows.length ? `${opRows[0].calendarYear} ~ ${opRows[opRows.length - 1].calendarYear}` : '—', `${pj.operationYears}년 · 첫해와 마지막 해는 가동일수만큼 일할`],
      ['IRR·NPV 기산점', `${first.calendarYear}년`, 'NPV는 사업 시작연도로 할인 · IRR·NPV 모두 개발·공사 기간 현금유출을 포함'],
      ['할인율 (NPV)', `${fmt(model.assumptions.waccPct, 2)}%`],
      ['당사(KCH) 지분율', `${fmt(fin.kchSharePct, 1)}%`, '당사 손익 금액에만 곱함 — IRR은 지분율과 무관'],
    ];
    basisHost.innerHTML = '<table class="kv"><tbody>' + rows.map(([k, v, s]) =>
      `<tr${k === '적정 입찰단가' ? ' class="strong"' : ''}><th>${escapeHtml(k)}${s ? `<span class="sub">${escapeHtml(s)}</span>` : ''}</th><td>${escapeHtml(v)}</td></tr>`).join('') + '</tbody></table>';

    const cols = SUMMARY_DETAIL_COLS.filter((c) => c.text || r.detail.some((d) => { const v = c.v(d); return v != null && Math.abs(v) > 1e-9; }));
    const head = cols.map((c) => `<th>${c.h}</th>`).join('');
    const body = r.detail.map((d) => `<tr${d.operatingDays > 0 ? ' class="op-row"' : ''}>` + cols.map((c) => {
      const v = c.v(d);
      if (c.text) return `<td>${escapeHtml(v)}</td>`;
      const txt = c.f ? c.f(v) : fmt(v, c.dp ?? 1);
      return `<td${Number.isFinite(v) && v < -1e-9 ? ' class="neg"' : ''}>${txt}</td>`;
    }).join('') + '</tr>').join('');
    detailHost.innerHTML = `<div class="table-wrap tall"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  // ---------- 민감도 탭 (PRD 6.3, spec 5장) ----------
  // 현재 산정 기준으로 구한 적정 입찰단가(화면 표시값)를 고정한 채 선순위 대출금리 × OPEX 물가상승률,
  // 선순위 대출금리 × EPC 총액 두 매트릭스를 다시 계산한다. 셀마다 지표 3종을 한 번에 담아 두므로
  // "표시 지표"를 바꿀 때는 재계산 없이 다시 그리기만 한다(spec 9.8 — 지표 변경은 즉시).
  // P-IRR을 쓰지 않는 이유는 탭 안 "왜 P-IRR 대신 E-IRR인가" 참고(금리가 P-IRR을 오히려 올리는 정의상 역설).
  const SENS_RATE_DELTAS = [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5];
  const SENS_OPEX_DELTAS = [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5];
  const SENS_EPC_DELTAS = [-15, -10, -5, 0, 5, 10, 15];
  const signed = (v, d) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v), d)}`;
  const SENS_METRICS = [
    { id: 'equityIrr', label: 'E-IRR (배당세전)', fmt: (v) => pct(v, 2), short: (v) => pct(v, 1), diff: (d) => `${signed(d * 100, 2)}%p` },
    { id: 'equityIrrAfterInvestorTax', label: 'E-IRR (배당세후)', fmt: (v) => pct(v, 2), short: (v) => pct(v, 1), diff: (d) => `${signed(d * 100, 2)}%p` },
    { id: 'companyProfitPreTax', label: '당사 누적 순이익 (세전)', fmt: (v) => `${fmt(v, 1)}억`, short: (v) => `${fmt(v, 0)}억`, diff: (d) => `${signed(d, 1)}억` },
  ];
  const sensPick = (r) => (r.errors && r.errors.length ? null
    : { equityIrr: r.equityIrr, equityIrrAfterInvestorTax: r.equityIrrAfterInvestorTax, companyProfitPreTax: r.companyProfitPreTax });

  function computeSensitivity() {
    sensCache = null;
    const bidPrice = parseFloat(String($('heroBidPrice').textContent).replace(/,/g, ''));
    if (!Number.isFinite(bidPrice)) return;
    const baseModel = readModel();
    baseModel.revenue.bidPricePerKWh = bidPrice;
    const baseRate = +$('seniorRatePct').value, baseOpex = +$('opexEscalationPct').value;
    const baseEpc = sum(baseModel.capex.items.map((it) => it.value));
    const withRate = (rd) => ({ ...baseModel, finance: { ...baseModel.finance, seniorRatePct: Math.max(0, baseRate + rd) } });
    const macro = SENS_RATE_DELTAS.map((rd) => SENS_OPEX_DELTAS.map((od) => {
      const m = withRate(rd);
      m.opex = { ...baseModel.opex, escalationPct: Math.max(0, baseOpex + od) };
      return sensPick(analyzeEss(m));
    }));
    // EPC 총액은 D. CAPEX 합계(항목별 입력이든 총액 직접 입력이든 현재 합계)를 기준으로 ±비율로 비례 스케일링한다.
    const epc = SENS_RATE_DELTAS.map((rd) => SENS_EPC_DELTAS.map((ed) => {
      const m = withRate(rd);
      m.capex = { ...baseModel.capex, items: baseModel.capex.items.map((it) => ({ ...it, value: it.value * (1 + ed / 100) })) };
      return sensPick(analyzeEss(m));
    }));
    sensCache = { baseRate, baseOpex, baseEpc, macro, epc };
  }

  // 2줄 셀 매트릭스 — 윗줄 지표값, 아랫줄 기준 칸 대비 차이. 행·열 머리에는 변동폭과 그때의 실제 값(.basev)을 함께 적는다
  // ("−0.5%p" 는 정보가 아니다, "4.70%" 가 정보다 — spec 규칙 8). 기준 칸은 border 가 아니라 outline(칸 크기 불변).
  function renderSensMatrix(headId, bodyId, grid, metric, o) {
    const bi = o.rows.indexOf(0), bj = o.cols.indexOf(0);
    const base = grid[bi] && grid[bi][bj] ? grid[bi][bj][metric.id] : NaN;
    $(headId).innerHTML = `<th class="var">${o.corner}</th>` + o.cols.map((c) => { const [m, s] = o.colHead(c); return `<th>${m}<span class="basev">${s}</span></th>`; }).join('');
    $(bodyId).innerHTML = o.rows.map((rv, i) => {
      const [rm, rs] = o.rowHead(rv);
      const tds = o.cols.map((cv, j) => {
        const cell = grid[i][j], v = cell ? cell[metric.id] : NaN;
        const ok = Number.isFinite(v), isBase = i === bi && j === bj;
        const cls = `cell ${isBase ? 'base' : heatClass(v, base, true)}${ok ? '' : ' na'}`;
        const sub = isBase ? '기준' : (ok && Number.isFinite(base) ? metric.diff(v - base) : '');
        const [cm, cs] = o.colHead(cv);
        const title = `${o.rowName} ${rs} · ${o.colName} ${cs} → ${metric.label} ${ok ? metric.fmt(v) : '—'}`;
        return `<td class="${cls}" title="${escapeHtml(title)}"><span class="cell-main">${ok ? metric.fmt(v) : '—'}</span><span class="cell-sub">${sub}</span></td>`;
      }).join('');
      return `<tr><th class="var">${rm}<span class="basev">${rs}</span></th>${tds}</tr>`;
    }).join('');
  }

  // 토네이도 — 변수 하나만 표 양 끝까지 움직였을 때의 범위. 영향이 큰 변수부터, 기준보다 불리한 쪽 빨강 / 유리한 쪽 초록.
  function tornadoSvg(rows, base, metric) {
    const W = 760, rowH = 34, M = { top: 26, right: 64, bottom: 22, left: 150 };
    const usable = rows.filter((r) => Number.isFinite(r.a) && Number.isFinite(r.b));
    const H = M.top + M.bottom + Math.max(1, usable.length) * rowH; // 0개일 때 음수 높이 방어
    if (!usable.length || !Number.isFinite(base)) return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}"></svg>`;
    usable.sort((p, q) => Math.abs(q.b - q.a) - Math.abs(p.b - p.a));
    const all = usable.flatMap((r) => [r.a, r.b]).concat(base);
    const lo = Math.min(...all), hi = Math.max(...all);
    const pad = (hi - lo) * 0.12 || 0.01; // || 0.01 — 전부 같은 값일 때 0 나누기 방어
    const x0 = lo - pad, x1 = hi + pad, iw = W - M.left - M.right;
    const x = (v) => M.left + ((v - x0) / (x1 - x0)) * iw;
    const xb = x(base);
    const p = [`<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${esc('변수별 영향 크기 — ' + metric.label)}">`];
    usable.forEach((r, i) => {
      const y = M.top + i * rowH, bh = rowH * 0.56, by = (y + (rowH - bh) / 2).toFixed(1), ty = (y + rowH / 2 + 4).toFixed(1);
      const vlo = Math.min(r.a, r.b), vhi = Math.max(r.a, r.b);
      const tip = `<title>${esc(`${r.label}: ${r.aTxt} → ${metric.fmt(r.a)} / ${r.bTxt} → ${metric.fmt(r.b)} (기준 ${metric.fmt(base)})`)}</title>`;
      p.push(`<text class="tn-label" x="${M.left - 10}" y="${ty}" text-anchor="end">${esc(r.label)}</text>`);
      if (vlo < base) p.push(`<rect class="tn-lo" x="${x(vlo).toFixed(1)}" y="${by}" width="${Math.max(1, xb - x(vlo)).toFixed(1)}" height="${bh.toFixed(1)}">${tip}</rect>`);
      if (vhi > base) p.push(`<rect class="tn-hi" x="${xb.toFixed(1)}" y="${by}" width="${Math.max(1, x(vhi) - xb).toFixed(1)}" height="${bh.toFixed(1)}">${tip}</rect>`);
      p.push(`<text class="tn-val" x="${(Math.min(x(vlo), xb) - 6).toFixed(1)}" y="${ty}" text-anchor="end">${esc(metric.short(vlo))}</text>`);
      p.push(`<text class="tn-val" x="${(Math.max(x(vhi), xb) + 6).toFixed(1)}" y="${ty}">${esc(metric.short(vhi))}</text>`);
    });
    p.push(`<line class="tn-base" x1="${xb.toFixed(1)}" x2="${xb.toFixed(1)}" y1="${M.top - 4}" y2="${H - M.bottom + 4}"/>`);
    p.push(`<text class="tn-val" x="${xb.toFixed(1)}" y="${M.top - 10}" text-anchor="middle">기준 ${esc(metric.fmt(base))}</text>`);
    p.push('</svg>');
    return p.join('');
  }

  function renderSensitivityView() {
    const metric = SENS_METRICS.find((m) => m.id === $('sensMetric').value) || SENS_METRICS[0];
    document.querySelectorAll('[data-sens-metric-label]').forEach((e) => { e.textContent = metric.label; });
    if (!sensCache) {
      const msg = '<tr><td style="white-space:normal;color:var(--muted);">위 단가산정모델이 아직 유효한 입찰단가를 계산하지 못해 민감도표를 표시할 수 없습니다.</td></tr>';
      $('macroSensHead').innerHTML = ''; $('epcSensHead').innerHTML = '';
      $('macroSensBody').innerHTML = msg; $('epcSensBody').innerHTML = msg;
      ['sensBaseSeniorRate', 'sensBaseOpexEsc', 'sensBaseIrr', 'sensBaseSeniorRate2', 'sensBaseEpcTotal', 'sensBaseEpcIrr'].forEach((id) => { $(id).value = ''; });
      $('sensTornado').innerHTML = tornadoSvg([], NaN, metric);
      return;
    }
    const { baseRate, baseOpex, baseEpc, macro, epc } = sensCache;
    const bi = SENS_RATE_DELTAS.indexOf(0), bj = SENS_OPEX_DELTAS.indexOf(0), bk = SENS_EPC_DELTAS.indexOf(0);
    const lastR = SENS_RATE_DELTAS.length - 1, lastO = SENS_OPEX_DELTAS.length - 1, lastE = SENS_EPC_DELTAS.length - 1;
    const val = (cell, id = metric.id) => (cell ? cell[id] : NaN);
    $('sensBaseSeniorRate').value = fmt(baseRate, 2); $('sensBaseOpexEsc').value = fmt(baseOpex, 2);
    $('sensBaseIrr').value = pct(val(macro[bi][bj], 'equityIrr'));
    $('sensBaseSeniorRate2').value = fmt(baseRate, 2); $('sensBaseEpcTotal').value = fmt(baseEpc, 1);
    $('sensBaseEpcIrr').value = pct(val(epc[bi][bk], 'equityIrr'));
    const rateHead = (rd) => [rd === 0 ? '기준' : `${signed(rd, 1)}%p`, `${fmt(Math.max(0, baseRate + rd), 2)}%`];
    const opexHead = (od) => [od === 0 ? '기준' : `${signed(od, 1)}%p`, `${fmt(Math.max(0, baseOpex + od), 2)}%/년`];
    const epcHead = (ed) => [ed === 0 ? '기준' : `${signed(ed, 0)}%`, `${fmt(baseEpc * (1 + ed / 100), 0)}억`];
    renderSensMatrix('macroSensHead', 'macroSensBody', macro, metric,
      { corner: '대출금리 ＼ OPEX 상승률', rowName: '대출금리', colName: 'OPEX 상승률', rows: SENS_RATE_DELTAS, cols: SENS_OPEX_DELTAS, rowHead: rateHead, colHead: opexHead });
    renderSensMatrix('epcSensHead', 'epcSensBody', epc, metric,
      { corner: '대출금리 ＼ EPC 총액', rowName: '대출금리', colName: 'EPC 총액', rows: SENS_RATE_DELTAS, cols: SENS_EPC_DELTAS, rowHead: rateHead, colHead: epcHead });
    $('sensTornado').innerHTML = tornadoSvg([
      { label: `대출금리 ±${fmt(SENS_RATE_DELTAS[lastR], 1)}%p`, a: val(macro[0][bj]), b: val(macro[lastR][bj]), aTxt: rateHead(SENS_RATE_DELTAS[0])[1], bTxt: rateHead(SENS_RATE_DELTAS[lastR])[1] },
      { label: `OPEX 상승률 ±${fmt(SENS_OPEX_DELTAS[lastO], 1)}%p`, a: val(macro[bi][0]), b: val(macro[bi][lastO]), aTxt: opexHead(SENS_OPEX_DELTAS[0])[1], bTxt: opexHead(SENS_OPEX_DELTAS[lastO])[1] },
      { label: `EPC 총액 ±${fmt(SENS_EPC_DELTAS[lastE], 0)}%`, a: val(epc[bi][0]), b: val(epc[bi][lastE]), aTxt: epcHead(SENS_EPC_DELTAS[0])[1], bTxt: epcHead(SENS_EPC_DELTAS[lastE])[1] },
    ], val(macro[bi][bj]), metric);
  }

