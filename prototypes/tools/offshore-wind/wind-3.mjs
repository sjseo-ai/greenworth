// 해상풍력 3 — 터빈 카탈로그 한 곳 관리 + 화면에서 새 터빈 등록·삭제·내보내기·불러오기 + 시나리오에 사용자 추가 터빈 포함
// wind-2d 다음에 실행한다(파이프라인: 1a → 1b → 1c → 2a → 2b → 2c → 2d → 3).
import { open, OUT, TURBINES } from "./wind-lib.mjs";
const f = open(OUT);

// ── 마크업: 정적 행 → 빈 컨테이너(스크립트가 카탈로그로 그린다) ──
f.between(`<select id="turbineMaker">`, `</select>`, `<select id="turbineMaker"></select>`);
f.rep(`<h2>터빈 비교 — 국산 2 · 외산 4</h2>`, `<h2>터빈 비교 — <span id="turbineCountHead">국산 2 · 외산 4</span></h2>`);
f.between(`<tbody id="turbineTableBody">`, `</tbody>`, `<tbody id="turbineTableBody"></tbody>`);
f.between(`<tbody id="turbineSpecBody">`, `</tbody>`, `<tbody id="turbineSpecBody"></tbody>`);
f.rep(`<th>국산화율<br>(%, 참고)</th></tr></thead>`, `<th>국산화율<br>(%, 참고)</th><th></th></tr></thead>`);
f.between(`<ul class="todo-list">
              <li>두산에너빌리티 DS205-10MW — 로터 205m`, `</ul>`, `<ul class="todo-list" id="turbineSourceList"></ul>`);
f.rep(`            <div class="subtotal strong"><span>터빈별 근거와 확인 수준</span><span></span></div>`,
  `            <div class="subtotal strong"><span>새 터빈 등록 · 목록 관리</span><span class="muted" id="catalogInfo"></span></div>
            <p class="hint" style="margin-top:0;">새 터빈이 나오면 <strong>① 아래 칸을 채워 "터빈 추가"</strong> — 이 브라우저에 저장되고 선택 목록·비교표·근거 목록에 바로 나타납니다. <strong>② 팀에 공유</strong>하려면 "사용자 추가 터빈 내보내기"로 JSON을 받아 전달하고, 받는 사람은 "불러오기"(시나리오 JSON 파일도 받음). 사용자 추가 터빈은 시나리오를 저장할 때 함께 담겨 시나리오 파일만으로도 복원됩니다. <strong>③ 기본 목록에 영구 반영</strong>하려면 내보낸 JSON의 항목을 페이지 코드의 <code>TURBINE_CATALOG</code>에 그대로 붙여넣으면 됩니다(항목 모양이 같습니다).</p>
            <div class="calc-grid" style="margin-top:0;">
              <div class="field"><label for="newTbMaker">제조사</label><div class="iw"><input id="newTbMaker" type="text" placeholder="예) Siemens Gamesa"></div></div>
              <div class="field"><label for="newTbModel">모델명</label><div class="iw"><input id="newTbModel" type="text" placeholder="예) SG 21-276 DD"></div></div>
              <div class="field"><label for="newTbOrigin">원산지</label><div class="iw"><select id="newTbOrigin"><option value="domestic">국산</option><option value="foreign" selected>외산</option></select></div></div>
              <div class="field"><label for="newTbMw">정격출력</label><div class="iw"><input id="newTbMw" type="number" value="15" step="0.1" min="0"><span class="unit">MW</span></div></div>
              <div class="field"><label for="newTbRotor">로터 직경</label><div class="iw"><input id="newTbRotor" type="number" value="236" step="1" min="0"><span class="unit">m</span></div></div>
              <div class="field"><label for="newTbPrice">터빈 단가</label><div class="iw"><input id="newTbPrice" type="number" value="28" step="0.5" min="0"><span class="unit">억원/MW</span></div></div>
              <div class="field"><label for="newTbAvail">가용률</label><div class="iw"><input id="newTbAvail" type="number" value="96" step="0.5" min="0" max="100"><span class="unit">%</span></div></div>
              <div class="field"><label for="newTbDegA">성능저하</label><div class="iw"><input id="newTbDegA" type="number" value="0.2" step="0.05" min="0"><span class="unit">%/년</span></div></div>
              <div class="field"><label for="newTbLocal">국산화율 (참고)</label><div class="iw"><input id="newTbLocal" type="number" value="20" step="5" min="0" max="100"><span class="unit">%</span></div></div>
              <div class="field"><label for="newTbSource">근거 · 확인 수준</label><div class="iw"><input id="newTbSource" type="text" placeholder="예) 제조사 발표(2026-10), 형식인증 전"></div></div>
            </div>
            <div class="module-link">
              <button type="button" class="btn btn-soft" id="addTurbineBtn">터빈 추가</button>
              <button type="button" class="btn" id="exportTurbinesBtn">사용자 추가 터빈 내보내기 (JSON)</button>
              <button type="button" class="btn" id="importTurbinesBtn">불러오기</button>
              <input type="file" id="importTurbinesFile" accept=".json,application/json" hidden>
            </div>
            <p id="turbineFormMsg" role="status" hidden></p>

            <div class="subtotal strong"><span>터빈별 근거와 확인 수준</span><span></span></div>`);
f.rep(`유니슨 U210은 형식인증 전(실증 중)</li>`, `유니슨 U210은 형식인증 전(실증 중). 기본 목록 기준일 2026-09-14 — 새 터빈은 터빈 비교 탭 "새 터빈 등록"으로 추가하거나 코드의 TURBINE_CATALOG에 항목을 더하면 됨</li>`);

// ── 스크립트: 카탈로그 · 사용자 추가 저장소 ───────────────────
const catalogJs = JSON.stringify(TURBINES, null, 2).split("\n").join("\n  ");
f.between(`  // 터빈 스펙·단가 기본값은 "터빈 비교" 탭 표의 입력 칸(HTML value)에 있고, 여기엔 식별 정보만 둔다.`,
  `  const TURBINE_BY_ID = Object.fromEntries(TURBINE_LIST.map((t) => [t.id, t]));`,
  `  // 터빈 카탈로그 — 새 터빈은 여기에 항목 하나를 더하면 선택 목록·비교표·스펙표·근거 목록에 자동 반영된다.
  // 필드: id(영문·숫자·_ 고유값) · origin('domestic' | 'foreign') · maker · model · mw(정격 MW) · rotor(로터 직경 m)
  //       price(터빈 단가 억원/MW, 예시) · avail(가용률 %) · degA(연간 성능저하 %/년) · local(국산화율 %, 참고)
  //       specLabel(확인 수준, 짧게) · source(근거 문장). 화면의 "새 터빈 등록"으로 추가한 터빈도 같은 모양으로 저장·내보낸다.
  const TURBINE_CATALOG_UPDATED = '2026-09-14';
  const TURBINE_CATALOG = ${catalogJs};
  // 사용자 추가 터빈 — 이 브라우저(localStorage)에 저장하고, 시나리오 저장·내보내기에도 담는다.
  const CUSTOM_TURBINE_KEY = 'windCustomTurbines.v1';
  let customTurbines = loadCustomTurbines();
  function validTurbine(t) { return !!(t && t.maker && t.model && +t.mw > 0 && +t.rotor > 0); }
  function loadCustomTurbines() {
    try {
      const v = JSON.parse(localStorage.getItem(CUSTOM_TURBINE_KEY) || '[]');
      return Array.isArray(v) ? v.filter((t) => validTurbine(t) && /^[A-Za-z0-9_]+$/.test(String(t.id))) : [];
    } catch { return []; }
  }
  function saveCustomTurbines() {
    try { localStorage.setItem(CUSTOM_TURBINE_KEY, JSON.stringify(customTurbines)); return true; } catch { return false; }
  }
  const newTurbineId = () => 'u' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
  const allTurbines = () => [...TURBINE_CATALOG, ...customTurbines.map((t) => ({ ...t, custom: true }))];
  const turbineById = (id) => allTurbines().find((t) => t.id === id);`);
f.reRep(/TURBINE_BY_ID\[([^\]]+?)\]/g, "turbineById($1)", 7);
f.rep(`    const rows = TURBINE_LIST.map((tb) => {`, `    const rows = allTurbines().map((tb) => {`);

// ── 스크립트: 목록으로 화면 그리기 (turbineDerived 앞에 둔다) ──
f.rep(`  // ---------- 터빈 → 순이용률·성능저하·터빈 단가 ----------`, `  // ---------- 터빈 목록(카탈로그 + 사용자 추가) → 선택 목록 · 비교표 · 스펙표 · 근거 목록 ----------
  // 이미 있던 스펙 칸의 값(이번 세션에 고친 값)과 선택 터빈은 유지한다. 칸의 HTML value는 정의값이라 "기본값으로 되돌리기"가 그 값으로 돌아간다.
  function renderTurbineUI() {
    const list = allTurbines(), keep = {};
    document.querySelectorAll('#turbineSpecBody input[id^="tb-"]').forEach((el) => { keep[el.id] = el.value; });
    const sel = $('turbineMaker'), prevSel = sel.value, h = escapeHtml;
    const opt = (t) => \`<option value="\${h(t.id)}"\${t.id === 'doosan10' ? ' selected' : ''}>\${h(t.maker)} · \${h(t.model)}\${t.custom ? ' (사용자 추가)' : ''}</option>\`;
    sel.innerHTML = \`<optgroup label="국산">\${list.filter((t) => t.origin === 'domestic').map(opt).join('')}</optgroup>\`
      + \`<optgroup label="외산">\${list.filter((t) => t.origin !== 'domestic').map(opt).join('')}</optgroup>\`;
    sel.value = list.some((t) => t.id === prevSel) ? prevSel : 'doosan10';
    const nameCell = (t) => \`<th class="mk-name"><span class="mk-origin \${t.origin === 'domestic' ? 'domestic' : 'china'}">\${t.origin === 'domestic' ? '국산' : '외산'}</span>\${h(t.maker)}<span class="sub">\${h(t.model)} · \${h(t.custom ? '사용자 추가' : t.specLabel || '')}</span></th>\`;
    $('turbineTableBody').innerHTML = list.map((t) => \`
      <tr data-tb-row="\${h(t.id)}">\${nameCell(t)}
        <td id="tb-\${h(t.id)}-rated">—</td><td id="tb-\${h(t.id)}-sp">—</td><td id="tb-\${h(t.id)}-y1">—</td><td id="tb-\${h(t.id)}-epc">—</td><td id="tb-\${h(t.id)}-solve">—</td><td id="tb-\${h(t.id)}-bid">—</td>
        <td><button type="button" class="btn btn-soft" data-tb-pick="\${h(t.id)}">선택</button></td>
      </tr>\`).join('');
    const cell = (t, fld, step, label) => \`<td><input id="tb-\${h(t.id)}-\${fld}" type="number" value="\${h(t[fld])}" step="\${step}" aria-label="\${h(t.maker)} \${label}"></td>\`;
    $('turbineSpecBody').innerHTML = list.map((t) => \`
      <tr data-tb-row="\${h(t.id)}">\${nameCell(t)}\${cell(t, 'price', 0.5, '터빈 단가')}\${cell(t, 'mw', 0.1, '정격출력')}\${cell(t, 'rotor', 1, '로터 직경')}\${cell(t, 'avail', 0.5, '가용률')}\${cell(t, 'degA', 0.05, '성능저하')}\${cell(t, 'local', 5, '국산화율')}
        <td>\${t.custom ? \`<button type="button" class="btn" data-tb-del="\${h(t.id)}">삭제</button>\` : ''}</td>
      </tr>\`).join('');
    document.querySelectorAll('#turbineSpecBody input[id^="tb-"]').forEach((el) => { if (keep[el.id] != null) el.value = keep[el.id]; });
    $('turbineSourceList').innerHTML = list.map((t) => {
      const sp = t.mw * 1e6 / (Math.PI * (t.rotor / 2) ** 2);
      return \`<li>\${t.custom ? \`<strong>[사용자 추가 \${h(t.addedAt || '')}]</strong> \` : ''}\${h(t.source || \`\${t.maker} \${t.model} — 근거 미입력\`)} 비출력 약 \${Math.round(sp)}W/m².</li>\`;
    }).join('');
    const dom = list.filter((t) => t.origin === 'domestic').length;
    $('turbineCountHead').textContent = \`국산 \${dom} · 외산 \${list.length - dom}\`;
    $('catalogInfo').textContent = \`기본 목록 \${TURBINE_CATALOG.length}종 (기준일 \${TURBINE_CATALOG_UPDATED}) · 사용자 추가 \${customTurbines.length}종\`;
    resultsDirty.turbine = true;
  }
  // ---------- 터빈 → 순이용률·성능저하·터빈 단가 ----------`);

// ── 스크립트: 리스너 — 표 이벤트 위임 · 등록 · 삭제 · 내보내기 · 불러오기 ──
f.between(`  const TURBINE_UPSTREAM_IDS = `, `    $('turbineMaker').value = b.dataset.tbPick;
    applyTurbineDerived();
    recalcAll();
  }));`, `  const TURBINE_UPSTREAM_IDS = ['siteBaseRatePct', 'wakeLossPct', 'electricalLossPct', 'bosUnitPrice', 'refSpecificPower', 'powerCurveExp'];
  TURBINE_UPSTREAM_IDS.forEach((id) => $(id).addEventListener('input', () => { if (turbineLinked) applyTurbineDerived(); }));
  $('applyTurbineBtn').addEventListener('click', () => { applyTurbineDerived(); recalcAll(); });
  $('gotoTurbineTab').addEventListener('click', () => $('tab-turbine').click());
  // 터빈 표는 목록이 바뀔 때마다 다시 그려지므로, 입력·버튼 이벤트는 패널에 한 번만 걸어 위임한다.
  $('panel-turbine').addEventListener('input', (e) => {
    const el = e.target;
    if (!el.id || !el.id.startsWith('tb-')) return;
    const cut = el.id.lastIndexOf('-'), own = el.id.slice(3, cut), fld = el.id.slice(cut + 1);
    // 사용자 추가 터빈의 스펙을 고치면 저장된 정의도 함께 고친다(기본 목록 터빈은 이번 세션 값 — 시나리오로 저장)
    const c = customTurbines.find((t) => t.id === own);
    if (c) { c[fld] = el.value; saveCustomTurbines(); }
    if (turbineLinked && own === $('turbineMaker').value) applyTurbineDerived();
    recalcAll();
  });
  $('panel-turbine').addEventListener('click', (e) => {
    const pick = e.target.closest('[data-tb-pick]'), del = e.target.closest('[data-tb-del]');
    if (pick) { $('turbineMaker').value = pick.dataset.tbPick; applyTurbineDerived(); recalcAll(); }
    if (del) removeCustomTurbine(del.dataset.tbDel);
  });

  // ---------- 새 터빈 등록 · 삭제 · 내보내기 · 불러오기 ----------
  function turbineMsg(text, isError) {
    const m = $('turbineFormMsg');
    m.className = isError ? 'warn show' : 'callout-sm';
    m.textContent = text;
    m.hidden = false;
  }
  $('addTurbineBtn').addEventListener('click', () => {
    const g = (id) => $(id).value.trim();
    const t = { id: newTurbineId(), origin: $('newTbOrigin').value, maker: g('newTbMaker'), model: g('newTbModel'), mw: g('newTbMw'), rotor: g('newTbRotor'),
      price: g('newTbPrice'), avail: g('newTbAvail'), degA: g('newTbDegA'), local: g('newTbLocal'), specLabel: '사용자 추가',
      source: g('newTbSource') ? \`\${g('newTbMaker')} \${g('newTbModel')} — \${g('newTbSource')}\` : '', addedAt: new Date().toISOString().slice(0, 10) };
    if (!t.maker || !t.model) return turbineMsg('제조사와 모델명을 입력해 주세요.', true);
    if (!(+t.mw > 0) || !(+t.rotor > 0)) return turbineMsg('정격출력(MW)과 로터 직경(m)은 0보다 커야 합니다.', true);
    if (!(+t.price >= 0) || !(+t.avail > 0 && +t.avail <= 100)) return turbineMsg('터빈 단가는 0 이상, 가용률은 0~100%로 입력해 주세요.', true);
    if (allTurbines().some((x) => x.maker === t.maker && x.model === t.model)) return turbineMsg(\`\${t.maker} \${t.model}은(는) 이미 목록에 있습니다 — 스펙 표에서 값을 고쳐 주세요.\`, true);
    customTurbines.push(t);
    const saved = saveCustomTurbines();
    renderTurbineUI();
    recalcAll();
    ['newTbMaker', 'newTbModel', 'newTbSource'].forEach((id) => { $(id).value = ''; });
    turbineMsg(\`\${t.maker} \${t.model}을(를) 추가했습니다\${saved ? '(이 브라우저에 저장)' : ' — 브라우저 저장이 막혀 이 화면에서만 유지되니 내보내기로 파일을 받아 두세요'}. 선택 목록과 비교표에 반영됐습니다.\`, !saved);
  });
  function removeCustomTurbine(id) {
    const t = customTurbines.find((x) => x.id === id);
    if (!t) return;
    customTurbines = customTurbines.filter((x) => x.id !== id);
    saveCustomTurbines();
    const wasSelected = $('turbineMaker').value === id;
    renderTurbineUI();
    if (wasSelected) applyTurbineDerived();
    recalcAll();
    turbineMsg(\`\${t.maker} \${t.model}을(를) 목록에서 뺐습니다\${wasSelected ? ' — 선택 터빈은 두산 DS205-10MW로 바뀌었습니다' : ''}. 내보낸 파일이 있으면 불러오기로 되살릴 수 있습니다.\`, false);
  }
  // 같은 id(또는 같은 제조사+모델)의 사용자 추가 터빈은 갱신, 새 것은 추가. 기본 목록과 같은 제조사+모델은 건너뛴다.
  function mergeTurbines(incoming) {
    const r = { added: 0, updated: 0, skipped: 0 };
    (Array.isArray(incoming) ? incoming : []).forEach((raw) => {
      if (!validTurbine(raw)) { r.skipped++; return; }
      const t = { ...raw };
      delete t.custom;
      if (TURBINE_CATALOG.some((x) => x.maker === t.maker && x.model === t.model)) { r.skipped++; return; }
      if (!/^[A-Za-z0-9_]+$/.test(String(t.id)) || TURBINE_CATALOG.some((x) => x.id === t.id)) t.id = newTurbineId();
      const i = customTurbines.findIndex((x) => x.id === t.id || (x.maker === t.maker && x.model === t.model));
      if (i >= 0) { customTurbines[i] = { ...customTurbines[i], ...t, id: customTurbines[i].id }; r.updated++; } else { customTurbines.push(t); r.added++; }
    });
    if (r.added + r.updated) saveCustomTurbines();
    return r;
  }
  $('exportTurbinesBtn').addEventListener('click', async () => {
    if (!customTurbines.length) return turbineMsg('내보낼 사용자 추가 터빈이 없습니다.', true);
    if (!downloadsApi) return turbineMsg('이 화면에서는 다운로드 기능을 사용할 수 없습니다(Claude 앱/웹의 아티팩트 화면에서 다시 시도해 주세요).', true);
    try {
      const data = JSON.stringify({ tool: '해상풍력 적정 입찰가격 프로토타입 (초안)', kind: 'turbineCatalog', exportedAt: new Date().toISOString(),
        turbines: customTurbines.map(({ custom, ...t }) => t) }, null, 2);
      await downloadsApi.save({ filename: \`해상풍력_터빈목록_\${new Date().toISOString().slice(0, 10)}.json\`, data });
      turbineMsg(\`사용자 추가 터빈 \${customTurbines.length}종을 내보냈습니다.\`, false);
    } catch (e) {
      turbineMsg(e && e.code === 'declined' ? '다운로드를 취소했습니다.' : '다운로드에 실패했습니다: ' + (e && e.message ? e.message : e), true);
    }
  });
  $('importTurbinesBtn').addEventListener('click', () => $('importTurbinesFile').click());
  $('importTurbinesFile').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      // 터빈 목록 파일(turbines) · 시나리오 파일(inputs.customTurbines) · 항목 배열 모두 받는다
      const incoming = Array.isArray(parsed) ? parsed : parsed.turbines || (parsed.inputs && parsed.inputs.customTurbines) || [];
      const r = mergeTurbines(incoming);
      renderTurbineUI();
      recalcAll();
      turbineMsg(\`불러오기: 추가 \${r.added}종 · 갱신 \${r.updated}종\${r.skipped ? \` · 건너뜀 \${r.skipped}종(필수값 누락 또는 기본 목록과 같은 모델)\` : ''}.\`, r.added + r.updated === 0);
    } catch (err) {
      turbineMsg('JSON 파일을 읽지 못했습니다: ' + (err && err.message ? err.message : err), true);
    } finally {
      e.target.value = '';
    }
  });`);

// ── 공통 리스너 · 시나리오 저장/복원 · 초기화 ─────────────────
f.rep(`el.id.startsWith('kch') || el.disabled) return;`, `el.id.startsWith('kch') || el.id.startsWith('tb-') || el.id.startsWith('newTb') || el.type === 'file' || el.disabled) return;`);
f.rep(`if (el.disabled || el.id === 'scenarioName' || el.id === 'sensMetric') return;`, `if (el.disabled || el.id === 'scenarioName' || el.id === 'sensMetric' || el.id.startsWith('newTb') || el.type === 'file') return;`);
f.rep(`    state.cdRates = Array.from(document.querySelectorAll('#cdRateGrid [data-cd-index]')).map((el) => el.value);`,
  `    state.cdRates = Array.from(document.querySelectorAll('#cdRateGrid [data-cd-index]')).map((el) => el.value);
    state.customTurbines = customTurbines.map(({ custom, ...t }) => t); // 사용자 추가 터빈 정의 — 시나리오 파일만으로 복원되게`);
f.rep(`  function applyScenarioState(state) {
    Object.entries(state.fields || {}).forEach(([id, val]) => {`, `  function applyScenarioState(state) {
    // 시나리오에 담긴 사용자 추가 터빈을 먼저 목록에 합치고 표를 다시 그려야, 그 터빈의 선택·스펙 칸 값이 복원된다.
    if (Array.isArray(state.customTurbines) && state.customTurbines.length) mergeTurbines(state.customTurbines);
    renderTurbineUI();
    Object.entries(state.fields || {}).forEach(([id, val]) => {`);
f.rep(`  syncSolveModeVisibility(); // 기본 산정 기준(목표 IRR)에 맞춰 A 구역 입력 표시를 맞춘다`,
  `  renderTurbineUI(); // 카탈로그 + 사용자 추가 터빈으로 선택 목록·터빈 표를 그린다(스펙 칸을 읽는 계산보다 먼저)
  syncSolveModeVisibility(); // 기본 산정 기준(목표 IRR)에 맞춰 A 구역 입력 표시를 맞춘다`);

f.save("wind-3");
