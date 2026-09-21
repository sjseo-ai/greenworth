// 공통 — "당사 이익" 기준을 누적 순이익(세전)에서 **누적 배당+최종회수(세전 배당 기준) 총액**으로 바꾼다.
// 최소치 100억원은 그대로 두고 기준 지표만 총액으로 통일한다.
//   · 가격 하한(최저단가)의 이익 조건: companyProfitPreTax → companyDividendPlusRecovery
//   · A. 산정 기준 "당사 이익 구성 기준"의 기본 선택도 같은 항목으로(선택지는 그대로 남긴다)
//   · 관련 문구(범위 캡션·라벨·하한 사유·환산 참고값·확정 필요 항목)도 함께
// 대상: prototypes/src/{solar,offshore-wind,bess}.html — 육상풍력은 해상풍력에서 다시 파생한다
//   node prototypes/tools/common/profit-basis-dividend.mjs && node prototypes/tools/onshore-wind/onshore-1-derive.mjs && npm run build:prototypes
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../../src");
const PAGES = ["solar", "offshore-wind", "bess"];

for (const id of PAGES) {
  const file = resolve(SRC, `${id}.html`);
  let s = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const sub = (from, to, n, label) => {
    const found = s.split(from).length - 1;
    if (found !== n) throw new Error(`${id} · ${label}: expected ${n}, found ${found}`);
    s = s.split(from).join(to);
  };
  const once = (from, to, label) => sub(from, to, 1, label);
  const maybe = (from, to, label) => { // 페이지에 없을 수 있는 문구
    const found = s.split(from).length - 1;
    if (found > 1) throw new Error(`${id} · ${label}: expected 0~1, found ${found}`);
    if (found === 1) s = s.split(from).join(to);
    return found === 1;
  };

  // ── 기준 지표 ────────────────────────────────────────────────
  once(`                  <option value="companyDividendPlusRecovery">누적 배당+최종회수</option>`,
    `                  <option value="companyDividendPlusRecovery" selected>누적 배당+최종회수 (세전 배당 · 기본)</option>`, "default kind");
  once(`solveBidPriceForCompanyProfitTarget(profitModel, 100, 'companyProfitPreTax')`,
    `solveBidPriceForCompanyProfitTarget(profitModel, 100, 'companyDividendPlusRecovery')`, "floor kind");
  sub(`binding: '당사이익 100억'`, `binding: '배당+회수 100억'`, 2, "floor binding");

  // ── 문구 ─────────────────────────────────────────────────────
  once(`  // (P-IRR 6% AND 당사 이익 100억 15년 누적, ESS_비가격점수_가격환산_계산기.xlsx의 Q1/Q2 로직과 동일 개념)을`,
    `  // (P-IRR 6% AND 당사 배당+최종회수 100억 누적 — 세전 배당 기준 총액, ESS_비가격점수_가격환산_계산기.xlsx의 Q1/Q2 로직과 동일 개념)을`, "floor comment");
  once(`P-IRR 6%·당사 이익 100억 모두`, `P-IRR 6%·당사 배당+최종회수 100억 모두`, "floor reason");
  once(`<span class="l">최저단가 · P-IRR6%·이익100억</span>`, `<span class="l">최저단가 · P-IRR6%·배당+회수100억</span>`, "floor label");
  once(`P-IRR 6%·당사 이익 100억보다 낮게 설정되어 있는지 확인해 주세요.`,
    `P-IRR 6%·당사 배당+최종회수 100억(세전 배당 기준)보다 낮게 설정되어 있는지 확인해 주세요.`, "floor warn");
  once(`환산 당사 이익(누적 순이익 세전): \${fmt(r.companyProfitPreTax, 1)}`,
    `환산 당사 이익(누적 배당+최종회수): \${fmt(r.companyDividendPlusRecovery, 1)}`, "cross ref");
  maybe(`최저는 P-IRR 6%·당사 이익 100억(운영기간 누적) 동시충족 최소 단가`,
    `최저는 P-IRR 6%·당사 배당+최종회수 100억(세전 배당 기준 · 운영기간 누적) 동시충족 최소 단가`, "range caption (wind/solar)");
  maybe(`최저단가는 P-IRR 6%·당사 이익 100억(15년 누적) 동시충족 최소 입찰단가(Q1/Q2 로직)`,
    `최저단가는 P-IRR 6%·당사 배당+최종회수 100억(세전 배당 기준 · 운영기간 누적) 동시충족 최소 입찰단가(Q1/Q2 로직)`, "range caption (ess)");
  maybe(`<strong>"당사 이익 목표" 기본값(100억원, 기준 지표=누적 순이익 세전)</strong>`,
    `<strong>"당사 이익 목표" 기본값(100억원, 기준 지표=누적 배당+최종회수 — 배당소득세 차감 전 총 수취액)</strong>`, "caveat kind (ess)");
  maybe(`(ESS의 "당사 이익 100억원"은 총`, `(ESS의 "당사 배당+최종회수 100억원"은 총`, "caveat cross (wind)");

  // KPI 카드의 "당사 누적 순이익(세전/세후)"과 입찰 사례 탭의 "당사 누적 순이익(세전)" 열은 그대로 둔다 —
  // 열 제목이 그 지표를 명시하고 있고, 이번 변경은 목표·하한의 "기준"에 대한 것이다.

  writeFileSync(file, s, "utf8");
  console.log(`  ${id}: 목표·하한 기준 → 누적 배당+최종회수(세전 배당 기준 총액)`);
}
console.log("profit-basis-dividend: done — 이어서 onshore-1-derive.mjs와 npm run build:prototypes를 실행하세요.");
