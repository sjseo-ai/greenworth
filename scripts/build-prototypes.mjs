// 입찰단가 프로토타입(태양광 · 육상풍력 · 해상풍력 · BESS) — Claude Artifact 원본 조각을 사이트용 독립 HTML과 발전원별 압축 파일로 만든다.
//
//   prototypes/src/{id}.html        원본(아티팩트에 게시한 HTML 조각 그대로 — 고칠 때는 이 파일을 고친다)
//                                   onshore-wind.html은 offshore-wind.html에서 prototypes/tools/onshore-wind/onshore-1-derive.mjs로 파생한다.
//   prototypes/{id}/index.html      생성 — 사이트용 독립 페이지(문서 골격 + 목록 링크 + 브라우저 다운로드 대체 + 통합 화면용 결과 전달). 커밋한다.
//   prototypes/index.html           생성 — 프로토타입 목록(허브). 커밋한다.
//   prototypes/analysis/index.html  생성 — 발전원 통합 사업성분석(발전원 탭 셸 + 비교 요약). 커밋한다.
//   prototypes/downloads/*.zip      생성 — 발전원별 압축 파일(독립 페이지 + 원본 + 안내문). 커밋한다(항목 시각 고정 — 같은 원본이면 같은 파일).
//
// 외부 패키지 없이 동작한다(압축은 node:zlib의 deflateRaw · crc32로 직접 쓴다). 실행: npm run build:prototypes
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { crc32, deflateRawSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SITE_URL = "https://sjseo-ai.github.io/greenworth/prototypes/";
const BUILD_DATE = { year: 2026, month: 9, day: 15 }; // 압축 파일 항목 시각 고정 — 같은 원본이면 같은 파일이 나오게

export const PROTOTYPES = [
  {
    id: "solar",
    title: "태양광 적정 입찰가격",
    tagline: "고정가격계약 경쟁입찰 · 기업PPA",
    zip: "greenworth-solar-bid-price.zip",
    features: [
      "국산 4사 · 중국산 3사 모듈 비교, 사별 탄소검증 제품 → 등급 · 배점 · 우대가격",
      "① 국산 모듈 + 고정가격계약 / ② 중국산 모듈 + 기업PPA 조합, 계약기간 20~30년",
      "상한가 진입 조건 — 상한가에 맞추려면 EPC · 이용률 · O&M · 탄소 등급을 얼마나 바꿔야 하는지",
      "입찰 사례 — 2022~2026 경쟁입찰 회차별 결과, 대형 사업 10건(보도 · 환경영향평가정보지원시스템)",
      "O&M 보증 발전시간 — 보증시간(h/일 · h/년) ↔ 이용률 연동, 보증 기준 발전량 · 발전매출 · 미달 보전액, 보증시간별 비교",
      "새 모듈 등록 · 목록 내보내기/불러오기(JSON)",
    ],
  },
  {
    id: "onshore-wind",
    title: "육상풍력 적정 입찰가격",
    tagline: "육상풍력 고정가격계약 경쟁입찰",
    zip: "greenworth-onshore-wind-bid-price.zip",
    features: [
      "국산(유니슨 U151 · U136) · 외산(Vestas · Siemens Gamesa · Nordex) 터빈 6종 비교, 터빈사 제공 순이용률 · EPC 단가 직접 지정",
      "REC 가중치 1.2 · 상한가 163.846원(2025년 하반기) · 40MW 기준 CAPEX · OPEX(에너지경제연구원 2024년 조사값)",
      "풍황 확률수준 P50 · P75 · P90, 목표 DSCR 부채 사이징, 보증 구조(터빈사 / EPC) · 준공지연 LD · 하자보수 보증",
      "입찰 사례 — 2023 · 2024 · 2025 하반기 육상풍력 경쟁입찰 선정 사업 13건과 회차별 공고 · 입찰 · 선정 물량",
      "해상풍력 페이지에서 변환 스크립트로 파생(prototypes/tools/onshore-wind) — 재무 엔진 · 화면 구성 동일",
    ],
  },
  {
    id: "offshore-wind",
    title: "해상풍력 적정 입찰가격",
    tagline: "고정가격계약 경쟁입찰 · 공공주도형/일반",
    zip: "greenworth-offshore-wind-bid-price.zip",
    features: [
      "국산 · 외산 터빈 6종 비교(비출력 → 순이용률 · 터빈 단가), 터빈사 제공 1년차 순이용률 · EPC 단가 직접 지정, 새 터빈 등록 · 공유",
      "풍황 확률수준 P50 · P75 · P90 수기 입력 — 확률수준별 순이용률 · 발전량 · 매출 · P-IRR · 적정 수령단가 비교",
      "목표 DSCR 부채 사이징 — 기준 발전량(P90 등) CFADS로 선순위 한도를 먼저 정하고 자기자본이 나머지",
      "공공주도형 · 일반 트랙, 이안거리 · 수심 구간 REC 가중치, 우대가격(R&D 실증 포함)",
      "상한가 진입 조건 — 상한가에 맞추려면 EPC · 이용률 · O&M · 가중치를 얼마나 바꿔야 하는지",
      "보증 구조 — 터빈사(TSA/LTSA: 출력곡선 · 기술적 가동률) / EPC·BOP(전기손실 · 계통 가동률) 구분, 미달 시 귀책별 손실 · LD 보전, 준공지연 LD · 하자보수 보증",
      "입찰 사례 — 2023~2026 선정 단지 18건(사업자 · 터빈 · EPC · 사업비 · EIASS 협의 제원)",
    ],
  },
  {
    id: "bess",
    title: "BESS(ESS) 적정 입찰단가",
    tagline: "ESS 중앙계약시장 경쟁입찰",
    zip: "greenworth-bess-bid-price.zip",
    features: [
      "목표 당사 이익 또는 목표 IRR → 적정 입찰단가 역산(이분탐색)",
      "계약용량 기준 공급량 ①~⑤ 산정, 준공지연 · 이행률 패널티(공고 Ⅴ항)",
      "선정평가 가격 점수 환산, KCH 개발수수료 단가산정",
      "입찰 사례 — ESS 중앙계약시장 회차별 결과(2023 제주 · 2025 제1·2차 · 제3차 예정)와 선정 사업지 15곳으로 사업성 추정",
      "민감도 · 시나리오 비교 · 현금흐름 상세 · CSV/JSON 내보내기",
    ],
  },
];

// 아티팩트 뷰어가 조각을 감싸는 골격과 같은 기본 스타일(페이지 CSS가 이 전제 위에서 검증됐다)
const SKELETON_STYLE = ":root{color-scheme:light}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}img{max-width:100%}[hidden]:not([hidden=until-found]){display:none!important}";

// 사이트(아티팩트 밖)에서는 window.claude가 없어 내보내기가 막히므로, 같은 모양의 save()를 브라우저 다운로드로 제공한다.
const BROWSER_DOWNLOADS = `<script>
  // GreenWorth 사이트에서 열 때 — 아티팩트 downloads 기능 대신 브라우저 다운로드로 파일을 받는다.
  window.greenworthBrowserDownloads = {
    async save({ filename, data }) {
      const type = /\\.csv$/i.test(filename) ? "text/csv;charset=utf-8" : /\\.json$/i.test(filename) ? "application/json" : "application/octet-stream";
      const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
      const a = Object.assign(document.createElement("a"), { href: url, download: filename });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
</script>`;

// 통합 사업성분석(prototypes/analysis)의 틀(iframe) 안에서 열렸을 때만 동작한다 — 핵심 결과를 부모 페이지에 알리고,
// 틀 안에서는 필요 없는 "← 프로토타입 목록" 줄을 지운다. 혼자 열면 아무 일도 하지 않는다. 결과는 계산된 숫자뿐이라 "*"로 보내도 되고,
// 부모는 보낸 창이 자기 iframe인지 확인한 뒤에만 받는다. 사이트 페이지에만 넣는다(압축 파일 안 페이지는 틀 없이 쓰므로 그대로 둔다).
const RESULT_BRIDGE = (id) => `<script>
  (function () {
    if (window.parent === window) return;
    var ID = ${JSON.stringify(id)};
    function text(key) {
      var el = document.getElementById(key);
      if (!el) return "";
      return String(el.tagName === "INPUT" || el.tagName === "SELECT" ? el.value : el.textContent).replace(/\\s+/g, " ").trim();
    }
    var last = "", timer = 0;
    function send() {
      var p = { type: "greenworth-result", id: ID, label: text("heroLabel"), price: text("heroBidPrice"),
        tender: text("heroTenderPrice"), tenderCap: text("heroTenderCap"), note: text("heroBidNote"), status: text("solveStatus"),
        tenderHidden: !!(document.getElementById("heroTenderBox") && document.getElementById("heroTenderBox").style.display === "none"),
        pirr: text("kpiPIrr"), eirr: text("kpiEIrr"), profit: text("kpiCompanyProfit"), invest: text("kpiTotalInvestment"),
        revenue: text("kpiRevenue"), generation: text("kpiGeneration"), capacity: text("contractCapacityMW"), cap: text("priceCapPerKWh") };
      var s = JSON.stringify(p);
      if (s !== last) { last = s; window.parent.postMessage(p, "*"); }
    }
    function soon() { clearTimeout(timer); timer = setTimeout(send, 300); }
    function start() {
      var nav = document.querySelector(".gw-site-nav");
      if (nav) nav.remove();
      new MutationObserver(soon).observe(document.body, { subtree: true, childList: true, characterData: true });
      soon();
    }
    window.addEventListener("message", function (e) {
      if (e.source === window.parent && e.data && e.data.type === "greenworth-ping") { last = ""; send(); }
    });
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  })();
</script>`;

const escapeHtml = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function replaceOnce(text, from, to, label) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one "${from.slice(0, 60)}", found ${count}`);
  return text.replace(from, () => to);
}

// 원본 조각 → 독립 HTML. nav=false면 목록 링크를 넣지 않는다(압축 파일 안에서는 목록 페이지가 없음).
export function buildStandalone(fragment, prototype, { nav = true } = {}) {
  let body = fragment.replace(/\r\n/g, "\n").trim();
  body = replaceOnce(body, "let downloadsApi = null;",
    "let downloadsApi = window.claude ? null : (window.greenworthBrowserDownloads || null); // 사이트에서 열면 브라우저 다운로드", `${prototype.id} downloads`);
  // 시나리오 이름 예시에 실제 사업명이 들어가지 않게 일반 예시로 바꾼다.
  body = body.split("예: 안좌 96MW 기본안").join("예: 기본안 A");
  if (nav) {
    body = replaceOnce(body, '<header class="topbar">',
      '<nav class="gw-site-nav" style="display:flex;align-items:center;min-height:44px;padding:0 16px;font-size:13px;background:var(--panel-alt);border-bottom:1px solid var(--line);">'
      + '<a href="../index.html" style="color:var(--accent);font-weight:600;text-decoration:none;">← 프로토타입 목록</a>'
      + '<span style="margin-left:8px;color:var(--muted);">GreenWorth</span></nav>\n  <header class="topbar">', `${prototype.id} nav`);
  }
  return [
    "<!doctype html>",
    `<!-- 생성 파일 — prototypes/src/${prototype.id}.html을 scripts/build-prototypes.mjs로 변환했습니다. 이 파일을 직접 고치지 마세요. -->`,
    '<html lang="ko">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<link rel="icon" href="data:,">',
    `<style>${SKELETON_STYLE}</style>`,
    BROWSER_DOWNLOADS,
    "</head>",
    "<body>",
    body,
    ...(nav ? [RESULT_BRIDGE(prototype.id)] : []),
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

export function buildHub() {
  const cards = PROTOTYPES.map((p) => `      <article class="card">
        <p class="tag">${escapeHtml(p.tagline)}</p>
        <h2>${escapeHtml(p.title)}</h2>
        <ul>
${p.features.map((f) => `          <li>${escapeHtml(f)}</li>`).join("\n")}
        </ul>
        <div class="actions">
          <a class="btn primary" href="${p.id}/index.html">열기</a>
          <a class="btn" href="downloads/${p.zip}" download>압축 파일 받기</a>
        </div>
      </article>`).join("\n");
  return `<!doctype html>
<!-- 생성 파일 — scripts/build-prototypes.mjs가 만든다. 목록 문구는 스크립트의 PROTOTYPES를 고친다. -->
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GreenWorth 입찰단가 프로토타입</title>
<link rel="icon" href="data:,">
<style>
  :root { --bg: #f4f6f8; --panel: #ffffff; --line: #e3e7ec; --ink: #1a1f28; --ink-2: #4a5462; --muted: #7b8794; --accent: #0f6b4a; --accent-strong: #0f6b4a; --accent-soft: #e7f2ed; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0f1417; --panel: #161d21; --line: #26313a; --ink: #e6ecef; --ink-2: #b3c0c8; --muted: #83929c; --accent: #3fbf8c; --accent-strong: #1f7a58; --accent-soft: #16302a; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.6 "Pretendard", "Malgun Gothic", "맑은 고딕", system-ui, -apple-system, "Segoe UI", sans-serif; }
  .wrap { max-width: 1120px; margin: 0 auto; padding: 32px 20px 48px; }
  .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
  h1 { margin: 0; font-size: 24px; letter-spacing: -0.01em; word-break: keep-all; }
  .lead { margin: 8px 0 24px; color: var(--ink-2); word-break: keep-all; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 16px; }
  .card { display: flex; flex-direction: column; gap: 8px; min-width: 0; padding: 18px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; }
  .card h2 { margin: 0; font-size: 18px; }
  .tag { margin: 0; font-size: 12.5px; font-weight: 600; color: var(--accent); }
  .card ul { margin: 0; padding-left: 18px; color: var(--ink-2); font-size: 13.5px; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: auto; padding-top: 8px; }
  .btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 16px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); color: var(--ink); font-size: 14px; font-weight: 600; text-decoration: none; }
  .btn:hover, .btn:focus-visible { border-color: var(--accent); color: var(--accent); }
  .btn.primary { background: var(--accent-strong); border-color: var(--accent-strong); color: #ffffff; }
  .btn.primary:hover, .btn.primary:focus-visible { color: #ffffff; filter: brightness(1.08); }
  .note { margin-top: 24px; padding: 12px 14px; border-left: 3px solid var(--line); background: var(--panel); border-radius: 0 8px 8px 0; font-size: 13px; color: var(--ink-2); }
</style>
</head>
<body>
  <main class="wrap">
    <div class="top">
      <h1>GreenWorth 입찰단가 프로토타입</h1>
      <div class="actions" style="margin-top:0;padding-top:0;">
        <a class="btn primary" href="analysis/index.html">발전원 통합 사업성분석 →</a>
        <a class="btn" href="../index.html">GreenWorth 사업성 분석 앱 →</a>
      </div>
    </div>
    <p class="lead">발전원별 경쟁입찰 조건으로 목표 수익을 만족하는 적정 입찰가격을 역산하는 사전 검토용 모델입니다. <strong>발전원 통합 사업성분석</strong>에서는 네 발전원을 한 화면의 탭으로 오가며 핵심 결과를 나란히 비교할 수 있습니다. 각 페이지는 인터넷 연결 없이도 동작하며, 압축 파일을 받아 index.html을 더블클릭해 열 수 있습니다.</p>
    <section class="grid" aria-label="프로토타입 목록">
${cards}
    </section>
    <p class="note">모든 수치는 공개 자료(공고문 · 보도 · 환경영향평가정보지원시스템)와 예시 가정에 기반한 사전 검토용 추정입니다. 실제 입찰 · 투자 판단 전에는 견적 · 계약 조건 · 금융 조건으로 교체해 확인하세요. 입력값과 시나리오는 각자의 브라우저에만 저장됩니다.</p>
  </main>
</body>
</html>
`;
}

// ---------- 통합 사업성분석 — 발전원 탭 셸 + 비교 요약 ----------
// 검증된 발전원 페이지를 고치지 않고 그대로 틀(iframe)에 띄운다. 네 페이지를 처음부터 모두 띄워 두고,
// 각 페이지가 보내는 결과(RESULT_BRIDGE)를 모아 "발전원 비교" 표를 채운다. 탭을 옮겨도 각 페이지의 입력은 유지된다.
export const ANALYSIS_SHORT = { solar: "태양광", "onshore-wind": "육상풍력", "offshore-wind": "해상풍력", bess: "ESS" };

export function buildAnalysis() {
  const tabs = PROTOTYPES.map((p) => `    <button type="button" role="tab" id="tab-${p.id}" aria-controls="panel-${p.id}" aria-selected="false" tabindex="-1" data-key="${p.id}">${escapeHtml(ANALYSIS_SHORT[p.id] || p.title)}<span class="dot" data-dot="${p.id}" aria-hidden="true"></span></button>`).join("\n");
  const panels = PROTOTYPES.map((p) => `    <section class="panel-frame" id="panel-${p.id}" role="tabpanel" aria-labelledby="tab-${p.id}" hidden>
      <iframe src="../${p.id}/index.html" title="${escapeHtml(p.title)}" data-key="${p.id}"></iframe>
    </section>`).join("\n");
  const techs = JSON.stringify(PROTOTYPES.map((p) => ({ key: p.id, name: ANALYSIS_SHORT[p.id] || p.title, tagline: p.tagline })));
  return `<!doctype html>
<!-- 생성 파일 — scripts/build-prototypes.mjs의 buildAnalysis()가 만든다. 발전원 목록은 PROTOTYPES를 고친다. -->
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GreenWorth 사업성분석 — 발전원 통합</title>
<link rel="icon" href="data:,">
<style>
  :root { --bg: #f4f6f8; --panel: #ffffff; --panel-alt: #fafbfc; --line: #e3e7ec; --line-strong: #cbd2da; --ink: #1a1f28; --ink-2: #4a5462; --muted: #7b8794;
    --accent: #0f6b4a; --accent-soft: #e7f2ed; --pos: #0f6b4a; --warn: #a15c00; --warn-soft: #fff5e6; --neg: #b3261e; --neg-soft: #fdecea; color-scheme: light; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0f1417; --panel: #161d21; --panel-alt: #1b2328; --line: #26313a; --line-strong: #35424c; --ink: #e6ecef; --ink-2: #b3c0c8; --muted: #83929c;
      --accent: #3fbf8c; --accent-soft: #16302a; --pos: #3fbf8c; --warn: #f2c078; --warn-soft: #352a17; --neg: #f08a80; --neg-soft: #3a1f1d; color-scheme: dark; }
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body { margin: 0; display: flex; flex-direction: column; background: var(--bg); color: var(--ink);
    font: 15px/1.55 "Pretendard", "Malgun Gothic", "맑은 고딕", system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
  a { color: var(--accent); }
  .top { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; padding: 10px 20px; background: var(--panel); border-bottom: 1px solid var(--line); }
  .brand { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; min-width: 0; }
  .brand h1 { margin: 0; font-size: 18px; letter-spacing: -0.01em; word-break: keep-all; }
  .brand .sub { font-size: 12.5px; color: var(--muted); word-break: keep-all; }
  .links { margin-left: auto; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 13px; }
  .links a { display: inline-flex; align-items: center; min-height: 44px; font-weight: 600; text-decoration: none; }
  .links a:hover, .links a:focus-visible { text-decoration: underline; }
  .tabs { flex: none; display: flex; gap: 4px; padding: 8px 16px 0; background: var(--panel); border-bottom: 1px solid var(--line); overflow-x: auto; scrollbar-width: none; }
  .tabs::-webkit-scrollbar { display: none; }
  .tabs [role="tab"] { flex: none; display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 16px; border: 1px solid transparent; border-bottom: 0;
    border-radius: 8px 8px 0 0; background: transparent; color: var(--muted); font: inherit; font-size: 14.5px; font-weight: 700; cursor: pointer; margin-bottom: -1px; }
  .tabs [role="tab"]:hover { color: var(--accent); }
  .tabs [role="tab"][aria-selected="true"] { background: var(--bg); border-color: var(--line); color: var(--accent); }
  .tabs [role="tab"]:focus-visible { outline: 2px solid var(--accent); outline-offset: -3px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--line-strong); }
  .dot.ok { background: var(--pos); } .dot.warn { background: var(--warn); } .dot.bad { background: var(--neg); }
  main { flex: 1; min-height: 0; position: relative; }
  [role="tabpanel"] { position: absolute; inset: 0; }
  [role="tabpanel"][hidden] { display: none; }
  .panel-frame iframe { display: block; width: 100%; height: 100%; border: 0; background: var(--bg); }
  #panel-compare { overflow: auto; }
  .wrap { max-width: 1320px; margin: 0 auto; padding: 20px; }
  .lead { margin: 0 0 14px; color: var(--ink-2); word-break: keep-all; }
  .summary { margin: 0 0 14px; padding: 12px 16px; border: 1px solid var(--line); border-left: 4px solid var(--accent); border-radius: 10px; background: var(--panel); font-size: 14px; word-break: keep-all; }
  .summary.warn { border-left-color: var(--warn); }
  /* position: relative — 화면에서 숨긴 열 제목(.sr)이 이 상자 안에 갇혀야 패널 전체가 가로로 늘어나지 않는다 */
  .table-wrap { position: relative; overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); }
  table.cmp { width: 100%; min-width: 980px; border-collapse: collapse; font-size: 13.5px; font-variant-numeric: tabular-nums; }
  .cmp th, .cmp td { padding: 10px; text-align: right; white-space: nowrap; border-bottom: 1px solid var(--line); vertical-align: middle; }
  .cmp tbody th { max-width: 190px; white-space: normal; }
  .cmp .sub { display: block; margin-top: 2px; font-size: 11.5px; font-weight: 400; color: var(--muted); }
  .cmp thead th { color: var(--muted); font-size: 12.5px; font-weight: 600; background: var(--panel-alt); }
  .cmp thead th small { font-weight: 400; }
  .cmp th:first-child, .cmp td:first-child { text-align: left; }
  .cmp tbody tr:last-child td, .cmp tbody tr:last-child th { border-bottom: 0; }
  .cmp tbody th { font-weight: 700; text-align: left; }
  .cmp tbody th .tag { display: block; font-size: 11.5px; font-weight: 400; color: var(--muted); }
  .cmp .big { font-size: 17px; font-weight: 800; }
  .cmp .price { color: var(--accent); }
  .cmp .ok { color: var(--pos); font-weight: 600; } .cmp .over { color: var(--neg); font-weight: 700; } .cmp .muted { color: var(--muted); }
  .cmp td.status { text-align: left; white-space: normal; min-width: 120px; font-size: 12.5px; color: var(--ink-2); }
  .open { min-height: 44px; padding: 0 14px; border: 1px solid var(--line-strong); border-radius: 8px; background: var(--panel); color: var(--ink); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
  .open:hover, .open:focus-visible { border-color: var(--accent); color: var(--accent); }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .notes { margin: 16px 0 0; padding-left: 18px; color: var(--ink-2); font-size: 13px; }
  .notes li { margin-bottom: 6px; word-break: keep-all; }
  @media (max-width: 640px) {
    .top { padding: 8px 16px; }
    .links { margin-left: 0; }
    .wrap { padding: 16px; }
  }
</style>
</head>
<body>
  <header class="top">
    <div class="brand">
      <h1>GreenWorth 사업성분석</h1>
      <span class="sub">태양광 · 육상풍력 · 해상풍력 · ESS 통합 — 사전 검토용</span>
    </div>
    <nav class="links" aria-label="다른 화면">
      <a href="../index.html">프로토타입 목록</a>
      <a href="../../index.html">사업성 분석 앱</a>
    </nav>
  </header>
  <div class="tabs" role="tablist" aria-label="발전원">
    <button type="button" role="tab" id="tab-compare" aria-controls="panel-compare" aria-selected="true" tabindex="0" data-key="compare">발전원 비교</button>
${tabs}
  </div>
  <main>
    <section id="panel-compare" role="tabpanel" aria-labelledby="tab-compare">
      <div class="wrap">
        <p class="lead">네 발전원 페이지를 이 화면 안에 함께 띄워 두고, 지금 입력된 조건으로 계산한 핵심 결과를 나란히 모읍니다. 발전원 탭에서 가정을 바꾸면 이 표도 바로 따라 바뀝니다.</p>
        <div class="summary" id="summary" role="status">발전원 결과를 불러오는 중…</div>
        <div class="table-wrap">
          <table class="cmp">
            <thead><tr><th>발전원</th><th>설비용량<br><small>(MW)</small></th><th>적정 단가<br><small>(원/kWh · 받는 값)</small></th><th>입찰가격<br><small>(원/kWh · 써내는 값)</small></th><th>상한가 대비</th><th>P-IRR</th><th>E-IRR</th><th>총사업비<br><small>(억원)</small></th><th>연간 매출<br><small>(억원)</small></th><th>연간 발전량<br><small>(GWh)</small></th><th>산정 상태</th><th><span class="sr">열기</span></th></tr></thead>
            <tbody id="cmpBody"></tbody>
          </table>
        </div>
        <ul class="notes">
          <li>각 값은 그 발전원 페이지의 <strong>현재 산정 기준</strong>(목표 P-IRR 또는 목표 당사 이익)으로 계산한 결과입니다. 기준이 다르면 수익률을 그대로 비교하지 마세요 — "산정 상태" 열에서 기준을 확인할 수 있습니다.</li>
          <li>태양광·풍력의 적정 단가는 SPC가 받는 <strong>수령단가</strong>(REC 가중치 · 우대가격 반영)이고, 입찰가격은 경쟁입찰에 써내는 <strong>SMP+1REC 기준 가격</strong>입니다. ESS는 용량 기준 고정비 요금이라 입찰단가가 곧 써내는 값이며, 발전원 단가와 직접 비교하지 않습니다.</li>
          <li>입력값·시나리오는 발전원별로 이 브라우저에만 저장됩니다. 탭을 옮겨도 각 페이지의 입력은 그대로 유지되며, 주소 끝에 <code>#offshore-wind</code>처럼 발전원을 붙이면 그 탭으로 바로 열립니다.</li>
        </ul>
      </div>
    </section>
${panels}
  </main>
  <script>
  (function () {
    "use strict";
    var TECHS = ${techs};
    var KEYS = ["compare"].concat(TECHS.map(function (t) { return t.key; }));
    var results = {}, started = Date.now();
    var $ = function (id) { return document.getElementById(id); };
    var frames = Array.prototype.slice.call(document.querySelectorAll("iframe[data-key]"));
    var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
    var blank = function (v) { return !v || v === "–" || v === "—"; };

    // 태양광은 입찰가격·상한가 여유가 설명 줄 안에만 있어 문장에서 읽는다. ESS는 입찰단가가 곧 써내는 값이다.
    function tenderOf(d) {
      if (!d.tenderHidden && !blank(d.tender)) return d.tender;
      var m = /=\\s*([\\d,.]+)\\s*원\\/kWh/.exec(d.note || "");
      if (m) return m[1];
      return d.id === "bess" ? d.price : "";
    }
    function capOf(d) {
      if (!d.tenderHidden && d.tenderCap) return d.tenderCap;
      var m = /상한가\\s*[\\d.,]+\\s*대비\\s*[\\d.,]+원\\s*(여유|초과)/.exec(d.note || "");
      if (m) return m[0];
      return d.id === "bess" ? "상한가 없음(ESS)" : "";
    }
    function stateOf(d) {
      if (!d) return "wait";
      if (blank(d.price)) return "bad";
      return /초과/.test(capOf(d)) ? "warn" : "ok";
    }

    function render() {
      var rows = TECHS.map(function (t) {
        var d = results[t.key];
        if (!d) {
          var late = Date.now() - started > 25000;
          return "<tr><th scope=\\"row\\">" + esc(t.name) + "<span class=\\"tag\\">" + esc(t.tagline) + "</span></th>"
            + "<td class=\\"muted\\" colspan=\\"10\\" style=\\"text-align:left;\\">" + (late ? "응답 없음 — 탭을 열어 확인해 주세요" : "계산 중…") + "</td>"
            + "<td><button type=\\"button\\" class=\\"open\\" data-open=\\"" + t.key + "\\">열기</button></td></tr>";
        }
        var tender = tenderOf(d), cap = capOf(d), over = /초과/.test(cap);
        // 단위는 열 제목에 두고 칸에는 숫자만 — 표가 한 화면에 들어오게 한다
        var num = function (v) {
          if (blank(v)) return "<span class=\\"muted\\">—</span>";
          var m = /-?[\\d,]+(\\.\\d+)?%?/.exec(String(v));
          return esc(m ? m[0] : v);
        };
        // "상한가 163.846 대비 6.50원 초과" → 굵게 "6.50원 초과", 아래 줄 "상한가 163.846"
        var capCell = function () {
          var m = /상한가\\s*([\\d.,]+)\\s*대비\\s*([\\d.,]+원\\s*(여유|초과))/.exec(cap);
          if (!m) return cap ? esc(cap) : "—";
          return esc(m[2]) + "<span class=\\"sub\\">상한가 " + esc(m[1]) + (over ? " · 응찰 불가" : "") + "</span>";
        };
        return "<tr><th scope=\\"row\\">" + esc(t.name) + "<span class=\\"tag\\">" + esc(t.tagline) + "</span></th>"
          + "<td>" + num(d.capacity) + "</td>"
          + "<td class=\\"big price\\">" + num(d.price) + "</td>"
          + "<td class=\\"big" + (over ? " over" : "") + "\\">" + num(tender) + "</td>"
          + "<td class=\\"" + (over ? "over" : cap ? "ok" : "muted") + "\\">" + capCell() + "</td>"
          + "<td>" + num(d.pirr) + "</td><td>" + num(d.eirr) + "</td>"
          + "<td>" + num(d.invest) + "</td><td>" + num(d.revenue) + "</td><td>" + num(d.generation) + "</td>"
          + "<td class=\\"status\\">" + esc((d.status || "").replace(/^●\\s*/, "")) + "</td>"
          + "<td><button type=\\"button\\" class=\\"open\\" data-open=\\"" + t.key + "\\">열기</button></td></tr>";
      });
      $("cmpBody").innerHTML = rows.join("");
      TECHS.forEach(function (t) {
        var dot = document.querySelector("[data-dot=\\"" + t.key + "\\"]");
        if (dot) { var st = stateOf(results[t.key]); dot.className = "dot" + (st === "wait" ? "" : " " + st); dot.title = { wait: "계산 중", ok: "목표 도달 · 상한가 이내", warn: "상한가 초과", bad: "산정 불가" }[st]; }
      });
      var got = TECHS.filter(function (t) { return results[t.key]; });
      var solved = got.filter(function (t) { return !blank(results[t.key].price); });
      var overs = got.filter(function (t) { return /초과/.test(capOf(results[t.key])); });
      var box = $("summary");
      if (!got.length) { box.textContent = "발전원 결과를 불러오는 중…"; box.className = "summary"; return; }
      var parts = ["결과 " + got.length + "/" + TECHS.length + "개 발전원", "목표 도달 " + solved.length + "개"];
      if (overs.length) parts.push("상한가 초과 — " + overs.map(function (t) { return t.name; }).join(" · ") + " (지금 조건으로는 응찰 불가)");
      else if (solved.length) parts.push("상한가를 넘는 발전원 없음");
      box.textContent = parts.join(" · ");
      box.className = overs.length ? "summary warn" : "summary";
    }

    window.addEventListener("message", function (e) {
      var d = e.data;
      if (!d || d.type !== "greenworth-result") return;
      var frame = frames.filter(function (f) { return f.contentWindow === e.source; })[0];
      if (!frame || frame.getAttribute("data-key") !== d.id) return; // 자기 틀에서 온 결과만 받는다
      results[d.id] = d;
      render();
    });

    // 탭 — 주소의 #발전원이 있으면 그 탭, 없으면 마지막으로 본 탭(이 브라우저에만 저장)
    var TAB_KEY = "gwAnalysisTab.v1";
    function select(key, focus) {
      if (KEYS.indexOf(key) < 0) key = "compare";
      KEYS.forEach(function (k) {
        var tab = $("tab-" + k), panel = $("panel-" + k), on = k === key;
        tab.setAttribute("aria-selected", String(on)); tab.tabIndex = on ? 0 : -1; panel.hidden = !on;
      });
      if (focus) $("tab-" + key).focus();
      try { localStorage.setItem(TAB_KEY, key); } catch (err) { /* 저장 불가 환경 */ }
      try { history.replaceState(null, "", key === "compare" ? location.pathname + location.search : "#" + key); } catch (err) { /* file:// 등 */ }
      if (key === "compare") frames.forEach(function (f) { try { f.contentWindow.postMessage({ type: "greenworth-ping" }, "*"); } catch (err) { /* 아직 로드 전 */ } });
    }
    KEYS.forEach(function (k, i) {
      var tab = $("tab-" + k);
      tab.addEventListener("click", function () { select(k); });
      tab.addEventListener("keydown", function (e) {
        var step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (e.key === "Home" || e.key === "End") { e.preventDefault(); select(KEYS[e.key === "Home" ? 0 : KEYS.length - 1], true); return; }
        if (!step) return;
        e.preventDefault();
        select(KEYS[(i + step + KEYS.length) % KEYS.length], true);
      });
    });
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-open]");
      if (b) select(b.getAttribute("data-open"), true);
    });
    window.addEventListener("hashchange", function () { select(location.hash.slice(1)); });
    var first = location.hash.slice(1);
    if (KEYS.indexOf(first) < 0) { try { first = localStorage.getItem(TAB_KEY) || "compare"; } catch (err) { first = "compare"; } }
    render();
    select(first);
    setInterval(function () { if (TECHS.some(function (t) { return !results[t.key]; })) render(); }, 5000); // "응답 없음" 표시용
  })();
  </script>
</body>
</html>
`;
}

function zipReadme(p) {
  return `# ${p.title} 프로토타입 (GreenWorth)

${p.tagline} 조건에서 목표 수익(당사 이익 또는 목표 IRR)을 만족하는 적정 입찰가격을 역산하는 사전 검토용 모델입니다.

## 여는 방법

- \`index.html\`을 더블클릭해 브라우저(Chrome · Edge 권장)로 엽니다. 설치 · 서버 · 인터넷 연결이 필요 없습니다.
- 입력값 · 시나리오 · 사용자 추가 항목은 이 브라우저(localStorage)에만 저장됩니다.
- 내보내기(CSV · JSON)는 브라우저 다운로드로 저장됩니다.
- 사이트 버전: ${SITE_URL}${p.id}/ (GitHub Pages 배포 후)

## 주요 기능

${p.features.map((f) => `- ${f}`).join("\n")}

## 파일

- \`index.html\` — 바로 여는 독립 페이지
- \`artifact-source.html\` — Claude Artifact에 게시한 원본 HTML 조각(아티팩트로 다시 게시하거나 수정할 때 사용)

## 유의사항

모든 수치는 공개 자료와 예시 가정에 기반한 추정입니다. 실제 입찰 · 투자 판단 전에는 견적 · 계약 · 금융 조건으로 교체해 확인하세요. 화면의 "확정 필요 항목" 탭에 확정되지 않은 가정이 정리되어 있습니다.
`;
}

// ---------- ZIP(deflate) 작성 — 항목 이름은 UTF-8 플래그를 켠다 ----------
function dosDateTime({ year, month, day }) {
  return { time: 0, date: ((year - 1980) << 9) | (month << 5) | day };
}

export function createZip(entries) {
  const { time, date } = dosDateTime(BUILD_DATE);
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const raw = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8");
    const packed = deflateRawSync(raw, { level: 9 });
    const checksum = crc32(raw) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, packed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

export function buildZip(fragment, p) {
  const source = fragment.replace(/\r\n/g, "\n"); // 체크아웃 줄바꿈(CRLF)과 무관하게 같은 압축 파일
  const folder = p.zip.replace(/\.zip$/, "");
  return createZip([
    { name: `${folder}/index.html`, data: buildStandalone(source, p, { nav: false }) },
    { name: `${folder}/artifact-source.html`, data: source },
    { name: `${folder}/README.md`, data: zipReadme(p) },
  ]);
}

export async function buildAll({ root = ROOT } = {}) {
  const written = [];
  const put = async (relativePath, content) => {
    const target = resolve(root, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
    written.push(relativePath);
  };
  for (const p of PROTOTYPES) {
    const fragment = await readFile(resolve(root, `prototypes/src/${p.id}.html`), "utf8");
    await put(`prototypes/${p.id}/index.html`, buildStandalone(fragment, p, { nav: true }));
    await put(`prototypes/downloads/${p.zip}`, buildZip(fragment, p));
  }
  await put("prototypes/index.html", buildHub());
  await put("prototypes/analysis/index.html", buildAnalysis());
  return written;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const written = await buildAll();
  console.log(written.map((path) => `  ${path}`).join("\n"));
}
