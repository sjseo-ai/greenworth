// Swap the converter's ExcelJS workbook layer for the excel-export-spec domain layer (xlsx-tail.mjs).
// Keeps lines from `import fs` up to (not including) `function solveCurrentModelNode(fields) {` — the calc engine copy.
import fs from "node:fs";
const ROOT = "C:/Users/KCH/OneDrive/바탕 화면/앱 만들기/사업성모델 앱";
const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
const P = `${ROOT}/ess-bidprice-xlsx.mjs`;
const src = fs.readFileSync(P, "utf8");
if (!src.includes('import ExcelJS from "exceljs";')) throw new Error("already spliced? ExcelJS import not found");
fs.copyFileSync(P, `${SP}/ess-bidprice-xlsx.before-spec.mjs`);
const IMPORT_FS = 'import fs from "node:fs";';
const a = src.indexOf(IMPORT_FS), b = src.indexOf("function solveCurrentModelNode(fields) {");
if (a < 0 || b < a) throw new Error("anchors not found");
const head = `// ESS 적정 입찰단가 프로토타입 — 엑셀 회신(.xlsx) 생성기. 설계 기준: excel-export-spec.md
//
// 아티팩트(claude.ai/code/artifact/fea66d24-...)의 downloads 캡ability는 xlsx 저장을 막고 있어(플랫폼 하드 제한:
// gif png jpg jpeg webp mp4 webm txt json md docx pptx epub csv ttf html svg pdf 만 허용), 화면에서 받은 시나리오 .json을
// 이 스크립트로 .xlsx로 바꾼다. 계산 엔진은 아티팩트 <script>의 순수 함수를 그대로 복사했으므로 수치는 화면과 같다.
//
// 구조(spec 3장 3계층):
//   · 계층 1·2 — ess-xlsx-lite.mjs : ZIP·OOXML 직접 작성, 의존성 0 (예전 ExcelJS 불필요)
//   · 계층 3   — 이 파일 후반부     : computeScenario()가 계산하고, buildExportSheets()는 옮기기만 한다(순수 함수)
//
// 사용법:
//   node ess-bidprice-xlsx.mjs [시나리오1.json 시나리오2.json …] [출력.xlsx] [--out-dir=폴더] [--no-open]
//   - JSON 없음 → 아티팩트 기본값(96MW/576MWh 기본안). 2개 이상 → '시나리오 비교' 시트 추가(첫 파일이 본 시나리오).
//   - 출력 생략 → 첫 JSON과 같은 폴더에 ESS_적정입찰단가_모델_<사업명>_<YYYYMMDD>.xlsx (.gitignore 접두어와 일치)
//   - 저장 후 Excel로 연다(--no-open 또는 환경변수 ESS_NO_OPEN 이 있으면 열지 않음).
//   ESS_엑셀변환.bat 에 JSON을 끌어다 놓아도 된다(여러 개 가능).

${IMPORT_FS}
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { buildXlsx, colName, COLORS } from "./ess-xlsx-lite.mjs";`;
let out = head + src.slice(a + IMPORT_FS.length, b) + fs.readFileSync(`${SP}/xlsx-tail.mjs`, "utf8");
// The tail's BOM strip was written with a literal (invisible) U+FEFF — replace it with a readable helper.
const BOM = String.fromCharCode(0xfeff);
const bomExpr = `fs.readFileSync(p, "utf8").replace(/^${BOM}/, "")`;
if (!out.includes(bomExpr)) throw new Error("BOM-strip expression not found");
out = out.replace(bomExpr, 'stripBom(fs.readFileSync(p, "utf8"))')
  .replace("function loadScenarioFile(p) {",
    "// 메모장 등이 붙이는 UTF-8 BOM(U+FEFF) 제거 — 보이지 않는 문자를 소스에 직접 쓰지 않도록 코드값으로 판정\n" +
    "const stripBom = (t) => (t.charCodeAt(0) === 0xfeff ? t.slice(1) : t);\nfunction loadScenarioFile(p) {");
if (out.includes(BOM)) throw new Error("literal U+FEFF still present");
for (const ch of out) {
  const c = ch.charCodeAt(0);
  if (c < 32 && c !== 9 && c !== 10 && c !== 13) throw new Error("raw control char in output: code " + c);
}
fs.writeFileSync(P, out, "utf8");
console.log(`spliced: ${src.split("\n").length} -> ${out.split("\n").length} lines`);
