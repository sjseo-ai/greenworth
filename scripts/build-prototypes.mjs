// 입찰단가 프로토타입(태양광 · 해상풍력 · BESS) — Claude Artifact 원본 조각을 사이트용 독립 HTML과 발전원별 압축 파일로 만든다.
//
//   prototypes/src/{id}.html        원본(아티팩트에 게시한 HTML 조각 그대로 — 고칠 때는 이 파일을 고친다)
//   prototypes/{id}/index.html      생성 — 사이트용 독립 페이지(문서 골격 + 목록 링크 + 브라우저 다운로드 대체). 커밋한다.
//   prototypes/index.html           생성 — 세 프로토타입 목록(허브). 커밋한다.
//   prototypes/downloads/*.zip      생성 — 발전원별 압축 파일(독립 페이지 + 원본 + 안내문). 커밋하지 않는다(.gitignore).
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
      "새 모듈 등록 · 목록 내보내기/불러오기(JSON)",
    ],
  },
  {
    id: "offshore-wind",
    title: "해상풍력 적정 입찰가격",
    tagline: "고정가격계약 경쟁입찰 · 공공주도형/일반",
    zip: "greenworth-offshore-wind-bid-price.zip",
    features: [
      "국산 · 외산 터빈 6종 비교(비출력 → 순이용률 · 터빈 단가), 새 터빈 등록 · 공유",
      "공공주도형 · 일반 트랙, 이안거리 · 수심 구간 REC 가중치, 우대가격(R&D 실증 포함)",
      "상한가 진입 조건 — 상한가에 맞추려면 EPC · 이용률 · O&M · 가중치를 얼마나 바꿔야 하는지",
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
      <a class="btn" href="../index.html">GreenWorth 사업성 분석 앱 →</a>
    </div>
    <p class="lead">발전원별 경쟁입찰 조건으로 목표 수익을 만족하는 적정 입찰가격을 역산하는 사전 검토용 모델입니다. 각 페이지는 인터넷 연결 없이도 동작하며, 압축 파일을 받아 index.html을 더블클릭해 열 수 있습니다.</p>
    <section class="grid" aria-label="프로토타입 목록">
${cards}
    </section>
    <p class="note">모든 수치는 공개 자료(공고문 · 보도 · 환경영향평가정보지원시스템)와 예시 가정에 기반한 사전 검토용 추정입니다. 실제 입찰 · 투자 판단 전에는 견적 · 계약 조건 · 금융 조건으로 교체해 확인하세요. 입력값과 시나리오는 각자의 브라우저에만 저장됩니다.</p>
  </main>
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
    const folder = p.zip.replace(/\.zip$/, "");
    await put(`prototypes/downloads/${p.zip}`, createZip([
      { name: `${folder}/index.html`, data: buildStandalone(fragment, p, { nav: false }) },
      { name: `${folder}/artifact-source.html`, data: fragment },
      { name: `${folder}/README.md`, data: zipReadme(p) },
    ]));
  }
  await put("prototypes/index.html", buildHub());
  return written;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const written = await buildAll();
  console.log(written.map((path) => `  ${path}`).join("\n"));
}
