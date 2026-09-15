// Splice result-tabs-design-spec chunks into the artifact by 1-indexed line ranges of the CURRENT file.
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
const SRC = `${SP}/ess-bid-price-prototype.html`;
copyFileSync(SRC, `${SP}/ess-bid-price-prototype.before-tabs-spec.html`);
const lines = readFileSync(SRC, "utf8").split("\n");
const chunk = (f) => readFileSync(`${SP}/${f}`, "utf8").replace(/\n$/, "").split("\n");
const keep = (a, b) => lines.slice(a - 1, b);
// sanity anchors so a shifted file fails loudly instead of splicing garbage
const expect = (n, s) => { if (!lines[n - 1].includes(s)) throw new Error(`line ${n} expected "${s}" got "${lines[n - 1]}"`); };
expect(2, "<style>"); expect(224, "</style>"); expect(452, 'aria-label="프로젝트 지표"'); expect(473, "</section>");
expect(475, '<aside class="notice"'); expect(487, '<section class="panel">'); expect(568, "</div>");
expect(571, 'id="panel-price"'); expect(596, "</div>"); expect(599, 'id="panel-kch"'); expect(640, 'class="kpi-row"');
expect(643, "</div>"); expect(658, '<div class="subhead">결과</div>'); expect(681, "</div>"); expect(684, 'id="panel-caveats"');
expect(686, 'class="tab-lede"'); expect(699, "</ul>"); expect(702, "</section>"); expect(703, "</div>");
const out = [
  ...keep(1, 1), ...chunk("v2-style.html"),
  ...keep(225, 451), ...chunk("v2-cards.html"),
  ...keep(474, 486), ...chunk("v2-tabsA.html"),
  ...chunk("v2-price.html"),
  ...chunk("v2-kch-open.html"), ...keep(601, 639), ...chunk("v2-kch-total.html"),
  ...keep(644, 657), ...chunk("v2-kch-result.html"),
  ...keep(682, 682), ...chunk("v2-cav-open.html"), ...keep(687, 699), ...chunk("v2-cav-close.html"),
  ...keep(703, lines.length),
];
writeFileSync(SRC, out.join("\n"), "utf8");
console.log("lines", lines.length, "->", out.length);
