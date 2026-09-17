# 입찰단가 프로토타입 제작 도구 (작업 기록)

`prototypes/src/*.html`(Claude Artifact 게시본)을 만들고 검증할 때 쓴 변환 파이프라인 · 브라우저 점검 스크립트 · 조사 결과를 그대로 모은 폴더입니다. 사이트 빌드(`npm run build:prototypes`)나 `npm test`는 이 폴더를 쓰지 않습니다.

> **경로 주의** — 스크립트 안의 `SP` 상수는 원래 작업 폴더(Claude Code 세션 임시 폴더)의 절대 경로를 가리킵니다. 다시 실행하려면 스크립트가 있는 폴더(또는 원하는 작업 폴더) 경로로 `SP`를 바꾸고, 각 폴더의 파일을 한곳에 모아 실행하세요.
>
> 브라우저 점검 스크립트는 원격 디버깅 포트를 연 헤드리스 Chrome을 씁니다:
> `chrome.exe --headless=new --remote-debugging-port=9335 --remote-allow-origins=* --disable-gpu --no-first-run --user-data-dir=<임시 폴더>`

## 폴더

| 폴더 | 내용 |
| --- | --- |
| `common/` | `check-ids.mjs`(HTML id 참조 누락 · 깨진 글자 점검), `site-smoke.mjs`(사이트 목록 → 세 페이지 로드 · 다운로드 대체 · 375px), `app-header-check.mjs`(앱 헤더 링크) |
| `solar/` | 태양광 파이프라인 · 점검 |
| `offshore-wind/` | 해상풍력 파이프라인 · 점검 |
| `bess/` | BESS(ESS) 화면 개편 조각 · 점검 · 엑셀 회신 검증 |
| `research-eiass/` | 환경영향평가정보지원시스템(EIASS) 사업 검색 · 상세 조회 스크립트와 결과 JSON |

## 태양광 (`solar/`)

BESS 페이지를 바탕으로 단계별로 변환합니다. 각 단계는 앞 단계 결과(스냅숏 `solar-v*-backup.html`)를 읽어 `solar-bid-price-prototype.html`을 씁니다.

1. `make-solar.mjs` — ESS 페이지 → 태양광 초안(v1)
2. `make-solar-v2.mjs` → `make-solar-v2b.mjs` — 계약기간 20~30년, EPC 일괄계약, 원산지 · 판매 구조 2개 조합(v2)
3. `make-solar-v3.mjs` — 국산 4사 · 중국산 3사 모듈 비교(v3)
4. `make-solar-v4.mjs` — 사별 탄소검증 제품 · 등급 · 우대가격, 공고 기준값(v4). `analyze-carbon.mjs`는 공공데이터포털 탄소검증 제품 목록(`carbon_modules.csv`)을 사별로 요약(`carbon-summary.json`)
5. `solar-5a.mjs` → `solar-5b.mjs` (`solar-lib.mjs`, `*-snippets.txt`, `solar-modules.json`) — 모듈 카탈로그 · 새 모듈 등록, 상한가 진입 조건, 입찰 사례(v4 스냅숏 기준, 재실행 가능)
6. 점검: `test-solar.mjs`(`patch-solar-test.mjs` + `solar-test-add.txt`로 5단계 항목 추가, 불러오기 픽스처 `solar-module-import-test.json`), `probe-375.mjs`

## 해상풍력 (`offshore-wind/`)

태양광 v4 스냅숏(`solar/solar-v4-backup.html`)을 읽어 `wind-bid-price-prototype.html`을 만듭니다.

- 실행 순서: `wind-1a` → `1b` → `1c` → `2a` → `2b` → `2c` → `2d` → `3` → `4` (공통 `wind-lib.mjs` — 교체 도구 · 터빈 데이터)
  - 1a~1c 마크업(조합 · 판매 조건 · 터빈 · 가중치 · 사업비), 2a~2d 계산 로직, 3 터빈 카탈로그 · 새 터빈 등록, 4 상한가 진입 조건 · 입찰 사례(보도 · EIASS)
- `patch-eiass.mjs`(+ `snip-eiass-reg.txt`, `snip-test.txt`) — 입찰 사례에 EIASS 협의 제원 반영
- 점검: `test-wind.mjs`(불러오기 픽스처 `turbine-import-test.json`), `shot-wind-catalog.mjs`, `shot-wind-entry.mjs`

## BESS (`bess/`)

- 화면 개편 전 스냅숏: `ess-bid-price-prototype.before-redesign.html`, `ess-bid-price-prototype.before-tabs-spec.html`
- 결과 탭 개편 조각: `redesign-top.html`, `script-part.html`, `v2-*.html`, `v2-sens.js`, 조립 `v2-splice.mjs` · `v2-js.mjs`, 문자 이스케이프 보정 `fix-escape.mjs`
- 점검: `test-redesign.mjs`, `shots-capex.mjs`, `shots-extra.mjs`, `diag-375.mjs`, `irr-options.mjs`, `sanity-caption.mjs`
- 엑셀 회신(`ESS_엑셀변환.bat` · `ess-bidprice-xlsx.mjs`) 검증: `capture-real-scenario.mjs`(화면에서 저장한 시나리오 JSON 캡처 → `ess_real_scenario.json` · `.expected.json`), `crosscheck-xlsx.mjs`(`crosscheck-A/B.json`), `verify-excel.ps1`, 변환기 이전 버전 `ess-bidprice-xlsx.before-spec.mjs`와 조립 `splice-xlsx.mjs` · `xlsx-tail.mjs`, 레거시 픽스처 `ess_kch_legacy.json`

## EIASS 조사 (`research-eiass/`)

- `eiass-cdp.mjs 검색어…` — 헤드리스 Chrome으로 사업 검색(검색은 페이지 스크립트로만 동작) → `eiass-results.json`
- 사업 상세는 `https://www.eiass.go.kr/biz/base/info/eiaInfo.do`에 `EIA_CD` · `EIA_DISC_SEQ`를 POST하면 받을 수 있음(`eiass_targets.txt` = 사업명 · 코드 · 순번). `eiass-detail.mjs`(클릭 방식, 팝업 때문에 실패) · `eiass-viewfn.mjs`(view() 추적)는 그 방법을 찾는 과정의 기록
- `eiass-results-*.json` · `eiass-detail.json` — 해상풍력 · 태양광 사례 조사 때의 검색 · 상세 결과

## 넣지 않은 것

화면 스크린샷 · 테스트 출력 로그, 내려받은 원문(EIASS 상세 HTML · 사이트 스크립트 · 공단 PDF), 엑셀 · PDF 산출물, 그리고 `.gitignore`의 민감 원본(`샘플/`, 단가산정모델 · 가격환산 계산기 원본, ESS 베타테스트 파일, 안좌 가정 파일)은 넣지 않았습니다.
