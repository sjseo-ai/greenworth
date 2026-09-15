# 엑셀 내보내기 명세서 — 의존성 0으로 .xlsx 만들기

> `사업성/` 웹앱의 **엑셀 내보내기**를 다른 사이트에 그대로 옮기기 위한 상세 명세입니다.
> 라이브러리 없이 ZIP 바이트와 OOXML을 직접 만들어 `.xlsx` 를 생성합니다.
>
> 자매 문서
> · [web-app-blueprint.md](web-app-blueprint.md) — 전체 아키텍처 · 계산 엔진 · 복제 레시피
> · [result-tabs-design-spec.md](result-tabs-design-spec.md) — 요약·민감도·시나리오 탭 디자인
>
> 기준 시점: 2026-09-11 · 기준 코드: `사업성/js/xlsx.js`(300줄) + `js/export-excel.js`(351줄) + 테스트 30개

---

## 목차

1. [왜 라이브러리를 쓰지 않았나](#1-왜-라이브러리를-쓰지-않았나)
2. [`.xlsx` 파일의 정체](#2-xlsx-파일의-정체)
3. [3계층 구조](#3-3계층-구조)
4. [계층 1 — ZIP 바이트 직접 쓰기](#4-계층-1--zip-바이트-직접-쓰기)
5. [계층 2 — OOXML 최소 집합](#5-계층-2--ooxml-최소-집합)
6. [스타일 시스템](#6-스타일-시스템)
7. [셀 모델과 워크시트 기능](#7-셀-모델과-워크시트-기능)
8. [계층 3 — 도메인 데이터 → 시트](#8-계층-3--도메인-데이터--시트)
9. [숫자 규약 — 받는 사람이 계산할 수 있어야 한다](#9-숫자-규약--받는-사람이-계산할-수-있어야-한다)
10. [다운로드 트리거](#10-다운로드-트리거)
11. [테스트 전략 — ZIP을 되읽어 검증](#11-테스트-전략--zip을-되읽어-검증)
12. [복사용 전문](#12-복사용-전문)
13. [다른 도메인으로 옮기기](#13-다른-도메인으로-옮기기)
14. [함정 모음](#14-함정-모음)
15. [한계와 확장 여지](#15-한계와-확장-여지)
16. [체크리스트](#16-체크리스트)

---

## 1. 왜 라이브러리를 쓰지 않았나

### 1.1 제약

```
이 프로젝트는 런타임 의존성이 없고 file:// 에서 동작해야 하므로(PRD 3.7)
SheetJS 같은 라이브러리를 쓸 수 없다. 그래서 필요한 최소한만 직접 만든다.
```

`index.html` 을 더블클릭해 `file://` 로 열어도 동작해야 합니다. 그러면:

1. **CDN 스크립트를 못 씁니다** — 오프라인일 수 있고, `file://` 에서 일부 CORS 제약이 있습니다.
2. **`npm install` 을 요구할 수 없습니다** — 받는 사람이 압축을 풀고 더블클릭만 합니다.
3. **번들에 넣으면 용량이 폭발합니다** — SheetJS 최소 빌드가 ~900KB. 현재 전체 번들이 172KB입니다.

### 1.2 직접 만든 결과

| 항목 | 값 |
|---|---|
| 코드량 | `xlsx.js` **300줄** (ZIP + OOXML 엔진) + `export-excel.js` **351줄** (도메인 → 시트) |
| 의존성 | **0** |
| 생성 시간 | **3ms** (5시트 · 224행) |
| 산출물 | **78.6 KB** (무압축) |
| 바이트 결정론 | **같은 입력 → 같은 바이트** (타임스탬프 고정) |

**무압축인데 78.6KB 입니다.** 압축하면 ~15KB 정도지만, **deflate를 직접 구현하지 않기로** 결정했습니다. 200~300줄이 더 들고, 얻는 건 첨부파일 60KB 절약뿐입니다.

### 1.3 이 선택이 맞는 경우 / 아닌 경우

**맞는 경우**
1. 표 형태 데이터 + 서식 정도만 필요하다
2. 배포 환경을 통제할 수 없다 (파일로 전달)
3. 의존성을 늘릴 수 없다
4. 생성 내용을 코드로 완전히 통제하고 싶다

**아닌 경우**
1. 수식(`=SUM(B2:B10)`)이 필요하다 → 직접 넣을 수는 있지만 의존성 검증이 없어 위험
2. 차트·이미지·피벗테이블이 필요하다 → 파트가 훨씬 늘어난다
3. 기존 `.xlsx` 를 **읽어야** 한다 → 읽기는 쓰기보다 훨씬 어렵다 (압축 해제 필요)
4. 조건부 서식·데이터 유효성 검사가 필요하다

15장에서 각각 얼마나 더 들지 가늠해 둡니다.

---

## 2. `.xlsx` 파일의 정체

**`.xlsx` 는 XML 파일 몇 개를 담은 ZIP입니다.** 확장자를 `.zip` 으로 바꿔 풀어보면 확인됩니다.

우리가 만드는 최소 구성 — **5종 + 시트 수만큼**:

```
포항 해돋이 풍력_사업성분석_20260911.xlsx   (= ZIP)
├── [Content_Types].xml          ← 어떤 파일이 어떤 종류인지 선언 (필수)
├── _rels/
│   └── .rels                    ← 패키지 진입점 → workbook.xml (필수)
└── xl/
    ├── workbook.xml             ← 시트 목록 (이름 · ID · 관계)
    ├── _rels/
    │   └── workbook.xml.rels    ← 시트 파일·스타일 파일 연결
    ├── styles.xml               ← 서식 정의 전부
    └── worksheets/
        ├── sheet1.xml           ← 요약
        ├── sheet2.xml           ← 입력값
        ├── sheet3.xml           ← 연도별 현금흐름
        ├── sheet4.xml           ← 민감도
        └── sheet5.xml           ← 시나리오
```

**생략한 것들** — 엑셀이 없어도 열어줍니다:

| 생략 | 원래 용도 | 대체 방법 |
|---|---|---|
| `xl/sharedStrings.xml` | 문자열 중복 제거 | `t="inlineStr"` 로 셀에 직접 넣음 |
| `docProps/app.xml`, `core.xml` | 작성자·제목 메타데이터 | 없어도 열린다 |
| `xl/theme/theme1.xml` | 테마 색 팔레트 | `rgb=` 로 색을 직접 지정 |
| `xl/calcChain.xml` | 수식 계산 순서 | 수식을 안 쓴다 |

**`sharedStrings` 생략이 가장 큰 단순화입니다.** 문자열 테이블을 만들고 인덱스를 관리하는 코드가 통째로 사라집니다. 대가는 파일 크기인데, 어차피 무압축이라 신경 쓰지 않습니다.

---

## 3. 3계층 구조

```
┌─────────────────────────────────────────────────────────────┐
│ 계층 3 — export-excel.js (351줄) · 도메인을 안다            │
│   analyzeCase() 결과 → 시트 배열                            │
│   "요약 시트 4열, 민감도 시트는 변수 × 단계"                 │
│   ⚠ 계산은 하지 않는다                                      │
└───────────────────────────┬─────────────────────────────────┘
                            │ [{ name, rows, colWidths, freeze, merges, tabColor }]
┌───────────────────────────▼─────────────────────────────────┐
│ 계층 2 — xlsx.js 후반 (160줄) · OOXML 을 안다                │
│   시트 배열 → XML 문자열 6종 + 스타일                        │
│   STYLES 이름 테이블 · 셀 모델 { v, s }                      │
│   ⚠ 도메인을 모른다                                          │
└───────────────────────────┬─────────────────────────────────┘
                            │ [{ name: 'xl/...', data: Uint8Array }]
┌───────────────────────────▼─────────────────────────────────┐
│ 계층 1 — xlsx.js 전반 (90줄) · ZIP 을 안다                   │
│   CRC32 + 로컬헤더 + 중앙디렉터리 + EOCD                     │
│   ⚠ XML 도 도메인도 모른다                                   │
└───────────────────────────┬─────────────────────────────────┘
                            │ Uint8Array
                      Blob → <a download> → 다운로드
```

**계층 1·2가 `xlsx.js` 한 파일에 있지만 한 방향으로만 의존합니다.** 다른 프로젝트로 가져갈 때 `xlsx.js` 는 **한 줄도 고치지 않고** 복사하면 됩니다 — 도메인 지식이 0이기 때문입니다.

---

## 4. 계층 1 — ZIP 바이트 직접 쓰기

### 4.1 CRC32 — 32줄

ZIP은 각 파일의 CRC32 체크섬을 요구합니다. 표준 다항식 `0xEDB88320` 의 역순 구현입니다.

```js
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
```

**`>>> 0` 이 필수입니다.** JS의 비트 연산은 **부호 있는** 32비트 정수를 돌려주므로, 없으면 음수가 나와 ZIP 헤더에 잘못 기록됩니다.

알려진 값으로 검증합니다 — `"123456789"` → `0xCBF43926`:

```js
test('crc32 가 알려진 값과 맞는다', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});
```

### 4.2 리틀엔디안 쓰기 헬퍼 — 3줄

ZIP의 모든 숫자 필드는 **리틀엔디안**입니다.

```js
const utf8 = (s) => new TextEncoder().encode(s);

function pushU16(out, v) { out.push(v & 0xff, (v >>> 8) & 0xff); }
function pushU32(out, v) { out.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff); }
function pushBytes(out, bytes) { for (let i = 0; i < bytes.length; i++) out.push(bytes[i]); }
```

평범한 JS 배열에 바이트를 쌓고 마지막에 `Uint8Array.from()` 으로 굳힙니다. 크기를 미리 계산할 필요가 없어집니다 — 78KB 규모에서는 성능 차이가 없습니다(전체 3ms).

### 4.3 ZIP 구조 — 3종 레코드

```
┌──────────────────────────────────────┐
│ Local File Header #1  (30B + 이름)   │  ← 파일마다 하나
│ File Data #1          (무압축 원본)   │
├──────────────────────────────────────┤
│ Local File Header #2                 │
│ File Data #2                         │
│ …                                    │
├══════════════════════════════════════┤  ← cdOffset
│ Central Directory Header #1 (46B+이름)│  ← 파일마다 하나, 뒤에 모아서
│ Central Directory Header #2          │
│ …                                    │
├══════════════════════════════════════┤
│ EOCD (End of Central Directory, 22B) │  ← 딱 하나, 맨 끝
└──────────────────────────────────────┘
```

**리더는 파일 끝에서 EOCD를 먼저 찾고, 거기 적힌 오프셋으로 중앙디렉터리를 읽습니다.** 그래서 중앙디렉터리의 오프셋 값이 틀리면 "손상된 파일"이 됩니다.

### 4.4 Local File Header — 30바이트 + 이름

| 오프셋 | 크기 | 값 | 설명 |
|---|---|---|---|
| 0 | 4 | `0x04034b50` | 시그니처 `PK\x03\x04` |
| 4 | 2 | `20` | 필요 버전 (2.0) |
| 6 | 2 | `0x0800` | 플래그 — **bit 11 = 파일명 UTF-8** |
| 8 | 2 | `0` | 압축 방식 **0 = store(무압축)** |
| 10 | 2 | `0` | 수정 시각 (DOS) |
| 12 | 2 | `0x2821` | 수정 날짜 (DOS) = 2000-01-01 |
| 14 | 4 | crc32 | |
| 18 | 4 | 크기 | 압축 후 크기 |
| 22 | 4 | 크기 | 압축 전 크기 (store라 동일) |
| 26 | 2 | n | 파일명 길이 |
| 28 | 2 | `0` | extra 필드 길이 |
| 30 | n | 이름 | UTF-8 바이트 |
| 30+n | m | 데이터 | |

```js
pushU32(out, 0x04034b50);
pushU16(out, 20);
pushU16(out, 0x0800); // UTF-8 파일명
pushU16(out, 0);      // store
pushU16(out, time);
pushU16(out, date);
pushU32(out, crc);
pushU32(out, f.data.length);
pushU32(out, f.data.length);
pushU16(out, nameBytes.length);
pushU16(out, 0);
pushBytes(out, nameBytes);
pushBytes(out, f.data);
```

**`0x0800` 플래그가 중요합니다.** 우리 내부 경로는 ASCII(`xl/worksheets/sheet1.xml`)지만, 플래그를 켜두면 한글 경로를 쓰게 돼도 안전합니다.

### 4.5 DOS 날짜 — 고정값의 이유

```js
// 고정 타임스탬프 — 같은 입력이면 같은 바이트가 나와 테스트가 안정된다.
const time = 0;
const date = 0x2821; // 2000-01-01
```

DOS 날짜 포맷:
```
비트  15-9      8-5     4-0
      년-1980   월      일
0x2821 = 0010100 0001 00001
       = 20      1     1      → 1980+20 = 2000년 1월 1일
```

**`Date.now()` 를 쓰면 같은 데이터인데도 매번 바이트가 달라져 테스트가 불안정해집니다.** 파일 수정 시각은 OS가 관리하므로 ZIP 내부 타임스탬프는 실용적 의미가 없습니다.

### 4.6 Central Directory Header — 46바이트 + 이름

로컬 헤더와 거의 같지만 **추가 필드 4개**가 있습니다.

| 오프셋 | 크기 | 값 | 설명 |
|---|---|---|---|
| 0 | 4 | `0x02014b50` | 시그니처 `PK\x01\x02` |
| 4 | 2 | `20` | **만든 버전** (로컬에 없는 필드) |
| 6 | 2 | `20` | 필요 버전 |
| 8 | 2 | `0x0800` | 플래그 |
| 10 | 2 | `0` | 압축 방식 |
| 12~27 | 16 | … | 시각·날짜·crc·크기 ×2 (로컬과 동일) |
| 28 | 2 | n | 파일명 길이 |
| 30 | 2 | `0` | extra 길이 |
| 32 | 2 | `0` | **주석 길이** |
| 34 | 2 | `0` | **시작 디스크 번호** |
| 36 | 2 | `0` | **내부 속성** |
| 38 | 4 | `0` | **외부 속성** |
| 42 | 4 | offset | **★ 로컬 헤더 오프셋** |
| 46 | n | 이름 | |

```js
const offset = out.length;   // ★ 로컬 헤더를 쓰기 전에 기록
/* … 로컬 헤더 + 데이터 … */

pushU32(central, 0x02014b50);
pushU16(central, 20);  // 만든 버전
pushU16(central, 20);  // 필요 버전
/* … 동일 필드 … */
pushU16(central, 0);   // 주석 길이
pushU16(central, 0);   // 시작 디스크
pushU16(central, 0);   // 내부 속성
pushU32(central, 0);   // 외부 속성
pushU32(central, offset);  // ★
pushBytes(central, nameBytes);
```

**오프셋을 로컬 헤더 기록 *전*에 잡아야 합니다.** 이 한 줄 순서가 틀리면 파일이 열리지 않습니다.

### 4.7 EOCD — 22바이트

| 오프셋 | 크기 | 값 |
|---|---|---|
| 0 | 4 | `0x06054b50` 시그니처 `PK\x05\x06` |
| 4 | 2 | 현재 디스크 번호 `0` |
| 6 | 2 | 중앙디렉터리 시작 디스크 `0` |
| 8 | 2 | 이 디스크의 항목 수 |
| 10 | 2 | 전체 항목 수 |
| 12 | 4 | 중앙디렉터리 바이트 크기 |
| 16 | 4 | 중앙디렉터리 오프셋 |
| 20 | 2 | 주석 길이 `0` |

```js
const cdOffset = out.length;
pushBytes(out, Uint8Array.from(central));
pushU32(out, 0x06054b50);
pushU16(out, 0);
pushU16(out, 0);
pushU16(out, files.length);
pushU16(out, files.length);
pushU32(out, central.length);
pushU32(out, cdOffset);
pushU16(out, 0);

return Uint8Array.from(out);
```

**전체 `zipStore()` 는 58줄입니다.** 이게 범용 ZIP 작성기라서, 다른 어떤 프로젝트에도 그대로 복사해 쓸 수 있습니다.

---

## 5. 계층 2 — OOXML 최소 집합

### 5.1 공통

```js
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL  = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
```

**XML 이스케이프 — 5종 + 제어문자 제거:**

```js
export function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')        // ★ 반드시 첫 번째
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // 엑셀이 거부하는 제어문자는 빼고 넣는다
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}
```

**포인트 2개**
1. **`&` 를 먼저 치환합니다.** 나중에 하면 `&lt;` 의 `&` 를 다시 이스케이프해 `&amp;lt;` 가 됩니다.
2. **제어문자를 제거합니다.** XML 1.0은 `\t`(09), `\n`(0A), `\r`(0D) 외의 C0 제어문자를 허용하지 않습니다. 사용자 입력에 섞여 들어오면 **엑셀이 "복구 불가" 오류**를 냅니다.

### 5.2 열 이름 — 0 → A, 26 → AA

```js
export function colName(index) {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
```

**26진법이 아니라 "이중 알파벳(bijective base-26)"입니다.** `A`=1이고 0이 없어서, 평범한 진법 변환으로는 `Z` 다음이 `BA` 가 됩니다(`AA` 가 아님). `(n-1)` 보정이 그래서 필요합니다.

```js
assert.equal(colName(0), 'A');
assert.equal(colName(25), 'Z');
assert.equal(colName(26), 'AA');   // ← 여기가 함정
assert.equal(colName(51), 'AZ');
assert.equal(colName(52), 'BA');
```

### 5.3 시트 이름 제약

```js
/** 시트 이름 제약: 31자, : \ / ? * [ ] 금지 */
export function safeSheetName(name, fallback = 'Sheet') {
  const cleaned = String(name).replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31);
  return cleaned || fallback;
}
```

엑셀 규칙: **31자 이하**, `: \ / ? * [ ]` 금지, 빈 이름 불가, **중복 불가**.
중복 처리는 `buildXlsx()` 에서 합니다:

```js
const used = new Set();
const named = sheets.map((s, i) => {
  let name = safeSheetName(s.name, `Sheet${i + 1}`);
  let n = 2;
  while (used.has(name)) name = safeSheetName(`${name.slice(0, 28)}(${n++})`, `Sheet${i + 1}`);
  used.add(name);
  return { ...s, name };
});
```

`slice(0, 28)` + `(2)` = 31자를 넘지 않습니다. **중복 이름은 엑셀이 파일을 아예 못 여는 오류**라서 조용히 고쳐줍니다.

### 5.4 `[Content_Types].xml`

```js
const contentTypes = `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  named.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
  '</Types>';
```

**모든 파트를 빠짐없이 선언해야 합니다.** 시트를 하나 추가했는데 여기 `Override` 를 안 넣으면 엑셀이 그 시트를 무시하거나 파일 복구를 시도합니다. **시트 배열을 순회해서 생성**하므로 누락이 구조적으로 불가능합니다.

`PartName` 은 **앞에 `/` 가 붙는 절대 경로**인데, ZIP 내부 항목 이름은 `/` 없이 시작합니다(`xl/workbook.xml`). 헷갈리기 쉬운 지점입니다.

### 5.5 관계(`.rels`) 2개

```js
// _rels/.rels — 패키지 진입점
const rootRels = `${XML_HEAD}<Relationships xmlns="…/relationships">` +
  `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
  '</Relationships>';

// xl/_rels/workbook.xml.rels — 워크북이 참조하는 것들
const workbookRels = `${XML_HEAD}<Relationships xmlns="…/relationships">` +
  named.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
  `<Relationship Id="rId${named.length + 1}" Type="${NS_REL}/styles" Target="styles.xml"/>` +
  '</Relationships>';
```

**`rId` 번호가 `workbook.xml` 의 `r:id` 와 정확히 맞아야 합니다:**

```js
const workbook = `${XML_HEAD}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets>` +
  named.map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
  '</sheets></workbook>';
```

**규약: 시트는 `rId1`..`rIdN`, 스타일은 `rId(N+1)`.** 둘을 같은 루프 변수로 만들어 어긋날 여지를 없앴습니다. `Target` 은 `xl/` 기준 **상대 경로**입니다(`worksheets/sheet1.xml`, `xl/` 를 붙이면 안 됩니다).

---

## 6. 스타일 시스템

`styles.xml` 이 `.xlsx` 에서 가장 헷갈리는 부분입니다. **5개 배열의 인덱스를 조합**하는 구조입니다.

```
numFmts  ─┐
fonts    ─┤
fills    ─┼─→ cellXfs[i] = { numFmtId, fontId, fillId, borderId, alignment }
borders  ─┤         ▲
          ┘         │
                    └── 셀의 s="i" 가 이 인덱스를 가리킨다
```

### 6.1 색과 폰트 상수

```js
const ACCENT      = 'FF0F6B4A';   // 딥 그린 — 화면 --accent 와 같은 색
const ACCENT_SOFT = 'FFE7F2ED';
const ZEBRA       = 'FFF4F6F8';
const LINE        = 'FFD5DBE1';
const MUTED       = 'FF7B8794';
const FONT_NAME   = '맑은 고딕';
```

**색은 `AARRGGBB` 8자리입니다** (앞 2자리 = 알파). `FF` 를 빼고 6자리로 쓰면 엑셀이 무시하거나 검은색으로 렌더합니다.

**화면 CSS 토큰과 같은 값을 씁니다.** `--accent: #0f6b4a` ↔ `ACCENT = 'FF0F6B4A'`. 엑셀 파일이 화면과 같은 브랜드로 보입니다.

### 6.2 숫자 서식 — ID는 164부터

```js
const NUM_FMTS = [
  { id: 164, code: '#,##0.0' },                    // 억원 1자리
  { id: 165, code: '#,##0.00' },                   // 억원 2자리 (검산용)
  { id: 166, code: '0.00%' },                      // 비율 ★
  { id: 167, code: '#,##0.0;[Red]-#,##0.0' },      // 음수 빨강
  { id: 168, code: '0.000' },                      // DSCR
  { id: 169, code: '#,##0' },                      // 정수
];
```

**⚠ 0~163번은 엑셀 내장 서식 예약 번호입니다.** 커스텀 서식은 **반드시 164 이상**을 써야 합니다. 163 이하를 쓰면 내장 서식이 덮어써져 엉뚱하게 보입니다.

**`167` 의 `;[Red]` 구문** — 세미콜론으로 `양수;음수` 구획을 나누고 `[Red]` 로 색을 지정합니다. 음수 현금흐름이 자동으로 빨강이 되어, **화면의 `td.neg` 와 같은 의미를 엑셀이 스스로 유지**합니다.

### 6.3 폰트 7종

```js
const FONTS = [
  `<font><sz val="11"/><color theme="1"/><name val="${FONT_NAME}"/></font>`,                    // 0 기본
  `<font><b/><sz val="11"/><color theme="1"/><name val="${FONT_NAME}"/></font>`,                 // 1 굵게
  `<font><b/><sz val="15"/><color rgb="${ACCENT}"/><name val="${FONT_NAME}"/></font>`,           // 2 제목
  `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="${FONT_NAME}"/></font>`,            // 3 헤더(흰글씨)
  `<font><sz val="10"/><color rgb="${MUTED}"/><name val="${FONT_NAME}"/></font>`,                // 4 주석
  `<font><b/><sz val="11"/><color rgb="${ACCENT}"/><name val="${FONT_NAME}"/></font>`,           // 5 섹션
  `<font><b/><sz val="13"/><color theme="1"/><name val="${FONT_NAME}"/></font>`,                 // 6 KPI
];
```

`color theme="1"` 은 테마의 본문 색(보통 검정)입니다. `theme1.xml` 을 생략했지만 엑셀이 기본 테마를 적용해 정상 동작합니다.

### 6.4 채우기 — 0·1번은 예약

```js
const FILLS = [
  '<fill><patternFill patternType="none"/></fill>',        // ★ 0 — 반드시 none
  '<fill><patternFill patternType="gray125"/></fill>',     // ★ 1 — 반드시 gray125
  `<fill><patternFill patternType="solid"><fgColor rgb="${ACCENT}"/><bgColor indexed="64"/></patternFill></fill>`,       // 2
  `<fill><patternFill patternType="solid"><fgColor rgb="${ACCENT_SOFT}"/><bgColor indexed="64"/></patternFill></fill>`,  // 3
  `<fill><patternFill patternType="solid"><fgColor rgb="${ZEBRA}"/><bgColor indexed="64"/></patternFill></fill>`,        // 4
];
```

**⚠ 엑셀은 `fills[0] = none`, `fills[1] = gray125` 를 요구합니다.** 사양에 명시돼 있진 않지만 실질적 필수입니다. 이 둘을 생략하고 0번에 색을 넣으면 **모든 채우기 색이 한 칸씩 밀립니다.**

`bgColor indexed="64"` 는 "기본 배경"을 뜻하는 관용구입니다. `solid` 패턴에서는 `fgColor` 가 실제 칠하는 색입니다 — 이름이 반대처럼 느껴지는 지점입니다.

### 6.5 테두리

```js
const THIN = `<border>` +
  `<left style="thin"><color rgb="${LINE}"/></left>` +
  `<right style="thin"><color rgb="${LINE}"/></right>` +
  `<top style="thin"><color rgb="${LINE}"/></top>` +
  `<bottom style="thin"><color rgb="${LINE}"/></bottom>` +
  `<diagonal/></border>`;

const BORDERS = [
  '<border><left/><right/><top/><bottom/><diagonal/></border>',   // 0 없음
  THIN,                                                           // 1 얇은 회색
];
```

**`<diagonal/>` 를 빠뜨리면 엑셀이 파일을 거부합니다.** 대각선을 안 쓰더라도 빈 태그가 있어야 합니다.

**테두리는 2종뿐입니다.** 화면 디자인은 "세로선 없이 가로선만"이지만, 엑셀에서는 격자선을 끄고(`showGridLines="0"`) 얇은 회색 테두리를 전면에 두는 쪽이 읽기 좋습니다 — 출력·복사 시 표 경계가 유지됩니다.

### 6.6 스타일 이름 테이블 — 이 설계의 핵심

```js
/** 이름 → cellXfs 인덱스. 순서가 곧 인덱스다. */
const STYLE_DEFS = [
  ['DEFAULT',     { font: 0 }],
  ['TITLE',       { font: 2, align: 'left', height: 22 }],
  ['SUBTITLE',    { font: 4, align: 'left' }],
  ['SECTION',     { font: 5, fill: 3, border: 1, align: 'left' }],
  ['HEADER',      { font: 3, fill: 2, border: 1, align: 'center', wrap: true }],
  ['LABEL',       { font: 0, border: 1, align: 'left' }],
  ['LABEL_B',     { font: 1, border: 1, align: 'left' }],
  ['LABEL_IN',    { font: 0, border: 1, align: 'left', indent: 1 }],
  ['NUM1',        { font: 0, border: 1, align: 'right', fmt: 164 }],
  ['NUM2',        { font: 0, border: 1, align: 'right', fmt: 165 }],
  ['PCT',         { font: 0, border: 1, align: 'right', fmt: 166 }],
  ['SIGNED',      { font: 0, border: 1, align: 'right', fmt: 167 }],
  ['DEC3',        { font: 0, border: 1, align: 'right', fmt: 168 }],
  ['INT',         { font: 0, border: 1, align: 'right', fmt: 169 }],
  ['TEXT',        { font: 0, border: 1, align: 'left', wrap: true }],
  ['NOTE',        { font: 4, align: 'left', wrap: true }],
  ['YEAR',        { font: 1, fill: 4, border: 1, align: 'center' }],
  ['TOTAL_LABEL', { font: 1, fill: 4, border: 1, align: 'left' }],
  ['TOTAL_NUM',   { font: 1, fill: 4, border: 1, align: 'right', fmt: 164 }],
  ['TOTAL_PCT',   { font: 1, fill: 4, border: 1, align: 'right', fmt: 166 }],
  ['KPI_LABEL',   { font: 1, border: 1, align: 'left' }],
  ['KPI_PCT',     { font: 6, border: 1, align: 'right', fmt: 166 }],
  ['KPI_NUM',     { font: 6, border: 1, align: 'right', fmt: 164 }],
  ['CENTER',      { font: 0, border: 1, align: 'center' }],
];

export const STYLES = Object.fromEntries(STYLE_DEFS.map(([name], i) => [name, i]));
```

**배열 순서가 곧 `cellXfs` 인덱스이고, 이름으로 조회합니다.** 덕분에 도메인 코드가 숫자를 전혀 다루지 않습니다.

```js
cell(1430.5, 'NUM1')    // ← 이렇게 쓰고
cell(1430.5, 8)         // ← 이렇게 쓰지 않는다
```

스타일을 **중간에 끼워 넣어도** 모든 호출처가 자동으로 맞습니다(이름으로 찾으니까). 인덱스를 직접 썼다면 전부 밀려서 서식이 뒤죽박죽이 됩니다.

### 6.7 `xf` 생성 — `apply*` 플래그

```js
function xfXml(def) {
  const fmt = def.fmt || 0;
  const parts = [
    `numFmtId="${fmt}"`,
    `fontId="${def.font || 0}"`,
    `fillId="${def.fill || 0}"`,
    `borderId="${def.border || 0}"`,
    'xfId="0"',
  ];
  if (fmt) parts.push('applyNumberFormat="1"');
  if (def.font) parts.push('applyFont="1"');
  if (def.fill) parts.push('applyFill="1"');
  if (def.border) parts.push('applyBorder="1"');
  const align = def.align || def.wrap || def.indent
    ? `<alignment horizontal="${def.align || 'general'}" vertical="center"${def.wrap ? ' wrapText="1"' : ''}${def.indent ? ` indent="${def.indent}"` : ''}/>`
    : '';
  if (align) parts.push('applyAlignment="1"');
  return align ? `<xf ${parts.join(' ')}>${align}</xf>` : `<xf ${parts.join(' ')}/>`;
}
```

**⚠ `apply*="1"` 플래그가 없으면 서식이 무시될 수 있습니다.** `fontId="3"` 을 지정해도 `applyFont="1"` 이 없으면 엑셀이 "이 셀은 폰트를 상속한다"고 해석할 수 있습니다. 인덱스가 0이 아닐 때만 플래그를 켜는 것이 관용적 처리입니다.

`vertical="center"` 를 전 스타일에 공통으로 걸어 행 높이가 커져도 값이 가운데에 머물게 합니다.

### 6.8 `styles.xml` 조립

```js
const STYLES_XML = `${XML_HEAD}<styleSheet xmlns="${NS_MAIN}">` +
  `<numFmts count="${NUM_FMTS.length}">${NUM_FMTS.map((f) => `<numFmt numFmtId="${f.id}" formatCode="${escapeXml(f.code)}"/>`).join('')}</numFmts>` +
  `<fonts count="${FONTS.length}">${FONTS.join('')}</fonts>` +
  `<fills count="${FILLS.length}">${FILLS.join('')}</fills>` +
  `<borders count="${BORDERS.length}">${BORDERS.join('')}</borders>` +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  `<cellXfs count="${STYLE_DEFS.length}">${STYLE_DEFS.map(([, d]) => xfXml(d)).join('')}</cellXfs>` +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';
```

**3가지 필수 사항**

1. **요소 순서가 고정입니다** — `numFmts → fonts → fills → borders → cellStyleXfs → cellXfs → cellStyles`. 순서가 바뀌면 스키마 위반으로 거부됩니다.
2. **`count` 속성이 실제 개수와 맞아야 합니다.** 배열 `.length` 로 생성하므로 어긋날 수 없습니다.
3. **`cellStyleXfs` 와 `cellStyles` 가 최소 1개씩 필요합니다.** `cellXfs` 의 `xfId="0"` 이 이걸 가리킵니다. 생략하면 엑셀이 복구를 시도합니다.

`formatCode` 도 `escapeXml()` 을 통과시킵니다 — `#,##0.0;[Red]-#,##0.0` 에는 위험 문자가 없지만, 나중에 `"` 가 들어간 서식(`#,##0"억"`)을 추가할 수 있습니다.

---

## 7. 셀 모델과 워크시트 기능

### 7.1 셀 — 원시값 또는 `{ v, s }`

```js
function normalizeCell(cell) {
  if (cell == null) return { v: null, s: 0 };
  if (typeof cell === 'object' && !(cell instanceof Date)) {
    const idx = typeof cell.s === 'string' ? STYLES[cell.s] : cell.s;
    return { v: cell.v == null ? null : cell.v, s: idx == null ? 0 : idx, name: cell.s };
  }
  return { v: cell, s: 0 };
}
```

**4가지 입력을 모두 받습니다.**

| 입력 | 해석 |
|---|---|
| `null` / `undefined` | 빈 셀, 서식 없음 |
| `1430.5` / `'텍스트'` | 값만, 서식 없음 |
| `{ v: 1430.5, s: 'NUM1' }` | 값 + **이름으로** 서식 |
| `{ v: 1430.5, s: 8 }` | 값 + 인덱스로 서식 (내부용) |

`name` 을 함께 돌려주는 이유는 행 높이 판정에 쓰기 때문입니다(7.5).

### 7.2 셀 XML — 타입 3종

```js
function cellXml(ref, cell) {
  const { v, s } = cell;
  const st = s ? ` s="${s}"` : '';
  if (v == null || v === '') return `<c r="${ref}"${st}/>`;
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
  return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`;
}
```

**3분기만 있습니다.**

1. **빈 셀** — `<c r="A1" s="5"/>`. 값이 없어도 **서식은 남깁니다**(배경색을 시트 폭 전체에 깔 때 필요).
2. **숫자** — `<c r="B1"><v>1430.5</v></c>`. `t` 속성 없음이 곧 숫자입니다.
3. **문자열** — `t="inlineStr"` + `<is><t>…</t></is>`.

**`Number.isFinite(v)` 검사가 중요합니다.** `NaN` 이나 `Infinity` 를 `<v>` 에 넣으면 엑셀이 파일을 거부합니다. 여기서 걸리면 문자열로 떨어지는데, 그 전에 `fin()` 헬퍼가 `null` 로 바꿔줍니다(8.1).

**`xml:space="preserve"`** — 앞뒤 공백이 보존됩니다. 들여쓰기용 전각 공백(`　`)을 쓸 때 필요합니다.

### 7.3 틀 고정 (freeze)

```js
const freeze = sheet.freeze
  ? `<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane` +
    `${sheet.freeze.col ? ` xSplit="${sheet.freeze.col}"` : ''}` +
    `${sheet.freeze.row ? ` ySplit="${sheet.freeze.row}"` : ''}` +
    ` topLeftCell="${colName(sheet.freeze.col || 0)}${(sheet.freeze.row || 0) + 1}"` +
    ` activePane="bottomRight" state="frozen"/></sheetView></sheetViews>`
  : '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>';
```

`{ row: 3, col: 1 }` → 3행과 1열을 고정 → `topLeftCell="B4"`.

**`showGridLines="0"` 을 전 시트에 걸었습니다.** 우리가 테두리를 직접 그리므로, 엑셀 기본 격자선이 함께 보이면 선이 두 겹이 되어 지저분합니다. **이 한 줄이 "직접 만든 파일" 과 "잘 만든 보고서" 를 가릅니다.**

시트별 설정:

| 시트 | freeze | 이유 |
|---|---|---|
| 요약 | `{ row: 1 }` | 제목만 고정 |
| 입력값 | `{ row: 2 }` | 제목 + 부제 |
| 연도별 현금흐름 | `{ row: 3, col: 1 }` | **17칼럼 × 30행 — 연도 열도 고정** |
| 민감도 | `{ row: 2, col: 1 }` | 변수명 열 고정 |
| 시나리오 | `{ row: 2, col: 1 }` | 항목명 열 고정 |

### 7.4 열 너비

```js
const cols = widths.length
  ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
  : '';
```

**`min`/`max` 는 1부터 시작합니다** (셀 참조와 달리 0-based가 아님). 한 칼럼씩 지정하므로 둘이 같습니다.

`width` 단위는 "기본 폰트의 '0' 문자 폭"입니다. 대략 `문자수 + 0.7` 정도로 잡습니다.

```js
colWidths: [30, 16, 14, 42]                              // 요약 — 마지막 비고란을 넓게
colWidths: [28, 15, 20, 13, 12, 24]                      // 입력값
colWidths: [9, 9, ...Array.from({ length: 15 }, () => 12)]  // 현금흐름 — 17칼럼 균일
```

**`customWidth="1"` 이 없으면 엑셀이 `width` 를 무시합니다.**

### 7.5 행 높이 — 스타일에서 끌어온다

```js
const ROW_HEIGHT = Object.fromEntries(
  STYLE_DEFS.filter(([, d]) => d.height).map(([n, d]) => [n, d.height])
);
// → { TITLE: 22 }

const body = rows.map((row, r) => {
  const cells = (row || []).map(normalizeCell);
  const h = cells.length && cells[0].name && ROW_HEIGHT[cells[0].name];
  const attrs = h ? ` ht="${h}" customHeight="1"` : '';
  /* … */
  return `<row r="${r + 1}"${attrs}>${xml}</row>`;
});
```

**첫 셀의 스타일 이름으로 행 높이를 정합니다.** `TITLE` 스타일(15pt 폰트)에 `height: 22` 를 달아두면, 그 스타일로 시작하는 행이 자동으로 높아집니다.

도메인 코드가 행 높이를 신경 쓰지 않아도 되는 구조입니다 — `[title('제목')]` 한 줄이면 끝입니다.

### 7.6 셀 병합과 탭 색

```js
const merges = (sheet.merges || []).length
  ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
  : '';

const tab = sheet.tabColor ? `<sheetPr><tabColor rgb="${sheet.tabColor}"/></sheetPr>` : '';
```

**병합은 제목 줄에만 씁니다** (`A1:D1`). 데이터 영역을 병합하면 정렬·필터·복사가 망가집니다.

**⚠ `mergeCells` 는 `sheetData` *뒤*에, `sheetPr` 는 `sheetData` *앞*에 와야 합니다.** 순서가 스키마로 고정돼 있습니다:

```js
return `${XML_HEAD}<worksheet xmlns="${NS_MAIN}">` +
  `${tab}` +                                     // 1. sheetPr
  `${freeze}` +                                  // 2. sheetViews
  `<sheetFormatPr defaultRowHeight="16.5"/>` +   // 3. sheetFormatPr
  `${cols}` +                                    // 4. cols
  `<sheetData>${body}</sheetData>` +             // 5. sheetData
  `${merges}` +                                  // 6. mergeCells
  '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
  '</worksheet>';
```

**탭 색으로 시트를 구분합니다:**

```js
const TAB = {
  요약:     ACCENT_COLOR,   // 딥 그린 — 가장 중요
  입력값:   'FF4A5462',     // 회색 — 참조용
  현금흐름: 'FF2F8F6B',     // 밝은 초록
  민감도:   'FFD98324',     // 주황 — 주의
  시나리오: 'FF7B8794',     // 연회색
};
```

**화면 차트 팔레트와 같은 색입니다** (`CHART_COLORS.revenue = '#2f8f6b'` ↔ `'FF2F8F6B'`).

---

## 8. 계층 3 — 도메인 데이터 → 시트

```js
/**
 * export-excel.js — 분석 결과를 .xlsx 로 내보내기
 *
 * 계산은 하지 않는다. analyzeCase()·sensitivityCases()·scenarioCases() 결과를 시트로 옮기기만 한다.
 * 시트 구성: 요약 · 입력값 · 연도별 현금흐름 · 민감도 · 시나리오
 */
```

**이 규칙이 절대적입니다.** 내보내기가 계산을 하면 화면과 파일이 다른 숫자를 보여줄 수 있습니다.

### 8.1 셀 헬퍼 — 작은 DSL

```js
const cell = (v, s) => ({ v, s });

/** 소수 자릿수를 맞추고, 유한하지 않은 값은 빈 셀로 떨어뜨린다 */
const fin = (v, d) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d)));

const title = (v) => cell(v, 'TITLE');
const sub   = (v) => cell(v, 'SUBTITLE');
const head  = (v) => cell(v, 'HEADER');
const lab   = (v) => cell(v, 'LABEL');
const labB  = (v) => cell(v, 'LABEL_B');
const labIn = (v) => cell(v, 'LABEL_IN');
const txt   = (v) => cell(v, 'TEXT');
const note  = (v) => cell(v, 'NOTE');
const n1    = (v) => cell(fin(v, 1), 'NUM1');
const n2    = (v) => cell(fin(v, 2), 'NUM2');
const n3    = (v) => cell(fin(v, 3), 'DEC3');
const sgn   = (v) => cell(fin(v, 1), 'SIGNED');
const int   = (v) => cell(fin(v, 0), 'INT');
const pc    = (v) => cell(v == null || !Number.isFinite(v) ? null : Number(v.toFixed(6)), 'PCT');
const yr    = (v) => cell(v, 'YEAR');
const ctr   = (v) => cell(v, 'CENTER');
```

**`fin()` 이 방어선입니다.** `NaN` · `Infinity` · `null` 을 전부 `null`(빈 셀)로 바꿉니다. IRR이 계산 불가일 때 화면은 `'—'` 를 보여주고, 엑셀은 **빈 셀**이 됩니다 — `'—'` 문자열을 넣으면 그 칼럼이 텍스트로 취급되어 엑셀에서 평균·차트가 안 됩니다.

**`pc()` 의 `toFixed(6)`** — 비율을 소수 6자리까지 보존합니다. `0.0692` 가 `0.00%` 서식으로 `6.92%` 로 보이고, 원값은 `0.069200` 이라 엑셀에서 계산에 쓸 수 있습니다.

**2~3글자 함수명을 쓴 이유**: 시트 정의가 한 줄에 한 행씩 읽혀야 합니다. `numberCell1Decimal(...)` 이면 한 줄이 넘쳐 표 모양이 깨집니다.

```js
[lab('설비용량'), n1(d.capacityMw), ctr('MW'), lab(`${input.capacity.unitCapacityMw} MW × ${input.capacity.turbineCount} 기`)],
```

### 8.2 구조 헬퍼

```js
/** 섹션 머리 — 배경색이 시트 폭 전체에 깔리도록 빈 칸까지 채운다. */
const section = (label, width) =>
  [cell(label, 'SECTION'), ...Array.from({ length: width - 1 }, () => cell(null, 'SECTION'))];

const headerRow = (labels) => labels.map(head);
const blank = () => [];
```

**`section()` 이 빈 칸을 채우는 게 핵심입니다.** `[cell('사업 개요', 'SECTION')]` 만 쓰면 A열만 색이 칠해지고 B~D열은 흰색으로 남아 섹션 머리가 "반쪽"으로 보입니다.

**`blank()` 가 빈 배열입니다.** 빈 행이 되고, `sheetXml()` 의 `(row || []).map(...)` 이 처리합니다. `null` 을 넣어도 동작하지만 의도가 드러나지 않습니다.

### 8.3 시트 5종 — 역할 분담

실제 산출물 측정값:

| 시트 | 행 | 열 | 역할 | 탭 색 |
|---|---|---|---|---|
| **요약** | 49 | 4 | 한 장으로 보고 | 딥 그린 |
| **입력값** | 84 | 6 | 무엇을 넣었는지 재현 | 회색 |
| **연도별 현금흐름** | 30 | 17 | 원자료 — 받는 사람이 다시 계산 | 밝은 초록 |
| **민감도** | 41 | 6 | 무엇이 위험한지 | 주황 |
| **시나리오** | 20 | 4 | 케이스 비교 | 연회색 |

**순서가 "결론 → 근거 → 원자료" 입니다.** 보고서를 받는 사람은 첫 시트만 보고, 검토하는 사람은 둘째·셋째를 봅니다.

**요약 시트 — 섹션 6개:**

```js
const rows = [
  [title('신재생에너지 사업성 분석 결과')],
  blank(),
  section('사업 개요', W),      // 사업명 · 에너지원 · 작성일시
  /* … */
  section('수익성 지표', W),     // IRR 3종 × (IRR · NPV · 회수기간)
  /* … */
  section('규모 · 매출', W),
  section('사업비 · 재원', W),
  section('운영기간 누적 손익', W),
  section('사업 기간', W),
];
```

**핵심 지표에 전용 스타일을 씁니다** (`KPI_*` = 13pt 굵게):

```js
[cell('세후 Project', 'KPI_LABEL'),
 cell(fin(m.postTax.irr, 6), 'KPI_PCT'),
 cell(fin(m.postTax.npv, 1), 'KPI_NUM'),
 ctr(payText(m.postTax))],
```

화면의 `.card.primary`(26px accent)에 대응합니다. 엑셀에서는 26px이 과하므로 13pt로 낮췄습니다.

**작성일시를 넣습니다:**

```js
[lab('작성일시'), lab(new Date().toLocaleString('ko-KR')), lab(''), lab('')],
```

**파일이 돌아다니기 때문에 필수입니다.** 언제 만든 숫자인지 모르는 엑셀은 위험합니다.

**조건부 섹션 — 값이 없으면 만들지 않습니다:**

```js
if (Math.abs(t.sponsorFlow || 0) > 1e-9) {
  rows.push(blank(), section('출자자 기타 현금흐름', W),
    [lab('합계'), n1(t.sponsorFlow), ctr('억원'), lab('Project IRR 에는 반영되지 않음')]);
}
if (r.warnings.length) {
  rows.push(blank(), section('경고', W));
  for (const w of r.warnings) rows.push([txt(w)]);
}
rows.push(blank(), [note('사전 검토용 개략 계산입니다. 금융약정용 정식 재무모델을 대체하지 않습니다.')]);
```

**화면의 면책 문구가 엑셀에도 들어갑니다.** 파일만 따로 돌아다닐 때 문맥이 사라지므로 더 중요합니다.

**입력값 시트 — 재현 가능성**

입력 폼의 아코디언 A~G와 같은 구조(`A. 사업 규모` ~ `G. 세금 · 기타`)입니다. **받는 사람이 이 시트만 보고 같은 결과를 재현할 수 있어야** 합니다.

열거형을 한글로 풀어 씁니다 — 받는 사람이 `'annuity'` 를 모릅니다:

```js
const phaseLabel = (p) => (p === 'development' ? '개발' : p === 'financing' ? '금융' : '공사');
const mode = { projectCostPct: '총사업비 %', totalInvestmentPct: '총투자비 %', fixed: '정액', plug: '잔액(plug)' }[t.sizing.mode] || t.sizing.mode;
const repay = { bullet: '만기일시', annuity: '원리금균등', straight: '원금균등' }[t.repayment] || t.repayment;
```

**`|| t.sizing.mode` 로 폴백**을 둡니다. 새 방식이 추가되면 한글이 없어도 원값이 보입니다.

**자동계산 여부를 표시합니다:**

```js
...r.derived.capexResolved.map((it) => [
  lab(it.label), n2(it.amount), ctr(groupLabel(it.group)), ctr(phaseLabel(it.phase)),
  ctr(it.inflationApplied ? '적용' : '불변'), ctr(it.auto ? '자동' : ''),
]),
```

**`derived.capexResolved` 를 쓰는 게 중요합니다** — `input.capexItems` 가 아닙니다. 자동계산 항목은 `input` 에 `amount: 0` 으로 있고, **계산된 값은 `derived` 에만** 있습니다.

**연도별 현금흐름 — 원자료**

17칼럼 × (모델 연수 + 헤더 3 + 합계 1)행. 합계 행을 직접 계산해 넣습니다:

```js
const sum = (k) => r.years.reduce((a, y) => a + (y[k] || 0), 0);
rows.push([
  cell('합계', 'TOTAL_LABEL'), cell(null, 'TOTAL_LABEL'),
  cell(fin(sum('revenue'), 1), 'TOTAL_NUM'),
  /* … */
  cell(null, 'TOTAL_LABEL'), cell(null, 'TOTAL_LABEL'), cell(null, 'TOTAL_LABEL'),  // 잔액·현금·DSCR은 합계 없음
]);
```

**잔액·기말현금·DSCR은 합계를 비웁니다.** 스톡(stock) 변수와 비율은 더하면 의미가 없습니다. 빈 셀에도 `TOTAL_LABEL` 서식을 줘서 합계 행의 배경색이 끊기지 않게 합니다.

**민감도 — 같은 표를 3번 반복**

```js
section('세후 Project IRR', W),        // 지표값
section('그때의 변수 실제값', W),       // ← 화면의 .cell-sub 에 대응
section('세후 NPV (억원)', W),          // 두 번째 지표
section(`목표 IRR ${(targetIrr * 100).toFixed(2)}% 달성 임계값`, W),
```

**화면은 한 셀에 2줄(`.cell-main` + `.cell-sub`)로 넣지만, 엑셀은 표를 나눕니다.** 한 셀에 줄바꿈을 넣으면 정렬·차트·수식이 전부 막힙니다. **같은 정보를 매체에 맞게 다르게 배치하는 것**이 좋은 내보내기입니다.

기준 열을 서식으로 강조합니다 — 화면의 `outline` 에 대응:

```js
...sensitivity.rows.map((row) => [lab(row.label),
  ...row.cells.map((c) => cell(fin(c.postTaxIrr, 6), c.isBase ? 'TOTAL_PCT' : 'PCT'))]),
```

**화면의 `.callout-sm` 경고가 `note` 2줄로 들어갑니다:**

```js
[note('각 줄은 그 변수 하나만 움직였을 때의 조건입니다. 나머지가 현재값 그대로일 때 어느 한 줄만 충족하면 목표에 도달합니다(AND 아님).')],
[note('두 변수가 동시에 나빠지면 각 줄의 조건을 따로 만족해도 목표에 미달할 수 있습니다.')],
```

**오해를 막는 문구는 엑셀에 더 필요합니다.** 화면에서는 옆 탭을 눌러 확인할 수 있지만, 파일만 받은 사람은 그 표가 전부입니다.

**시나리오 — 사용자가 붙인 이름 그대로**

```js
headerRow(['항목', ...cases.map((c) => c.label)]),
[lab('이용률'), ...cases.map((c) => pc(c.capacityFactor))],
[lab('적용 판매단가 (원/kWh)'), ...cases.map((c) => n1(c.tariffValue))],
[lab('총사업비 (억원)'), ...cases.map((c) => n1(c.totalProjectCost))],
[lab('평균 차입금리'), ...cases.map((c) => pc(c.avgRate))],
```

**`cases[].capacityFactor` 처럼 계산된 결과값을 씁니다** — 사용자가 넣은 입력값(`scenarios[].capacityFactor`)이 아닙니다. 둘은 보통 같지만, 총사업비는 수렴 계산을 거치므로 결과가 정답입니다.

열 수가 가변이라 병합 범위도 계산합니다:

```js
const W = cases.length + 1;
merges: [`A1:${String.fromCharCode(64 + W)}1`, `A2:${String.fromCharCode(64 + W)}2`],
```

`String.fromCharCode(64 + W)` 는 **W ≤ 26 에서만 맞습니다.** `colName(W - 1)` 로 바꾸는 게 안전하지만, 시나리오 상한이 6개(`MAX_SCENARIOS`)라 현재는 문제가 없습니다.

### 8.4 진입점

```js
/** 내보낼 시트 묶음을 만든다 (순수 함수 — DOM 없이 테스트 가능). */
export function buildExportSheets({ input, result, sensitivity, breakevens, targetIrr, scenarios }) {
  const sheets = [summarySheet(input, result), inputSheet(input, result), cashflowSheet(result)];
  if (sensitivity && breakevens) sheets.push(sensitivitySheet(sensitivity, breakevens, targetIrr));
  if (scenarios) sheets.push(scenarioSheet(scenarios));
  return sheets;
}
```

**`buildExportSheets()` 를 `downloadExcel()` 과 분리한 게 중요합니다.** 전자는 순수 함수라 DOM 없이 테스트할 수 있고, 후자만 브라우저 API를 씁니다.

```js
test('민감도·시나리오가 없으면 3개 시트만 만든다', () => {
  const only = buildExportSheets({ input, result });
  assert.deepEqual(only.map((s) => s.name), ['요약', '입력값', '연도별 현금흐름']);
});
```

---

## 9. 숫자 규약 — 받는 사람이 계산할 수 있어야 한다

**이 한 가지가 내보내기 품질을 결정합니다.**

```js
/**
 * 값은 엑셀이 이해하는 형태로 넣는다 — 비율은 0.0692 로 넣고 서식(0.00%)이 6.92% 로 보여준다.
 * 그래야 엑셀에서 정렬·차트·수식이 그대로 먹는다.
 */
```

### 9.1 하지 말아야 할 것 / 해야 할 것

| 값 | ❌ 나쁜 방식 | ✅ 좋은 방식 |
|---|---|---|
| IRR 6.92% | `'6.92%'` 문자열 | `0.069200` + `0.00%` 서식 |
| 1,430.5억 | `'1,430.5'` 문자열 | `1430.5` + `#,##0.0` 서식 |
| −156.9억 | `'(156.9)'` 문자열 | `-156.9` + `#,##0.0;[Red]-#,##0.0` |
| 계산 불가 | `'—'` / `'N/A'` | **빈 셀** (`null`) |
| 28% 가동률 | `'28%'` | `0.28` + `0.00%` |
| 2030년 | `2030` (숫자) | `2030` + `YEAR` 서식 (중앙정렬·음영) |

### 9.2 왜 이렇게까지 하나

문자열로 넣으면 받는 사람이:

1. **정렬을 못 합니다** — `'10%'` < `'9%'` (문자열 비교)
2. **차트를 못 만듭니다** — 텍스트 칼럼은 값 축에 들어가지 않습니다
3. **수식을 못 씁니다** — `=AVERAGE(B2:B10)` 이 0을 돌려줍니다
4. **피벗테이블을 못 만듭니다** — 합계가 계산되지 않습니다
5. **천 단위 구분을 다시 넣어야 합니다** — `'1,430.5'` 는 숫자로 변환도 안 됩니다

**하나만 문자열이어도 그 칼럼 전체가 오염됩니다.** 엑셀은 칼럼에 텍스트가 섞이면 경고 표시를 띄우고 일부 기능을 비활성화합니다.

### 9.3 빈 값은 문자열이 아니라 빈 셀

```js
const fin = (v, d) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d)));
```

화면과 엑셀이 **의도적으로 다르게** 처리하는 유일한 지점입니다.

| | 화면 | 엑셀 |
|---|---|---|
| `null`/`NaN` | `'—'` (시각적 일관성) | **빈 셀** (계산 가능성) |
| 회수 불가 | `'회수 불가'` | `'회수 불가'` (의미가 있는 문자열) |

**숫자 칼럼에는 빈 셀, 설명 칼럼에는 문자열.** 회수기간은 `ctr(payText(m))` 로 텍스트 칼럼에 들어가므로 `'회수 불가'` 를 그대로 씁니다.

### 9.4 자릿수 — 용도별로 다르게

```js
n1  1자리   #,##0.0     합계·현금흐름 (읽는 값)
n2  2자리   #,##0.00    사업비 항목 (검산하는 값)
n3  3자리   0.000       DSCR (1.15 vs 1.20 판정)
int 0자리   #,##0       연도·기수·MWh
pc  6자리   0.00%       비율 (원값 보존, 표시는 2자리)
```

**`pc` 만 `toFixed(6)` 입니다.** 표시는 `0.00%`(2자리)지만 원값을 6자리까지 보존해, 받는 사람이 그 값으로 계산할 때 오차가 누적되지 않습니다.

### 9.5 파일명

```js
/** 파일명 — 프로젝트명 + 날짜 */
export function exportFileName(input, now = new Date()) {
  const name = String(input.projectName || '').replace(/[\\/:*?"<>|]/g, '').trim();
  const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return name ? `${name}_사업성분석_${d}.xlsx` : `사업성분석_${d}.xlsx`;
}
```

실제 출력: `포항 해돋이 풍력_사업성분석_20260911.xlsx`

**포인트 4개**
1. **Windows 금지문자 9종을 제거합니다** — `\ / : * ? " < > |`. 남기면 브라우저가 이름을 바꾸거나 저장이 실패합니다.
2. **`YYYYMMDD` 형식** — 파일 목록에서 이름순 정렬이 곧 날짜순이 됩니다.
3. **사업명이 없으면 생략**합니다 — `_사업성분석_20260911.xlsx` 처럼 밑줄로 시작하지 않습니다.
4. **`now` 를 인자로 받습니다** — 테스트에서 날짜를 고정할 수 있습니다.

```js
test('파일명에 사업명과 날짜가 들어간다', () => {
  const at = new Date(2026, 8, 11);
  assert.equal(exportFileName({ projectName: '포항 풍력' }, at), '포항 풍력_사업성분석_20260911.xlsx');
  assert.equal(exportFileName({ projectName: '' }, at), '사업성분석_20260911.xlsx');
  assert.equal(exportFileName({ projectName: 'a/b:c' }, at), 'abc_사업성분석_20260911.xlsx');
});
```

---

## 10. 다운로드 트리거

```js
/** 브라우저에서 다운로드를 트리거한다. */
export function downloadExcel(payload) {
  const bytes = buildXlsx(buildExportSheets(payload));
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName(payload.input);
  if (document.body) document.body.append(a);
  a.click();
  if (a.remove) a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return bytes.length;
}
```

**포인트 6개**

1. **MIME 타입을 정확히 씁니다.** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. `application/octet-stream` 으로 하면 일부 환경에서 `.zip` 으로 저장됩니다.
2. **`<a>` 를 DOM에 붙입니다.** Firefox는 문서에 붙지 않은 `<a>` 의 `click()` 을 무시합니다.
3. **`if (document.body)` 방어** — DOM 스텁 환경(테스트)에서 `body` 가 없을 수 있습니다.
4. **`if (a.remove)` 방어** — 같은 이유.
5. **`revokeObjectURL` 을 2초 뒤에** 합니다. 즉시 해제하면 다운로드가 시작되기 전에 URL이 죽어 실패할 수 있습니다.
6. **바이트 수를 반환합니다** — 테스트에서 "뭔가 만들어졌다"를 확인하는 가장 싼 방법입니다.

**호출 쪽 (`app.js`) — 숨은 탭까지 전부 계산:**

```js
// 내보내기는 화면에 안 보이는 탭까지 포함해 전부 계산한 뒤 파일로 만든다.
exportBtn.addEventListener('click', () => {
  if (!lastResult) return;
  const label = exportBtn.textContent;
  try {
    exportBtn.textContent = '만드는 중…';
    const sensitivity = sensitivityCases(input, { steps: stepsFrom(sensState.rangePct) });
    const breakevens = breakevenAll(input, sensState.targetIrr, SENSITIVITY_VARIABLES);
    downloadExcel({
      input, result: lastResult, sensitivity, breakevens,
      targetIrr: sensState.targetIrr,
      scenarios: scenarioCases(input, scenarios),
    });
    exportBtn.textContent = label;
  } catch (err) {
    exportBtn.textContent = label;
    hosts.warnings.hidden = false;
    hosts.warnings.textContent = `엑셀 내보내기 실패: ${err.message}`;
  }
});
```

**포인트 3개**

1. **화면은 보이는 탭만 계산하지만(lazy), 내보내기는 전부 계산합니다.** 파일에는 다 들어가야 합니다.
2. **버튼 문구를 `만드는 중…` 으로 바꿉니다.** 3ms라 보이지 않지만, 큰 모델(50년 × 10시나리오)에서는 체감됩니다.
3. **실패를 경고 영역에 띄웁니다.** `alert()` 를 쓰지 않습니다 — 화면의 다른 경고와 같은 자리에서 같은 방식으로 보여줍니다. `finally` 를 쓰지 않고 양쪽에 복구 코드를 둔 건 기존 스타일입니다(`finally` 로 합치면 더 짧습니다).

---

## 11. 테스트 전략 — ZIP을 되읽어 검증

```js
/**
 * 두 가지를 고정한다.
 *   1. 의존성 없는 xlsx 생성기가 올바른 ZIP·OOXML 을 만든다
 *   2. 내보낸 내용이 화면에 보이는 값과 같다 (계산을 다시 하지 않는다)
 */
```

### 11.1 ZIP 파서를 테스트에 직접 구현

**만든 ZIP을 되읽어서 검증합니다.** 가장 강력한 검증이고, 라이브러리 없이 40줄로 됩니다.

```js
/** ZIP 중앙디렉터리를 읽어 항목 이름을 뽑는다 (EOCD → CD 순회). */
function zipEntryNames(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {          // 뒤에서부터 EOCD 찾기
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('EOCD 를 찾지 못했습니다');

  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const names = [];
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(off, true) !== 0x02014b50) throw new Error('중앙디렉터리 시그니처 불일치');
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    names.push(dec.decode(bytes.subarray(off + 46, off + 46 + nameLen)));
    off += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}
```

**이 파서가 통과하면 ZIP 구조가 맞습니다.** EOCD 위치·항목 수·중앙디렉터리 오프셋·각 헤더의 가변 길이 필드가 모두 일관돼야 순회가 끝까지 갑니다.

**무압축(store)이라 XML을 문자열로 바로 검사할 수 있습니다:**

```js
const asText = (bytes) => new TextDecoder().decode(bytes);
assert.ok(asText(xlsxBytes).includes('<sheet name="요약"'));
```

압축했다면 여기서도 inflate를 구현해야 했습니다. **무압축 선택이 테스트 비용까지 낮췄습니다.**

### 11.2 4층 검증

```
1층  기본기     crc32 알려진 값 · colName 경계 · escapeXml · safeSheetName
2층  ZIP 구조   EOCD 탐색 · 중앙디렉터리 순회 · 항목 이름 집합
3층  OOXML      필수 파트 존재 · 시트 이름 · 스타일 인덱스 · count 일치
4층  내용       화면 값과 같은지 · 비율이 0~1 인지 · 조건부 시트
```

**핵심 테스트 6개:**

```js
test('crc32 가 알려진 값과 맞는다', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('colName 이 AA 경계를 넘는다', () => {
  assert.equal(colName(25), 'Z');
  assert.equal(colName(26), 'AA');
});

test('필요한 파트가 모두 들어 있다', () => {
  const names = zipEntryNames(buildXlsx(sheets));
  for (const need of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
                      'xl/_rels/workbook.xml.rels', 'xl/styles.xml']) {
    assert.ok(names.includes(need), `${need} 가 없다`);
  }
});

test('비율은 0~1 로 저장되고 서식이 %로 보여준다', () => {
  const row = findRow(sheets[0], '세후 Project');
  const v = val(row[1]);
  assert.ok(v > 0 && v < 1, `비율이 0~1 범위를 벗어났다: ${v}`);
  assert.equal(sty(row[1]), 'KPI_PCT');
});

test('내보낸 IRR 이 화면 값과 같다', () => {
  const row = findRow(sheets[0], '세후 Project');
  assert.equal(val(row[1]), Number(result.metrics.postTax.irr.toFixed(6)));
});

test('민감도·시나리오가 없으면 3개 시트만 만든다', () => {
  assert.deepEqual(buildExportSheets({ input, result }).map((s) => s.name),
    ['요약', '입력값', '연도별 현금흐름']);
});
```

### 11.3 시트 배열을 직접 들여다보기

`buildExportSheets()` 가 순수 함수라서 **XML로 만들기 전에** 검사할 수 있습니다.

```js
/** 셀은 원시값이거나 { v, s } 다. */
const val = (c) => (c && typeof c === 'object' && 'v' in c ? c.v : c);
const sty = (c) => (c && typeof c === 'object' ? c.s : undefined);
const rowText = (row) => (row || []).map((c) => val(c)).filter((v) => v != null).join(' | ');
const sheetText = (sheet) => sheet.rows.map(rowText).join('\n');
const findRow = (sheet, label) => sheet.rows.find((r) => val(r[0]) === label);
```

**`findRow(sheet, '세후 Project')` 로 라벨을 찾아 검증합니다.** 행 번호를 하드코딩하면 섹션을 하나 추가할 때마다 테스트가 줄줄이 깨집니다.

`sheetText()` 로 시트 전체를 문자열로 만들어 포함 검사를 합니다:

```js
test('민감도 시트에 지표값과 변수 실제값이 둘 다 들어간다', () => {
  const text = sheetText(sheets[3]);
  assert.ok(text.includes('그때의 변수 실제값'));
  assert.ok(text.includes('원/kWh'), '단가의 실제값이 단위와 함께 들어가야 한다');
  assert.ok(text.includes('AND 아님'), '임계값 해석 안내가 있어야 한다');
});
```

### 11.4 바이트 결정론

```js
const a = buildXlsx(sheets);
const b = buildXlsx(sheets);
assert.ok(a.length === b.length && a.every((x, i) => x === b[i]));
```

**타임스탬프를 고정했기 때문에 가능합니다.** 회귀 테스트에서 "바뀐 게 없으면 바이트도 같다"를 확인할 수 있습니다 — 골든 파일 비교가 가능해집니다.

---

## 12. 복사용 전문

`xlsx.js` 는 **도메인 지식이 0이라 그대로 복사**하면 됩니다. 여기서는 핵심 골격만 싣습니다 — 전체는 `사업성/js/xlsx.js` 300줄을 그대로 가져가십시오.

### 12.1 ZIP 계층 (그대로 복사 가능)

```js
// ── CRC32 ───────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── ZIP (store) ─────────────────────────────────────────────
const utf8 = (s) => new TextEncoder().encode(s);
function pushU16(out, v) { out.push(v & 0xff, (v >>> 8) & 0xff); }
function pushU32(out, v) { out.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff); }
function pushBytes(out, bytes) { for (let i = 0; i < bytes.length; i++) out.push(bytes[i]); }

/**
 * @param {Array<{name:string, data:Uint8Array}>} files
 * @returns {Uint8Array} ZIP 바이트
 */
export function zipStore(files) {
  const out = [];
  const central = [];
  // 고정 타임스탬프 — 같은 입력이면 같은 바이트가 나와 테스트가 안정된다.
  const time = 0;
  const date = 0x2821; // 2000-01-01

  for (const f of files) {
    const nameBytes = utf8(f.name);
    const crc = crc32(f.data);
    const offset = out.length;          // ★ 로컬 헤더를 쓰기 전에 기록

    pushU32(out, 0x04034b50);
    pushU16(out, 20);
    pushU16(out, 0x0800);               // UTF-8 파일명
    pushU16(out, 0);                    // store
    pushU16(out, time);
    pushU16(out, date);
    pushU32(out, crc);
    pushU32(out, f.data.length);
    pushU32(out, f.data.length);
    pushU16(out, nameBytes.length);
    pushU16(out, 0);
    pushBytes(out, nameBytes);
    pushBytes(out, f.data);

    pushU32(central, 0x02014b50);
    pushU16(central, 20);               // 만든 버전
    pushU16(central, 20);               // 필요 버전
    pushU16(central, 0x0800);
    pushU16(central, 0);
    pushU16(central, time);
    pushU16(central, date);
    pushU32(central, crc);
    pushU32(central, f.data.length);
    pushU32(central, f.data.length);
    pushU16(central, nameBytes.length);
    pushU16(central, 0);                // extra
    pushU16(central, 0);                // 주석
    pushU16(central, 0);                // 시작 디스크
    pushU16(central, 0);                // 내부 속성
    pushU32(central, 0);                // 외부 속성
    pushU32(central, offset);           // ★
    pushBytes(central, nameBytes);
  }

  const cdOffset = out.length;
  pushBytes(out, Uint8Array.from(central));
  pushU32(out, 0x06054b50);
  pushU16(out, 0);
  pushU16(out, 0);
  pushU16(out, files.length);
  pushU16(out, files.length);
  pushU32(out, central.length);
  pushU32(out, cdOffset);
  pushU16(out, 0);

  return Uint8Array.from(out);
}
```

### 12.2 OOXML 유틸 (그대로 복사 가능)

```js
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL  = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')       // ★ 반드시 첫 번째
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');   // 엑셀이 거부하는 제어문자
}

/** 0 → A, 25 → Z, 26 → AA */
export function colName(index) {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** 시트 이름 제약: 31자, : \ / ? * [ ] 금지 */
export function safeSheetName(name, fallback = 'Sheet') {
  const cleaned = String(name).replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31);
  return cleaned || fallback;
}
```

### 12.3 스타일 — 색만 바꾸면 됩니다

```js
const ACCENT = 'FF0F6B4A';        // ← 브랜드 색으로 교체 (AARRGGBB)
const ACCENT_SOFT = 'FFE7F2ED';
const ZEBRA = 'FFF4F6F8';
const LINE = 'FFD5DBE1';
const MUTED = 'FF7B8794';
const FONT_NAME = '맑은 고딕';     // ← 필요하면 교체

// ⚠ 커스텀 numFmt ID 는 반드시 164 이상
const NUM_FMTS = [
  { id: 164, code: '#,##0.0' },
  { id: 165, code: '#,##0.00' },
  { id: 166, code: '0.00%' },
  { id: 167, code: '#,##0.0;[Red]-#,##0.0' },
  { id: 168, code: '0.000' },
  { id: 169, code: '#,##0' },
];

// ⚠ fills[0]=none, fills[1]=gray125 는 엑셀이 요구하는 예약 슬롯
const FILLS = [
  '<fill><patternFill patternType="none"/></fill>',
  '<fill><patternFill patternType="gray125"/></fill>',
  `<fill><patternFill patternType="solid"><fgColor rgb="${ACCENT}"/><bgColor indexed="64"/></patternFill></fill>`,
  /* … */
];

// ⚠ <diagonal/> 을 빠뜨리면 엑셀이 파일을 거부한다
const THIN = `<border><left style="thin"><color rgb="${LINE}"/></left><right style="thin"><color rgb="${LINE}"/></right><top style="thin"><color rgb="${LINE}"/></top><bottom style="thin"><color rgb="${LINE}"/></bottom><diagonal/></border>`;
```

### 12.4 도메인 계층 — 여기만 새로 씁니다

```js
import { buildXlsx, ACCENT_COLOR } from './xlsx.js';

const TAB = { 요약: ACCENT_COLOR, 상세: 'FF4A5462' /* … */ };

// ── 셀 헬퍼 (그대로 복사) ───────────────────────────────────
const cell = (v, s) => ({ v, s });
const fin = (v, d) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d)));
const title = (v) => cell(v, 'TITLE');
const sub = (v) => cell(v, 'SUBTITLE');
const head = (v) => cell(v, 'HEADER');
const lab = (v) => cell(v, 'LABEL');
const txt = (v) => cell(v, 'TEXT');
const note = (v) => cell(v, 'NOTE');
const n1 = (v) => cell(fin(v, 1), 'NUM1');
const n2 = (v) => cell(fin(v, 2), 'NUM2');
const int = (v) => cell(fin(v, 0), 'INT');
const sgn = (v) => cell(fin(v, 1), 'SIGNED');
const pc = (v) => cell(v == null || !Number.isFinite(v) ? null : Number(v.toFixed(6)), 'PCT');
const ctr = (v) => cell(v, 'CENTER');

/** 섹션 머리 — 배경색이 시트 폭 전체에 깔리도록 빈 칸까지 채운다 */
const section = (label, width) => [cell(label, 'SECTION'), ...Array.from({ length: width - 1 }, () => cell(null, 'SECTION'))];
const headerRow = (labels) => labels.map(head);
const blank = () => [];

// ── 시트 (도메인에 맞게) ────────────────────────────────────
function summarySheet(input, r) {
  const W = 4;
  const rows = [
    [title('분석 결과')],
    blank(),
    section('개요', W),
    [cell('이름', 'KPI_LABEL'), cell(input.name || '(미입력)', 'KPI_LABEL'), cell(null, 'LABEL'), cell(null, 'LABEL')],
    [lab('작성일시'), lab(new Date().toLocaleString('ko-KR')), lab(''), lab('')],
    blank(),
    section('핵심 지표', W),
    headerRow(['구분', '값', '보조', '비고']),
    [cell('지표 A', 'KPI_LABEL'), cell(fin(r.metrics.a, 6), 'KPI_PCT'), cell(fin(r.metrics.b, 1), 'KPI_NUM'), ctr('')],
  ];
  if (r.warnings.length) {
    rows.push(blank(), section('경고', W));
    for (const w of r.warnings) rows.push([txt(w)]);
  }
  rows.push(blank(), [note('사전 검토용 개략 계산입니다.')]);
  return { name: '요약', rows, colWidths: [30, 16, 14, 42], merges: ['A1:D1'], freeze: { row: 1 }, tabColor: TAB.요약 };
}

// ── 진입점 ──────────────────────────────────────────────────
/** 순수 함수 — DOM 없이 테스트 가능 */
export function buildExportSheets({ input, result, extra }) {
  const sheets = [summarySheet(input, result), detailSheet(result)];
  if (extra) sheets.push(extraSheet(extra));      // 조건부 시트
  return sheets;
}

export function exportFileName(input, now = new Date()) {
  const name = String(input.name || '').replace(/[\\/:*?"<>|]/g, '').trim();
  const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return name ? `${name}_분석_${d}.xlsx` : `분석_${d}.xlsx`;
}

export function downloadExcel(payload) {
  const bytes = buildXlsx(buildExportSheets(payload));
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName(payload.input);
  if (document.body) document.body.append(a);     // Firefox 는 DOM 에 붙어야 click 이 먹는다
  a.click();
  if (a.remove) a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);   // 즉시 해제하면 다운로드가 실패할 수 있다
  return bytes.length;
}
```

---

## 13. 다른 도메인으로 옮기기

### 13.1 이식 단계

**1단계 — `xlsx.js` 를 그대로 복사합니다.** 도메인 지식이 0이라 수정할 게 없습니다. 바꿀 것은 딱 2가지:
1. `ACCENT` 등 색 5개 → 브랜드 색 (AARRGGBB 8자리)
2. `FONT_NAME` → 필요한 폰트

**2단계 — 테스트도 그대로 복사합니다.** `zipEntryNames()` 파서와 `crc32`·`colName` 테스트는 도메인과 무관합니다. **복사 즉시 ZIP·OOXML 레벨이 검증됩니다.**

**3단계 — `STYLE_DEFS` 를 점검합니다.** 24종이 과하거나 부족할 수 있습니다. 추가할 때는 **배열 끝에 붙이세요** — 중간에 끼워도 이름으로 조회하니 동작하지만, 끝에 붙이는 게 기존 파일과의 바이트 비교에 유리합니다.

**4단계 — 셀 헬퍼를 도메인 단위에 맞춥니다.**

```js
// 재무 도메인
const n1 = (v) => cell(fin(v, 1), 'NUM1');          // 억원 1자리
const pc = (v) => cell(…, 'PCT');                    // 비율

// 공학 도메인이라면
const mm = (v) => cell(fin(v, 1), 'NUM1');           // mm
const mpa = (v) => cell(fin(v, 2), 'NUM2');          // MPa
const ratio = (v) => cell(fin(v, 3), 'DEC3');        // 안전율
```

**5단계 — 시트를 "결론 → 근거 → 원자료" 순으로 설계합니다.**

**6단계 — 진입점을 `buildExportSheets()` / `downloadExcel()` 로 나눕니다.** 전자는 순수 함수로 테스트, 후자만 브라우저 API.

### 13.2 대응 표

| 사업성 | 구조적 역할 | 다른 도메인 예시 |
|---|---|---|
| 요약 시트 | **결론 한 장** | 판정 결과 · 검토 의견 · 핵심 지표 |
| 입력값 시트 | **재현 가능성** | 설계 조건 · 입력 파라미터 · 가정 목록 |
| 연도별 현금흐름 | **원자료(시계열)** | 절점별 응력 · 월별 실적 · 로그 |
| 민감도 시트 | **변수 × 단계 매트릭스** | 파라미터 스윕 · 케이스 스터디 |
| 시나리오 시트 | **케이스 비교** | A/B/C안 · 공법 비교 |
| `TAB` 색 | **시트 성격 구분** | 동일 |
| `pc()` 0~1 + `0.00%` | **비율 규약** | 동일 (절대 문자열 금지) |
| `sgn()` `[Red]` | **음수 강조** | 적자 · 부족량 · 편차 |
| `note()` 면책 문구 | **문맥 보존** | 적용 한계 · 검토 전제 |
| `derived.*Resolved` | **계산된 값** | 자동 산출 결과 (입력값 아님) |

### 13.3 이식 시 반드시 지킬 것

1. `fills[0] = none`, `fills[1] = gray125` 예약 슬롯
2. 커스텀 `numFmt` ID는 **164 이상**
3. `<diagonal/>` 빈 태그 포함
4. `escapeXml` 에서 `&` 를 **첫 번째**로 치환
5. 제어문자 제거
6. `styles.xml` 요소 순서
7. `sheetPr`(앞) / `mergeCells`(뒤) 위치
8. 중앙디렉터리 오프셋을 로컬 헤더 **쓰기 전**에 기록
9. `>>> 0` 으로 CRC32를 부호 없는 값으로
10. **비율은 0~1 + 서식** (문자열 금지)
11. 빈 값은 **빈 셀** (`'—'` 금지)
12. 고정 타임스탬프

---

## 14. 함정 모음

### 함정 1 ⭐ — 숫자를 문자열로 넣는다

가장 흔하고, 가장 치명적입니다. `'6.92%'` 를 넣으면 받는 사람이 정렬·차트·수식을 전부 못 씁니다.

```js
// ❌
cell('6.92%', 'LABEL')
// ✅
cell(0.0692, 'PCT')     // 서식 0.00% 가 6.92% 로 보여준다
```

### 함정 2 ⭐ — `fills` 예약 슬롯을 건너뛴다

`fills[0]` 에 바로 색을 넣으면 **모든 채우기가 한 칸 밀립니다.** 헤더가 연한 초록, 섹션이 진한 초록으로 뒤바뀝니다. 사양에 명시돼 있지 않아 찾기 어렵습니다.

### 함정 3 ⭐ — 커스텀 `numFmt` ID를 163 이하로 쓴다

0~163은 엑셀 내장 예약 번호입니다. `{ id: 100, code: '0.00%' }` 를 쓰면 내장 서식과 충돌해 엉뚱한 표시가 됩니다.

### 함정 4 — `<diagonal/>` 을 빠뜨린다

```js
// ❌ 엑셀이 "복구가 필요합니다" 를 띄운다
'<border><left/><right/><top/><bottom/></border>'
// ✅
'<border><left/><right/><top/><bottom/><diagonal/></border>'
```

### 함정 5 — `escapeXml` 에서 `&` 를 나중에 치환한다

```js
// ❌ '<' → '&lt;' → '&amp;lt;'  (이중 이스케이프)
s.replace(/</g, '&lt;').replace(/&/g, '&amp;')
// ✅
s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
```

### 함정 6 — 제어문자를 그대로 넣는다

사용자 입력에 `\u0000`~`\u001F` 가 섞이면 **엑셀이 "복구 불가" 오류**를 냅니다. 파일이 아예 열리지 않으므로 원인 추적이 어렵습니다.

**⚠ 이 정규식 자체가 함정입니다 — 반드시 직접 편집하세요.**

스크립트나 heredoc 을 경유해 이 줄을 생성하면 **이스케이프가 풀려 실제 제어문자가 소스에 박힙니다.** 그러면 `grep` 이 그 파일을 "Binary file matches" 로 처리하고, 정규식은 의도와 다르게 동작합니다.

> **실제 사례 2건:**
> 1. `사업성/js/xlsx.js` 의 이 함수를 스크립트로 고치다 제어문자가 박혀, 복구 스크립트로 함수를 통째 교체했습니다.
> 2. **이 문서를 쓰면서 같은 실수를 반복했습니다.** 위 코드 블록에 실제 제어문자가 들어가 `.md` 가 바이너리로 인식됐고, 다시 복구 스크립트를 돌려야 했습니다.
>
> 같은 계열의 함정: `python -c "..."` 로 `\d` 같은 이스케이프를 넘기면 bash → python 경유에서 깨집니다.
> **이스케이프가 든 코드는 heredoc 이 아니라 파일로 쓰십시오.**

### 함정 7 — `colName(26)` 이 `BA` 가 된다

```js
// ❌ 평범한 26진법
let s = ''; let n = index;
do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); } while (n > 0);
// colName(26) → 'BA'  (틀림)

// ✅ (n-1) 보정
let n = index + 1;
while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
// colName(26) → 'AA'
```

26칼럼 이하에서는 드러나지 않아 나중에 터집니다.

### 함정 8 — 중앙디렉터리 오프셋을 늦게 기록한다

```js
// ❌ 로컬 헤더를 쓴 뒤에 기록 → 오프셋이 헤더 크기만큼 밀린다
pushBytes(out, localHeader);
const offset = out.length;
// ✅
const offset = out.length;
pushBytes(out, localHeader);
```

파일이 "손상됨"으로 표시됩니다.

### 함정 9 — CRC32에 `>>> 0` 을 빼먹는다

JS 비트 연산은 부호 있는 32비트를 돌려줍니다. 음수가 ZIP 헤더에 들어가면 체크섬 불일치가 됩니다.

### 함정 10 — `MIME` 타입을 `octet-stream` 으로 한다

일부 브라우저·메일 클라이언트가 `.zip` 으로 저장하거나 확장자를 붙입니다.

### 함정 11 — `<a>` 를 DOM에 붙이지 않는다

Firefox는 문서에 붙지 않은 `<a>` 의 `click()` 을 무시합니다. Chrome은 동작하므로 크로스 브라우저 테스트에서만 드러납니다.

### 함정 12 — `revokeObjectURL` 을 즉시 호출한다

다운로드가 시작되기 전에 URL이 죽어 실패합니다. `setTimeout(…, 2000)` 정도 뒤로 미룹니다.

### 함정 13 — `input` 을 내보내고 `derived` 를 안 본다

자동계산 항목은 `input.capexItems` 에 `amount: 0` 으로 있습니다. **계산된 값은 `derived.capexResolved` 에만** 있습니다. `input` 만 내보내면 엑셀에 0이 줄줄이 찍힙니다.

### 함정 14 — 합계 행에 스톡 변수를 더한다

차입잔액·기말현금·DSCR은 더하면 의미가 없습니다. 빈 셀로 두되 **서식은 유지**해 배경색이 끊기지 않게 합니다.

### 함정 15 — `String.fromCharCode(64 + W)` 로 열 이름을 만든다

`W > 26` 에서 깨집니다. `colName(W - 1)` 이 안전합니다. 현재 코드에 남아 있는 지점입니다(시나리오 시트 — 상한 6개라 문제없음).

### 함정 16 — `Date.now()` 를 ZIP 타임스탬프로 쓴다

같은 데이터인데 바이트가 매번 달라져 테스트가 불안정해집니다. 골든 파일 비교가 불가능해집니다.

### 함정 17 — 시트 이름이 중복된다

엑셀이 파일을 **아예 열지 못합니다.** `buildXlsx()` 에서 `Set` 으로 검사해 `(2)` 를 붙입니다.

### 함정 18 — `count` 속성과 실제 개수가 다르다

`<fonts count="7">` 인데 6개만 넣으면 엑셀이 복구를 시도합니다. 배열 `.length` 로 생성해 어긋날 여지를 없앱니다.

---

## 15. 한계와 확장 여지

### 15.1 지금 없는 것

| 기능 | 추가 비용 | 필요한 파트 |
|---|---|---|
| **수식** | **낮음** (~10줄) | `<c><f>SUM(B2:B10)</f></c>`. `calcChain.xml` 없이도 동작 (열 때 재계산) |
| **압축(deflate)** | 높음 (~250줄) | 압축 방식 `8` + deflate 구현. 78KB → ~15KB |
| **조건부 서식** | 중간 (~40줄) | `<conditionalFormatting>` + `<dxfs>` in styles.xml |
| **데이터 유효성** | 중간 (~30줄) | `<dataValidations>` |
| **자동 필터** | **낮음** (~5줄) | `<autoFilter ref="A3:Q30"/>` |
| **인쇄 설정** | **낮음** (~10줄) | `<pageSetup orientation="landscape" fitToWidth="1"/>` |
| **차트** | 매우 높음 (~400줄) | `xl/charts/chart1.xml` + drawing 파트 + 관계 3개 |
| **이미지** | 높음 (~150줄) | `xl/media/` + drawing + 관계 |
| **읽기** | 매우 높음 | inflate 구현 + XML 파서 |

### 15.2 수식을 넣는다면

가장 싼 확장입니다. `cellXml()` 에 분기 하나를 더합니다.

```js
function cellXml(ref, cell) {
  const { v, s, f } = cell;
  const st = s ? ` s="${s}"` : '';
  if (f) return `<c r="${ref}"${st}><f>${escapeXml(f)}</f></c>`;   // ← 추가
  /* … 기존 3분기 … */
}

// 사용
cell(null, 'TOTAL_NUM', { f: `SUM(C4:C${lastRow})` })
```

**하지만 권하지 않습니다.** 이유 3개:
1. **검증이 불가능합니다.** 수식 결과가 맞는지 테스트하려면 엑셀 계산 엔진이 필요합니다.
2. **값이 2개가 됩니다** — 우리 계산값과 엑셀 수식 결과. 어긋나면 어느 쪽이 맞는지 알 수 없습니다.
3. **`<v>` 캐시가 없으면** 일부 뷰어(Google Sheets · 미리보기)에서 0으로 보입니다.

**대안: 값을 넣고, 계산 과정을 "입력값" 시트에 문서화합니다.** 지금 방식입니다.

### 15.3 인쇄 설정을 넣는다면

보고서용이라면 가성비가 가장 좋습니다.

```js
// sheetXml() 의 pageMargins 앞에 추가
const pageSetup = sheet.landscape
  ? '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9"/>'
  : '';
// sheetFormatPr 자리에 함께
const sheetPr = `<sheetPr${tabColorXml}><pageSetUpPr fitToPage="1"/></sheetPr>`;
```

17칼럼짜리 현금흐름 시트를 A4 가로 1장 폭에 맞출 수 있습니다. `paperSize="9"` 가 A4입니다.

### 15.4 압축을 넣는다면

`CompressionStream('deflate-raw')` 이 최신 브라우저에 있습니다.

```js
// 비동기가 되므로 zipStore 전체를 async 로 바꿔야 한다
async function deflateRaw(bytes) {
  const cs = new CompressionStream('deflate-raw');
  const w = cs.writable.getWriter();
  w.write(bytes); w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
```

그리고 압축 방식 필드를 `8` 로, 압축 후 크기를 따로 기록합니다.

**권하지 않는 이유 3개:**
1. **`zipStore()` 가 async가 됩니다** — 호출 사슬 전체가 async로 번집니다.
2. **Node 구버전·구형 브라우저에 없습니다** — `file://` 호환성이 목표인데 역행합니다.
3. **테스트가 어려워집니다** — XML을 문자열로 바로 검사할 수 없고 inflate가 필요합니다.

78KB는 메일 첨부에 전혀 문제가 없습니다.

---

## 16. 체크리스트

### ZIP 계층
1. [ ] CRC32가 `"123456789"` → `0xCBF43926` 을 맞춘다
2. [ ] `>>> 0` 으로 부호 없는 값을 만든다
3. [ ] 모든 숫자 필드가 리틀엔디안이다
4. [ ] 로컬 헤더 30바이트 + 중앙디렉터리 46바이트 + EOCD 22바이트
5. [ ] 중앙디렉터리 오프셋을 로컬 헤더 **쓰기 전**에 기록한다
6. [ ] UTF-8 플래그 `0x0800` 을 켠다
7. [ ] 타임스탬프를 고정값으로 둔다 (바이트 결정론)
8. [ ] EOCD의 항목 수·CD 크기·CD 오프셋이 실제와 맞는다

### OOXML 계층
9. [ ] `[Content_Types].xml` 이 모든 파트를 선언한다 (시트 배열 순회로 생성)
10. [ ] `_rels/.rels` 와 `xl/_rels/workbook.xml.rels` 둘 다 있다
11. [ ] `rId` 번호가 `workbook.xml` 의 `r:id` 와 맞는다 (시트 1..N, 스타일 N+1)
12. [ ] `Target` 이 `xl/` 기준 상대 경로다
13. [ ] `escapeXml` 이 `&` 를 첫 번째로 치환한다
14. [ ] 제어문자를 제거한다
15. [ ] `colName(26) === 'AA'` 다
16. [ ] 시트 이름이 31자 이하·금지문자 없음·중복 없음

### 스타일
17. [ ] `fills[0] = none`, `fills[1] = gray125` 예약 슬롯을 둔다
18. [ ] 커스텀 `numFmt` ID가 164 이상이다
19. [ ] 모든 `<border>` 에 `<diagonal/>` 이 있다
20. [ ] 색이 `AARRGGBB` 8자리다
21. [ ] `apply*="1"` 플래그를 인덱스가 0이 아닐 때 켠다
22. [ ] `styles.xml` 요소 순서가 맞다 (numFmts→fonts→fills→borders→cellStyleXfs→cellXfs→cellStyles)
23. [ ] `count` 속성이 배열 `.length` 로 생성된다
24. [ ] `cellStyleXfs` 와 `cellStyles` 가 최소 1개씩 있다
25. [ ] 스타일을 **이름**으로 조회한다 (인덱스 직접 사용 금지)
26. [ ] 화면 CSS 토큰과 같은 색을 쓴다

### 워크시트
27. [ ] `showGridLines="0"` 으로 기본 격자선을 끈다
28. [ ] `sheetPr` 는 `sheetData` 앞, `mergeCells` 는 뒤에 온다
29. [ ] `customWidth="1"` 을 붙인다
30. [ ] 넓은 시트에 `freeze: { row, col }` 을 둔다
31. [ ] 병합은 제목 줄에만 쓴다 (데이터 영역 금지)
32. [ ] 행 높이를 스타일 이름에서 끌어온다
33. [ ] 탭 색으로 시트 성격을 구분한다

### 숫자 규약
34. [ ] 비율을 0~1로 넣고 `0.00%` 서식을 준다
35. [ ] 금액을 숫자로 넣고 `#,##0.0` 서식을 준다
36. [ ] 음수를 `[Red]` 서식으로 처리한다 (괄호 문자열 금지)
37. [ ] `NaN`/`Infinity`/`null` 을 **빈 셀**로 떨어뜨린다 (`fin()` 헬퍼)
38. [ ] 의미 있는 빈 값만 문자열로 둔다 (`'회수 불가'`)
39. [ ] 자릿수를 용도별로 다르게 준다 (읽는 값 1자리 / 검산 2자리)
40. [ ] 비율은 `toFixed(6)` 으로 원값을 보존한다

### 도메인 계층
41. [ ] 내보내기가 **계산을 하지 않는다**
42. [ ] `derived.*Resolved` 를 쓴다 (`input` 아님 — 자동계산 값)
43. [ ] 열거형을 한글로 풀고 `|| 원값` 폴백을 둔다
44. [ ] `section()` 이 시트 폭 전체에 배경색을 깐다
45. [ ] 작성일시를 넣는다
46. [ ] 면책·해석 문구를 넣는다 (화면보다 더 중요)
47. [ ] 값이 없는 섹션은 만들지 않는다
48. [ ] 합계 행에서 스톡 변수·비율을 비운다 (서식은 유지)
49. [ ] 시트 순서가 "결론 → 근거 → 원자료" 다
50. [ ] 화면의 2줄 셀을 엑셀에서는 표 2개로 나눈다
51. [ ] 사용자가 붙인 이름이 시트에 들어간다

### 진입점 · 다운로드
52. [ ] `buildExportSheets()` 가 순수 함수다 (DOM 없이 테스트 가능)
53. [ ] 파일명에서 Windows 금지문자 9종을 제거한다
54. [ ] 파일명이 `YYYYMMDD` 로 정렬 가능하다
55. [ ] `now` 를 인자로 받아 테스트에서 고정할 수 있다
56. [ ] MIME 타입이 정확하다
57. [ ] `<a>` 를 DOM에 붙인 뒤 `click()` 한다
58. [ ] `revokeObjectURL` 을 2초 뒤에 호출한다
59. [ ] 내보내기가 숨은 탭까지 전부 계산한다
60. [ ] 버튼 문구를 `만드는 중…` 으로 바꾼다
61. [ ] 실패를 화면 경고 영역에 띄운다 (`alert()` 금지)

### 테스트
62. [ ] ZIP 파서를 테스트에 직접 구현해 되읽어 검증한다
63. [ ] 필수 파트 5종이 모두 있는지 확인한다
64. [ ] 내보낸 값이 화면 값과 같은지 확인한다
65. [ ] 비율이 0~1 범위인지 확인한다
66. [ ] 행을 **라벨로 찾는다** (행 번호 하드코딩 금지)
67. [ ] 같은 입력 → 같은 바이트를 확인한다
68. [ ] 조건부 시트(민감도·시나리오 없을 때)를 확인한다

---

## 맺음

**`.xlsx` 는 생각보다 간단합니다.** ZIP 58줄 + OOXML 160줄 + 도메인 350줄이면 보고서급 파일이 나옵니다. 3ms에 78KB를 만들고, 의존성은 0입니다.

어려운 건 바이너리 포맷이 아니라 **세 가지 암묵적 규칙**입니다.

1. **엑셀이 요구하지만 사양에 안 적힌 것** — `fills` 예약 슬롯, `<diagonal/>`, `cellStyleXfs`, `numFmt` 164
2. **순서가 고정된 것** — `styles.xml` 요소 순서, `sheetPr`/`mergeCells` 위치, `&` 먼저 이스케이프
3. **숫자를 숫자로 넣는 것** — 이게 받는 사람의 경험을 결정합니다

마지막이 가장 중요합니다.

> **내보내기의 목표는 "보기 좋은 파일"이 아니라 "이어서 작업할 수 있는 파일"입니다.**
>
> `'6.92%'` 와 `0.0692 + 0.00%` 는 화면에서 똑같이 보입니다.
> 하지만 전자를 받은 사람은 숫자를 다시 타이핑하고, 후자를 받은 사람은 바로 차트를 만듭니다.
>
> 서식은 사람을 위한 것이고, **값은 엑셀을 위한 것입니다.** 둘을 섞지 마십시오.
