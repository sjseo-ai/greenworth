// Repairs escapeXml's control-character regex without any escape sequence passing through a tool call
// (excel-export-spec.md pitfall 6). The backslash is built from its char code.
import fs from "node:fs";
const P = "C:/Users/KCH/OneDrive/바탕 화면/앱 만들기/사업성모델 앱/ess-xlsx-lite.mjs";
const B = String.fromCharCode(92);
const u = (hex) => B + "u" + hex;
const cls = "[" + u("0000") + "-" + u("0008") + u("000B") + u("000C") + u("000E") + "-" + u("001F") + "]";
const good = "    .replace(/" + cls + "/g, ''); // 엑셀이 '복구 불가'로 거부하는 C0 제어문자 제거(탭·줄바꿈은 허용)";
const lines = fs.readFileSync(P, "utf8").split("\n");
const i = lines.findIndex((l) => l.includes("제어문자 제거"));
if (i < 0) throw new Error("escapeXml control-char line not found");
lines[i] = good;
const out = lines.join("\n");
for (const ch of out) {
  const c = ch.charCodeAt(0);
  if (c < 32 && c !== 9 && c !== 10 && c !== 13) throw new Error("raw control char still present: code " + c);
}
fs.writeFileSync(P, out, "utf8");
console.log("fixed line " + (i + 1) + ": " + good.trim());
