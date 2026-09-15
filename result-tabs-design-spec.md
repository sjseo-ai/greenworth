# 결과 탭 디자인 명세서 — 요약 · 민감도 · 시나리오

> `사업성/` 웹앱의 **결과 영역 3개 탭**을 다른 사이트에 그대로 옮기기 위한 디자인 상세 명세입니다.
> 마크업 트리 · CSS 전문 · 렌더러 코드 · 수치 근거를 모두 담았습니다.
>
> 자매 문서: [web-app-blueprint.md](web-app-blueprint.md) (전체 아키텍처 · 계산 엔진 · 복제 레시피)
> 기준 시점: 2026-09-11 · 기준 코드: `사업성/css/style.css` (730줄) + `results-view.js` · `sensitivity-view.js` · `chart.js`

---

## 목차

1. [세 탭이 각각 답하는 질문](#1-세-탭이-각각-답하는-질문)
2. [공통 디자인 시스템](#2-공통-디자인-시스템)
3. [탭 껍데기 (Tab Shell)](#3-탭-껍데기-tab-shell)
4. [요약 탭 해부](#4-요약-탭-해부)
5. [민감도 탭 해부](#5-민감도-탭-해부)
6. [시나리오 탭 해부](#6-시나리오-탭-해부)
7. [관통하는 디자인 규칙 10개](#7-관통하는-디자인-규칙-10개)
8. [복사용 CSS 전문](#8-복사용-css-전문)
9. [복사용 렌더러 코드](#9-복사용-렌더러-코드)
10. [다른 도메인으로 옮기기](#10-다른-도메인으로-옮기기)
11. [계약 테스트 · 체크리스트](#11-계약-테스트--체크리스트)

---

## 1. 세 탭이 각각 답하는 질문

디자인을 베끼기 전에 **왜 3개로 쪼갰는지**가 먼저입니다. 탭마다 답하는 질문이 다릅니다.

| 탭 | 답하는 질문 | 정보 구조 | 사용자 행동 |
|---|---|---|---|
| **요약** | "지금 이 조건이면 어떻게 되나?" | **1개 케이스 × 전체 항목** | 읽는다 (read-only) |
| **민감도** | "무엇이 가장 위험한가? 어디까지 버티나?" | **6개 변수 × 5단계 × 1지표** | 지표·범위를 고른다 |
| **시나리오** | "기본/낙관/비관을 나란히 보면?" | **3~4개 케이스 × 8개 지표** | **표 안에서 직접 입력한다** |

**축이 전부 다릅니다.** 그래서 같은 표 컴포넌트를 쓰면 안 됩니다.

```
요약     : 한 케이스를 깊게          → 세로로 긴 kv 표 + 26px 대형 숫자 카드
민감도   : 한 지표를 넓게             → 2차원 매트릭스 + 히트맵 색
시나리오 : 여러 케이스를 비교         → 열=케이스, 행=항목, 셀에 input
```

**가장 중요한 차이: 시나리오 탭의 셀은 입력칸입니다.** 읽는 표와 쓰는 표는 다르게 생겨야 하고(배경·높이·정렬), 이걸 섞으면 사용자가 어디를 고칠 수 있는지 모릅니다.

---

## 2. 공통 디자인 시스템

### 2.1 토큰 (`:root`)

```css
:root {
  /* 면 */
  --bg:          #f4f6f8;   /* 페이지 바탕 — 회색. 카드가 떠 보이게 한다 */
  --panel:       #ffffff;   /* 카드/패널 */
  --panel-alt:   #fafbfc;   /* 호버·그룹머리·보조 영역 */

  /* 선 */
  --line:        #e3e7ec;   /* 기본 구분선 */
  --line-strong: #cbd2da;   /* 입력칸 테두리 · 강조 구분 */

  /* 글자 3단 */
  --ink:         #1a1f28;   /* 본문·숫자 */
  --ink-2:       #4a5462;   /* 라벨 */
  --muted:       #7b8794;   /* 단위·주석·보조 */

  /* 의미색 */
  --accent:      #0f6b4a;   /* 딥 그린 — 브랜드 + 좋음 */
  --accent-soft: #e7f2ed;   /* accent 배경 */
  --danger:      #b3261e;
  --pos:         #0f6b4a;   /* = accent */
  --neg:         #b3261e;   /* = danger */
  --warn-bg:     #fff5e6;
  --warn-ink:    #8a4b08;

  --radius: 10px;
  --shadow: 0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06);
}
```

**색 설계의 핵심 2가지**

1. **글자색이 3단(`--ink` / `--ink-2` / `--muted`)입니다.** 숫자는 가장 진하게, 라벨은 중간, 단위·주석은 흐리게. 폰트 크기를 안 바꾸고도 위계가 생깁니다.
2. **`--pos`/`--neg` 를 `--accent`/`--danger` 와 같은 값으로 따로 선언합니다.** 의미가 다르기 때문입니다. 나중에 "좋음"만 파란색으로 바꾸고 싶을 때 브랜드색을 건드리지 않습니다.

### 2.2 숫자 타이포그래피 — 이 디자인의 뼈대

```css
font-variant-numeric: tabular-nums;
```

**모든 숫자 표시 요소에 예외 없이 걸립니다.** `table`, `.card .v`, `.card .s`, `.subtotal`, `input`, `.acc-total`.

왜 필수인가: 비례 숫자(proportional)에서는 `1` 이 `8` 보다 좁습니다. 표에서 `1,111` 과 `8,888` 의 폭이 달라져 **자릿수가 세로로 안 맞고, 스크롤할 때 숫자가 흔들려 보입니다.** 재무·공학 데이터를 다루는 화면에서 이건 신뢰도 문제입니다.

```css
/* 대형 숫자(카드)에는 자간을 조인다 */
.card .v { font-size: 26px; font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
```

`letter-spacing: -.02em` — 큰 숫자는 기본 자간이 헐렁해 보입니다. 20px 이상에서만 조이세요.

### 2.3 패널 — 모든 블록의 기본 껍데기

```css
.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);      /* 10px */
  box-shadow: var(--shadow);
  margin-bottom: 16px;
}

/* 패널 제목 — 작고, 대문자, 흐리게. "이건 라벨이지 제목이 아니다" */
.panel > h2 {
  margin: 0;
  padding: 14px 16px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--muted);
  border-bottom: 1px solid var(--line);
}

.panel-body { padding: 14px 16px; }
```

**제목을 12px / muted / uppercase 로 낮추는 게 포인트입니다.** 제목이 크면 제목만 보이고 데이터가 안 보입니다. 이 화면의 주인공은 숫자입니다.

한글에는 `text-transform: uppercase` 가 효과 없지만, 영문·숫자 혼용 제목에서 일관성을 주고 `letter-spacing: .06em` 과 함께 "라벨 느낌"을 만듭니다.

### 2.4 표 기본형 — 3개 탭 전부가 상속

```css
.table-wrap { overflow-x: auto; }        /* ⚠ 반드시 감싼다 */

table {
  width: 100%;
  min-width: 720px;                      /* 좁아지면 스크롤, 찌그러지지 않는다 */
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
}

th, td {
  padding: 6px 8px;
  text-align: right;                     /* 숫자 기본 = 우측 */
  white-space: nowrap;                   /* 줄바꿈 금지 — 표가 울렁거린다 */
  border-bottom: 1px solid var(--line);  /* 세로선 없음. 가로선만 */
}

thead th {
  position: sticky; top: 0;              /* 긴 표에서 머리 고정 */
  background: var(--panel);
  color: var(--muted);
  font-weight: 600;
  z-index: 1;
}

th:first-child, td:first-child { text-align: left; }   /* 첫 칼럼 = 라벨 = 좌측 */
tbody tr:hover { background: var(--panel-alt); }       /* 행 추적 */
td.neg { color: var(--neg); }
```

**표 디자인 4원칙**
1. **세로선을 그리지 않는다.** 가로선만으로 충분하고, 세로선은 시각적 소음입니다.
2. **숫자는 우측, 라벨은 좌측.** `th:first-child` 만 좌측으로 뒤집습니다.
3. **`white-space: nowrap` + 바깥 `overflow-x: auto`.** 셀 안에서 줄바꿈하면 행 높이가 제각각 되어 눈이 따라가지 못합니다.
4. **`thead` 고정.** 20~26행짜리 표에서 머리가 사라지면 읽을 수 없습니다.

**`min-width` 를 표마다 다르게 줍니다** — 칼럼 수에 맞춰서:

| 표 | `min-width` | 칼럼 구성 |
|---|---|---|
| 기본 (연도별 상세) | 720px | 16~17칼럼 |
| `.kv` (산출 근거) | `0` (해제) | 2칼럼 — 좁아도 읽힌다 |
| `.matrix` (민감도) | 560px | 변수 + 5단계 = 6칼럼 |
| `.scenario` | 520px | 구분 + 3~4케이스 |
| `.guide-table` | 520px | 참고용 |

### 2.5 섹션 제목 — 패널 안에서 블록을 나눌 때

```css
.subtotal {
  display: flex;
  justify-content: space-between;
  padding: 8px 0 2px;
  margin-top: 8px;
  border-top: 1px solid var(--line);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ink-2);
}
.subtotal.strong { color: var(--ink); font-size: 14px; }
```

민감도 탭은 한 패널 안에 4개 블록(토네이도 / 매트릭스 / 임계값 / 설명)이 들어갑니다.
패널을 4개로 쪼개면 여백이 낭비되므로, **`.subtotal.strong` 을 구분선 겸 제목으로** 씁니다.

```js
function sectionTitle(text) {
  return el('div', { class: 'subtotal strong' }, el('span', { text }), el('span', { text: '' }));
}
```

빈 `<span>` 을 두는 이유: `justify-content: space-between` 이므로 오른쪽에 나중에 값을 넣을 자리를 비워둡니다(입력 폼의 소계 줄과 같은 컴포넌트를 재사용).

---

## 3. 탭 껍데기 (Tab Shell)

### 3.1 마크업

```html
<div class="tabs" role="tablist">
  <button class="tab" type="button" role="tab" id="tab-summary"
          aria-controls="panel-summary" aria-selected="true">요약</button>
  <button class="tab" type="button" role="tab" id="tab-sensitivity"
          aria-controls="panel-sensitivity" aria-selected="false">민감도</button>
  <button class="tab" type="button" role="tab" id="tab-scenario"
          aria-controls="panel-scenario" aria-selected="false">시나리오</button>
</div>

<div class="tabpanel" id="panel-summary" role="tabpanel" aria-labelledby="tab-summary">…</div>
<div class="tabpanel" id="panel-sensitivity" role="tabpanel" aria-labelledby="tab-sensitivity" hidden>…</div>
<div class="tabpanel" id="panel-scenario"  role="tabpanel" aria-labelledby="tab-scenario"  hidden>…</div>
```

**접근성 4쌍을 반드시 갖춥니다.**
1. `role="tablist"` / `role="tab"` / `role="tabpanel"`
2. `aria-controls` (탭 → 패널)
3. `aria-labelledby` (패널 → 탭)
4. `aria-selected` (상태)

### 3.2 CSS — "폴더 탭" 스타일

```css
.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--line);   /* 탭 아래 기준선 */
}

.tab {
  min-height: 44px;                        /* 터치 타깃 — 계약 테스트가 잠금 */
  padding: 0 18px;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 8px 8px 0 0;              /* 위쪽만 둥글게 */
  background: transparent;
  color: var(--muted);
  font-weight: 600;
  font-size: 14px;
  margin-bottom: -1px;                     /* ★ 기준선을 1px 덮는다 */
}
.tab:hover { color: var(--accent); }
.tab[aria-selected="true"] {
  background: var(--panel);
  border-color: var(--line);
  color: var(--accent);
}
.tab:focus-visible { outline: 2px solid var(--accent); outline-offset: -3px; }

.tabpanel[hidden] { display: none; }
```

**`margin-bottom: -1px` 가 이 디자인의 핵심 트릭입니다.**
선택된 탭이 아래 기준선을 1px 덮어써서, **탭과 내용이 이어진 하나의 면**으로 보입니다. 이게 없으면 탭이 내용 위에 떠 있는 별개 버튼처럼 보입니다.

```
없을 때                          있을 때
┌────┐ ┌────┐                   ┌────┐ ┌────┐
│요약│ │민감│                    │요약│ │민감│
└────┘ └────┘                   │    └─┴────┴──
────────────── ← 선이 끊김       │  내용이 이어짐
```

**`outline-offset: -3px`** — 포커스 링을 안쪽으로 넣습니다. 바깥으로 내면 둥근 모서리 밖으로 삐져나와 옆 탭과 겹칩니다.

### 3.3 JS — 전환 + "보이는 탭만 계산"

```js
const TABS = [
  { tab: 'tab-summary',     panel: 'panel-summary' },
  { tab: 'tab-sensitivity', panel: 'panel-sensitivity' },
  { tab: 'tab-scenario',    panel: 'panel-scenario' },
];
let activeTab = 'tab-summary';

function selectTab(tabId) {
  activeTab = tabId;
  for (const t of TABS) {
    const on = t.tab === tabId;
    document.getElementById(t.tab)?.setAttribute('aria-selected', String(on));
    const p = document.getElementById(t.panel);
    if (p) p.hidden = !on;          // ★ hidden 프로퍼티로 토글 (style.display 아님)
  }
  renderActiveTab();
}

/** 보이는 탭만 계산한다 — 숨은 탭까지 매번 돌릴 이유가 없다. */
function renderActiveTab() {
  if (activeTab === 'tab-sensitivity') renderSensitivityTab();
  else if (activeTab === 'tab-scenario') renderScenarioTab();
}

for (const t of TABS) {
  document.getElementById(t.tab)?.addEventListener('click', () => selectTab(t.tab));
}

// 초기 상태를 HTML 속성에 기대지 않고 JS 가 명시적으로 정한다
selectTab(activeTab);
```

**3가지 규칙**
1. `el.hidden = true` 를 쓰고 `style.display = 'none'` 을 쓰지 않습니다. `hidden` 은 의미가 있고 `[hidden]` 셀렉터로 제어됩니다.
2. **지연 계산(lazy)** — 민감도 탭은 엔진을 60번 부릅니다. 요약 탭을 보는 동안은 계산하지 않습니다.
3. **초기 탭을 JS가 정합니다.** HTML의 `aria-selected="true"` 를 믿지 않으면 HTML·JS 불일치 버그가 원천 차단됩니다.

---

## 4. 요약 탭 해부

### 4.1 구조 — 5개 블록

```
┌─ #cards        (KPI 카드 3장 · 강조 O)  ─┐  탭 바깥 — 탭을 바꿔도 보인다
├─ #cards-scale  (규모 카드 3장 · 강조 X) ─┘
│
├─ .tabs  [요약] 민감도 시나리오
│
└─ #panel-summary
   ├─ .panel  "연도별 현금흐름"   → .legend + .chart-wrap > svg
   ├─ .panel  "산출 근거"         → table.kv  +  #warnings
   └─ .panel  "연도별 상세"       → .table-wrap > table (16~17칼럼)
```

**카드 2줄이 탭 바깥에 있는 게 의도적입니다.** IRR·총사업비는 민감도 탭을 볼 때도 기준점으로 계속 보여야 합니다.

### 4.2 KPI 카드 — 2줄 × 3장

```css
.cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));   /* ⚠ minmax(0, …) */
  gap: 12px;
  margin-bottom: 16px;
}

.card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 14px 16px;
}

/* 3단 구조: 라벨(k) → 값(v) → 보조(s) */
.card .k { font-size: 12px; color: var(--muted); }
.card .v {
  margin-top: 3px;
  font-size: 26px; font-weight: 700;
  letter-spacing: -.02em;
  font-variant-numeric: tabular-nums;
}
.card .s { margin-top: 3px; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }

/* 1줄 — 수익성 지표: 테두리·숫자를 accent 로 */
.card.primary { border-color: var(--accent); }
.card.primary .v { color: var(--accent); }

/* 2줄 — 규모: 성격이 달라 강조를 낮춘다 */
.card.scale { background: var(--panel-alt); }
.card.scale .v { font-size: 22px; color: var(--ink); }
.card.scale .k { font-weight: 600; }

#cards-scale { margin-top: -4px; }   /* 1줄과 붙여 한 묶음으로 보이게 */
```

**`k` / `v` / `s` 3단 구조가 카드 컴포넌트의 전부입니다.**

```
┌──────────────────────────┐
│ 세후 Project IRR         │  .k  12px muted      ← 무엇인가
│ 6.61%                    │  .v  26px 700 accent ← 값 (주인공)
│ NPV 64.9억 · 회수 19년   │  .s  12px muted      ← 맥락
└──────────────────────────┘
```

**`.s` 에 2~3개 보조 지표를 점(`·`)으로 이어 붙이는 게 정보 밀도의 비결입니다.**
IRR 카드 한 장에 IRR·NPV·회수기간이 다 들어가므로, 카드 9장이 필요했을 화면이 3장으로 끝납니다.

**강조 2단 (primary / scale) 이 중요합니다.** 같은 크기 카드 6장을 나란히 두면 무엇이 핵심인지 알 수 없습니다.

| | `.primary` (수익성) | `.scale` (규모) |
|---|---|---|
| 배경 | `--panel` (흰색) | `--panel-alt` (연회색) |
| 테두리 | `--accent` | `--line` |
| 값 크기 | 26px | 22px |
| 값 색 | `--accent` | `--ink` |

```js
const card = (cls, k, v, s) => el('div', { class: `card ${cls}` },
  el('div', { class: 'k', text: k }),
  el('div', { class: 'v', text: v }),
  el('div', { class: 's', text: s }));

/** 위 줄 — 수익성 지표 3종. 셋 다 같은 강조로 통일한다. */
export function renderCards(host, result) {
  const m = result.metrics;
  host.innerHTML = '';
  host.append(
    card('primary', '세전 Project IRR', pf(m.preTax.irr),  `NPV ${nf(m.preTax.npv)}억 · 회수 ${payf(m.preTax)}`),
    card('primary', '세후 Project IRR', pf(m.postTax.irr), `NPV ${nf(m.postTax.npv)}억 · 회수 ${payf(m.postTax)}`),
    card('primary', '출자자 IRR',       pf(m.equity.irr),  `NPV ${nf(m.equity.npv)}억 · 회수 ${payf(m.equity)}`));
}
```

> **설계 이력:** 처음에는 출자자 IRR 카드만 `.primary` 가 아니었습니다. 사용자가 "초록색 배경이 출자자 IRR에는 없는데 통일시켜줘"라고 요청했습니다.
> **교훈: 같은 종류의 지표는 같은 강조를 받아야 합니다.** 하나만 다르면 사용자는 "덜 중요한가?" 하고 의심합니다.

### 4.3 포매터 3종 — 모든 렌더러가 공유

```js
const nf = (v, d = 1) =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const pf = (v, d = 2) => (v == null || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(d)}%`);
const yf = (v) => (v == null ? '회수 불가' : `${v}년`);
```

**`null` / `NaN` / `Infinity` 를 전부 `'—'` 로 통일합니다.** 이걸 안 하면 화면에 `NaN%`, `Infinity년`, `undefined` 가 튀어나옵니다. IRR 은 **정상적으로 계산 불가**일 수 있으므로(부호 변화 없음) 반드시 필요합니다.

**`'—'`(em dash)를 쓰고 `'-'`(hyphen)이나 `'N/A'` 를 쓰지 않습니다.** 하이픈은 마이너스로 읽히고, `N/A` 는 폭을 차지합니다.

**의미가 있는 빈 값은 따로 문구를 줍니다:**

```js
/** 회수기간은 가격기준일부터 세므로 운영개시 후 경과를 괄호로 덧붙인다. */
const payf = (m) => {
  if (m.payback == null) return '회수 불가';          // '—' 아님 — 원인이 있다
  if (m.paybackFromCod == null) return `${m.payback}년`;
  return `${m.payback}년 (운영 후 ${m.paybackFromCod}년)`;
};
```

> **설계 이력:** 사용자가 "회수년이 20년이 넘고 23년도 있는데 상업운전기간이 20년인데 이상하지 않아?"라고 물었습니다. 계산은 맞았지만(기산점이 가격기준일) **표시가 오해를 불렀습니다.**
> **해결: 숫자를 바꾸지 않고 `(운영 후 14년)` 을 괄호로 덧붙였습니다.**
> **교훈: 숫자가 맞는데 오해를 산다면, 그건 디자인 결함입니다.**

### 4.4 차트 블록 — 범례 + SVG

```css
.chart-wrap { overflow-x: auto; padding: 4px 0; }
.chart-wrap svg { display: block; min-width: 640px; }

.legend {
  display: flex; gap: 14px; flex-wrap: wrap;
  margin: 4px 0 10px;
  font-size: 12px; color: var(--ink-2);
}
.legend i {
  display: inline-block;
  width: 10px; height: 10px;
  border-radius: 2px;
  margin-right: 5px;
  vertical-align: -1px;
}
```

**범례를 SVG 밖 HTML로 뺍니다.** SVG 안에 넣으면 `flex-wrap` 이 안 되어 좁은 화면에서 잘립니다. 색 칩은 `<i>` 에 `style.background` 를 직접 넣습니다 — 색이 데이터(`CHART_COLORS`)에서 오므로 CSS 클래스로 만들 수 없습니다.

```js
function legendItem(color, label) {
  const box = el('i', {});
  box.style.background = color;
  return el('span', {}, box, document.createTextNode(label));
}

export function renderChart(host, result) {
  host.innerHTML = '';
  const legend = el('div', { class: 'legend' },
    legendItem(CHART_COLORS.revenue, '매출 (위쪽 막대)'),
    legendItem(CHART_COLORS.capex, '투자비 (아래쪽)'),
    legendItem(CHART_COLORS.opex, '운영비 (아래쪽)'),
    legendItem(CHART_COLORS.cumulative, '누적 세후 현금흐름 · 오른쪽 축'),
    legendItem(CHART_COLORS.breakeven, '손익분기 시점'),
    legendItem(PHASE_COLORS.development.ribbon, '사업준비'),
    legendItem(PHASE_COLORS.construction.ribbon, '건설'),
    legendItem(PHASE_COLORS.operation.ribbon, '운영'));
  const wrap = el('div', { class: 'chart-wrap' });
  wrap.innerHTML = cashflowChartSvg(result.years);   // 문자열을 그대로 주입
  host.append(legend, wrap);
}
```

### 4.5 현금흐름 차트 — SVG 설계

```js
const W = 940, H = 360, RIBBON = 20;
const M = { top: 16, right: 70, bottom: 52, left: 68 };
```

**마진 수치의 근거** — 각각 이유가 있습니다.

| 마진 | 값 | 왜 |
|---|---|---|
| `left: 68` | 68px | `1,234` + 단위 여백. 억원 단위 4자리를 받는다 |
| `right: 70` | 70px | 오른쪽 축(누적) 라벨 + `누적` 글자 |
| `bottom: 52` | 52px | 단계 띠 20px + 간격 6px + 연도 라벨 ~14px + 여유 |
| `top: 16` | 16px | 최상단 막대가 잘리지 않을 최소값 |

**구조 — 위아래 양방향 막대 + 오른쪽 축 꺾은선:**

```
  억원 ↑
  1,500 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄   ← 점선 눈금 (2 4)
        │         ▐▐▐▐▐▐▐▐▐▐▐▐▐      매출 (초록 #2f8f6b)
      0 ├────────────────────────────   ← 영점선 1.2px (#4a5462)
        │  █████                       투자비 (회색 #7b8794)
   -500 ┄┄┄┄┄▒▒▒┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄   운영비 (주황 #d98324)
        └────────────────────────────
        ▓▓▓▓▓│░░░░░│▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒   ← 단계 띠 (높이 20px)
        사업준비3년 건설2년  운영21년
        2025   2028  2030        2050
```

**핵심 설계 결정 6개**

**(1) 영점을 데이터에 맞춰 움직입니다.**

```js
const barTop    = Math.max(1, ...bars.map((b) => b.up));
const barBottom = Math.max(1, ...bars.map((b) => b.capex + b.opex));
const zeroY = M.top + (ih * barTop) / (barTop + barBottom);
```

위아래를 같은 스케일로 쓰지 않고, **각각 자기 최대값에 맞춰 정규화**합니다. 매출 1,500억 / 투자비 900억이면 영점이 중앙이 아니라 위쪽 62% 지점에 옵니다. 양쪽 막대가 모두 잘 보입니다.

**(2) 막대 폭 = 슬롯의 66%**

```js
const slot = iw / bars.length;
const bw = Math.max(3, slot * 0.66);   /* 최소 3px 보장 */
```

26년짜리 모델에서 슬롯은 ~31px, 막대는 ~20px. **`Math.max(3, …)` 가 없으면 50년 모델에서 막대가 사라집니다.**

**(3) 눈금은 "보기 좋은 값"으로 끊습니다 (1·2·5 × 10ⁿ)**

```js
function niceStep(range, targetCount) {
  const raw = range / Math.max(1, targetCount);
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}
```

`range/3` 을 그냥 쓰면 `477`, `954` 같은 눈금이 나옵니다. 이 함수가 `500`, `1000` 으로 만듭니다. **모든 차트에 재사용할 수 있는 20줄짜리 유틸입니다.**

**(4) 단계 구분을 2중으로 표현합니다 — 배경 음영 + 아래 띠**

```js
const PHASES = {
  development:  { label: '사업준비', band: '#F2F5F8', ribbon: '#DFE5EB', text: '#4A5462' },
  construction: { label: '건설',     band: '#E6EBF0', ribbon: '#C6D0D9', text: '#2C343D' },
  operation:    { label: '운영',     band: '#FFFFFF', ribbon: '#DCEDE4', text: '#0F6B4A' },
};
```

`band`(배경, 연하게) + `ribbon`(띠, 진하게) + `text`(글자) 3색 세트입니다.
**운영 단계의 `band` 가 `#FFFFFF` 인 건 의도적입니다** — 건너뛰어서 가장 긴 구간에 배경색을 칠하지 않습니다(차트가 탁해짐).

```js
for (const seg of segments) {
  const def = PHASES[seg.phase];
  if (!def || def.band === '#FFFFFF') continue;   /* 흰색이면 그리지 않는다 */
  /* … rect … */
}
```

> **설계 이력:** 원래는 배경 음영 위에 단계 이름을 직접 올렸습니다. 사용자가 **"건설기간이랑 사업준비기간이 분리 안 돼 있고, 운영기간은 막대차트에 가려서 잘 보이지 않음 — 밑에 내리는 것도 방법"** 이라고 지적했습니다.
> **해결: 색은 배경에, 글씨는 그래프 아래 별도 띠로 분리.**
> **교훈: 차트 영역에 텍스트를 올리면 데이터에 가립니다. 축 밖으로 빼세요.**

**(5) 좁은 띠는 글씨를 생략하고 툴팁으로만 남깁니다**

```js
if (w >= 46) {
  p.push(`<text … text-anchor="middle">${def.label} ${span}년</text>`);
}
// 폭에 관계없이 툴팁은 항상 있다
p.push(`<rect …><title>${esc(`${def.label} ${from}~${to} (${span}년)`)}</title></rect>`);
```

**46px 이 임계값입니다** (`사업준비 3년` = 11px × 7자 ≈ 46px). 삐져나온 글씨보다 없는 게 낫습니다.

**(6) 툴팁은 SVG 기본 `<title>` 로 — 라이브러리 없이**

```js
const tip = `${b.year}년 · 매출 ${b.up.toFixed(1)} · 투자비 ${b.capex.toFixed(1)} · 운영비 ${b.opex.toFixed(1)} · 누적 ${cum[i].toFixed(1)} (억원)`;
p.push(`<rect …><title>${esc(tip)}</title></rect>`);
```

**한 해의 3개 막대에 같은 툴팁을 넣습니다.** 어느 막대에 올려도 그 해의 전체 정보가 보입니다. 막대별로 다른 툴팁을 주면 사용자가 3번 올려봐야 합니다.

**⚠ `esc()` 를 직접 해야 합니다** — SVG 문자열을 만들고 있으므로 브라우저가 이스케이프해주지 않습니다.

```js
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
```

**(7) 연도 라벨은 선택적으로 — 겹침 방지**

```js
const boundaries = new Set(segments.map((sg) => sg.from));
bars.forEach((b, i) => {
  if (!(i === 0 || i === bars.length - 1 || boundaries.has(i) || b.year % 5 === 0)) return;
  /* … text … */
});
```

**처음 · 끝 · 단계 경계 · 5년 배수**만 표시합니다. 26개를 다 쓰면 겹쳐서 읽을 수 없습니다.

**(8) 접근성**

```js
`<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="연도별 현금흐름 차트">`
```

`viewBox` + `width="100%"` 로 반응형, `role="img"` + `aria-label` 로 스크린리더 대응.

### 4.6 산출 근거 표 (`.kv`) — 2칼럼 수직 나열

```css
.kv { width: 100%; min-width: 0; }                /* ★ min-width 해제 */
.kv th {
  text-align: left;
  color: var(--ink-2);
  font-weight: 500;
  white-space: normal;                             /* ★ 줄바꿈 허용 */
}
.kv td { font-weight: 600; }
```

**기본 `table` 규칙을 2개 뒤집습니다.**
1. `min-width: 0` — 2칼럼이라 720px이 필요 없습니다. 좁은 화면에서 스크롤이 생기면 안 됩니다.
2. `white-space: normal` — 라벨이 길어서(`적용 판매단가 (SMP + REC × 가중치)`) 줄바꿈이 필요합니다.

**계층은 전각 공백(`　`, U+3000)으로 표현합니다:**

```js
const rows = [
  ['A. 총사업비', `${nf(d.totalProjectCost, 2)} 억원`],
  ['C. 건설이자', `${nf(d.idc, 2)} 억원`],
  ['D. 총투자비', `${nf(d.totalInvestment, 2)} 억원`],
  ['자기자본', `${nf(d.equityAmount, 2)} 억원`],
  ...d.tranches.map((tr) => [`　${tr.label}`, `${nf(tr.amount, 2)} 억원 @ ${pf(tr.rate, 2)}`]),  // ← 들여쓰기
  ['WACC (Project NPV 할인율)', pf(d.wacc, 3)],
  /* … */
  ['모델 기간', `${d.baseYear} ~ ${d.operationEndDate.slice(0, 4)} (${d.modelYears}년)`],
  ['　개발 · 건설', …],   // ← 들여쓰기
  ['　운영', …],          // ← 들여쓰기
];
```

`padding-left` 클래스를 따로 만들 수도 있지만, **데이터가 `[라벨, 값]` 2요소 배열이라 단순함이 유지됩니다.** 행 수가 가변(트랜치 개수)일 때 특히 편합니다.

**자릿수를 표마다 다르게 줍니다:**

```js
['A. 총사업비',       nf(d.totalProjectCost, 2)],   // 근거표 = 2자리 (검산용)
['운영기간 누적 매출', nf(t.revenue, 1)],            // 합계 = 1자리
['설비용량',          nf(d.capacityMw, 0)],         // 정수
['WACC',             pf(d.wacc, 3)],               // 비율 = 3자리 (4.575%)
```

**"산출 근거"는 검산하는 표이므로 자릿수를 후하게, 카드는 읽는 값이므로 인색하게.**

**마지막 행에 해설을 넣습니다:**

```js
['회수기간 기산점', `가격기준일 ${d.baseYear}년 — 개발·건설 기간이 포함되므로 운영기간(20년)보다 클 수 있습니다`],
```

표 안에 문장을 넣는 건 보통 나쁘지만, **오해가 반복되는 지점에는 그 자리에 설명을 두는 게 맞습니다.** 별도 각주는 아무도 읽지 않습니다.

### 4.7 경고 블록

```css
#warnings {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--warn-bg);    /* #fff5e6 — 연한 주황 */
  color: var(--warn-ink);        /* #8a4b08 — 진한 갈색 */
  font-size: 13px;
}
#warnings ul { margin: 0; padding-left: 18px; }
```

```js
export function renderWarnings(host, result) {
  const warnings = result.warnings || [];
  host.innerHTML = '';
  host.hidden = warnings.length === 0;      /* ★ 비면 숨긴다 */
  if (!warnings.length) return;
  const ul = el('ul', {});
  for (const w of warnings) ul.append(el('li', { text: w }));
  host.append(ul);
}
```

**`host.hidden = warnings.length === 0` 한 줄이 중요합니다.** 빈 경고 상자가 남아 있으면 여백이 생겨 레이아웃이 흔들립니다.

**빨강(`--danger`)이 아니라 주황(`--warn-bg`)입니다.** 계산은 됐고 "확인하세요" 수준이므로. 빨강은 계산 실패(`catch`)에만 씁니다.

### 4.8 연도별 상세 표 — 16~17칼럼

```js
const hasSponsor = result.years.some((y) => Math.abs(y.sponsorFlow || 0) > 1e-9);
const head = ['연도', '가동', '매출', '운영비', '감가상각', '영업이익', '이자', '법인세', '당기순이익',
              '투자비', '세전 CF', '세후 CF', '배당',
              ...(hasSponsor ? ['출자자기타'] : []),    /* ★ 조건부 칼럼 */
              '차입잔액', 'DSCR'];
```

**값이 전부 0인 칼럼은 아예 만들지 않습니다.** 17칼럼 표에서 빈 칼럼 하나는 순수한 소음입니다.

```css
tr.op-row td:first-child { color: var(--accent); font-weight: 600; }   /* 운영연도 강조 */
td.neg { color: var(--neg); }                                          /* 음수 */
```

```js
tbody.append(el('tr', { class: y.opFraction > 0 ? 'op-row' : '' }, ...cells));

function numCell(v) {
  return el('td', { class: v < 0 ? 'neg' : '', text: nf(v) });
}
```

**행 전체를 칠하지 않고 첫 칼럼(연도)만 칠합니다.** 21개 운영연도 전체를 칠하면 표가 초록 덩어리가 됩니다. 왼쪽 끝 색만으로 "여기부터 운영"이 충분히 읽힙니다.

**음수는 색으로만 표시하고 괄호(`(123)`)를 쓰지 않습니다.** `#,##0.0;[Red]-#,##0.0` 서식과 일관되고, `tabular-nums` 와 함께 자릿수가 맞습니다.

---

## 5. 민감도 탭 해부

### 5.1 구조 — 한 패널 안 4블록

```
#panel-sensitivity > .panel "민감도 분석" > .panel-body > #sensitivity
  │
  ├─ .toolbar                         [표시 지표 ▾] [변동폭 ±%] [목표 IRR %]  주석
  ├─ .subtotal.strong  "변수별 영향 크기 — 세후 Project IRR"
  ├─ .chart-wrap > svg                토네이도
  ├─ .subtotal.strong  "민감도 매트릭스 — 세후 Project IRR"
  ├─ .hint-block                      읽는 법 (작은 주석)
  ├─ .table-wrap > table.matrix       6변수 × 5단계, 2줄 셀, 히트맵
  ├─ .subtotal.strong  "목표 IRR 7.00% 달성 임계값"
  ├─ .callout-sm                      ⚠ AND 아님 경고
  └─ .table-wrap > table.matrix       임계값 3칼럼
```

**순서가 "넓게 → 좁게" 입니다.**
1. **토네이도** — 무엇이 제일 위험한지 한 장으로 (개요)
2. **매트릭스** — 정확히 몇 %인지 (상세)
3. **임계값** — 어디까지 버티는지 (판단)

### 5.2 도구 막대 (`.toolbar`)

```css
.toolbar {
  display: flex;
  align-items: flex-end;      /* ★ 라벨 높이가 달라도 입력칸 밑선이 맞는다 */
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.toolbar .field { margin-bottom: 0; min-width: 150px; }
.toolbar .note { color: var(--muted); font-size: 12px; padding-bottom: 12px; }
```

**`align-items: flex-end` 가 핵심입니다.** `.field` 는 `라벨 + 입력칸` 2단인데, 라벨 길이가 달라 `stretch` 나 `center` 로는 입력칸 밑선이 어긋납니다.

**`.note` 에 `padding-bottom: 12px`** — 주석을 입력칸 밑선에 맞추는 수동 보정입니다. `baseline` 정렬로는 안 됩니다.

컨트롤 3개의 역할:

| 컨트롤 | 타입 | `step` | 역할 |
|---|---|---|---|
| 표시 지표 | `select` (6개) | — | **표 전체를 갈아끼운다** (재계산 없음) |
| 변동폭 | `number` | 5 | ±% 범위 → 재계산 |
| 목표 IRR | `number` | 0.5 | 임계값 기준 → 재계산 |

```js
// 지표 변경 = 이미 계산된 값을 다시 그리기만 → 즉시
onMetricChange: (id) => { sensState.metricId = id; renderSensitivityTab(); },
// 범위/목표 변경 = 재계산 필요 → 디바운스
onRangeChange:  (v)  => { sensState.rangePct = v; scheduleSensitivity(); },
onTargetChange: (v)  => { sensState.targetIrr = v; scheduleSensitivity(); },
```

**재계산이 필요한 입력만 디바운스합니다.** 지표 select 를 디바운스하면 느리게 느껴집니다.

**비율 입력은 사용자 단위(%)로 받고 내부는 소수로 저장합니다:**

```js
const targetInput = el('input', {
  type: 'number', step: '0.5',
  value: String(Number((state.targetIrr * 100).toFixed(2))),     // 0.07 → "7"
  oninput: () => { const v = Number(targetInput.value); if (Number.isFinite(v)) handlers.onTargetChange(v / 100); },
});
```

`String(Number(x.toFixed(2)))` 가 `"7.00"` 이 아니라 `"7"` 을 만듭니다. **입력칸에 불필요한 `.00` 이 보이면 지우고 다시 치게 됩니다.**

### 5.3 매트릭스 표 — 2줄 셀 + 히트맵

```css
table.matrix { min-width: 560px; }
table.matrix td.cell { font-weight: 600; padding: 5px 8px; line-height: 1.3; }
table.matrix td.base { outline: 2px solid var(--line-strong); outline-offset: -2px; }  /* 기준열 */
table.matrix td.na { color: var(--muted); font-weight: 400; }                          /* 계산 불가 */
table.matrix th.var { text-align: left; white-space: nowrap; }
table.matrix .basev { display: block; font-size: 11px; font-weight: 400; color: var(--muted); }

/* 2줄 셀 */
.cell-main { display: block; font-weight: 700; font-size: 13.5px; }
.cell-sub  { display: block; font-size: 11px; font-weight: 500; color: var(--muted); margin-top: 1px; }
table.matrix td.base .cell-sub { color: var(--ink-2); }   /* 기준열은 보조값도 진하게 */
```

**히트맵 5단계:**

```css
.heat-5 { background: #d7ede2; }   /* 매우 좋음 — 진한 초록 */
.heat-4 { background: #e9f4ee; }   /* 좋음     — 연한 초록 */
.heat-3 { background: transparent; }/* 보통     — ★ 색 없음 */
.heat-2 { background: #fdeceb; }   /* 나쁨     — 연한 빨강 */
.heat-1 { background: #f9d9d6; }   /* 매우 나쁨 — 진한 빨강 */
```

**`.heat-3` 이 `transparent` 인 게 의도적입니다.** 5단계 전부에 색을 칠하면 표가 알록달록해져서 **극단값이 눈에 안 들어옵니다.** 중간은 비워두고 양극단만 칠해야 "어디가 위험한지"가 즉시 보입니다.

**임계값을 기준값의 8%로 정규화합니다:**

```js
export function heatClass(value, base, higherIsBetter) {
  if (value == null || base == null || !Number.isFinite(value) || !Number.isFinite(base)) return '';
  const diff = (value - base) * (higherIsBetter ? 1 : -1);     /* ★ 방향 보정 */
  const scale = Math.abs(base) > 1e-9 ? Math.abs(base) * 0.08 : 1;
  if (diff >  scale)        return 'heat-5';
  if (diff >  scale * 0.25) return 'heat-4';
  if (diff < -scale)        return 'heat-1';
  if (diff < -scale * 0.25) return 'heat-2';
  return 'heat-3';
}
```

설계 포인트 3개:
1. **상대 스케일** — 절대값(예: `±1%p`)으로 하면 IRR(6.6%)과 NPV(64억)에 같은 기준을 쓸 수 없습니다. **기준값의 8%** 는 지표 종류와 무관하게 동작합니다.
2. **`higherIsBetter` 로 방향을 뒤집습니다.** 회수기간은 작을수록 좋으므로 `SENSITIVITY_METRICS` 에서 `higherIsBetter: false` 를 줍니다. **이 플래그가 없으면 회수기간이 늘어난 칸이 초록색이 됩니다.**
3. **`0.25 × scale` 로 내부 구간** — 2%~8% 변화는 연한 색, 8% 초과는 진한 색.

**2줄 셀 — 이 표의 가장 중요한 디자인 결정**

```js
// 지표값(굵게) 아래에 그 변수가 실제로 얼마인지 함께 보여준다.
// "이용률 −10% 일 때 세후 IRR 5.37%" 만으로는 이용률이 몇 %인지 알 수 없다.
return el('td', {
  class: `cell ${c.isBase ? 'base' : heatClass(v, baseValue, metric.higherIsBetter)}${v == null ? ' na' : ''}`,
  title: `${row.label} ${row.format(c.value)} → ${metric.label} ${v == null ? '—' : metric.fmt(v)}`,
},
  el('span', { class: 'cell-main', text: v == null ? '—' : metric.fmt(v) }),    /* 지표값 */
  el('span', { class: 'cell-sub',  text: row.format(c.value) }));               /* 변수 실제값 */
```

```
        │  -20%   │  -10%   │  기준   │  +10%   │  +20%
이용률  │ 4.21%   │ 5.37%   │ 6.61%   │ 7.78%   │ 8.89%    ← .cell-main 13.5px 700
기준 28%│ 22.4%   │ 25.2%   │ 28.0%   │ 30.8%   │ 33.6%    ← .cell-sub  11px muted
```

**"−10%" 만으로는 실무에서 쓸 수 없습니다.** 이용률이 25.2%라는 걸 알아야 "그게 P90이네"라고 판단합니다.
행 머리에도 기준값을 함께 넣습니다:

```js
el('th', { class: 'var' },
  el('span', { text: row.label }),
  el('span', { class: 'basev', text: `기준 ${row.format(row.baseValue)}` })),
```

**기준 열 표시에 `outline` 을 쓰고 `border` 를 쓰지 않습니다:**

```css
table.matrix td.base { outline: 2px solid var(--line-strong); outline-offset: -2px; }
```

`border` 는 레이아웃 공간을 차지해서 **그 열만 2px 넓어집니다**(열 정렬이 깨짐). `outline` 은 공간을 차지하지 않고, `offset: -2px` 로 셀 안쪽에 그려 인접 셀과 겹치지 않습니다.

**`format` 함수를 데이터가 들고 있습니다:**

```js
// sensitivity.js — 변수 정의에 포매터가 포함된다
{ id: 'capacityFactor', label: '이용률', format: (v) => `${(v * 100).toFixed(1)}%` },
{ id: 'capex',          label: '총사업비', format: (v) => `${v.toFixed(0)} 억원` },
{ id: 'debtRate',       label: '차입 금리', format: (v) => `${(v * 100).toFixed(2)}%` },
```

뷰는 `row.format(c.value)` 만 호출합니다. **변수를 추가해도 뷰 코드는 그대로입니다.**

### 5.4 임계값(Breakeven) 표 + 경고 콜아웃

```css
.be-ok { color: var(--pos); font-weight: 600; }
.be-no { color: var(--neg); font-weight: 600; }

.callout-sm {
  margin: 2px 0 10px;
  padding: 9px 12px;
  border-left: 3px solid var(--line-strong);   /* ★ 왼쪽 선만 */
  border-radius: 0 6px 6px 0;                  /* ★ 오른쪽만 둥글게 */
  background: var(--panel-alt);
  color: var(--ink-2);
  font-size: 12.5px;
  line-height: 1.6;
}
.callout-sm strong { color: var(--ink); }
```

**왼쪽 선만 + 오른쪽만 둥근 모서리** = 인용/주의 블록의 전형입니다. 4면을 다 감싸면 또 하나의 카드가 되어 정보 위계가 평평해집니다.

```js
host.append(
  sectionTitle(`목표 IRR ${pf(state.targetIrr)} 달성 임계값`),
  el('div', { class: 'callout-sm' },
    el('strong', { text: '읽는 법 — 각 줄은 "그 변수 하나만" 움직였을 때의 조건입니다. ' }),
    document.createTextNode('나머지 변수가 모두 현재값 그대로일 때, 어느 한 줄만 충족하면 목표 IRR 에 도달합니다(AND 아님). 반대로 두 변수가 동시에 나빠지면 각 줄의 조건을 따로 만족해도 목표에 미달할 수 있습니다. 여러 변수를 함께 움직인 결과는 시나리오 탭에서 확인하세요.')),
  /* … 표 … */);
```

**이 콜아웃이 디자인 관점에서 가장 중요한 요소일 수 있습니다.**

민감도 표는 **오해하기 쉬운 정보**입니다. 사용자는 6줄을 보고 "6개 조건을 다 맞춰야 하나?"(AND) 또는 "하나만 맞추면 되나?"(OR) 를 구분할 수 없습니다. 정답은 OR이고, **동시에 나빠지면 각 조건을 따로 만족해도 미달**입니다.

**표 자체로는 전달할 수 없으니 문장으로 적고, 시나리오 탭으로 유도합니다.**
`<strong>` 으로 첫 문장만 진하게 하여 훑어도 요지가 잡히게 합니다.

**3상태 셀:**

```js
let cell;
if (b.value == null) {
  cell = el('td', { class: b.achievedAtBase ? 'be-ok' : 'be-no',
    text: b.achievedAtBase ? '이 변수로는 미달 없음' : '이 변수만으로는 달성 불가' });
} else {
  cell = el('td', { class: 'be-ok', text: `${b.format(b.value)} ${b.direction === 'up' ? '이상' : '이하'}` });
}
```

| 상태 | 표시 | 색 |
|---|---|---|
| 임계값 있음 | `25.2% 이상` | `.be-ok` 초록 |
| 이미 달성 (범위 내 미달 없음) | `이 변수로는 미달 없음` | `.be-ok` 초록 |
| 달성 불가 | `이 변수만으로는 달성 불가` | `.be-no` 빨강 |

**`'—'` 로 뭉개지 않고 3가지를 구분합니다.** "달성 불가"와 "미달 없음"은 정반대 의미인데 둘 다 `value == null` 입니다.

**`이상`/`이하` 를 붙이는 것도 필수입니다.** `25.2%` 만 쓰면 그 위가 좋은지 아래가 좋은지 모릅니다.

### 5.5 토네이도 차트

```js
const W = 760, rowH = 34;
const M = { top: 26, right: 64, bottom: 22, left: 92 };
```

```
                    기준 6.61%
                         ┊
        이용률  ████████████████████      ← 영향 큰 순서로 정렬
               4.2      ┊      8.9
      총사업비   ██████████████
               5.1      ┊      8.1
      차입 금리     ██████████
               5.8      ┊      7.4
                         ┊
                        세후 Project IRR (%)
```

**설계 결정 5개**

**(1) 영향 크기 순으로 정렬 — 이게 토네이도의 존재 이유**

```js
const bands = usable
  .map((r) => {
    const irrs = r.cells.map((c) => c.postTaxIrr).filter((v) => v != null);
    return { label: r.label, lo: Math.min(...irrs), hi: Math.max(...irrs) };
  })
  .sort((a, b) => (b.hi - b.lo) - (a.hi - a.lo));      /* 폭 넓은 순 */
```

정렬하지 않으면 그냥 막대 차트입니다. **"위에서부터 조심할 것"** 이 이 차트의 메시지입니다.

**(2) 기준선을 중심으로 좌우 분할 — 색으로 방향 표시**

```js
const bx = X(baseIrr);
// 왼쪽(나쁨) = 빨강
parts.push(`<rect x="${Math.min(xl, bx)}" … fill="${PALETTE.breakeven}" opacity=".78">`);
// 오른쪽(좋음) = 초록
parts.push(`<rect x="${bx}" width="${Math.max(0, xh - bx)}" … fill="${PALETTE.revenue}" opacity=".78">`);
```

**`Math.min(xl, bx)` / `Math.max(0, xh - bx)`** 로 기준선이 밴드 밖에 있는 경우(한쪽으로만 움직이는 변수)를 방어합니다. 이걸 빼면 음수 `width` 로 SVG 가 렌더링되지 않습니다.

**`opacity: .78`** — 불투명하면 기준선 점선이 막대에 가립니다.

**(3) 높이를 데이터로 계산**

```js
const usable = rows.filter((r) => r.cells.some((c) => c.postTaxIrr != null));
const H = M.top + M.bottom + Math.max(1, usable.length) * rowH;
```

변수 수가 바뀌면 높이가 따라갑니다. `Math.max(1, …)` 로 0개일 때 음수 높이를 방어합니다.

**(4) 축 범위에 12% 패딩**

```js
const pad = (hi - lo) * 0.12 || 0.01;     /* ★ || 0.01 — 전부 같은 값일 때 */
const x0 = lo - pad, x1 = hi + pad;
```

패딩이 없으면 최대/최소 막대가 차트 끝에 딱 붙어 잘려 보입니다. `|| 0.01` 은 `hi === lo` 일 때 `pad = 0` 이 되어 `x1 - x0 === 0` 으로 **0 나누기**가 되는 걸 막습니다.

**(5) 값 라벨을 막대 양끝 밖에 둡니다**

```js
parts.push(`<text x="${(xl - 6)}" … text-anchor="end">${(b.lo * 100).toFixed(1)}</text>`);   /* 왼쪽 밖 */
parts.push(`<text x="${(xh + 6)}" …>${(b.hi * 100).toFixed(1)}</text>`);                     /* 오른쪽 밖 */
```

막대 안에 넣으면 짧은 막대에서 글씨가 삐져나옵니다. `right: 64` 마진이 오른쪽 라벨 자리입니다.

**빈 데이터 방어 — 모든 차트 함수의 첫 줄:**

```js
if (!usable.length) return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}"></svg>`;
```

`null` 이나 `''` 를 반환하지 않고 **빈 SVG** 를 반환합니다. 레이아웃이 무너지지 않고, `innerHTML = ''` 로 인한 깜빡임도 없습니다.

### 5.6 작은 주석 (`.hint-block`)

```css
.hint-block {
  margin: 2px 0 8px;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--muted);
}
```

`.callout-sm` 과 용도가 다릅니다.

| | `.hint-block` | `.callout-sm` |
|---|---|---|
| 크기 | 11.5px | 12.5px |
| 배경 | 없음 | `--panel-alt` |
| 테두리 | 없음 | 왼쪽 3px |
| 용도 | **읽는 법** (표 설명) | **오해 방지 경고** |

**주석에도 위계가 필요합니다.** 전부 같은 스타일이면 중요한 경고가 묻힙니다.

---

## 6. 시나리오 탭 해부

### 6.1 구조 — 단일 표, 행 4종

```
#panel-scenario > .panel "시나리오 비교" > .panel-body > #scenario
  └─ .table-wrap > table.scenario
       thead  │ 구분        │ 기본   │ 낙관   │ 비관   │
       ──────────────────────────────────────────────────
       tr.group-head │ 가정 — 값을 바꾸면 즉시 다시 계산됩니다  │ ← colSpan
       tr            │ 이용률 변동 (%)    │[ 0.0]│[ 5.0]│[-5.0]│ ← input
       tr            │ 판매단가 (원/kWh)  │[178.4]│[190.0]│[165.0]│
       tr            │ 총사업비 (억원)    │[1393]│[1300]│[1500]│
       tr            │ 차입 금리 가감(%p) │[0.00]│[-0.25]│[0.50]│
       tr.derived    │ → 적용 이용률      │ 28.0%│ 29.4%│ 26.6%│ ← 읽기전용 되짚기
       ──────────────────────────────────────────────────
       tr.group-head │ 결과                                    │
       tr            │ 세전 Project IRR   │ 6.92%│ 8.14%│ 5.61%│ ← win/lose 색
       tr            │ …                                       │
```

**열 = 시나리오, 행 = 항목.** 반대로 하면(행=시나리오) 시나리오가 늘어날 때 세로로 길어져 비교가 어렵습니다. **비교 대상은 가로로 나란히** 둬야 합니다.

### 6.2 표 스타일 — 입력 가능한 표

```css
table.scenario { min-width: 520px; }

/* 머리 = 시나리오 이름이므로 진하게 (기본 표는 muted) */
table.scenario thead th { font-size: 13px; color: var(--ink); text-align: right; }
table.scenario thead th:first-child { text-align: left; }

/* 구역 머리 — 가정 / 결과 */
table.scenario tr.group-head td {
  background: var(--panel-alt);
  color: var(--muted);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: .05em;
  text-align: left;
}

/* 표 안의 입력칸 — 일반 입력칸(44px)보다 작게 */
table.scenario td input {
  min-height: 36px;        /* ★ 44px 아님 */
  padding: 4px 6px;
  text-align: right;       /* 숫자니까 우측 */
  font-size: 13px;
}

/* 결과 숫자 — 굵고 크게 */
table.scenario td.metric { font-weight: 700; font-size: 14px; }

/* 되짚기 행 — 입력도 결과도 아니므로 둘 사이에서 조용히 */
table.scenario tr.derived th,
table.scenario tr.derived td { color: var(--muted); font-weight: 500; font-size: 13px; padding-top: 2px; }
table.scenario tr.derived td.metric { font-weight: 500; font-size: 13px; }

/* 최고/최저 */
table.scenario .win  { color: var(--pos); }
table.scenario .lose { color: var(--neg); }
```

**`min-height: 36px` — 44px 규칙의 유일한 예외**

전역 규칙은 44px(터치 타깃)인데 여기만 36px입니다. 이유:
1. 표 안에 4행 × 3~4열 = 12~16개 입력칸이 들어갑니다. 44px이면 표가 세로로 너무 길어져 **결과 행이 화면 밖으로 나갑니다** — 입력과 결과를 동시에 봐야 하는데 그게 깨집니다.
2. 표 셀은 주변에 여백이 있어 실제 탭 가능 영역이 36px보다 큽니다.

**이런 예외는 반드시 이유와 함께 기록하세요.** 안 그러면 다음 사람이 "버그인가?" 하고 44px로 되돌립니다.

**그룹 머리 (`colSpan`):**

```js
const cols = cases.length;
const groupRow = (title) => el('tr', { class: 'group-head' }, el('td', { colSpan: cols + 1, text: title }));

tbody.append(groupRow('가정 — 값을 바꾸면 즉시 다시 계산됩니다'));
/* … 가정 4줄 + 되짚기 1줄 … */
tbody.append(groupRow('결과'));
/* … 결과 8줄 … */
```

**제목에 동작 설명을 넣습니다** — "값을 바꾸면 즉시 다시 계산됩니다". 표 안에 입력칸이 있다는 걸 사용자가 모를 수 있습니다.

### 6.3 가정 행 — 단위를 실무 단위로 받는다

```js
/**
 * 가정 한 줄. 단위가 변수마다 다르므로 소수 자릿수도 따로 받는다
 * (억원을 소수 셋째 자리까지 보여 줄 이유가 없다).
 */
function assumptionRow(label, scenarios, get, set, handlers, step, digits = 3) {
  const tds = scenarios.map((sc) => {
    const input = el('input', {
      type: 'number', step: String(step),
      value: String(Number(get(sc).toFixed(digits))),
      oninput: () => {
        const v = Number(input.value);
        if (!Number.isFinite(v)) return;
        set(sc, v);
        handlers.onScenarioChange();
      },
    });
    return el('td', {}, input);
  });
  return el('tr', {}, el('th', { text: label }), ...tds);
}
```

**`step` 과 `digits` 를 변수마다 다르게 줍니다:**

```js
assumptionRow('이용률 변동 (%)',    scenarios, (sc) => (sc.capacityFactorDelta || 0) * 100,
                                              (sc, v) => { sc.capacityFactorDelta = v / 100; }, handlers, 1,   1);
assumptionRow('판매단가 (원/kWh)',  scenarios, (sc) => sc.tariff ?? 0,
                                              (sc, v) => { sc.tariff = v; },                     handlers, 1,   1);
assumptionRow('총사업비 (억원)',    scenarios, (sc) => sc.capexTotal ?? 0,
                                              (sc, v) => { sc.capexTotal = v; },                 handlers, 10,  0);
assumptionRow('차입 금리 가감 (%p)', scenarios, (sc) => (sc.debtRate || 0) * 100,
                                              (sc, v) => { sc.debtRate = v / 100; },             handlers, 0.1, 2);
```

| 변수 | 단위 | `step` | `digits` | 왜 |
|---|---|---|---|---|
| 이용률 변동 | % | 1 | 1 | 1%p 단위로 흔든다 |
| 판매단가 | 원/kWh | 1 | 1 | **협상 단위가 원/kWh** |
| 총사업비 | 억원 | **10** | **0** | 10억 단위. 소수점 무의미 |
| 차입 금리 | %p | **0.1** | **2** | 0.1%p 단위. 4.575% 표시 필요 |

**총사업비를 `step: 1`(1억)로 두면 스피너를 140번 눌러야 합니다. `digits: 3`(1393.000)이면 표가 넓어지고 읽기 어렵습니다.**

> **설계 이력:** 이 단위 선택은 `tests/scenario-contract.test.mjs` 가 **계약으로 잠그고 있습니다.**
> ```js
> /*
>  * 변수마다 실무에서 쓰는 단위가 다르다. 그 단위가 화면에서 바뀌면
>  * 사용자가 넣은 숫자의 뜻이 달라지므로, 라벨과 단위를 계약으로 고정한다.
>  *   · 이용률   — 기본 입력값 대비 **변동률(%)**
>  *   · 판매단가 — SMP·REC 를 합친 **적용단가(원/kWh)** 한 칸
>  *   · 총사업비 — **억원 금액** 그대로
>  */
> ```
> **단위는 디자인이자 계약입니다.** 누군가 "판매단가를 SMP/REC 두 칸으로 나누자"고 하면 사용자가 넣은 과거 숫자의 뜻이 달라집니다.

### 6.4 되짚기 행 (`tr.derived`) — 3번째 행 종류

```js
// 변동률만으로는 실제 이용률이 얼마인지 안 보인다. 결과값을 함께 보여 준다.
tbody.append(el('tr', { class: 'derived' }, el('th', { text: '→ 적용 이용률' }),
  ...cases.map((c) => el('td', { class: 'metric', text: pf(c.capacityFactor) }))));
```

**`이용률 변동 +5%` 를 넣으면 실제 이용률이 29.4%** 입니다. 변동률만 보이면 "그게 몇 %지?"를 매번 계산해야 합니다.

라벨에 **`→`** 를 붙여 "위 입력의 결과"임을 표시하고, 스타일은 입력 행과 결과 행의 중간(muted, 500)으로 둡니다.

```css
/*
 * 변동률로 넣은 값이 실제로 얼마가 됐는지 되짚어 주는 줄.
 * 입력 줄도 결과 줄도 아니므로 둘 사이에서 조용히 읽혀야 한다.
 */
table.scenario tr.derived th,
table.scenario tr.derived td { color: var(--muted); font-weight: 500; font-size: 13px; padding-top: 2px; }
```

**`.metric` 클래스가 붙어 있지만 `tr.derived td.metric` 으로 다시 눌러줍니다.** 결과 행의 700/14px 강조를 상속받으면 안 되니까요.

### 6.5 결과 행 — 최고/최저 자동 표시

```js
const metricRows = [
  //  라벨                      표시 포맷                  비교값 추출            클수록 좋은가
  ['세전 Project IRR',        (c) => pf(c.preTaxIrr),    (c) => c.preTaxIrr,     true],
  ['세후 Project IRR',        (c) => pf(c.postTaxIrr),   (c) => c.postTaxIrr,    true],
  ['세후 NPV (억원)',          (c) => nf(c.postTaxNpv, 1),(c) => c.postTaxNpv,    true],
  ['출자자 IRR',              (c) => pf(c.equityIrr),    (c) => c.equityIrr,     true],
  ['회수기간 (가격기준일부터)', (c) => yf(c.payback),
                              (c) => (c.payback == null ? Number.POSITIVE_INFINITY : c.payback), false],
  ['최소 DSCR',               (c) => nf(c.minDscr, 2),   (c) => c.minDscr,       true],
  ['적용 판매단가 (원/kWh)',   (c) => nf(c.tariffValue, 1), () => null,           true],   /* 비교 안 함 */
  ['총사업비 (억원)',          (c) => nf(c.totalProjectCost, 0), () => null,      true],   /* 비교 안 함 */
];

for (const [label, fmt, pick, higher] of metricRows) {
  const values = cases.map(pick);
  const valid = values.filter((v) => v != null && Number.isFinite(v));
  const best  = valid.length > 1 ? (higher ? Math.max(...valid) : Math.min(...valid)) : null;
  const worst = valid.length > 1 ? (higher ? Math.min(...valid) : Math.max(...valid)) : null;
  const tds = cases.map((c, i) => {
    const v = values[i];
    let cls = 'metric';
    if (best != null && v === best) cls += ' win';
    else if (worst != null && v === worst) cls += ' lose';
    return el('td', { class: cls, text: fmt(c) });
  });
  tbody.append(el('tr', {}, el('th', { text: label }), ...tds));
}
```

**설계 포인트 5개**

1. **`[라벨, 표시포맷, 비교값, 방향]` 4요소 배열** — 행을 추가하려면 배열에 한 줄 넣습니다.
2. **`pick` 이 `() => null` 이면 비교하지 않습니다.** 판매단가·총사업비는 "그때 실제로 얼마였나"를 보여주는 참고값이라 최고/최저가 무의미합니다.
3. **`higher: false` 로 방향을 뒤집습니다** — 회수기간은 짧을수록 좋습니다.
4. **`null` 을 `Number.POSITIVE_INFINITY` 로 변환** — "회수 불가"를 최악으로 정렬합니다. 그냥 `null` 이면 `filter` 에서 빠져서 **회수 불가 케이스에 `lose` 가 안 붙습니다.**
5. **`valid.length > 1` 조건** — 시나리오가 1개뿐이면 비교가 무의미하므로 색을 칠하지 않습니다. 이게 없으면 유일한 값이 `win` 과 `lose` 를 동시에 받습니다.

**색만 쓰고 아이콘/배경을 쓰지 않습니다.**

```css
table.scenario .win  { color: var(--pos); }
table.scenario .lose { color: var(--neg); }
```

8행 × 4열 = 32칸에 배경색을 칠하면 표가 읽히지 않습니다. **글자색만으로 충분하고, 이미 `font-weight: 700` 이라 색이 잘 보입니다.**

### 6.6 경고 합치기

```js
const warns = [...new Set(cases.flatMap((c) => c.warnings || []))];
if (warns.length) host.append(el('div', { class: 'note', text: `시나리오 경고: ${warns.join(' / ')}` }));
```

**`new Set` 으로 중복을 제거합니다.** 3개 시나리오가 같은 경고를 내면 3번 보일 이유가 없습니다.

---

## 7. 관통하는 디자인 규칙 10개

다른 사이트에 옮길 때 **이 10개만 지키면 같은 느낌이 납니다.**

### 규칙 1 — 숫자에는 예외 없이 `tabular-nums`

```css
font-variant-numeric: tabular-nums;
```

표·카드·입력칸·소계 전부. 이거 하나로 화면의 "정밀해 보이는 정도"가 달라집니다.

### 규칙 2 — 글자색 3단으로 위계를 만든다

```
--ink    숫자·결과        (진함)
--ink-2  라벨·설명        (중간)
--muted  단위·주석·비활성 (흐림)
```

폰트 크기를 늘리는 대신 색을 쓰세요. 크기를 키우면 레이아웃이 흔들립니다.

### 규칙 3 — 강조는 2단까지만

`.primary`(accent 테두리 + accent 숫자 + 26px) / `.scale`(회색 배경 + ink 숫자 + 22px).
3단 이상은 사용자가 구분하지 못합니다.

### 규칙 4 — 제목은 작게, 데이터는 크게

```css
.panel > h2 { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
.card .v    { font-size: 26px; font-weight: 700; }
```

제목 12px, 값 26px. **2배 이상 차이**를 줍니다.

### 규칙 5 — 히트맵 중간값은 색을 칠하지 않는다

```css
.heat-3 { background: transparent; }
```

양극단만 칠해야 극단값이 보입니다.

### 규칙 6 — 빈 값은 `'—'` 로 통일, 의미 있는 빈 값은 문구로

```js
null/NaN/Infinity  →  '—'
회수 불가          →  '회수 불가'
달성 불가          →  '이 변수만으로는 달성 불가'
미달 없음          →  '이 변수로는 미달 없음'
```

### 규칙 7 — 넓은 콘텐츠는 자체 컨테이너에서 스크롤

```css
.table-wrap { overflow-x: auto; }
.chart-wrap { overflow-x: auto; }
table { min-width: 720px; }                          /* 표마다 다르게 */
.layout { grid-template-columns: 380px minmax(0, 1fr); }   /* ★ minmax(0, …) */
```

**`1fr` 로 쓰면 최소 크기가 `auto` 라서 넓은 표가 칼럼을 밀어내고 본문 전체가 가로로 찢어집니다.** `overflow-x` 가 안 듣는 원인이 거의 항상 이것입니다.

### 규칙 8 — 변동률을 받으면 실제값을 되짚어 준다

민감도 셀은 2줄(`.cell-main` + `.cell-sub`), 시나리오는 `tr.derived` 행.
**"−10%" 는 정보가 아닙니다. "25.2%" 가 정보입니다.**

### 규칙 9 — 오해할 수 있는 표에는 "읽는 법"을 붙인다

```
.hint-block  11.5px · 배경 없음 · 읽는 법
.callout-sm  12.5px · 왼쪽 3px 선 · 오해 방지 경고
```

주석에도 위계를 주세요. 전부 같으면 중요한 경고가 묻힙니다.

### 규칙 10 — 보이는 탭만 계산한다

```js
function renderActiveTab() {
  if (activeTab === 'tab-sensitivity') renderSensitivityTab();
  else if (activeTab === 'tab-scenario') renderScenarioTab();
}
```

단, **내보내기(엑셀·인쇄)는 숨은 탭까지 전부 계산**합니다.

---

## 8. 복사용 CSS 전문

이 블록을 그대로 복사하면 세 탭의 모든 스타일이 동작합니다. 색만 바꾸세요.

```css
/* ═══════════════════════════════════════════════════════════
   결과 탭 디자인 시스템 — 요약 · 민감도 · 시나리오
   44px 터치 타깃 · 1180px/760px 브레이크포인트는 계약으로 잠그세요.
   색·폰트·여백은 자유롭게 바꿀 수 있습니다.
   ═══════════════════════════════════════════════════════════ */

:root {
  --bg: #f4f6f8; --panel: #fff; --panel-alt: #fafbfc;
  --line: #e3e7ec; --line-strong: #cbd2da;
  --ink: #1a1f28; --ink-2: #4a5462; --muted: #7b8794;
  --accent: #0f6b4a; --accent-soft: #e7f2ed;
  --danger: #b3261e; --pos: #0f6b4a; --neg: #b3261e;
  --warn-bg: #fff5e6; --warn-ink: #8a4b08;
  --radius: 10px;
  --shadow: 0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06);
}

* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--ink);
  font: 15px/1.55 "Pretendard", "Malgun Gothic", "맑은 고딕", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* ── 레이아웃 ───────────────────────────────────────── */
/* ⚠ minmax(0, 1fr) — 1fr 로 쓰면 넓은 표가 칼럼을 밀어내 본문이 가로로 찢어진다 */
.layout {
  display: grid; grid-template-columns: 380px minmax(0, 1fr);
  gap: 20px; align-items: start; padding: 20px 24px 48px;
  max-width: 1600px; margin: 0 auto;
}
.col-input { position: sticky; top: 68px; max-height: calc(100vh - 88px); overflow-y: auto; overscroll-behavior: contain; }
@media (max-width: 1180px) {
  .layout { grid-template-columns: minmax(0, 1fr); }
  .col-input { position: static; max-height: none; overflow: visible; }
}

/* ── 패널 ───────────────────────────────────────────── */
.panel {
  background: var(--panel); border: 1px solid var(--line);
  border-radius: var(--radius); box-shadow: var(--shadow); margin-bottom: 16px;
}
.panel > h2 {
  margin: 0; padding: 14px 16px;
  font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
  color: var(--muted); border-bottom: 1px solid var(--line);
}
.panel-body { padding: 14px 16px; }

/* ── 탭 ─────────────────────────────────────────────── */
.tabs { display: flex; gap: 4px; margin-bottom: 14px; border-bottom: 1px solid var(--line); }
.tab {
  min-height: 44px; padding: 0 18px;
  border: 1px solid transparent; border-bottom: none; border-radius: 8px 8px 0 0;
  background: transparent; color: var(--muted);
  font-weight: 600; font-size: 14px;
  margin-bottom: -1px;                      /* 기준선을 1px 덮어 탭과 내용을 잇는다 */
  cursor: pointer;
}
.tab:hover { color: var(--accent); }
.tab[aria-selected="true"] { background: var(--panel); border-color: var(--line); color: var(--accent); }
.tab:focus-visible { outline: 2px solid var(--accent); outline-offset: -3px; }
.tabpanel[hidden] { display: none; }

/* ── KPI 카드 ───────────────────────────────────────── */
.cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.card {
  background: var(--panel); border: 1px solid var(--line);
  border-radius: var(--radius); box-shadow: var(--shadow); padding: 14px 16px;
}
.card .k { font-size: 12px; color: var(--muted); }
.card .v { margin-top: 3px; font-size: 26px; font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.card .s { margin-top: 3px; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.card.primary { border-color: var(--accent); }
.card.primary .v { color: var(--accent); }
.card.scale { background: var(--panel-alt); }
.card.scale .v { font-size: 22px; color: var(--ink); }
.card.scale .k { font-weight: 600; }
#cards-scale { margin-top: -4px; }

/* ── 표 기본형 ──────────────────────────────────────── */
.table-wrap { overflow-x: auto; }
table {
  width: 100%; min-width: 720px; border-collapse: collapse;
  font-variant-numeric: tabular-nums; font-size: 13px;
}
th, td { padding: 6px 8px; text-align: right; white-space: nowrap; border-bottom: 1px solid var(--line); }
thead th { position: sticky; top: 0; background: var(--panel); color: var(--muted); font-weight: 600; z-index: 1; }
th:first-child, td:first-child { text-align: left; }
tbody tr:hover { background: var(--panel-alt); }
tr.op-row td:first-child { color: var(--accent); font-weight: 600; }
td.neg { color: var(--neg); }

/* kv 표 — 2칼럼. 기본 규칙 2개를 뒤집는다 */
.kv { width: 100%; min-width: 0; }
.kv th { text-align: left; color: var(--ink-2); font-weight: 500; white-space: normal; }
.kv td { font-weight: 600; }

/* ── 섹션 제목 (패널 내부 구분) ──────────────────────── */
.subtotal {
  display: flex; justify-content: space-between;
  padding: 8px 0 2px; margin-top: 8px; border-top: 1px solid var(--line);
  font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--ink-2);
}
.subtotal.strong { color: var(--ink); font-size: 14px; }

/* ── 차트 ───────────────────────────────────────────── */
.chart-wrap { overflow-x: auto; padding: 4px 0; }
.chart-wrap svg { display: block; min-width: 640px; }
.legend { display: flex; gap: 14px; flex-wrap: wrap; margin: 4px 0 10px; font-size: 12px; color: var(--ink-2); }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }

/* ── 경고 ───────────────────────────────────────────── */
#warnings {
  margin-top: 12px; padding: 10px 12px; border-radius: 8px;
  background: var(--warn-bg); color: var(--warn-ink); font-size: 13px;
}
#warnings ul { margin: 0; padding-left: 18px; }

/* ── 민감도 도구 막대 ───────────────────────────────── */
.toolbar { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.toolbar .field { margin-bottom: 0; min-width: 150px; }
.toolbar .note { color: var(--muted); font-size: 12px; padding-bottom: 12px; }

/* ── 민감도 매트릭스 ────────────────────────────────── */
table.matrix { min-width: 560px; }
table.matrix td.cell { font-weight: 600; padding: 5px 8px; line-height: 1.3; }
table.matrix td.base { outline: 2px solid var(--line-strong); outline-offset: -2px; }  /* border 금지 */
table.matrix td.na { color: var(--muted); font-weight: 400; }
table.matrix th.var { text-align: left; white-space: nowrap; }
table.matrix .basev { display: block; font-size: 11px; font-weight: 400; color: var(--muted); }
.cell-main { display: block; font-weight: 700; font-size: 13.5px; }
.cell-sub  { display: block; font-size: 11px; font-weight: 500; color: var(--muted); margin-top: 1px; }
table.matrix td.base .cell-sub { color: var(--ink-2); }

/* 히트맵 5단계 — 중간(heat-3)은 칠하지 않는다 */
.heat-5 { background: #d7ede2; }
.heat-4 { background: #e9f4ee; }
.heat-3 { background: transparent; }
.heat-2 { background: #fdeceb; }
.heat-1 { background: #f9d9d6; }

.be-ok { color: var(--pos); font-weight: 600; }
.be-no { color: var(--neg); font-weight: 600; }

/* ── 주석 2종 ───────────────────────────────────────── */
.hint-block { margin: 2px 0 8px; font-size: 11.5px; line-height: 1.5; color: var(--muted); }
.callout-sm {
  margin: 2px 0 10px; padding: 9px 12px;
  border-left: 3px solid var(--line-strong); border-radius: 0 6px 6px 0;
  background: var(--panel-alt); color: var(--ink-2);
  font-size: 12.5px; line-height: 1.6;
}
.callout-sm strong { color: var(--ink); }
.note { color: var(--muted); font-size: 12px; }

/* ── 시나리오 표 ────────────────────────────────────── */
table.scenario { min-width: 520px; }
table.scenario thead th { font-size: 13px; color: var(--ink); text-align: right; }
table.scenario thead th:first-child { text-align: left; }
table.scenario tr.group-head td {
  background: var(--panel-alt); color: var(--muted);
  font-size: 11.5px; font-weight: 700; letter-spacing: .05em; text-align: left;
}
/* 표 안 입력칸 — 44px 예외(36px). 입력과 결과를 한 화면에 담기 위해 */
table.scenario td input { min-height: 36px; padding: 4px 6px; text-align: right; font-size: 13px; }
table.scenario td.metric { font-weight: 700; font-size: 14px; }
/* 되짚기 행 — 입력도 결과도 아니므로 둘 사이에서 조용히 */
table.scenario tr.derived th,
table.scenario tr.derived td { color: var(--muted); font-weight: 500; font-size: 13px; padding-top: 2px; }
table.scenario tr.derived td.metric { font-weight: 500; font-size: 13px; }
table.scenario .win  { color: var(--pos); }
table.scenario .lose { color: var(--neg); }

/* ── 입력 필드 공통 ─────────────────────────────────── */
.field { display: block; margin-bottom: 10px; }
.field > .lbl { display: flex; align-items: baseline; gap: 6px; font-size: 12.5px; color: var(--ink-2); margin-bottom: 4px; }
.field > .lbl .unit { color: var(--muted); font-size: 11.5px; }
.field > .lbl .hint { margin-left: auto; color: var(--muted); font-size: 11px; }
input[type="text"], input[type="number"], input[type="date"], select {
  width: 100%; min-height: 44px; padding: 8px 10px;
  font: inherit; font-variant-numeric: tabular-nums;
  color: var(--ink); background: #fff;
  border: 1px solid var(--line-strong); border-radius: 7px;
}
input:focus, select:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }

/* ── 좁은 화면 ──────────────────────────────────────── */
@media (max-width: 760px) {
  .layout { padding: 14px; gap: 14px; }
  .cards { grid-template-columns: minmax(0, 1fr); }
}
```

---

## 9. 복사용 렌더러 코드

### 9.1 공통 헬퍼

```js
/** DOM 생성 — 이 14줄이 JSX 역할을 한다 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in node) node[k] = v;          // value, hidden, readOnly, type, colSpan …
    else node.setAttribute(k, v);             // aria-*, data-*, title …
  }
  for (const c of children.flat()) if (c != null) node.append(c);
  return node;
}

/** 포매터 — null/NaN/Infinity 를 전부 '—' 로 */
const nf = (v, d = 1) =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const pf = (v, d = 2) => (v == null || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(d)}%`);
const yf = (v) => (v == null ? '회수 불가' : `${v}년`);

/** 패널 내부 구분 제목 */
function sectionTitle(text) {
  return el('div', { class: 'subtotal strong' }, el('span', { text }), el('span', { text: '' }));
}
```

### 9.2 KPI 카드 2줄

```js
const card = (cls, k, v, s) => el('div', { class: `card ${cls}` },
  el('div', { class: 'k', text: k }),
  el('div', { class: 'v', text: v }),
  el('div', { class: 's', text: s }));

/** 위 줄 — 핵심 지표. 같은 종류는 같은 강조로 통일한다 */
export function renderCards(host, result) {
  const m = result.metrics;
  host.innerHTML = '';
  host.append(
    card('primary', '지표 A', pf(m.a.value), `보조1 ${nf(m.a.sub1)} · 보조2 ${nf(m.a.sub2)}`),
    card('primary', '지표 B', pf(m.b.value), `보조1 ${nf(m.b.sub1)} · 보조2 ${nf(m.b.sub2)}`),
    card('primary', '지표 C', pf(m.c.value), `보조1 ${nf(m.c.sub1)} · 보조2 ${nf(m.c.sub2)}`));
}

/** 아래 줄 — 규모. 성격이 달라 강조를 낮춘다 */
export function renderScaleCards(host, result) {
  const d = result.derived;
  host.innerHTML = '';
  host.append(
    card('scale', '규모 1', `${nf(d.x, 1)} 단위`, `환산 ${nf(d.xPer, 1)} · 총 ${nf(d.xTotal, 1)}`),
    card('scale', '규모 2', `${nf(d.y, 1)} 단위`, `비중 ${pf(d.yShare, 1)}`),
    card('scale', '규모 3', `${nf(d.z, 1)} 단위`, `비중 ${pf(d.zShare, 1)}`));
}
```

### 9.3 kv 표 (산출 근거)

```js
export function renderBasis(host, result) {
  const d = result.derived;
  host.innerHTML = '';
  const rows = [
    ['항목 1', `${nf(d.a, 2)} 단위`],
    ['항목 2', `${nf(d.b, 2)} 단위`],
    ...d.children.map((c) => [`　${c.label}`, `${nf(c.amount, 2)} 단위`]),   // 전각 공백으로 들여쓰기
    ['비율', pf(d.ratio, 3)],
    ['기간', `${d.from} ~ ${d.to} (${d.years}년)`],
    ['　구간 1', `${d.from} ~ ${d.mid}`],
    ['　구간 2', `${d.mid} ~ ${d.to}`],
    // 오해가 반복되는 지점에는 그 자리에 해설을 둔다
    ['기산점', `${d.baseYear}년 — 준비 기간이 포함되므로 운영기간보다 클 수 있습니다`],
  ];
  const tbody = el('tbody', {});
  for (const [k, v] of rows) tbody.append(el('tr', {}, el('th', { text: k }), el('td', { text: v })));
  host.append(el('table', { class: 'kv' }, tbody));
}
```

### 9.4 경고

```js
export function renderWarnings(host, result) {
  const warnings = result.warnings || [];
  host.innerHTML = '';
  host.hidden = warnings.length === 0;     // 비면 숨긴다 — 빈 상자가 여백을 만든다
  if (!warnings.length) return;
  const ul = el('ul', {});
  for (const w of warnings) ul.append(el('li', { text: w }));
  host.append(ul);
}
```

### 9.5 민감도 — 히트맵 + 2줄 셀 매트릭스

```js
export const SENSITIVITY_METRICS = [
  { id: 'metricA', label: '지표 A',   fmt: (v) => pf(v),     higherIsBetter: true  },
  { id: 'metricB', label: '지표 B',   fmt: (v) => nf(v, 0),  higherIsBetter: true  },
  { id: 'period',  label: '기간 (년)', fmt: (v) => (v == null ? '불가' : `${v}년`), higherIsBetter: false },
];

/** 기준 대비 좋고 나쁨을 5단계 색으로. 기준값의 8% 를 임계로 쓴다 */
export function heatClass(value, base, higherIsBetter) {
  if (value == null || base == null || !Number.isFinite(value) || !Number.isFinite(base)) return '';
  const diff = (value - base) * (higherIsBetter ? 1 : -1);
  const scale = Math.abs(base) > 1e-9 ? Math.abs(base) * 0.08 : 1;
  if (diff >  scale)        return 'heat-5';
  if (diff >  scale * 0.25) return 'heat-4';
  if (diff < -scale)        return 'heat-1';
  if (diff < -scale * 0.25) return 'heat-2';
  return 'heat-3';
}

export function renderSensitivity(host, data, state, handlers) {
  const { sensitivity, breakevens, tornadoSvg } = data;
  const metric = SENSITIVITY_METRICS.find((m) => m.id === state.metricId) || SENSITIVITY_METRICS[0];
  host.innerHTML = '';

  // ── 도구 막대 ──
  const metricSelect = el('select', { onchange: () => handlers.onMetricChange(metricSelect.value) });
  for (const m of SENSITIVITY_METRICS) {
    metricSelect.append(el('option', { value: m.id, text: m.label, selected: m.id === metric.id }));
  }
  metricSelect.value = metric.id;

  const rangeInput = el('input', {
    type: 'number', step: '5', value: String(Math.round(state.rangePct)),
    oninput: () => { const v = Number(rangeInput.value); if (Number.isFinite(v) && v > 0) handlers.onRangeChange(v); },
  });
  const targetInput = el('input', {
    type: 'number', step: '0.5',
    value: String(Number((state.target * 100).toFixed(2))),     // "7" not "7.00"
    oninput: () => { const v = Number(targetInput.value); if (Number.isFinite(v)) handlers.onTargetChange(v / 100); },
  });

  host.append(el('div', { class: 'toolbar' },
    el('label', { class: 'field' }, el('span', { class: 'lbl' }, el('span', { text: '표시 지표' })), metricSelect),
    el('label', { class: 'field' }, el('span', { class: 'lbl' }, el('span', { text: '변동폭' }), el('span', { class: 'unit', text: '±%' })), rangeInput),
    el('label', { class: 'field' }, el('span', { class: 'lbl' }, el('span', { text: '목표' }), el('span', { class: 'unit', text: '%' })), targetInput),
    el('span', { class: 'note', text: '한 번에 한 변수만 움직인 결과입니다.' })));

  // ── 토네이도 ──
  const tornado = el('div', { class: 'chart-wrap' });
  tornado.innerHTML = tornadoSvg;
  host.append(sectionTitle(`변수별 영향 크기 — ${metric.label}`), tornado);

  // ── 매트릭스 ──
  const steps = sensitivity.rows[0] ? sensitivity.rows[0].cells.map((c) => c.step) : [];
  const thead = el('thead', {}, el('tr', {},
    el('th', { class: 'var', text: '변수' }),
    ...steps.map((st) => el('th', { text: st === 0 ? '기준' : `${st > 0 ? '+' : ''}${Math.round(st * 100)}%` }))));

  const tbody = el('tbody', {});
  const baseValue = sensitivity.base[metric.id];
  for (const row of sensitivity.rows) {
    const cells = row.cells.map((c) => {
      const v = c[metric.id];
      return el('td', {
        class: `cell ${c.isBase ? 'base' : heatClass(v, baseValue, metric.higherIsBetter)}${v == null ? ' na' : ''}`,
        title: `${row.label} ${row.format(c.value)} → ${metric.label} ${v == null ? '—' : metric.fmt(v)}`,
      },
      el('span', { class: 'cell-main', text: v == null ? '—' : metric.fmt(v) }),   // 지표값
      el('span', { class: 'cell-sub',  text: row.format(c.value) }));              // 변수 실제값
    });
    tbody.append(el('tr', {},
      el('th', { class: 'var' },
        el('span', { text: row.label }),
        el('span', { class: 'basev', text: `기준 ${row.format(row.baseValue)}` })),
      ...cells));
  }
  host.append(
    sectionTitle(`민감도 매트릭스 — ${metric.label}`),
    el('p', { class: 'hint-block', text: `각 칸의 윗줄은 ${metric.label}, 아랫줄은 그때 그 변수의 실제 값입니다.` }),
    el('div', { class: 'table-wrap' }, el('table', { class: 'matrix' }, thead, tbody)));

  // ── 임계값 ──
  const beBody = el('tbody', {});
  for (const b of breakevens) {
    const cell = b.value == null
      ? el('td', { class: b.achievedAtBase ? 'be-ok' : 'be-no',
          text: b.achievedAtBase ? '이 변수로는 미달 없음' : '이 변수만으로는 달성 불가' })
      : el('td', { class: 'be-ok', text: `${b.format(b.value)} ${b.direction === 'up' ? '이상' : '이하'}` });
    beBody.append(el('tr', {}, el('th', { class: 'var', text: b.label }), el('td', { text: b.format(b.baseValue) }), cell));
  }
  host.append(
    sectionTitle(`목표 ${pf(state.target)} 달성 임계값`),
    el('div', { class: 'callout-sm' },
      el('strong', { text: '읽는 법 — 각 줄은 "그 변수 하나만" 움직였을 때의 조건입니다. ' }),
      document.createTextNode('어느 한 줄만 충족하면 목표에 도달합니다(AND 아님). 두 변수가 동시에 나빠지면 각 줄을 따로 만족해도 미달할 수 있습니다. 여러 변수를 함께 움직인 결과는 시나리오 탭에서 확인하세요.')),
    el('div', { class: 'table-wrap' },
      el('table', { class: 'matrix' },
        el('thead', {}, el('tr', {},
          el('th', { class: 'var', text: '변수' }), el('th', { text: '현재값' }), el('th', { text: '이 변수만 움직일 때 필요 조건' }))),
        beBody)));
}
```

### 9.6 시나리오 — 입력 가능한 비교표

```js
export function renderScenarios(host, cases, scenarios, handlers) {
  host.innerHTML = '';
  const cols = cases.length;
  const thead = el('thead', {}, el('tr', {}, el('th', { text: '구분' }), ...cases.map((c) => el('th', { text: c.label }))));
  const tbody = el('tbody', {});
  const groupRow = (title) => el('tr', { class: 'group-head' }, el('td', { colSpan: cols + 1, text: title }));

  // ── 가정 (입력) ──
  tbody.append(groupRow('가정 — 값을 바꾸면 즉시 다시 계산됩니다'));
  tbody.append(assumptionRow('변수 A 변동 (%)', scenarios,
    (sc) => (sc.aDelta || 0) * 100, (sc, v) => { sc.aDelta = v / 100; }, handlers, 1, 1));
  tbody.append(assumptionRow('변수 B (원/단위)', scenarios,
    (sc) => sc.b ?? 0, (sc, v) => { sc.b = v; }, handlers, 1, 1));
  tbody.append(assumptionRow('변수 C (억원)', scenarios,
    (sc) => sc.c ?? 0, (sc, v) => { sc.c = v; }, handlers, 10, 0));     // step 10, 정수
  tbody.append(assumptionRow('변수 D 가감 (%p)', scenarios,
    (sc) => (sc.d || 0) * 100, (sc, v) => { sc.d = v / 100; }, handlers, 0.1, 2));

  // ── 되짚기 (변동률 → 실제값) ──
  tbody.append(el('tr', { class: 'derived' }, el('th', { text: '→ 적용 변수 A' }),
    ...cases.map((c) => el('td', { class: 'metric', text: pf(c.aValue) }))));

  // ── 결과 ──
  tbody.append(groupRow('결과'));
  const metricRows = [
    //  라벨          표시 포맷                  비교값             클수록 좋은가
    ['지표 A',      (c) => pf(c.metricA),      (c) => c.metricA,   true],
    ['지표 B',      (c) => nf(c.metricB, 1),   (c) => c.metricB,   true],
    ['기간',        (c) => yf(c.period),
                    (c) => (c.period == null ? Number.POSITIVE_INFINITY : c.period), false],   // null = 최악
    ['참고값',      (c) => nf(c.ref, 1),       () => null,         true],                      // 비교 안 함
  ];
  for (const [label, fmt, pick, higher] of metricRows) {
    const values = cases.map(pick);
    const valid = values.filter((v) => v != null && Number.isFinite(v));
    const best  = valid.length > 1 ? (higher ? Math.max(...valid) : Math.min(...valid)) : null;
    const worst = valid.length > 1 ? (higher ? Math.min(...valid) : Math.max(...valid)) : null;
    const tds = cases.map((c, i) => {
      const v = values[i];
      let cls = 'metric';
      if (best != null && v === best) cls += ' win';
      else if (worst != null && v === worst) cls += ' lose';
      return el('td', { class: cls, text: fmt(c) });
    });
    tbody.append(el('tr', {}, el('th', { text: label }), ...tds));
  }

  host.append(el('div', { class: 'table-wrap' }, el('table', { class: 'scenario' }, thead, tbody)));

  const warns = [...new Set(cases.flatMap((c) => c.warnings || []))];   // 중복 제거
  if (warns.length) host.append(el('div', { class: 'note', text: `시나리오 경고: ${warns.join(' / ')}` }));
}

/** 가정 한 줄. 단위가 변수마다 다르므로 step·digits 를 따로 받는다 */
function assumptionRow(label, scenarios, get, set, handlers, step, digits = 3) {
  const tds = scenarios.map((sc) => {
    const input = el('input', {
      type: 'number', step: String(step), value: String(Number(get(sc).toFixed(digits))),
      oninput: () => {
        const v = Number(input.value);
        if (!Number.isFinite(v)) return;
        set(sc, v);
        handlers.onScenarioChange();
      },
    });
    return el('td', {}, input);
  });
  return el('tr', {}, el('th', { text: label }), ...tds);
}
```

### 9.7 차트 유틸 — 어느 도메인에도 쓰이는 것

```js
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ko  = (v) => Math.round(v).toLocaleString('ko-KR');

/** 축 눈금을 보기 좋은 값으로 끊는다 (1·2·5 × 10^n) */
function niceStep(range, targetCount) {
  const raw = range / Math.max(1, targetCount);
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

function ticksUpTo(max, count) {
  const step = niceStep(max, count);
  const out = [];
  for (let v = step; v <= max * 1.0001; v += step) out.push(v);
  return out;
}

/** 연속된 같은 구간을 하나로 묶는다 (단계 띠용) */
function phaseSegments(items, keyOf) {
  const out = [];
  let cur = null;
  items.forEach((it, i) => {
    const k = keyOf(it);
    if (!cur || cur.key !== k) { cur = { key: k, from: i, to: i }; out.push(cur); }
    else cur.to = i;
  });
  return out;
}
```

### 9.8 오케스트레이션 — 탭 배선

```js
const sensState = { metricId: 'metricA', rangePct: 20, target: 0.07 };   // 화면 상태 (모델 아님)

const TABS = [
  { tab: 'tab-summary',     panel: 'panel-summary' },
  { tab: 'tab-sensitivity', panel: 'panel-sensitivity' },
  { tab: 'tab-scenario',    panel: 'panel-scenario' },
];
let activeTab = 'tab-summary';
const $ = (id) => document.getElementById(id);

function selectTab(tabId) {
  activeTab = tabId;
  for (const t of TABS) {
    const on = t.tab === tabId;
    $(t.tab)?.setAttribute('aria-selected', String(on));
    const p = $(t.panel);
    if (p) p.hidden = !on;
  }
  renderActiveTab();
}

/** 보이는 탭만 계산한다 */
function renderActiveTab() {
  if (activeTab === 'tab-sensitivity') renderSensitivityTab();
  else if (activeTab === 'tab-scenario') renderScenarioTab();
}

for (const t of TABS) $(t.tab)?.addEventListener('click', () => selectTab(t.tab));

// 지표 변경은 즉시(재계산 없음), 범위·목표 변경은 디바운스(재계산 필요)
const handlers = {
  onMetricChange: (id) => { sensState.metricId = id; renderSensitivityTab(); },
  onRangeChange:  (v)  => { sensState.rangePct = v; scheduleSensitivity(); },
  onTargetChange: (v)  => { sensState.target = v;   scheduleSensitivity(); },
};

let sensTimer = null;
const scheduleSensitivity = () => { clearTimeout(sensTimer); sensTimer = setTimeout(renderSensitivityTab, 150); };

selectTab(activeTab);   // 초기 상태를 JS 가 명시적으로 정한다
```

---

## 10. 다른 도메인으로 옮기기

### 10.1 대응 표

| 사업성 | 구조적 역할 | 다른 도메인 예시 |
|---|---|---|
| 세전/세후/출자자 IRR | **동종 핵심 지표 3개** → `.card.primary` | 응답시간/처리량/오류율 · 수익/비용/이익 · 정확도/재현율/F1 |
| 총사업비/자기자본/타인자본 | **규모 3개** → `.card.scale` | 총량/구성A/구성B |
| 연도별 현금흐름 | **시계열 + 단계** → 양방향 막대 + 띠 | 월별 실적 · 공정별 진척 · 세대별 성능 |
| 사업준비/건설/운영 | **구간 3단** → `PHASES` | 설계/시공/준공 · 개발/검증/배포 |
| 이용률·SMP·REC·사업비·금리 | **흔들 변수 6개** → 매트릭스 행 | 설계 파라미터 · 가격 변수 · 하이퍼파라미터 |
| 세후 IRR | **대표 지표 1개** → 토네이도 축 | 목적 함수 |
| 목표 IRR 7% | **목표 임계** → breakeven | SLA · 손익분기 · 합격 기준 |
| 기본/낙관/비관 | **비교 케이스 3~4개** → 시나리오 열 | Best/Base/Worst · A/B/C안 · 공법 비교 |
| 회수 불가 / 달성 불가 | **구분되는 빈 값** | 미수렴 / 범위 초과 / 측정 실패 |

### 10.2 단계별 이식

**1단계 — CSS 전문을 복사하고 색만 바꿉니다.** (8장)
토큰 12개(`--accent` 등)만 교체하면 브랜드가 바뀝니다. 구조 CSS는 그대로 둡니다.

**2단계 — 탭 껍데기를 만듭니다.** (3장)
`role`/`aria-*` 4쌍 + `margin-bottom: -1px` + `hidden` 토글.

**3단계 — 요약 탭: 카드 3+3 → 차트 → kv 표 → 상세표 순으로.**
카드의 `.s` 보조 지표 2~3개를 `·` 로 잇는 것을 꼭 따라하세요. 화면 밀도가 달라집니다.

**4단계 — 민감도 탭: 변수 정의 배열부터.**

```js
{ id, label, read, apply, setAbsolute, format }
```

이 6필드 객체 배열만 만들면 매트릭스·토네이도·임계값이 자동으로 따라옵니다.
`format` 을 데이터에 두는 게 핵심입니다.

**5단계 — 시나리오 탭: 단위 4개를 먼저 정합니다.**
`[라벨, get, set, step, digits]` 를 표로 먼저 적고, 그다음 코드를 쓰세요. 단위를 나중에 바꾸면 사용자가 입력한 값의 뜻이 달라집니다.

**6단계 — 계약 테스트를 붙입니다.** (11장)

### 10.3 바꾸지 말아야 할 것

1. `font-variant-numeric: tabular-nums` — 전부
2. `.heat-3 { background: transparent }` — 중간값 무색
3. `grid-template-columns: … minmax(0, 1fr)` — `1fr` 금지
4. `table.matrix td.base { outline: … }` — `border` 금지
5. `overflow-x: auto` 감싸기 + `table { min-width }`
6. `'—'` 통일 + 의미 있는 빈 값 분리
7. `el.hidden` 토글 (`style.display` 금지)
8. `higherIsBetter` 방향 플래그
9. 변동률과 실제값 동시 표시 (`.cell-sub` / `tr.derived`)
10. `.callout-sm` 오해 방지 문구

### 10.4 자유롭게 바꿀 것

1. 모든 색 (토큰 12개)
2. 폰트 패밀리·크기 스케일
3. 여백·`gap`·`radius`
4. 카드 개수 (3장이 꼭 아니어도 됨 — `repeat(N, minmax(0,1fr))`)
5. 차트 종류 (막대 대신 면적·선)
6. 단계 수 (3단계가 아니어도 `PHASES` 에 추가)
7. 민감도 단계 수 (5단계 → 7단계: `stepsFrom()` 수정)

---

## 11. 계약 테스트 · 체크리스트

### 11.1 잠글 것 — 계약 테스트

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const css  = readFileSync(join(root, 'css/style.css'), 'utf8');

test('탭이 접근성 속성을 갖춘다 (role · aria-selected · aria-controls)', () => {
  assert.match(html, /role="tablist"/);
  assert.equal((html.match(/role="tab"/g) || []).length, 3);
  assert.equal((html.match(/role="tabpanel"/g) || []).length, 3);
  for (const id of ['panel-summary', 'panel-sensitivity', 'panel-scenario']) {
    assert.ok(html.includes(`aria-controls="${id}"`), `aria-controls="${id}" 가 없다`);
  }
  assert.match(html, /aria-selected="true"/);
});

test('탭 버튼이 44px 터치 타깃이다', () => {
  assert.match(css, /\.tab\s*\{[^}]*min-height:\s*44px/);
});

test('넓은 콘텐츠는 자체 컨테이너에서 가로 스크롤한다 (본문은 안 밀린다)', () => {
  assert.match(css, /\.table-wrap\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(css, /\.chart-wrap\s*\{[^}]*overflow-x:\s*auto/);
});

test('민감도 매트릭스·시나리오 표에 min-width 가 있다', () => {
  assert.match(css, /table\.matrix\s*\{[^}]*min-width/);
  assert.match(css, /table\.scenario\s*\{[^}]*min-width/);
});

test('그리드 칼럼이 minmax(0, …) 로 보호된다', () => {
  assert.match(css, /grid-template-columns:[^;]*minmax\(0,\s*1fr\)/);
});

test('히트맵 중간값은 색을 칠하지 않는다', () => {
  assert.match(css, /\.heat-3\s*\{[^}]*background:\s*transparent/);
});

test('숫자 표시에 tabular-nums 가 걸려 있다', () => {
  assert.match(css, /table\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
  assert.match(css, /\.card \.v\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
});

test('반응형 브레이크포인트 1180px / 760px', () => {
  assert.match(css, /@media \(max-width: 1180px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
});
```

**렌더러 계약 테스트** (DOM 스텁 위에서 — `web-app-blueprint.md` 7.4 참조):

```js
import { TestElement, installDocument, walk } from './helpers/dom-stub.mjs';
installDocument();
const { renderScenarios } = await import('../js/sensitivity-view.js');

test('시나리오 가정 줄의 단위가 고정돼 있다', () => {
  const host = new TestElement('div');
  renderScenarios(host, cases, scenarios, { onScenarioChange: () => {} });
  const ths = walk(host, (n) => n.tagName === 'TH').map((n) => n.textContent);
  assert.ok(ths.includes('이용률 변동 (%)'), '이용률은 변동률(%)로 받는다');
  assert.ok(ths.includes('판매단가 (원/kWh)'), '판매단가는 합산 단가 한 칸');
  assert.ok(ths.includes('총사업비 (억원)'), '총사업비는 금액 그대로');
});

test('최고/최저에 win/lose 가 붙는다', () => {
  const tds = walk(host, (n) => n.tagName === 'TD');
  assert.ok(tds.some((n) => n.className.includes('win')));
  assert.ok(tds.some((n) => n.className.includes('lose')));
});
```

### 11.2 구현 체크리스트

**요약 탭**
1. [ ] 카드가 `k`/`v`/`s` 3단이고 `.s` 에 보조 지표 2~3개가 `·` 로 이어진다
2. [ ] `.primary` 와 `.scale` 강조가 2단으로 구분된다
3. [ ] 같은 종류의 지표가 모두 같은 강조를 받는다
4. [ ] 카드가 탭 바깥에 있어 탭을 바꿔도 보인다
5. [ ] 차트 범례가 SVG 밖 HTML 이고 `flex-wrap` 된다
6. [ ] 차트 영점이 데이터에 맞춰 움직인다
7. [ ] 단계 이름이 차트 영역 밖(아래 띠)에 있다
8. [ ] 좁은 띠는 글씨를 생략하고 툴팁만 남긴다
9. [ ] 눈금이 1·2·5 × 10ⁿ 으로 끊긴다
10. [ ] `.kv` 에서 `min-width: 0` + `white-space: normal` 로 뒤집혔다
11. [ ] 계층이 전각 공백으로 들여쓰기됐다
12. [ ] 값이 전부 0인 칼럼은 만들지 않는다
13. [ ] 경고가 비면 `host.hidden = true`

**민감도 탭**
14. [ ] `.toolbar` 가 `align-items: flex-end`
15. [ ] 지표 변경은 즉시, 범위·목표 변경은 디바운스
16. [ ] 비율 입력이 `String(Number(x.toFixed(2)))` 로 `.00` 을 안 보인다
17. [ ] 매트릭스 셀이 2줄(`.cell-main` + `.cell-sub`)이다
18. [ ] 행 머리에도 `기준 ~` 이 붙는다
19. [ ] 히트맵이 기준값의 8% 로 정규화되고 `.heat-3` 은 무색
20. [ ] `higherIsBetter` 로 방향이 뒤집힌다
21. [ ] 기준 열이 `outline` (`border` 아님)으로 표시된다
22. [ ] 토네이도가 영향 크기 순으로 정렬된다
23. [ ] 토네이도 좌=빨강 / 우=초록 이고 `opacity: .78`
24. [ ] 축 패딩에 `|| 0.01` 방어가 있다
25. [ ] 빈 데이터에 빈 SVG 를 반환한다
26. [ ] 임계값이 3상태(있음/달성/불가)로 구분된다
27. [ ] `이상`/`이하` 가 붙는다
28. [ ] `.callout-sm` 에 "AND 아님" 경고가 있다

**시나리오 탭**
29. [ ] 열 = 케이스, 행 = 항목
30. [ ] `tr.group-head` 가 `colSpan` 으로 구역을 나눈다
31. [ ] 그룹 제목에 "값을 바꾸면 즉시 다시 계산됩니다" 가 있다
32. [ ] 표 안 입력칸이 36px (예외 이유를 주석에 적었다)
33. [ ] `step`·`digits` 가 변수마다 실무 단위에 맞다
34. [ ] `tr.derived` 가 변동률의 실제값을 되짚는다
35. [ ] `tr.derived td.metric` 이 결과 강조를 다시 누른다
36. [ ] 참고값 행은 `pick: () => null` 로 비교를 건너뛴다
37. [ ] `null` → `POSITIVE_INFINITY` 로 최악 정렬된다
38. [ ] `valid.length > 1` 조건으로 단일 케이스에 색을 안 칠한다
39. [ ] `win`/`lose` 가 색만 쓰고 배경을 안 쓴다
40. [ ] 경고가 `new Set` 으로 중복 제거된다

---

## 맺음

이 디자인의 핵심은 화려함이 아니라 **정보 위계**입니다.

```
1. 색 3단 (--ink / --ink-2 / --muted)      으로 무엇이 데이터인지 구분
2. 강조 2단 (.primary / .scale)            으로 무엇이 핵심인지 구분
3. 주석 2단 (.hint-block / .callout-sm)    으로 무엇이 경고인지 구분
4. 히트맵 양극단만 칠해서                    무엇이 위험한지 구분
5. tabular-nums 로                         숫자를 숫자답게
```

그리고 가장 반복적으로 나타나는 교훈 하나:

> **숫자가 맞는데 오해를 산다면, 그건 디자인 결함입니다.**
>
> 회수기간 23년 → `(운영 후 14년)` 괄호 추가
> 이용률 −10% → 아랫줄에 `25.2%` 병기
> 임계값 6줄 → "AND 아님" 콜아웃 추가
>
> 세 번 모두 **계산을 고치지 않고 표시를 고쳤습니다.**
