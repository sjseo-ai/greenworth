// 엑셀 회신 생성기 점검 — excel-export-spec.md 11장 "4층 검증"을 이 도구에 맞춘 것.
// 실행: node --test ess-bidprice-xlsx.check.mjs
// (*.test.mjs 가 아닌 이유: 저장소의 npm test(node --test)가 이 로컬 전용 도구 점검까지 줍지 않게 하려고.)
//   1층 기본기   crc32 · colName · escapeXml · safeSheetName
//   2층 ZIP      만든 파일을 되읽어 EOCD → 중앙디렉터리 순회
//   3층 OOXML    필수 파트 · 시트 이름 · 스타일 예약 슬롯 · count 일치
//   4층 내용     화면 값과 같은가 · 숫자는 숫자로 · 비율은 0~1 · 조건부 시트 · 바이트 결정론
import test from "node:test";
import assert from "node:assert/strict";
import { crc32, colName, escapeXml, safeSheetName, buildXlsx, STYLES } from "./ess-xlsx-lite.mjs";
import { computeScenario, buildExportSheets, exportFileName, capexComposition } from "./ess-bidprice-xlsx.mjs";

const dec = new TextDecoder();
const FIXED_NOW = new Date(2026, 8, 11, 9, 30);

/** ZIP 중앙디렉터리를 따라 항목 이름과 (무압축) 데이터를 꺼낸다 */
function zipEntries(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("EOCD 를 찾지 못했습니다");
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const out = [];
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(off, true) !== 0x02014b50) throw new Error("중앙디렉터리 시그니처 불일치");
    const size = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true), extraLen = dv.getUint16(off + 30, true), commentLen = dv.getUint16(off + 32, true);
    const local = dv.getUint32(off + 42, true);
    if (dv.getUint32(local, true) !== 0x04034b50) throw new Error("로컬 헤더 시그니처 불일치");
    const name = dec.decode(bytes.subarray(off + 46, off + 46 + nameLen));
    const dataStart = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const data = bytes.subarray(dataStart, dataStart + size);
    if (crc32(data) !== dv.getUint32(off + 16, true)) throw new Error(`CRC 불일치: ${name}`);
    out.push({ name, text: dec.decode(data) });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const val = (c) => (c && typeof c === "object" && "v" in c ? c.v : c);
const sty = (c) => (c && typeof c === "object" ? c.s : undefined);
const findRow = (sheet, label) => sheet.rows.find((r) => r && val(r[0]) === label);
const sheetText = (sheet) => sheet.rows.map((r) => (r || []).map(val).filter((v) => v != null).join(" | ")).join("\n");
const byName = (sheets, name) => sheets.find((s) => s.name === name);
const pct2 = (v) => Math.round(v * 10000) / 100; // 0.07861 → 7.86

const base = computeScenario({}, { label: "기본값" });
const sheets = buildExportSheets([base], FIXED_NOW);
const bytes = buildXlsx(sheets);

// ── 1층 ──
test("crc32 가 알려진 값과 맞는다", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});
test("colName 이 Z/AA/AZ/BA 경계를 넘는다", () => {
  assert.deepEqual([0, 25, 26, 51, 52].map(colName), ["A", "Z", "AA", "AZ", "BA"]);
});
test("escapeXml 은 & 를 먼저 치환하고 제어문자를 뺀다(탭은 남긴다)", () => {
  assert.equal(escapeXml('<a & "b">'), "&lt;a &amp; &quot;b&quot;&gt;");
  assert.equal(escapeXml(String.fromCharCode(1) + "x" + String.fromCharCode(9) + "y"), "x" + String.fromCharCode(9) + "y");
});
test("safeSheetName 은 31자·금지문자를 지킨다", () => {
  const n = safeSheetName("a/b:c?d*e[f]".repeat(5));
  assert.ok(n.length <= 31 && !/[:\\/?*[\]]/.test(n));
});

// ── 2·3층 ──
test("필수 파트와 시트 파일이 모두 들어 있고 CRC가 맞다", () => {
  const names = zipEntries(bytes).map((e) => e.name);
  for (const need of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml"]) assert.ok(names.includes(need), need);
  sheets.forEach((_, i) => assert.ok(names.includes(`xl/worksheets/sheet${i + 1}.xml`)));
});
test("styles.xml — 예약 채우기 2칸 · numFmt 164 이상 · diagonal · count 일치", () => {
  const xml = zipEntries(bytes).find((e) => e.name === "xl/styles.xml").text;
  assert.match(xml, /<fills count="\d+"><fill><patternFill patternType="none"\/><\/fill><fill><patternFill patternType="gray125"\/><\/fill>/);
  for (const m of xml.matchAll(/numFmtId="(\d+)" formatCode/g)) assert.ok(+m[1] >= 164);
  assert.equal((xml.match(/<border>/g) || []).length, (xml.match(/<diagonal\/>/g) || []).length);
  assert.equal(+xml.match(/<cellXfs count="(\d+)"/)[1], Object.keys(STYLES).length);
  assert.equal((xml.match(/<xf /g) || []).length - 1, Object.keys(STYLES).length); // -1 = cellStyleXfs
});
test("workbook·rels·content types 의 시트 목록이 서로 맞고 모든 XML에 제어문자가 없다", () => {
  const e = Object.fromEntries(zipEntries(bytes).map((x) => [x.name, x.text]));
  const names = [...e["xl/workbook.xml"].matchAll(/<sheet name="([^"]+)" sheetId="(\d+)" r:id="rId(\d+)"/g)];
  assert.deepEqual(names.map((m) => m[1]), sheets.map((s) => s.name));
  names.forEach((m, i) => { assert.equal(+m[2], i + 1); assert.equal(+m[3], i + 1); });
  assert.ok(e["xl/_rels/workbook.xml.rels"].includes(`Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"`));
  assert.equal((e["[Content_Types].xml"].match(/worksheets\/sheet\d+\.xml/g) || []).length, sheets.length);
  for (const [n, t] of Object.entries(e)) {
    for (const ch of t) { const c = ch.charCodeAt(0); assert.ok(c >= 32 || c === 9 || c === 10 || c === 13, `제어문자 in ${n}`); }
  }
  const s1 = e["xl/worksheets/sheet1.xml"];
  assert.ok(s1.indexOf("<sheetPr") < s1.indexOf("<sheetData") && s1.indexOf("<sheetData") < s1.indexOf("<mergeCells"), "sheetPr 앞 · mergeCells 뒤");
  assert.ok(s1.includes('showGridLines="0"'));
});

// ── 4층 ──
test("시트 순서가 결론 → 근거 → 원자료 다", () => {
  assert.deepEqual(sheets.map((s) => s.name), ["요약", "입력값", "연도별 현금흐름", "민감도", "가격환산", "KCH 개발수수료", "부록1 손익계산서", "부록2 부채상환", "부록3 현금흐름 전체"]);
});
test("요약 값이 화면과 같다 (22.51 · 7.86% · 239.8억 · 23.63 · 38.09점)", () => {
  const s = byName(sheets, "요약");
  const price = findRow(s, "적정 입찰단가");
  assert.equal(val(price[1]), 22.51); assert.equal(sty(price[1]), "KPI_PRICE");
  const irr = findRow(s, "달성 P-IRR");
  assert.ok(val(irr[1]) > 0 && val(irr[1]) < 1, "비율은 0~1"); assert.equal(pct2(val(irr[1])), 7.86); assert.equal(sty(irr[1]), "KPI_PCT");
  assert.equal(val(irr[1]), Number(base.solved.result.projectIrr.toFixed(6)), "화면과 같은 원값(6자리)");
  assert.equal(val(findRow(s, "NPV")[1]), 239.8);
  assert.equal(val(findRow(s, "가격환산 입찰가격")[1]), 23.63);
  assert.equal(val(findRow(s, "가격평가점수")[1]), 38.09);
  assert.equal(val(findRow(s, "검증: 총투자비 − 자금조달 합계")[1]), 0);
});
test("KCH 수취액 137.67억 · 민감도 기준 E-IRR 7.45% (화면과 같음)", () => {
  assert.equal(val(findRow(byName(sheets, "KCH 개발수수료"), "생애주기 누적 총 수취액")[1]), 137.67);
  const sens = byName(sheets, "민감도");
  const baseCells = sens.rows.flatMap((r) => (r || []).filter((c) => sty(c) === "TOTAL_PCT"));
  assert.ok(baseCells.length >= 5);
  assert.equal(pct2(val(baseCells[0])), 7.45);
  assert.ok(sheetText(sens).includes("OPEX 상승률 실제값"), "변수 실제값 행");
  assert.ok(sheetText(sens).includes("동시에 나빠지는"), "해석 안내");
});
test("숫자 서식 칸에는 문자열이 없다 ('—'·'N/A' 금지 — 계산 불가는 빈 칸)", () => {
  const numeric = /^(NUM|PCT|SIGNED|INT|DEC3|KPI_(PCT|NUM|PRICE)|TOTAL_(NUM|PCT|INT|SIGNED|DELTA)|YEAR|DELTA|AXIS_(PCT|NUM))/;
  for (const s of sheets) for (const r of s.rows) for (const c of r || []) {
    if (typeof sty(c) === "string" && numeric.test(sty(c))) assert.ok(val(c) == null || typeof val(c) === "number", `${s.name}: ${sty(c)} = ${val(c)}`);
  }
  assert.ok(!sheets.some((s) => /N\/A/.test(sheetText(s))));
});
test("입력 %는 0~1 로 들어간다 (선순위 고정금리 5.2% → 0.052)", () => {
  const r = findRow(byName(sheets, "입력값"), "선순위 고정금리");
  assert.equal(val(r[1]), 0.052); assert.equal(sty(r[1]), "PCT");
  for (const s of sheets) for (const row of s.rows) for (const c of row || []) if (sty(c) === "PCT" && typeof val(c) === "number") assert.ok(Math.abs(val(c)) <= 5, `${s.name}: ${val(c)}`);
});
test("연도별 현금흐름 — 17개 연도 + 합계, 흐름만 더하고 DSCR·누적은 비운다", () => {
  const s = byName(sheets, "연도별 현금흐름");
  const head = s.rows[2].map(val);
  const years = s.rows.filter((r) => r && sty(r[0]) === "YEAR");
  assert.equal(years.length, 17);
  const total = findRow(s, "합계"), iRev = head.indexOf("매출"), iDscr = head.indexOf("DSCR\n(연간)"), iCum = head.indexOf("누적\n프로젝트 CF");
  const revSum = base.solved.result.detail.reduce((t, d) => t + d.revenue, 0);
  assert.equal(val(total[iRev]), Number(revSum.toFixed(1)));
  assert.equal(val(total[iDscr]), null); assert.equal(val(total[iCum]), null);
  assert.equal(sty(total[iDscr]), "TOTAL_LABEL", "빈 칸도 합계 서식 유지");
});
test("같은 입력 → 같은 바이트", () => {
  const again = buildXlsx(buildExportSheets([computeScenario({}, { label: "기본값" })], FIXED_NOW));
  assert.ok(again.length === bytes.length && again.every((b, i) => b === bytes[i]));
});
test("조건부 시트 — 시나리오 2개면 비교 시트, 산정 실패면 결과 시트 없이 4장", () => {
  const other = computeScenario({ fields: { contractCapacityMW: "90" } }, { label: "용량 90MW" });
  const two = buildExportSheets([base, other], FIXED_NOW);
  assert.equal(two[4].name, "시나리오 비교");
  const cmp = byName(two, "시나리오 비교");
  const priceRow = findRow(cmp, "적정 입찰단가 (원/kWh)");
  assert.equal(val(priceRow.at(-1)), "기본값", "낮은 단가가 유리");
  assert.equal(val(findRow(cmp, "총투자비 (억원)").at(-1)), null, "참고값은 비교 안 함");
  const failed = computeScenario({ fields: { delayDays: "800" } }, { label: "지연 3단계" });
  assert.equal(failed.solved.ok, false);
  const fs4 = buildExportSheets([failed], FIXED_NOW);
  assert.deepEqual(fs4.map((s) => s.name), ["요약", "입력값", "가격환산", "KCH 개발수수료"]);
  assert.equal(val(findRow(fs4[0], "적정 입찰단가")[1]), null, "산정 실패 → 빈 칸(문자열 아님)");
  assert.ok(sheetText(fs4[0]).includes("준공지연 3단계"));
});
test("시나리오 JSON의 CAPEX 항목·연차별 가동률이 계산에 반영된다(예전엔 기본값으로 바뀌던 버그)", () => {
  const capex = [700, 120, 25, 60, 35, 20, 50, 15, 8, 6, 5, 6, 5];
  const edited = computeScenario({ fields: {}, capexItems: capex }, { label: "배터리 700억" });
  assert.ok(edited.solved.price > base.solved.price + 0.5, `${edited.solved.price} vs ${base.solved.price}`);
  const rates = Array.from({ length: 15 }, (_, i) => (i === 2 ? 80 : i === 0 ? 95 : i === 1 ? 96 : 97));
  const lowRate = computeScenario({ fields: {}, opRates: rates }, { label: "3년차 80%" });
  assert.notEqual(lowRate.solved.price, base.solved.price);
});
test("CAPEX 총사업비 구성 — ①+②+③ = 총투자비, ③ = 보험+기타+예비비+금융수수료+건설이자+DSRA", () => {
  const s = byName(sheets, "요약");
  const total = val(findRow(s, "총사업비 (총투자비)")[1]);
  const c1 = val(findRow(s, "① 공사비 (EPC)")[1]), c2 = val(findRow(s, "② 개발·간접비")[1]), c3 = val(findRow(s, "③ 부대비용")[1]);
  assert.equal(total, 1130);
  assert.ok(Math.abs(c1 + c2 + c3 - total) < 0.15, `${c1}+${c2}+${c3} vs ${total}`);
  const cc = capexComposition(base.built.model.capex.items, base.solved.result.funding);
  assert.ok(Math.abs(cc.construction + cc.soft + cc.ancillary - cc.total) < 1e-9);
  assert.ok(Math.abs(cc.insurance + cc.other + cc.contingency + cc.financeFee + cc.idc + cc.dsra - cc.ancillary) < 1e-6);
  assert.ok(sheetText(byName(sheets, "입력값")).includes("금융수수료 (주선·약정 등)"), "금융수수료가 D. CAPEX ③에");
});
test("EPC 총액 모드는 ① 공사비만 대체 — 960억이면 항목별과 같은 단가", () => {
  const lump = computeScenario({ fields: { capexInputMode: "lumpsum", capexLumpSum: "960" } }, { label: "총액" });
  assert.equal(lump.solved.price.toFixed(6), base.solved.price.toFixed(6));
});
test("③ 기타 부대비용이 총사업비·단가에 반영되고, 예전 13칸 JSON은 0으로 읽는다", () => {
  const capex = [650, 120, 25, 60, 35, 20, 50, 15, 8, 6, 5, 6, 5, 20];
  const more = computeScenario({ fields: {}, capexItems: capex }, { label: "기타 20억" });
  assert.ok(more.solved.result.totalInvestment > base.solved.result.totalInvestment + 20);
  assert.ok(more.solved.price > base.solved.price);
  const legacy = computeScenario({ fields: {}, capexItems: capex.slice(0, 13) }, { label: "예전 13칸" });
  assert.equal(legacy.solved.price, base.solved.price);
});
test("KCH 설비용량·저장용량은 계약용량 연동(기본 96MW·576MWh), 수취액은 불변", () => {
  const k = byName(sheets, "KCH 개발수수료");
  assert.equal(val(findRow(k, "설비용량")[1]), 96);
  assert.equal(val(findRow(k, "저장용량")[1]), 576);
  assert.ok(sheetText(k).includes("96 MW (현재)"), "민감도 축에 현재 용량");
  const c90 = computeScenario({ fields: { contractCapacityMW: "90", kchCapacityMW: "50" } }, { label: "90MW" });
  assert.equal(c90.kch.m.capacityMW, 90, "예전 JSON의 kchCapacityMW는 무시하고 계약용량을 쓴다");
  assert.equal(c90.kch.lifetimeTotal.toFixed(2), "137.67");
});
test("KCH 합산 IRR = 수수료 순현금 + 당사 지분 현금흐름(14.93%), 수수료만(50.76%)은 비고로", () => {
  const k = byName(sheets, "KCH 개발수수료");
  const row = findRow(k, "KCH 합산 IRR");
  assert.equal(pct2(val(row[1])), 14.93);
  assert.equal(sty(row[1]), "KPI_PCT");
  assert.ok(String(val(row[3])).includes("50.76%"), String(val(row[3])));
  assert.equal(pct2(base.kchRet.irr), 14.93);
  assert.ok(sheetText(k).includes("KCH 합산 CF"));
  const failed = computeScenario({ fields: { delayDays: "800" } }, { label: "지연 3단계" });
  assert.equal(failed.kchRet, null, "산정 실패면 합산 IRR 없음(수수료만 비고)");
});
test("자금조달 금액 입력 — 자기자본·주민채권 고정, 선순위 = 총사업비 − 두 금액", () => {
  const same = computeScenario({ fields: { fundingMode: "amount", equityAmount: "339", bondAmount: "56.5" } }, {});
  assert.ok(Math.abs(same.solved.price - base.solved.price) < 0.02, `${same.solved.price} vs ${base.solved.price}`);
  const eq400 = computeScenario({ fields: { fundingMode: "amount", equityAmount: "400", bondAmount: "56.5" } }, {});
  const fu = eq400.solved.result.funding;
  assert.equal(fu.equityPrincipal, 400);
  assert.ok(Math.abs(fu.seniorPrincipal - (fu.totalInvestment - 400 - 56.5)) < 1e-6);
  assert.ok(sheetText(buildExportSheets([eq400], FIXED_NOW)[1]).includes("자기자본 금액"));
});
test("선순위 고정+변동(CD 연동) — 평탄하면 불변, CD 경로·조정주기(3/6개월) 반영", () => {
  const flat = computeScenario({ fields: { seniorFixedSharePct: "50" } }, {});
  assert.equal(flat.solved.price.toFixed(6), base.solved.price.toFixed(6));
  const cd = [2.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8];
  const r2 = (c) => c.solved.result.detail.find((d) => d.phase === "운영 2년차").seniorRateApplied;
  const up3 = computeScenario({ fields: { seniorFixedSharePct: "50" }, cdRates: cd }, {});
  assert.ok(Math.abs(r2(up3) - 0.056375) < 1e-9, String(r2(up3))); // 0.5×5.2 + 0.5×(3.8×0.875 + 2.8×0.125 + 2.4)
  const up6 = computeScenario({ fields: { seniorFixedSharePct: "50", rateResetMonths: "6" }, cdRates: cd }, {});
  assert.ok(Math.abs(r2(up6) - 0.05575) < 1e-9, String(r2(up6)));   // 0.5×5.2 + 0.5×(3.8×0.75 + 2.8×0.25 + 2.4)
  assert.ok(up3.solved.price > base.solved.price);
  assert.ok(Math.abs(r2(base) - 0.052) < 1e-12, "고정 100%면 고정금리 그대로(부동소수점 오차 허용)");
  assert.ok(sheetText(buildExportSheets([up3], FIXED_NOW)[1]).includes("선순위 고정금리 비중"));
});
test("파일명 — 접두어·사업명·YYYYMMDD, 금지문자는 '-'로", () => {
  assert.equal(exportFileName("안좌 96MW", FIXED_NOW), "ESS_적정입찰단가_모델_안좌 96MW_20260911.xlsx");
  assert.equal(exportFileName("", FIXED_NOW), "ESS_적정입찰단가_모델_20260911.xlsx");
  assert.equal(exportFileName("ESS 96MW/576MWh 입찰사업", FIXED_NOW), "ESS_적정입찰단가_모델_ESS 96MW-576MWh 입찰사업_20260911.xlsx");
  assert.equal(exportFileName('a/b:c*?"<>|', FIXED_NOW, 3), "ESS_적정입찰단가_모델_a-b-c_시나리오3개_20260911.xlsx");
});
