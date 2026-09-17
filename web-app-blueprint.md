# 웹앱 복제 설계도 (Blueprint)

> `사업성/` (신재생에너지 사업성 분석) 을 리버스 엔지니어링해서,
> **같은 구조·같은 품질의 다른 페이지를 처음부터 만드는 방법**을 적은 문서입니다.
>
> 기준 시점: 2026-09-11 · 기준 코드: `사업성/` (소스 7개 모듈 2,534줄 + 테스트 231개 전부 통과)
>
> 자매 문서: [result-tabs-design-spec.md](result-tabs-design-spec.md) — 요약·민감도·시나리오 탭의 **디자인 상세 명세** (CSS 전문 · 렌더러 코드 · 수치 근거)

---

## 0. 이 문서를 읽는 방법

| 목적 | 읽을 곳 |
|---|---|
| "이 구조가 왜 이렇게 생겼는지" 이해 | 1 ~ 4장 |
| "각 파일이 정확히 무슨 일을 하는지" 파악 | 5장 |
| "새 페이지를 지금 만들겠다" | **8장(복제 레시피) → 부록 B(골격 코드) → 부록 C(체크리스트)** |
| "내 주제(도메인)에 어떻게 대응시키지" | 9장 |
| "남들이 어디서 넘어졌나" | 10장 |
| **"결과 화면 디자인을 그대로 베끼고 싶다"** | **[result-tabs-design-spec.md](result-tabs-design-spec.md)** |

AI에게 이 문서를 던져서 새 페이지를 만들게 할 거라면, **8장과 부록 B만 줘도 동작**합니다.
나머지는 판단이 필요한 순간에 근거로 쓰입니다.

---

## 1. 30초 요약 — 이 구조의 정체

1. **런타임 의존성 0.** `node_modules` 없음, 프레임워크 없음, CDN 없음. 브라우저가 읽는 건 HTML 1개 + CSS 1개 + JS 번들 1개.
2. **`index.html` 을 더블클릭해서 열면 동작한다.** 서버가 필요 없다. 이게 모든 기술 결정의 뿌리다(4장).
3. **계산과 화면이 완전히 분리돼 있다.** 계산 엔진은 `document` 를 단 한 번도 만지지 않는 순수 함수다. 그래서 브라우저 없이 `node --test` 로 숫자를 검증할 수 있다.
4. **도메인 숫자는 단 한 파일에만 있다.** 엔진에는 사업 고유 값이 0개. 프리셋 파일을 갈아끼우면 다른 사업이 된다.
5. **테스트가 "계약"을 잠근다.** 단위 테스트뿐 아니라 CSS·HTML·번들 상태까지 정규식으로 검사한다(7장).

한 문장으로: **"빌드 산출물을 커밋하는, 의존성 없는 vanilla JS 계산기 + 계약 테스트"**.

---

## 2. 전체 지도

### 2.1 디렉터리

```
사업성/
├── index.html              77줄   마운트 지점(빈 div)만 있는 껍데기
├── css/style.css          730줄   토큰 + 레이아웃 + 컴포넌트
├── js/
│   ├── project-data.js    344줄   ① 데이터: 프리셋·분류·가이드 (도메인 숫자 전부)
│   ├── finance.js         730줄   ② 엔진: 순수 계산 (DOM 접근 0)
│   ├── sensitivity.js     327줄   ③ 파생: 엔진을 여러 번 호출하는 래퍼
│   ├── form-view.js       576줄   ④ 입력 렌더러
│   ├── results-view.js    153줄   ④ 결과 렌더러
│   ├── sensitivity-view.js 187줄  ④ 민감도·시나리오 렌더러
│   ├── chart.js           225줄   ⑤ SVG 차트 (문자열 반환)
│   ├── xlsx.js            300줄   ⑤ 의존성 0 .xlsx 생성기
│   ├── export-excel.js    351줄   ⑤ 결과 → 시트 배열
│   ├── app.js             201줄   ⑥ 오케스트레이션 (이벤트·탭·디바운스)
│   └── app.bundle.js    3,521줄   ⚠ 빌드 산출물. 커밋된다.
├── tests/                         계약 테스트 231개
│   ├── helpers/dom-stub.mjs       공용 DOM 스텁 (브라우저 없이 렌더러 실행)
│   └── fixtures/*.mjs             검증용 기대값 (프로덕션에서 import 금지)
├── package.json                   스크립트 3개뿐
└── PRD.md                 601줄   기획의 단일 원본
```

**줄 수 비율이 중요합니다.** 엔진(730) + 데이터(344) = 1,074줄이 "두뇌"고,
렌더러 3개(916줄)는 그 두뇌를 화면에 옮기는 손발이며,
오케스트레이션은 201줄밖에 안 됩니다. **app.js 가 비대해지면 구조가 무너진 신호입니다.**

### 2.2 데이터 흐름 — 단방향

```
   [사용자 입력]
        │ oninput
        ▼
  ProjectInput (평범한 JS 객체 하나)  ◄── project-data.js 가 초기값 생성
        │
        │ app.js: 150ms 디바운스
        ▼
  analyzeCase(input)  ─── 순수 함수. 같은 입력 → 같은 출력
        │
        ├─► { derived, totals, years[], cashflows, metrics, warnings }
        │
        ├─► results-view.js   → DOM
        ├─► chart.js          → SVG 문자열 → innerHTML
        ├─► sensitivity.js    → analyzeCase 를 30~60번 더 호출 → sensitivity-view.js
        └─► export-excel.js   → xlsx.js → Blob → 다운로드
```

**역방향 화살표가 없다는 점**이 핵심입니다. 뷰는 모델을 읽고 쓰지만, 계산 결과를 모델에 다시 써넣지 않습니다. 결과는 매번 버리고 새로 만듭니다(재계산 70~130ms).

### 2.3 의존 방향 — 절대 규칙

```
project-data.js  ←──────┐
      ▲                 │ (import 해도 되는 방향)
      │                 │
  finance.js ←── sensitivity.js
      ▲                 ▲
      │                 │
 form-view.js     sensitivity-view.js
 results-view.js        ▲
      ▲                 │
      └───── app.js ────┘
```

1. `finance.js` 는 **무엇도 import 하지 않는다**(자기 완결). 도메인 숫자도, DOM도 없다.
2. `project-data.js` 는 순수 데이터. 함수는 `createProjectInput()` 하나뿐.
3. 뷰는 서로를 import 하지 않는다. 단 하나 예외: `results-view.js` 가 `form-view.js` 의 `el()` 헬퍼를 가져온다(DOM 헬퍼 중복 방지).
4. `app.js` 만 전부를 import 한다. **역참조(뷰 → app)는 금지**, 대신 콜백(`onInput`, `onMetricChange`)을 내려준다.

---

## 3. 이 구조를 지배하는 7개 원칙

### 원칙 1 — 계산 엔진은 순수 함수다

```js
// finance.js 최상단 주석이 곧 계약이다
/**
 * PRD 3.9 가드레일:
 *   - 사업 고유 수치가 이 파일에 없다. 전부 projectInput 에서 온다.
 *   - analyzeCase(projectInput) 는 프리셋·기술 ID 를 인자로 받지 않는다.
 *   - capexItems / opexItems / debtTranches 는 배열 순회로만 다룬다 (항목명 직접 접근 금지).
 */
```

얻는 것:
1. 브라우저 없이 테스트된다 → 231개 테스트가 1.3초에 돈다.
2. 민감도 분석이 **엔진을 고치지 않고** 구현된다(입력만 바꿔 재호출).
3. 엑셀 내보내기도 엔진을 안 건드린다.

### 원칙 2 — 도메인 숫자는 한 파일에만 존재한다

`finance.js` 에서 `86`(SMP), `0.28`(이용률), `588`(기자재비) 같은 숫자를 **grep 해도 안 나옵니다.**
있는 건 `HOURS_PER_YEAR = 8760` 같은 물리 상수뿐입니다.

이 규칙을 지켰는지 확인하는 방법:

```bash
# 엔진에 도메인 숫자가 샜는지 점검 — 물리 상수 외에 하드코딩된 값이 보이면 리팩터링 대상
grep -n "= 0\.\|= [0-9]\{2,\}" js/finance.js | grep -v HOURS_PER\|DAYS_PER\|KWH_PER\|WON_PER\|QUARTERS
```

### 원칙 3 — 항목은 "이름"이 아니라 "역할 표식"으로 찾는다

사용자가 항목 이름을 바꿔도 계산이 깨지면 안 됩니다. 그래서:

```js
/** 대분류별 합계 — 이름이 아니라 group 으로 찾는다. */
function groupSum(items, code) {
  return items.reduce((sum, it) => (it.group === code && !it.auto ? sum + (it.amount || 0) : sum), 0);
}

/** role 로 찾는다 — 이름을 바꿔도, 순서를 바꿔도 깨지지 않는다. */
function roleSum(items, role) {
  return items.reduce((sum, it) => (it.role === role ? sum + (it.amount || 0) : sum), 0);
}
```

항목 스키마에 `group`(분류), `role`(의미), `auto`(자동계산 키)를 달아두고 **그것만 봅니다.**
`items.find(x => x.label === '인건비')` 는 절대 쓰지 않습니다.

### 원칙 4 — 자동계산은 언제나 수동으로 덮어쓸 수 있다

```js
function resolveWith(table, input, ctx) {
  return (it) => {
    if (!it.auto) return { ...it };                                    // 수동 항목
    if (it.amountOverride != null) return { ...it, amount: it.amountOverride, autoOverridden: true };
    const fn = table[it.auto];
    return { ...it, amount: fn ? fn(input, ctx) : 0, autoOverridden: false };  // 자동
  };
}
```

**3상태 패턴**: `auto 없음`(항상 수동) / `auto + override=null`(자동) / `auto + override=값`(수동 덮어쓰기).
화면에는 「자」 버튼을 달아 되돌릴 수 있게 합니다. 자동계산을 넣을 때 이 탈출구를 같이 만들지 않으면 반드시 민원이 들어옵니다.

### 원칙 5 — 순환 의존은 수렴 루프로 푼다

재무모델에는 순환참조가 있습니다(총투자비 → 차입 → 건설이자 → 총투자비).
엑셀은 "반복 계산" 옵션으로 풀지만, 우리는 명시적으로 돌립니다.

```js
// 안쪽 루프: 총투자비 ↔ 건설이자
for (let iter = 0; iter < 50; iter++) {
  const debtGuess = totalInvestment * (1 - input.finance.equityRatio);
  resolvedCapex = resolveCapexItems(input, debtGuess, auto);
  totalProjectCost = resolvedCapex.reduce((s, it) => s + (it.amount || 0), 0);
  equityAmount = equityBaseAmount(input, totalProjectCost, totalInvestment) * input.finance.equityRatio;
  tranches = sizeTranches(input, totalProjectCost, totalInvestment, equityAmount).sized;
  construction = simulateConstruction(buildCapexSchedule(input, resolvedCapex), equityAmount, tranches);

  const next = totalProjectCost + construction.idc;
  if (Math.abs(next - totalInvestment) < 1e-6) { totalInvestment = next; converged = true; break; }
  totalInvestment = next;
}
if (!converged) warnings.push('총투자비 수렴 계산이 50회 안에 끝나지 않았습니다.');

// ⚠ 수렴 후 한 번 더 확정한다 — 안 하면 sources ≠ uses 오차가 남는다
{
  const debtFinal = totalInvestment * (1 - input.finance.equityRatio);
  resolvedCapex = resolveCapexItems(input, debtFinal, auto);
  /* … 재산정 … */
}
```

그리고 바깥 루프(보험료 ↔ 지급이자)가 한 겹 더 있습니다:

```js
export function analyzeCase(input, { maxPasses = 8, tolerance = 1e-4, warmStart = null } = {}) {
  let auto = warmStart ? { ...AUTO_SEED, ...warmStart } : { ...AUTO_SEED };
  let out = computeCore(input, auto);
  if (!needsOuterLoop(input)) return out;          // 필요 없으면 즉시 반환 — 성능 방어

  for (let pass = 0; pass < maxPasses; pass++) {
    const next = deriveAuto(input, out);
    const delta = /* 변화량 합 */;
    if (delta < tolerance) return out;
    auto = next;
    out = computeCore(input, auto);
  }
  out.warnings = [...out.warnings, '자동계산(보험료) 수렴이 끝나지 않았습니다.'];
  return out;
}
```

세 가지 교훈:
1. **수렴 실패는 throw 하지 않고 warnings 에 담는다.** 화면이 죽으면 사용자가 원인을 못 본다.
2. **`warmStart`** — 이전 결과를 시작점으로 주면 패스 수가 반 이하로 준다. 민감도에서 60번 호출할 때 211ms → 70ms.
3. **`needsOuterLoop()`** 로 불필요한 수렴을 건너뛴다.

### 원칙 6 — 뷰는 모델을 제자리에서 수정하고, 다시 그리지 않는다

```js
/**
 * 설계 원칙
 *   1. 모델(ProjectInput)을 제자리에서 수정하고 onInput 을 부른다. 계산은 하지 않는다.
 *   2. CAPEX·OPEX·트랜치는 배열 순회로만 그린다. 항목명으로 접근하지 않는다.
 *   3. 값 입력은 폼을 다시 그리지 않는다(포커스 유지). 항목 추가·삭제 때만 해당 구역을 다시 그린다.
 */
```

3번이 실전에서 가장 중요합니다. 숫자를 타이핑할 때마다 폼을 re-render 하면 **커서가 튑니다.**
그래서 `get`/`set` 클로저로 필드를 모델에 직접 묶고, 구조가 바뀔 때만(`drawCapexGroup(code)`) 해당 구역만 다시 그립니다.

```js
function numberField(label, unit, get, set, onInput, opts = {}) {
  const input = el('input', {
    type: 'number', step: String(opts.step ?? 'any'), value: fmtValue(get()),
    oninput: () => {
      const v = Number(input.value);
      if (!Number.isFinite(v)) return;   // 입력 중간 상태("-", "1.") 는 무시
      set(v);
      onInput();
    },
  });
  /* … */
}
```

### 원칙 7 — 보이는 것만 계산한다

```js
/** 보이는 탭만 계산한다 — 숨은 탭까지 매번 돌릴 이유가 없다. */
function renderActiveTab() {
  if (activeTab === 'tab-sensitivity') renderSensitivityTab();
  else if (activeTab === 'tab-scenario') renderScenarioTab();
}
```

민감도 탭은 엔진을 60번 부르므로 요약 탭을 보는 동안은 계산하지 않습니다.
단, **엑셀 내보내기는 숨은 탭까지 전부 계산합니다** — 파일에는 다 들어가야 하니까요.

---

## 4. 가장 중요한 제약 — `file://` 에서 열린다

> `index.html` 을 더블클릭해 열어도 전부 동작해야 한다. 이것이 아래 번들 제약의 이유다.

`file://` 프로토콜에서는 `<script type="module">` 이 **CORS 로 차단**됩니다. 그래서:

1. 소스는 ES 모듈(`js/*.js`)로 쓴다 — 개발 편의·테스트 가능성 확보.
2. 브라우저에는 **IIFE 번들 1개만** 준다.
3. **번들을 저장소에 커밋한다.** 받는 사람이 `npm install` 없이 열 수 있어야 하므로.

```bash
# 소스를 고쳤으면 반드시 재생성 — 안 하면 화면에 반영되지 않는다
npx --yes esbuild@0.25.6 js/app.js --bundle --format=iife --platform=browser --outfile=js/app.bundle.js
# 또는
npm run build
```

**이걸 잊는 게 1번 함정입니다.** 그래서 계약 테스트가 잠급니다:

```js
test('index.html 은 번들만 로드한다 (module 스크립트 금지)', () => {
  assert.ok(!/<script[^>]*type\s*=\s*["']module["']/i.test(html), 'type="module" 스크립트가 있으면 file:// 에서 CORS 로 막힌다');
  assert.ok(/<script[^>]*src\s*=\s*["']js\/app\.bundle\.js["']/i.test(html));
});

test('번들에 ESM 구문이 남아 있지 않다', () => {
  assert.ok(!/^\s*import\s/m.test(bundle), '번들에 import 문이 남아 있다 — 재빌드 필요');
  assert.ok(!/^\s*export\s/m.test(bundle), '번들에 export 문이 남아 있다 — 재빌드 필요');
});
```

파생 제약 3개:
1. **외부 라이브러리 금지** → 차트는 SVG 직접 생성, 엑셀은 ZIP+OOXML 직접 구현.
2. **`fetch()` 금지** → 데이터는 `.js` 파일로 `export`. (`발전사업허가_웹` 은 `data/*.json` 과 동일 내용의 `data/*.js` 를 둘 다 두는 방식을 씁니다.)
3. **CSS는 `<link>` 로 OK** — 스타일시트는 `file://` 에서 막히지 않습니다.

---

## 5. 레이어 해부

### 5.1 L1 데이터 — `project-data.js`

역할: **"이 도메인의 모든 숫자와 분류"**. 함수는 `createProjectInput()` 하나.

네 종류의 export 가 있습니다.

**(a) 고정 분류 (코드가 의존하는 구조)**

```js
/** CAPEX 대분류 — 고정 7종. 세부 항목만 가변. */
export const CAPEX_GROUPS = [
  { code: '가', label: '직접공사비(EPC)' },
  /* … */
  { code: '사', label: '기타' },
];
```

**(b) 열거형 (매직 문자열 방지)**

```js
export const CAPEX_PHASES  = { DEVELOPMENT: 'development', CONSTRUCTION: 'construction', FINANCING: 'financing' };
export const DEBT_SIZING   = { PROJECT_COST_PCT: 'projectCostPct', TOTAL_INVESTMENT_PCT: 'totalInvestmentPct', FIXED: 'fixed', PLUG: 'plug' };
export const REPAYMENT     = { BULLET: 'bullet', ANNUITY: 'annuity', STRAIGHT: 'straight' };
```

**(c) 프리셋 — 초기값 트리**

```js
export const ONSHORE_WIND_PRESET = {
  id: 'onshore-wind', label: '육상풍력', revenueModel: 'smp-rec',
  defaults: { projectName, capacity{}, schedule{}, revenue{}, finance{}, tax{}, dscr{}, dividendPolicy{}, autoCalc{} },
  capexItems: [ /* 18개 */ ],
  opexItems:  [ /* 8개 */ ],
  debtTranches: [ /* 2개 */ ],
  sponsorCashflows: [],
};
```

**핵심: 모든 요율이 입력값입니다.** 자동계산 식도 요율을 `autoCalc` 에서 읽습니다.

```js
autoCalc: {
  financeFee: { rate: 0.009, base: 'debt' },
  constructionInsurance: { bondCoverageRatio: 0.1, bondBaseRate: 0.005, bondBufferDays: 60, /* … */ },
  contingency: { rate: 0.08, baseGroup: '가' },
  omPerTurbine: { ltsa: 1, bop: 0.2791666666666667 },
}
```

**(d) 참고 자료 — 계산에 안 쓰이는 것**

```js
/**
 * CAPEX 단가 가이드 — 참고용. 계산에 쓰이지 않고 화면에 보여주기만 한다.
 * 금액을 얼마로 넣어야 할지 감을 잡는 용도이며, 입력값을 자동으로 채우지 않는다.
 */
export const CAPEX_GUIDES = [ /* basis: perMw | perTurbine | lines | text */ ];
export const OPEX_NOTES   = [ { id, label, text, ref } ];   // 항목 의미 설명 + 근거
export const TECHNOLOGIES = [ { id, label, ready, phase, note } ];  // 미구현 탭 안내
```

`CAPEX_GUIDES`/`OPEX_NOTES` 는 **도메인 지식을 코드에 박아두는 좋은 자리**입니다. 주석이 아니라 데이터라서 화면에 띄울 수 있습니다.

**프리셋 → 입력 모델 변환은 반드시 깊은 복사로:**

```js
/** 프리셋 → ProjectInput. 깊은 복사이므로 이후 자유롭게 수정 가능. */
export function createProjectInput(preset = ONSHORE_WIND_PRESET) {
  return {
    technologyId: preset.id,
    revenueModel: preset.revenueModel,
    ...structuredCloneCompat(preset.defaults),
    capexItems: structuredCloneCompat(preset.capexItems),
    /* … */
  };
}
function structuredCloneCompat(value) { return JSON.parse(JSON.stringify(value)); }
```

얕은 복사로 만들면 "기본값으로 되돌리기"가 망가집니다(프리셋 자체가 오염됨).

### 5.2 L2 엔진 — `finance.js`

6개 구역으로 나뉩니다. 구역 구분선을 주석으로 명시합니다.

```
1. 순수 수학 유틸     npv, irr, progressiveTax, escalationFactor, paybackYears
2. 날짜 유틸          toDate, yearOf, quarterIndex, yearOverlapFraction, yearFrac30360
3. 수익 모듈 테이블    REVENUE_MODELS
4. 자금 인출·재원      buildCapexSchedule, simulateConstruction, sizeTranches, buildRepaymentSchedule
5. 메인               computeCore  ← 전체의 40%
6. 자동계산 + 바깥 루프 CAPEX_AUTO, OPEX_AUTO, deriveAuto, analyzeCase
```

**수익 모듈 테이블 — 도메인 확장의 핵심 이음매:**

```js
const REVENUE_MODELS = {
  'smp-rec': (input, capacity) => { /* 발전량 × (SMP + REC×가중치) */ },
  // BESS 는 여기에 'charge-discharge' 를 추가하면 된다 — computeCore 는 안 건드린다
};

const revenueModel = REVENUE_MODELS[input.revenueModel];
if (!revenueModel) throw new Error(`알 수 없는 수익 모듈: ${input.revenueModel}`);
const rev = revenueModel(input, capacity);
```

새 에너지원이 **수익식만 다르면** 이 테이블에 한 줄 추가하면 끝입니다. 태양광은 수익식이 같으니 프리셋만 추가하면 되고, BESS는 여기에 모듈을 더해야 합니다.

**자동계산 테이블 — 같은 패턴:**

```js
const CAPEX_AUTO = {
  financeFee: (input, ctx) => { /* … */ },
  constructionInsurance: (input, ctx) => constructionInsurance(input, ctx.auto).total,
  contingency: (input) => groupSum(input.capexItems, cfg(input,'contingency').baseGroup || '가') * (cfg(input,'contingency').rate ?? 0),
};
const OPEX_AUTO = {
  operatingInsurance: (input, ctx) => operatingInsurance(input, ctx.auto).total,
  omLtsa: (input) => (input.capacity.turbineCount || 0) * (cfg(input,'omPerTurbine').ltsa ?? 0),
  omBop:  (input) => (input.capacity.turbineCount || 0) * (cfg(input,'omPerTurbine').bop  ?? 0),
};
```

항목의 `auto: 'financeFee'` 문자열이 테이블 키입니다. **데이터가 동작을 지목하는 구조**라서, 항목을 추가해도 엔진 코드는 그대로입니다.

**반환 형태 — 5개 묶음으로 고정:**

```js
return {
  derived:   { /* 스칼라 파생값 30여 개 — 화면이 바로 쓸 수 있는 형태 */ },
  totals:    { /* 기간 합계 */ },
  years:     [ { year, phase, opFraction, revenue, opex, /* … */ dscr } ],  // 연도별 행
  cashflows: { preTax: [], postTax: [], equity: [] },                        // IRR 입력용 배열
  metrics:   { preTax: {irr,npv,payback}, postTax: {…}, equity: {…} },
  warnings:  [ '…' ],
};
```

**`derived` 를 후하게 채우는 게 요령입니다.** 뷰에서 다시 계산하면 두 곳이 어긋납니다.
예: `equityRatioOfInvestment`, `equityRatioOfProjectCost` 를 둘 다 내보내서 뷰가 나누기를 안 하게 합니다.

**`warnings` 규약:** 계산 불가(입력 자체가 깨짐)는 `throw`, "되지만 이상함"은 `warnings.push`.
`app.js` 가 `throw` 를 잡아 경고 영역에 띄웁니다.

```js
try { result = analyzeCase(input); }
catch (err) {
  hosts.warnings.hidden = false;
  hosts.warnings.textContent = `계산 오류: ${err.message}`;
  return;        // 이전 화면을 유지한다 — 빈 화면보다 낫다
}
```

### 5.3 L3 파생 — `sensitivity.js`

> 엔진을 수정하지 않는다. `analyzeCase()` 를 입력만 바꿔 여러 번 부르는 래퍼다.
> 그래서 이터 3 은 이터 1·2 의 계산 결과를 흔들지 않는다.

**변수 정의를 데이터로:**

```js
export const SENSITIVITY_VARIABLES = [
  {
    id: 'capacityFactor', label: '이용률', kind: 'relative',
    read:        (i) => i.revenue.capacityFactor,
    apply:       (i, factor) => { i.revenue.capacityFactor *= factor; },
    setAbsolute: (i, v) => { i.revenue.capacityFactor = v; },
    format:      (v) => `${(v * 100).toFixed(1)}%`,
  },
  /* smp, rec, tariff, capex, debtRate */
];
```

4개 함수(`read`/`apply`/`setAbsolute`/`format`)가 한 변수의 완전한 명세입니다. 변수를 추가하려면 배열에 객체 하나만 넣으면 됩니다. 민감도 표·토네이도 차트·임계값 탐색 **셋 다 자동으로** 새 변수를 다룹니다.

**배열 변수는 배율로 움직입니다** — 항목명으로 접근하지 않기 위해서:

```js
apply: (i, factor) => { for (const it of i.capexItems) if (!it.auto) it.amount *= factor; },
```

**성능 두 가지:**

```js
// 1. warmStart — 기준 계산의 autoValues 를 모든 변동 케이스에 물려준다
const baseResult = analyzeCase(input);
const warmStart = baseResult.derived.autoValues;
m = metricsOf(analyzeCase(trial, { warmStart }));
```

```js
/**
 * IRR 은 배율에 대해 매끄럽고 거의 선형이라, 이분법 대신 가위치법(Illinois false position)을
 * 쓰면 같은 정밀도를 1/3 의 호출로 얻는다. 민감도 탭이 200ms 예산 안에 들어가려면 필요하다.
 */
export function breakeven(input, variable, targetIrr, { lo = 0.2, hi = 3.0, iterations = 24, /* … */ }) { }
```

측정 기록: 이분법 329ms → 가위치법 124ms. **그리고 그 예산을 테스트로 잠갔습니다:**

```js
test('민감도 탭 전체가 200ms 예산 안에 들어간다', () => { /* … */ });
```

### 5.4 L4 뷰 — 렌더러 3개

**공용 DOM 헬퍼 — 전체 뷰 코드의 기반 (14줄):**

```js
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in node) node[k] = v;        // value, hidden, readOnly, type …
    else node.setAttribute(k, v);           // aria-*, data-*, title …
  }
  for (const c of children.flat()) if (c != null) node.append(c);
  return node;
}
```

이 14줄이 JSX 역할을 합니다. `else if (k in node)` 분기가 중요한데, **DOM 스텁에 프로퍼티가 없으면 `setAttribute` 로 빠져서 테스트가 어긋납니다**(10장 함정 4).

**필드 팩토리 5종:** `numberField` / `textField` / `dateField` / `selectField` / `section`.
전부 `(label, get, set, onInput, opts)` 시그니처를 따릅니다. 새 입력 유형이 필요하면 여기에 6번째를 추가합니다.

**항목 행(`itemRow`) — 가변 목록의 표준형:**

```
[이름 입력] [금액 입력] [자] [₩] [×]
                        └ 자동계산 되돌리기 (auto 항목만)
                            └ 물가상승 토글 (OPEX만)
                                └ 삭제
[단계 select]   ← CAPEX만, 둘째 줄
```

포인트 3개:
1. 자리를 비울 때도 `el('span', {})` 를 넣어 **그리드 칼럼을 유지**합니다.
2. 빈 문자열 입력(`raw === ''`)은 자동계산 복귀로 해석합니다.
3. `title` 속성에 가이드/설명을 넣어 **툴팁으로 도메인 지식을 전달**합니다.

**`refreshTotals(result)` — 역방향 업데이트의 유일한 통로:**

```js
export function renderForm(host, input, { onInput }) {
  /* … 전부 그린 뒤 … */
  function refreshTotals(result) {
    const d = result.derived;
    secA.total.textContent = `${d.capacityMw.toLocaleString('ko-KR')} MW`;
    opEndEl.value = d.operationEndDate;               // 자동계산된 읽기전용 칸
    /* 자동계산 항목 입력칸에 계산값 다시 채우기 */
  }
  return { refreshTotals };
}
```

폼을 다시 그리지 않으면서 "자동계산 결과"를 폼에 보여주려면 이 경로가 필요합니다.
`app.js` 가 재계산 후 한 번 부릅니다: `if (form) form.refreshTotals(result);`

**차트는 문자열을 반환합니다:**

```js
const wrap = el('div', { class: 'chart-wrap' });
wrap.innerHTML = cashflowChartSvg(result.years);
```

`chart.js` 는 DOM을 만들지 않고 **SVG 문자열**을 돌려줍니다. 그래서 Node에서 테스트할 수 있고, 엑셀/인쇄로 재사용할 여지가 남습니다. 단 **직접 이스케이프**해야 합니다:

```js
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
```

### 5.5 L5 오케스트레이션 — `app.js`

> 역할: 모델 보관 · 탭 전환 · 디바운스 재계산 · 뷰 호출.
> 계산도 렌더도 직접 하지 않는다.

201줄로 유지되는 이유는 **오직 배선만** 하기 때문입니다.

```js
let input = createProjectInput(ONSHORE_WIND_PRESET);   // 모델 — 단 하나
let form = null;
let lastResult = null;
let scenarios = defaultScenarios(input);

/** 민감도 탭 상태 — 계산 결과가 아니라 화면 설정이다. */
const sensState = { metricId: 'postTaxIrr', rangePct: 20, targetIrr: 0.07 };
```

**모델과 화면 상태를 분리**하는 게 포인트입니다. `sensState` 는 엑셀로 내보내지지도, 저장되지도 않는 UI 상태입니다.

**마운트 지점 일괄 수집:**

```js
const $ = (id) => document.getElementById(id);
const hosts = {
  form: $('form'), cards: $('cards'), cardsScale: $('cards-scale'), basis: $('basis'),
  chart: $('chart'), table: $('table'), warnings: $('warnings'), timing: $('timing'),
  sensitivity: $('sensitivity'), scenario: $('scenario'),
  energyTabs: $('energy-tabs'), comingSoon: $('coming-soon'), layout: $('layout'),
};
```

이 id 목록이 곧 `index.html` 과의 계약이고, **계약 테스트가 둘을 대조**합니다.

**디바운스 3종 + 성능 표시:**

```js
const DEBOUNCE_MS = 150;
let timer = null;
function scheduleRecalc() { clearTimeout(timer); timer = setTimeout(recalc, DEBOUNCE_MS); }
// scheduleSensitivity(), scheduleScenario() 도 각자 타이머를 갖는다

function recalc() {
  const t0 = Date.now();
  /* … */
  if (hosts.timing) hosts.timing.textContent = `재계산 ${Date.now() - t0}ms`;
}
```

**재계산 시간을 화면에 상시 노출**하는 건 작지만 강력한 습관입니다. 성능 회귀를 즉시 눈치챕니다.

**탭 — HTML 속성을 믿지 않고 JS가 정합니다:**

```js
function selectTab(tabId) {
  activeTab = tabId;
  for (const t of TABS) {
    const on = t.tab === tabId;
    $(t.tab)?.setAttribute('aria-selected', String(on));
    const p = $(t.panel); if (p) p.hidden = !on;
  }
  renderActiveTab();
}
// 초기화에서: selectTab(activeTab);  ← 초기 탭 상태를 HTML 속성에 기대지 않는다
```

**미구현 탭 처리 — 빈 화면 대신 안내:**

```js
function selectTech(id) {
  const tech = TECHNOLOGIES.find((t) => t.id === id) || TECHNOLOGIES[0];
  if (hosts.layout) hosts.layout.hidden = !tech.ready;
  cs.hidden = !!tech.ready;
  if (tech.ready) return;
  /* Phase 안내 + note + "돌아가기" 버튼 */
}
```

**되돌리기 = 모델 재생성 + 전체 재구축:**

```js
resetBtn.addEventListener('click', () => {
  input = createProjectInput(ONSHORE_WIND_PRESET);
  scenarios = defaultScenarios(input);
  if (nameInput) nameInput.value = input.projectName;
  build();                       // 폼까지 다시 그린다
});
```

### 5.6 L6 출력 — `chart.js` / `xlsx.js` / `export-excel.js`

**의존성 0 으로 .xlsx 를 만드는 법** (`xlsx.js` 300줄):

```
1. CRC32 테이블 (256엔트리) 직접 생성
2. ZIP store(무압축) — 로컬헤더 + 중앙디렉터리 + EOCD
   └ 타임스탬프를 고정값(0)으로 → 같은 입력이면 같은 바이트 → 테스트 안정
3. OOXML 최소 집합
   [Content_Types].xml / _rels/.rels / xl/workbook.xml
   xl/_rels/workbook.xml.rels / xl/styles.xml / xl/worksheets/sheet1..N.xml
4. 문자열은 inlineStr 로 → sharedStrings.xml 생략
5. 스타일은 이름 테이블로 (STYLE_DEFS 배열 순서 = cellXfs 인덱스)
```

```js
/** 이름 → cellXfs 인덱스. 순서가 곧 인덱스다. */
const STYLE_DEFS = [
  ['DEFAULT', { font: 0 }],
  ['TITLE',   { font: 2, align: 'left', height: 22 }],
  ['HEADER',  { font: 3, fill: 2, border: 1, align: 'center', wrap: true }],
  /* … 24종 … */
];
export const STYLES = Object.fromEntries(STYLE_DEFS.map(([name], i) => [name, i]));
```

**셀 형식 규약 — 비율은 0~1 로 넣고 서식으로 보여줍니다:**

```js
/**
 * 값은 엑셀이 이해하는 형태로 넣는다 — 비율은 0.0692 로 넣고 서식(0.00%)이 6.92% 로 보여준다.
 * 그래야 엑셀에서 정렬·차트·수식이 그대로 먹는다.
 */
const pc = (v) => cell(v == null || !Number.isFinite(v) ? null : Number(v.toFixed(6)), 'PCT');
```

`"6.92%"` 문자열로 넣으면 받는 사람이 엑셀에서 계산을 못 합니다. **내보내기의 품질은 이 한 가지로 결정됩니다.**

**`export-excel.js` 는 계산을 안 합니다:**

```js
/**
 * 계산은 하지 않는다. analyzeCase()·sensitivityCases()·scenarioCases() 결과를 시트로 옮기기만 한다.
 * 시트 구성: 요약 · 입력값 · 연도별 현금흐름 · 민감도 · 시나리오
 */
const section = (label, width) => [cell(label, 'SECTION'), ...Array.from({ length: width - 1 }, () => cell(null, 'SECTION'))];
```

`section()` 헬퍼가 배경색을 시트 폭 전체에 깔기 위해 빈 칸까지 채우는 것 같은 디테일이 "받아서 그대로 쓸 수 있는 파일"을 만듭니다.

---

## 6. CSS 규약

**토큰 우선 (`:root` 24개):**

```css
/* 계약 테스트가 잠그는 것: 44px 터치 타깃, 1180px·760px 브레이크포인트.
   색·폰트·여백은 테스트가 건드리지 않으므로 자유롭게 바꿀 수 있습니다. */
:root {
  --bg: #f4f6f8;  --panel: #ffffff;  --panel-alt: #fafbfc;
  --line: #e3e7ec;  --line-strong: #cbd2da;
  --ink: #1a1f28;  --ink-2: #4a5462;  --muted: #7b8794;
  --accent: #0f6b4a;  --accent-soft: #e7f2ed;
  --danger: #b3261e;  --warn-bg: #fff5e6;  --warn-ink: #8a4b08;
  --pos: #0f6b4a;  --neg: #b3261e;
  --radius: 10px;  --shadow: 0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06);
}
```

**파일 구조 — 구역 주석으로 나눕니다:**

```
:root 토큰 → body → 헤더 → 레이아웃 → 아코디언 → 입력 필드 →
항목 목록 → 결과 카드 → 표 → 차트 → 경고 → 좁은 화면 → 탭 →
민감도 → 시나리오 → (이후 증분 추가 구역)
```

뒤쪽에 `/* ══ 좌측 입력 패널 가시성 ═══ */` 처럼 **나중에 덧붙인 구역**이 있습니다. 앞 규칙을 덮어쓰는 형태인데, 실무적으로는 괜찮습니다 — 어느 요청으로 뭐가 바뀌었는지 추적됩니다. 다만 3개 넘게 쌓이면 앞 구역으로 통합하세요.

**잠긴 3가지 (바꾸면 테스트가 깨집니다):**

1. **44px 터치 타깃** — `input[type=number]`, `.btn`, `.chip`, `.acc > summary`, `.tab`, `.etab`
2. **브레이크포인트 1180px / 760px** — 2단 → 1단, 1단 → 모바일
3. **넓은 콘텐츠는 자체 컨테이너에서 스크롤** — `.table-wrap`, `.chart-wrap` 에 `overflow-x: auto`. 본문이 가로로 밀리면 안 됩니다.

**가시성 계층 (2단 단계 구분):**

```css
.acc[open] > summary { background: var(--accent-soft); border-left-color: var(--accent); }
.acc[open] > summary .acc-title { color: var(--accent); }
.acc-body { background: #f7f9fa; }        /* 펼친 내용 = 눌린 바탕 */
.capex-group { background: #fff; }        /* 그 안의 목록 = 흰 카드 */
.acc > summary { position: sticky; }      /* 스크롤해도 어느 구역인지 보인다 */
```

**바탕(회색) → 카드(흰색) → 강조(accent-soft)** 3단 구조를 쓰면, 하얀 칸이 끝없이 이어지는 문제가 해결됩니다.

---

## 7. 테스트 전략 — 계약 테스트

231개 테스트가 4종류입니다.

### 7.1 벤치마크 대조 — 숫자가 맞는가

```js
import { ONSHORE_BENCHMARK as B } from './fixtures/onshore-workbook-benchmark.mjs';

function checkAgainst(actualBag, specBag, label) {
  for (const [key, spec] of Object.entries(specBag)) {
    const limit = spec.tol ?? spec.tolAbs ?? Math.abs(spec.expected) * spec.tolPct;
    assert.ok(Math.abs(actualBag[key] - spec.expected) <= limit,
      `${label}.${key}: 기대 ${spec.expected}, 실제 ${actualBag[key]}, 오차 ${(actualBag[key]-spec.expected).toFixed(6)} (허용 ±${limit})`);
  }
}
```

**허용 오차를 항목마다 데이터로 지정**합니다(`tol` 절대값 / `tolPct` 비율). 재무 계산은 참조 모델과 100% 일치하지 않습니다 — 트랜치 분할 방식이 의도적으로 다르거나, 참조 쪽이 수동 캐시값을 갖고 있기도 합니다. **오차 허용치와 그 이유를 코드에 박아두는 것**이 이 패턴의 핵심입니다.

픽스처는 읽기 전용이고 **프로덕션 코드에서 import 하지 않습니다.**

### 7.2 판정 케이스 — 예시에 기대지 않는가

```js
/**
 * "예시와 전혀 다른 사업을 입력했을 때 정상 동작하는가"
 *   20MW / 개발 2년 · 공사 1년 / 주민참여채권 없음 / EPC 일괄 도급 1줄 /
 *   거치 3년 원금균등 / 운영 15년 / 지역발전기금 10%
 * 예시 사업의 값에 기대지 않는다는 것을 코드로 고정한다.
 */
function altProject() {
  const p = createProjectInput();
  p.capacity = { unitCapacityMw: 1, turbineCount: 20, capacityMwOverride: 20 };
  p.capexItems = [ /* 구조를 통째로 갈아엎는다 */ ];
  /* … */
}
```

**이 테스트가 "범용 계산기"라는 약속을 지킵니다.** 프리셋 값에 은근히 의존하는 코드를 잡아냅니다.

### 7.3 계약 테스트 — CSS·HTML·번들을 문자열로 검사

```js
const html   = readFileSync(join(root, 'index.html'), 'utf8');
const css    = readFileSync(join(root, 'css/style.css'), 'utf8');
const bundle = readFileSync(join(root, 'js/app.bundle.js'), 'utf8');

test('뷰가 붙는 마운트 지점 id 가 모두 존재한다', () => {
  const ids = ['form', 'cards', 'basis', /* … app.js 가 찾는 전부 … */];
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `index.html 에 id="${id}" 가 없다`);
});

test('입력 컨트롤은 44px 이상의 터치 타깃을 가진다', () => {
  assert.match(css, /input\[type="number"\][\s\S]{0,200}?min-height:\s*44px/);
});
```

**파서 없이 정규식으로 합니다.** 정밀하진 않지만 **의존성 0** 으로 회귀를 막습니다.
잠글 것과 자유롭게 둘 것을 명시적으로 고릅니다 — 색은 자유, 터치 타깃은 잠금.

### 7.4 스모크 테스트 — 번들을 Node에서 실제로 실행

```js
function runBundle(opts = {}) {
  const doc = makeDocument(MOUNT_IDS);
  globalThis.Blob = class { constructor(parts) { this.size = parts[0].length; } };
  globalThis.URL = { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} };
  doc.createElement = (tag) => { /* <a> 의 click 을 가로채 다운로드를 기록 */ };

  const bundle = readFileSync(join(root, 'js/app.bundle.js'), 'utf8');
  const timers = [];
  const fn = new Function('document', 'setTimeout', 'clearTimeout', bundle);
  fn(doc, (cb) => { timers.push(cb); return timers.length; }, () => {});

  return { doc, downloads, $: (id) => doc.getElementById(id), flush: () => timers.splice(0).forEach(cb => cb()) };
}
```

이게 가장 강력한 테스트입니다.
1. `new Function` 에 `document`/`setTimeout` 을 **주입**합니다 — IIFE 번들이라 가능합니다.
2. `setTimeout` 을 배열에 모아서 `flush()` 로 **디바운스를 즉시 소진**합니다.
3. 번들을 직접 읽으므로 **재빌드를 잊으면 여기서 걸립니다.**

**공용 DOM 스텁** (`tests/helpers/dom-stub.mjs`, 90줄):

```js
export class TestElement {
  constructor(tag = 'div') {
    /* … */
    // 실제 DOM 처럼 프로퍼티로 존재해야 el() 이 setAttribute 대신 프로퍼티에 넣는다.
    this.value = ''; this.hidden = false; this.className = ''; this.readOnly = false;
    this.checked = false; this.selected = false; this.open = false;
    this.type = ''; this.step = ''; this.placeholder = ''; this.title = '';
  }
  /** [data-x="y"] 형태만 지원한다. */
  querySelector(sel) { /* … */ }
}
export function installDocument(ids = []) { globalThis.document = makeDocument(ids); }
```

**스텁은 반드시 한 파일에 두세요.** 테스트마다 각자 갖고 있으면 한쪽만 갱신돼 어긋납니다(실제로 겪은 일입니다).

### 7.5 성능 예산도 테스트

```js
test('민감도 전체 계산이 200ms 안에 끝난다 (PRD 3.7)', () => { /* … */ });
test('임계값 탐색이 가위치법으로 호출 수를 줄인다', () => { /* calls 수 검증 */ });
```

---

## 8. 복제 레시피 — 새 페이지 만들기

### 0단계 — 기획을 PRD 한 파일로 먼저 쓴다

코드를 건드리기 전에 `PRD.md` 를 씁니다. `사업성/PRD.md` 의 목차를 그대로 베끼세요.

```
1. 배경과 목적 (+ 1.4 예시 자료의 위치 ← 가장 중요)
2. 범위 — Phase 전략 / In Scope / Out of Scope
3. 제품 요구사항 — 3.2 화면 구성 / 3.3 입력 명세 / 3.4 계산 명세
                  / 3.6 데이터 모델 / 3.7 비기능 / 3.9 구현 가드레일
4. 개발 이터레이션 — 4.1 변경 비용 지도 / 4.2~4.4 3단계
5. 검증 기준 — 참조 자료 대조표 (실측값 채워 넣기)
6. 열린 이슈
```

**「1.4 예시 자료의 위치」** 가 왜 가장 중요한가: 참조 자료를 받아서 만들 때, 그 자료의 값이 슬금슬금 코드에 박히는 게 최대 리스크입니다. "이건 예시일 뿐이고 임의 입력이 들어가야 한다"를 문서 맨 앞에 못 박고, 그 약속을 7.2 판정 케이스 테스트로 강제합니다.

**「3.9 구현 가드레일」** 은 5~7줄짜리 금지 목록입니다. 예:
1. 엔진 파일에 도메인 숫자를 두지 않는다.
2. 항목을 이름으로 찾지 않는다(`group`/`role` 로 찾는다).
3. 뷰는 계산하지 않는다.

**「4.1 변경 비용 지도」** — "어디를 고치면 어디까지 번지는가" 표. 이터레이션 순서를 정하는 근거가 됩니다.

### 1단계 — 골격 파일 6개를 만든다

부록 B의 코드를 그대로 복사하세요. 이 시점에 `npm test` 가 돌아야 합니다(테스트 0개라도).

```
새프로젝트/
├── index.html        마운트 지점만
├── css/style.css     :root 토큰 + 레이아웃
├── js/{data,engine,form-view,results-view,app}.js
├── tests/helpers/dom-stub.mjs      ← 사업성에서 그대로 복사
├── tests/layout-contract.test.mjs  ← 사업성에서 복사 후 id 목록만 교체
└── package.json
```

`tests/helpers/dom-stub.mjs` 는 **도메인 무관**하므로 무조건 복사하세요. 90줄로 브라우저 테스트 환경이 공짜로 생깁니다.

### 2단계 — 이터 1: 엔진부터 만든다. 화면은 나중에

**순서를 지키세요.** 화면을 먼저 만들면 숫자를 검증할 방법이 없어서 엔진이 화면 코드에 섞입니다.

1. `data.js` 에 프리셋 하나를 넣는다(참조 자료의 값).
2. `engine.js` 에 `analyze(input)` 를 쓴다. `console.log` 로 결과를 본다.
3. `tests/fixtures/*-benchmark.mjs` 에 참조 자료의 기대값을 박는다.
4. 대조 테스트를 돌려 오차를 맞춘다.

**완료 조건: 참조 자료의 핵심 지표가 허용 오차 안에 들어온다.**

### 3단계 — 이터 1 보강: 판정 케이스

프리셋과 **전혀 다른 입력**으로 테스트를 하나 씁니다(7.2). 여기서 십중팔구 "프리셋 값에 기댄 코드"가 드러납니다.

### 4단계 — 이터 2: 입력 폼 전체

1. `el()` 헬퍼 복사.
2. 필드 팩토리(`numberField` 등) 복사.
3. 아코디언 구역 A~G 를 도메인에 맞게 배치.
4. 가변 목록은 `itemRow` 패턴으로.

**완료 조건: 참조 자료의 값을 손으로 다 입력하면 2단계와 같은 결과가 나온다.**
(실제로 이 단계에서 "CAPEX 인출 단계 select 를 화면에 안 만들어서 IRR 이 0.22%p 어긋난" 버그가 잡혔습니다.)

### 5단계 — 이터 2 보강: 결과 화면 + 스모크 테스트

1. 카드 → 차트 → 산출 근거 표 → 연도별 상세 표 순으로.
2. `npm run build` 로 번들 생성.
3. 스모크 테스트(7.4)를 붙인다.

### 6단계 — 이터 3: 파생 기능

민감도·시나리오·내보내기. **엔진을 수정하지 않고** 래퍼로만 만듭니다.
수정하고 싶어지면 그건 엔진의 `derived` 가 부족하다는 뜻이니, 값을 더 내보내세요.

### 7단계 — 계약 테스트로 잠근다

1. 마운트 지점 id 목록
2. 44px / 브레이크포인트 / `overflow-x`
3. 번들에 ESM 없음
4. 성능 예산

### 8단계 — CLAUDE.md 에 프로젝트 구역을 추가한다

명령어, 제약(번들 재생성!), 모듈 경계, 단일 원본 문서를 적습니다.
**특히 "소스를 고쳤으면 번들을 재생성해야 한다"는 반드시** — 이걸 빠뜨리면 다음 세션의 AI가 100% 실수합니다.

---

## 9. 도메인 치환 표

| 사업성 | 역할 | 다른 도메인 예시 |
|---|---|---|
| `ProjectInput` | 단일 모델 객체 | 설계 입력 / 견적 입력 / 시뮬레이션 조건 |
| `ONSHORE_WIND_PRESET` | 도메인 기본값 트리 | 표준 사양 / 템플릿 / 기준 케이스 |
| `CAPEX_GROUPS` (고정 7종) | 코드가 의존하는 분류 | 공정 분류 / 계정 과목 / 부위 구분 |
| `capexItems[]` (가변) | 사용자가 추가·삭제 | 내역 항목 / 부재 목록 / 장비 목록 |
| `auto: 'financeFee'` | 자동계산 지목 | 수량 자동 산출 / 단가 자동 조회 |
| `amountOverride` | 수동 덮어쓰기 | 동일 |
| `REVENUE_MODELS` 테이블 | 도메인 변종 이음매 | 공법별 / 기준별 / 지역별 모듈 |
| `analyzeCase()` | 순수 계산 진입점 | `calculate()` / `simulate()` / `evaluate()` |
| `derived` / `totals` / `years[]` / `metrics` | 결과 5묶음 | 파생값 / 합계 / 시계열 / 핵심지표 |
| `warnings[]` | "되지만 이상함" | 동일 |
| `SENSITIVITY_VARIABLES` | 흔들 변수 명세 | 설계 변수 / 파라미터 스윕 |
| `onshore-workbook-benchmark.mjs` | 참조 자료 기대값 | 수계산 검증표 / 기존 시스템 출력 |
| 수렴 루프 | 순환 의존 해소 | 구조해석 반복 / 열평형 / 재귀 단가 |

**같은 저장소의 자매 프로젝트:** `발전사업허가_웹/` 이 이미 같은 구조입니다.
(`app.bundle.js` 커밋, `layout-contract.test.mjs`, `data-contract.test.mjs`, `data/*.js` + `data/*.json` 이중 보관)
**새 페이지를 만들 때 가장 가까운 참고는 이 두 프로젝트를 나란히 놓고 보는 것입니다.**

---

## 10. 함정 모음 — 실제로 밟은 것들

### 함정 1 ⭐ — 번들 재생성을 잊는다

가장 자주, 가장 확실하게 발생합니다. 소스를 고쳤는데 화면이 안 바뀝니다.

```bash
npm run build   # 소스 수정 후 항상
```

방어: 스모크 테스트가 번들을 직접 실행하므로 `npm test` 가 잡아줍니다. **커밋 전 `npm test` 를 습관으로.**

### 함정 2 ⭐ — 큰 텍스트를 heredoc 으로 파일에 쓰려다 깨진다

`cat > file << 'EOF'` 로 긴 한글 텍스트(특히 정규식·백틱 포함)를 넘기면
`unexpected EOF while looking for matching` 로 반복 실패합니다.

**해결: Write 도구를 쓰거나, scratchpad 에 스크립트 파일을 만들어 실행합니다.**
같은 이유로 `python -c "..."` 에 정규식을 넘기면 `\d` 같은 이스케이프가 bash → python 경유에서 깨집니다.

### 함정 3 — 문자열 치환이 두 곳을 동시에 바꾼다

`s.replace(anchor, new)` 로 코드를 수정할 때, 앵커가 2곳 이상이면 **두 번째 앵커가 사라집니다.**
치환 전에 개수를 검증하세요.

```js
const count = (s.match(/anchor/g) || []).length;
if (count !== 1) throw new Error(`앵커가 ${count}개 — 수동 확인 필요`);
```

### 함정 4 — DOM 스텁에 프로퍼티가 없어 `el()` 이 엉뚱하게 동작한다

`el()` 의 `else if (k in node)` 분기 때문에, 스텁에 `type` 이 없으면
`node.type = 'number'` 대신 `setAttribute('type', 'number')` 로 빠집니다.
테스트에서 `el.type` 을 읽으면 `undefined` 가 나옵니다.

**실제 DOM 이 프로퍼티로 갖는 것은 스텁에도 프로퍼티로 선언하세요:**
`value, hidden, className, readOnly, checked, selected, open, type, step, placeholder, title`

### 함정 5 — 부동소수점 때문에 대조가 실패한다

`178.39999999999998 !== 178.4`. 허용 오차를 명시적으로 두세요(항목별로 다르게).

### 함정 6 — 수렴 후 재산정을 빼먹어 sources ≠ uses

수렴 루프가 끝난 뒤 최종 값으로 **한 번 더 재산정**하지 않으면 `3.29e-6` 수준의 오차가 남습니다.
작아 보이지만 "합계가 안 맞는 재무모델"은 신뢰를 잃습니다. 등식을 테스트로 잠그세요.

```js
test('sources = uses — 자기자본 + 차입 = 총투자비', () => {
  const sources = result.derived.equityAmount + result.derived.debtTotal;
  assert.ok(Math.abs(sources - result.derived.totalInvestment) < 1e-6);
});
```

### 함정 7 — Windows 에서 `/tmp` 가 `C:\tmp` 로 해석된다

scratchpad 절대경로를 쓰세요.

### 함정 8 — 제어문자 정규식이 리터럴 제어문자로 파일에 기록된다

`.replace(/[\u0000-\u0008]/g, '')` 를 스크립트로 생성하다 보면 실제 제어문자가 박힙니다.
이런 코드는 **직접 편집**하세요(스크립트 생성 금지).

### 함정 9 — 참조 자료 자체가 틀렸을 수 있다

예시3 엑셀이 **내부적으로 불일치**했습니다(수동 캐시값 + 순환참조 미갱신 −156.89억).
우리 값이 0.13%p 높았고, **우리가 맞았습니다.**

**교훈: 대조가 안 맞으면 우리 코드만 의심하지 말고 참조 자료의 정합성을 검산하세요.**
그리고 그 판단 과정을 PRD 에 기록하세요(`사업성/PRD.md` 5-A장이 그 기록입니다).

### 함정 10 — `grid-template-columns: 380px 1fr` 로 쓴다

`1fr` 의 최소 크기는 `auto` 라서, 넓은 표가 들어오면 **칼럼이 표 너비만큼 부풀어** 본문 전체가 가로로 찢어집니다.
`.table-wrap { overflow-x: auto }` 를 넣었는데 안 듣는 원인이 거의 항상 이것입니다.

```css
grid-template-columns: 380px minmax(0, 1fr);   /* ← 반드시 minmax(0, …) */
```

### 함정 11 — "개선"을 요청 없이 적용한다

참조 모델의 방법론 쟁점 5건을 정량화했지만, 사용자 지시는 **"엑셀 재현용 기본값은 그대로 둬"** 였습니다.
검토 결과는 PRD 5-A 에 기록하고 **코드는 그대로** 뒀습니다.

표준 방식 탭을 추가했는데 IRR 변화가 없자 **탭 전체를 제거**하고 근거만 문서에 남겼습니다.
**근거를 문서에 남기고 코드를 지우는 것**이 옳은 선택인 경우가 많습니다.

---

## 11. `CLAUDE.md` 와 실제의 차이 (2026-09-11 기준)

복제할 때 **없는 것을 있다고 믿지 않도록** 적어둡니다.

| `CLAUDE.md` 의 서술 | 실제 |
|---|---|
| `DESIGN.md` 가 디자인 시스템의 단일 원본 | **파일 없음.** 토큰은 `css/style.css` 의 `:root` 주석이 사실상의 원본 |
| `README.md` 가 재무 방법론의 단일 원본 | **파일 없음.** 방법론은 `PRD.md` 3.4 / 5 / 5-A 장 |
| `npm run serve` / `scripts/serve.mjs` | **둘 다 없음.** `package.json` 에는 `test` / `build` / `start`(기본 브라우저로 `index.html` 열기) |
| `tests/static-server*.test.mjs` | 없음 |
| `tests/docs-methodology-contract`, `tests/results-contract` | 없음. 대신 `scenario-contract`, `alt-project`, `example2`, `auto-calc` 가 있음 |

즉 현재 `사업성/` 의 **실제** 단일 원본은 `PRD.md` 하나이고, 스타일 토큰은 CSS 안에 있습니다.
새 페이지를 만들 때는 둘 중 하나를 고르세요.
1. 문서를 실제에 맞춘다(`CLAUDE.md` 수정) — 권장.
2. `DESIGN.md` / `README.md` 를 실제로 만든다.

---

## 부록 A — 파일별 한 줄 요약

| 파일 | 한 줄 |
|---|---|
| `index.html` | 마운트 지점(빈 div)과 탭 골격만. 로직 0 |
| `css/style.css` | `:root` 토큰 24개 + 구역별 스타일. 44px·브레이크포인트는 테스트가 잠금 |
| `js/project-data.js` | 도메인 숫자 전부. 분류·열거형·프리셋·가이드 |
| `js/finance.js` | 순수 계산. 6구역. 수렴 루프 2겹. DOM 접근 0 |
| `js/sensitivity.js` | 엔진 재호출 래퍼. 변수 명세 배열 + 가위치법 임계값 탐색 |
| `js/form-view.js` | `el()` 헬퍼 + 필드 팩토리 5종 + `itemRow` + `refreshTotals` |
| `js/results-view.js` | 카드·근거표·차트·상세표·경고. 계산 0 |
| `js/sensitivity-view.js` | 민감도 매트릭스 + 토네이도 + 시나리오 표 |
| `js/chart.js` | SVG **문자열** 반환. 현금흐름 + 토네이도 |
| `js/xlsx.js` | CRC32 + ZIP store + 최소 OOXML. 스타일 24종 |
| `js/export-excel.js` | 결과 → 시트 5개. 계산 0. 비율은 0~1 + 서식 |
| `js/app.js` | 배선만 201줄. 모델 1개, 디바운스 3개, 탭 2종 |
| `js/app.bundle.js` | esbuild IIFE 산출물. **커밋 대상** |
| `tests/helpers/dom-stub.mjs` | 도메인 무관. 무조건 복사 |
| `tests/fixtures/*.mjs` | 참조 기대값. 프로덕션 import 금지 |

---

## 부록 B — 복사용 최소 골격

### `package.json`

```json
{
  "name": "my-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "build": "npx --yes esbuild@0.25.6 js/app.js --bundle --format=iife --platform=browser --outfile=js/app.bundle.js",
    "start": "node -e \"import('node:child_process').then(c=>c.spawn('cmd',['/c','start','','index.html'],{shell:true}))\""
  }
}
```

### `index.html`

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>제목</title>
<link rel="stylesheet" href="css/style.css">
</head>
<body>

<header class="topbar">
  <div class="brand">제목</div>
  <div class="spacer"></div>
  <span id="timing" class="unit"></span>
  <button id="reset" class="btn" type="button">기본값으로 되돌리기</button>
</header>

<main class="layout" id="layout">
  <div class="col-input">
    <section class="panel"><h2>입력</h2><div id="form"></div></section>
  </div>
  <div class="col-result">
    <div id="cards" class="cards"></div>
    <section class="panel">
      <h2>결과</h2>
      <div class="panel-body"><div id="basis"></div><div id="warnings" hidden></div></div>
    </section>
  </div>
</main>

<script src="js/app.bundle.js"></script>
</body>
</html>
```

### `js/data.js`

```js
/**
 * data.js — 도메인 프리셋
 * 가드레일: 이 도메인의 모든 숫자는 이 파일에만 존재한다. engine.js 에는 없다.
 */
export const ITEM_GROUPS = [
  { code: '가', label: '분류1' },
  { code: '나', label: '분류2' },
];

export const PRESET = {
  id: 'default',
  label: '기본',
  defaults: {
    name: '예시',
    scale: { unit: 1, count: 10 },
    rates: { a: 0.05, b: 0.02 },
    autoCalc: { feeRate: 0.009 },
  },
  items: [
    { id: 'x', label: '항목1', group: '가', amount: 100 },
    { id: 'fee', label: '수수료', group: '나', amount: 0, auto: 'fee', amountOverride: null },
  ],
};

export function createInput(preset = PRESET) {
  return {
    presetId: preset.id,
    ...clone(preset.defaults),
    items: clone(preset.items),
  };
}
const clone = (v) => JSON.parse(JSON.stringify(v));
```

### `js/engine.js`

```js
/**
 * engine.js — 순수 계산 (DOM 접근 0)
 * 가드레일:
 *   1. 도메인 고유 수치가 이 파일에 없다. 전부 input 에서 온다.
 *   2. items 는 배열 순회로만 다룬다 (항목명 직접 접근 금지).
 */

// ── 순수 유틸 ────────────────────────────────────────────────
export function sumBy(items, fn) { return items.reduce((s, it) => s + (fn(it) || 0), 0); }

/** 분류별 합계 — 이름이 아니라 group 으로 찾는다. */
function groupSum(items, code) {
  return items.reduce((s, it) => (it.group === code && !it.auto ? s + (it.amount || 0) : s), 0);
}

// ── 자동계산 테이블 ──────────────────────────────────────────
const cfg = (input, key) => (input.autoCalc && input.autoCalc[key]) || 0;

const AUTO = {
  fee: (input) => groupSum(input.items, '가') * (input.autoCalc.feeRate ?? 0),
};

function resolveItems(input) {
  return input.items.map((it) => {
    if (!it.auto) return { ...it };
    if (it.amountOverride != null) return { ...it, amount: it.amountOverride, autoOverridden: true };
    const fn = AUTO[it.auto];
    return { ...it, amount: fn ? fn(input) : 0, autoOverridden: false };
  });
}

// ── 진입점 ──────────────────────────────────────────────────
/**
 * @param {object} input
 * @returns {{derived:object, totals:object, rows:Array, metrics:object, warnings:string[]}}
 */
export function analyze(input) {
  const warnings = [];
  const items = resolveItems(input);
  const total = sumBy(items, (it) => it.amount);

  if (!(total > 0)) warnings.push('합계가 0 입니다 — 항목 금액을 확인하십시오.');

  return {
    derived: {
      total,
      itemsResolved: items.map((it) => ({ id: it.id, label: it.label, group: it.group, amount: it.amount, auto: it.auto || null })),
    },
    totals: { total },
    rows: [],
    metrics: {},
    warnings,
  };
}
```

### `js/form-view.js` — `el()` 과 필드 팩토리

```js
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) node.append(c);
  return node;
}

const fmtValue = (v) => (v == null || !Number.isFinite(v) ? '' : String(Number(v.toFixed(6))));

function numberField(label, unit, get, set, onInput, opts = {}) {
  const input = el('input', {
    type: 'number', step: String(opts.step ?? 'any'), value: fmtValue(get()),
    readOnly: !!opts.readOnly,
    oninput: () => {
      if (opts.readOnly) return;
      const v = Number(input.value);
      if (!Number.isFinite(v)) return;
      set(v); onInput();
    },
  });
  const lbl = el('span', { class: 'lbl' }, el('span', { text: label }), unit ? el('span', { class: 'unit', text: unit }) : null);
  return { row: el('label', { class: 'field' }, lbl, input), input };
}

function section(code, title, body, open = false) {
  const total = el('span', { class: 'acc-total', text: '' });
  const details = el('details', { class: 'acc', open },
    el('summary', {}, el('span', { class: 'acc-badge', text: code }), el('span', { class: 'acc-title', text: title }), total),
    el('div', { class: 'acc-body' }, body));
  return { details, total };
}

export function renderForm(host, input, { onInput }) {
  host.innerHTML = '';
  const body = el('div', {},
    numberField('단위', '개', () => input.scale.unit, (v) => { input.scale.unit = v; }, onInput, { step: 1 }).row,
    numberField('수량', '개', () => input.scale.count, (v) => { input.scale.count = v; }, onInput, { step: 1 }).row);
  const secA = section('A', '규모', body, true);
  host.append(secA.details);

  function refreshTotals(result) { secA.total.textContent = `${result.derived.total} 합계`; }
  return { refreshTotals };
}
```

### `js/app.js`

```js
import { analyze } from './engine.js';
import { createInput, PRESET } from './data.js';
import { renderForm } from './form-view.js';
import { renderAll } from './results-view.js';

const DEBOUNCE_MS = 150;
let input = createInput(PRESET);
let form = null;
let lastResult = null;

const $ = (id) => document.getElementById(id);
const hosts = { form: $('form'), cards: $('cards'), basis: $('basis'), warnings: $('warnings'), timing: $('timing') };

function recalc() {
  const t0 = Date.now();
  let result;
  try { result = analyze(input); }
  catch (err) {
    hosts.warnings.hidden = false;
    hosts.warnings.textContent = `계산 오류: ${err.message}`;
    return;
  }
  lastResult = result;
  renderAll(hosts, result, input);
  if (form) form.refreshTotals(result);
  if (hosts.timing) hosts.timing.textContent = `재계산 ${Date.now() - t0}ms`;
}

let timer = null;
const scheduleRecalc = () => { clearTimeout(timer); timer = setTimeout(recalc, DEBOUNCE_MS); };

function build() {
  form = renderForm(hosts.form, input, { onInput: scheduleRecalc });
  recalc();
}

$('reset')?.addEventListener('click', () => { input = createInput(PRESET); build(); });
build();
```

### `css/style.css` 머리

```css
/* 계약 테스트가 잠그는 것: 44px 터치 타깃, 1180px·760px 브레이크포인트.
   색·폰트·여백은 자유롭게 바꿀 수 있습니다. */
:root {
  --bg: #f4f6f8; --panel: #fff; --panel-alt: #fafbfc;
  --line: #e3e7ec; --line-strong: #cbd2da;
  --ink: #1a1f28; --ink-2: #4a5462; --muted: #7b8794;
  --accent: #0f6b4a; --accent-soft: #e7f2ed;
  --danger: #b3261e; --warn-bg: #fff5e6; --warn-ink: #8a4b08;
  --radius: 10px; --shadow: 0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06);
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--ink);
  font: 15px/1.55 "Pretendard", "Malgun Gothic", "맑은 고딕", system-ui, sans-serif;
}
/* ⚠ minmax(0, 1fr) — 그냥 1fr 로 쓰면 넓은 표가 칼럼을 밀어내 본문이 가로로 찢어진다.
   .table-wrap 의 overflow-x 가 듣지 않는 원인이 거의 항상 이것이다. */
.layout {
  display: grid; grid-template-columns: 380px minmax(0, 1fr);
  gap: 20px; align-items: start; padding: 20px 24px 48px;
  max-width: 1600px; margin: 0 auto;
}
.col-input {
  position: sticky; top: 68px;
  max-height: calc(100vh - 88px); overflow-y: auto; overscroll-behavior: contain;
}
@media (max-width: 1180px) {
  .layout { grid-template-columns: minmax(0, 1fr); }
  .col-input { position: static; max-height: none; overflow: visible; }
}
@media (max-width: 760px) { .layout { padding: 8px; gap: 8px; } }

input[type="number"], input[type="text"], input[type="date"], select { min-height: 44px; width: 100%; }
.btn { min-height: 44px; }
.chip { min-height: 44px; }
.tab { min-height: 44px; }
.acc > summary { min-height: 44px; position: sticky; top: 0; }
.acc[open] > summary { background: var(--accent-soft); border-left-color: var(--accent); }
.acc[open] > summary .acc-title { color: var(--accent); }
.acc-body { background: #f7f9fa; }
.table-wrap { overflow-x: auto; }
.chart-wrap { overflow-x: auto; }
```

### `tests/layout-contract.test.mjs` — 복사 후 id 목록만 교체

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const bundle = readFileSync(join(root, 'js/app.bundle.js'), 'utf8');

test('index.html 은 번들만 로드한다 (module 스크립트 금지)', () => {
  assert.ok(!/<script[^>]*type\s*=\s*["']module["']/i.test(html));
  assert.ok(/<script[^>]*src\s*=\s*["']js\/app\.bundle\.js["']/i.test(html));
});

test('번들에 ESM 구문이 남아 있지 않다', () => {
  assert.ok(!/^\s*import\s/m.test(bundle), '번들에 import 문이 남아 있다 — 재빌드 필요');
  assert.ok(!/^\s*export\s/m.test(bundle), '번들에 export 문이 남아 있다 — 재빌드 필요');
});

test('뷰가 붙는 마운트 지점 id 가 모두 존재한다', () => {
  const ids = ['form', 'cards', 'basis', 'warnings', 'timing', 'reset', 'layout'];  // ← 교체
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `index.html 에 id="${id}" 가 없다`);
});

test('입력 컨트롤은 44px 이상의 터치 타깃을 가진다', () => {
  assert.match(css, /input\[type="number"\][\s\S]{0,200}?min-height:\s*44px/);
  assert.match(css, /\.btn\s*\{[^}]*min-height:\s*44px/);
});

test('반응형 브레이크포인트 1180px / 760px 이 정의돼 있다', () => {
  assert.match(css, /@media \(max-width: 1180px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
});

test('넓은 콘텐츠는 자체 컨테이너 안에서 가로 스크롤한다', () => {
  assert.match(css, /\.table-wrap\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(css, /\.chart-wrap\s*\{[^}]*overflow-x:\s*auto/);
});
```

---

## 부록 C — 체크리스트

### 새 페이지 착수 전

1. [ ] `PRD.md` 를 썼다 (특히 1.4 예시의 위치 / 3.9 가드레일 / 4.1 변경 비용 지도)
2. [ ] 참조 자료의 기대값을 `tests/fixtures/` 에 박을 준비가 됐다
3. [ ] 고정 분류(코드가 의존) vs 가변 항목(사용자가 편집)의 경계를 정했다
4. [ ] 이터레이션 3단계의 완료 조건을 각각 한 문장으로 썼다

### 커밋 전 (매번)

1. [ ] `npm run build` — 소스를 고쳤으면 반드시
2. [ ] `npm test` — 전부 통과
3. [ ] `index.html` 을 더블클릭해서 실제로 열어봤다
4. [ ] 새 마운트 지점을 추가했으면 계약 테스트의 id 목록도 갱신했다
5. [ ] 새 입력 필드를 추가했으면 엑셀 「입력값」 시트에도 넣었다

### 리뷰 시 의심할 것

1. [ ] `engine.js` 에 도메인 숫자가 새지 않았나 (`grep` 으로 확인)
2. [ ] 항목을 `label` 로 찾는 코드가 없나 (`group`/`role` 만 써야 함)
3. [ ] 뷰가 계산을 하고 있지 않나 (`derived` 에 값을 추가하는 게 정답)
4. [ ] 자동계산 항목에 수동 덮어쓰기 경로가 있나
5. [ ] 등식(합계 일치 등)이 테스트로 잠겨 있나
6. [ ] 수렴 루프가 실패했을 때 `throw` 대신 `warnings` 로 빠지나
7. [ ] `app.js` 가 200줄을 넘기기 시작했나 (구조 붕괴 신호)

---

## 맺음 — 이 구조가 맞는 경우 / 아닌 경우

**맞는 경우**
1. 입력 → 계산 → 결과 구조의 도구 (계산기·견적·시뮬레이터·대시보드)
2. 숫자의 정확성이 핵심이고, 참조 자료로 대조 검증이 가능한 경우
3. 배포 환경을 통제할 수 없어 "파일로 전달"해야 하는 경우
4. 오래 유지되며 여러 사람(또는 여러 AI 세션)이 손대는 경우

**아닌 경우**
1. 서버 데이터가 실시간으로 필요한 경우 (`fetch` 가 막힘)
2. 인증·다중 사용자·동시 편집이 필요한 경우
3. 복잡한 라우팅이나 수십 개 화면이 있는 경우
4. 외부 라이브러리가 반드시 필요한 경우 (지도·3D·고급 차트)

그래도 **레이어 분리 + 순수 엔진 + 계약 테스트** 세 가지는 프레임워크를 쓰든 안 쓰든 그대로 유효합니다.
React를 쓰게 되더라도 `engine.js` 는 한 줄도 바꿀 필요가 없습니다 — **그게 이 구조의 진짜 이득입니다.**
