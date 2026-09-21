import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { inflateRawSync, crc32 } from "node:zlib";
import { PROTOTYPES, ROOT, buildAnalysis, buildHub, buildStandalone, buildZip, createZip } from "../scripts/build-prototypes.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const normalize = (text) => text.replace(/\r\n/g, "\n");

test("every prototype has a source fragment and a committed standalone page that matches the build", async () => {
  // Given: the artifact fragments are the source of truth for the generated site pages.
  for (const prototype of PROTOTYPES) {
    const fragment = await read(`prototypes/src/${prototype.id}.html`);
    // When: the page is rebuilt from its fragment.
    const built = buildStandalone(fragment, prototype, { nav: true });
    // Then: the committed page is exactly that build (regenerate with npm run build:prototypes after editing a fragment).
    assert.equal(normalize(await read(`prototypes/${prototype.id}/index.html`)), built, `${prototype.id} page is stale`);
  }
  assert.equal(normalize(await read("prototypes/index.html")), buildHub(), "hub page is stale");
  assert.equal(normalize(await read("prototypes/analysis/index.html")), buildAnalysis(), "analysis page is stale");
});

test("the integrated analysis page frames every prototype and only trusts results from its own frames", () => {
  // Given: the shell built from the prototype list.
  const page = buildAnalysis();
  // Then: one tab and one frame per technology, plus the comparison tab.
  assert.ok(page.includes('id="tab-compare"'));
  for (const prototype of PROTOTYPES) {
    assert.ok(page.includes(`id="tab-${prototype.id}"`), `${prototype.id} tab`);
    assert.ok(page.includes(`<iframe src="../${prototype.id}/index.html"`), `${prototype.id} frame`);
  }
  // And: results are accepted only when the message comes from the matching frame.
  assert.ok(page.includes("f.contentWindow === e.source"));
  assert.ok(page.includes('frame.getAttribute("data-key") !== d.id'));
  assert.ok(page.includes('href="../index.html"') && page.includes('href="../../index.html"'));
});

test("the onshore wind page is derived from the offshore page, not a hand-edited copy", async () => {
  // Given: the derived fragment.
  const onshore = await read("prototypes/src/onshore-wind.html");
  // Then: onshore conditions are in, and offshore-only defaults are gone.
  assert.ok(onshore.includes("<title>육상풍력 적정 입찰가격 프로토타입</title>"));
  assert.ok(onshore.includes('id="priceCapPerKWh" type="number" value="163.846"'), "2025 H2 onshore cap");
  assert.ok(onshore.includes('id="weightManual" type="number" value="1.2"'), "onshore REC weight");
  assert.ok(onshore.includes("'onshoreWindBidPriceScenarios.v1'"), "own storage key so scenarios do not mix with offshore");
  assert.ok(!onshore.includes("'windBidPriceScenarios.v1'"));
  assert.ok(!onshore.includes("DS205-10MW") && !onshore.includes("V236"), "no offshore turbines");
});

test("committed zip downloads match the build of their source fragment", async () => {
  for (const prototype of PROTOTYPES) {
    const fragment = normalize(await read(`prototypes/src/${prototype.id}.html`));
    const committed = await readFile(new URL(`../prototypes/downloads/${prototype.zip}`, import.meta.url));
    assert.ok(buildZip(fragment, prototype).equals(committed), `${prototype.zip} is stale — run npm run build:prototypes`);
  }
});

test("standalone pages are full documents with a list link and a browser download fallback", async () => {
  for (const prototype of PROTOTYPES) {
    const page = buildStandalone(await read(`prototypes/src/${prototype.id}.html`), prototype, { nav: true });
    assert.match(page, /^<!doctype html>/);
    assert.match(page, /<meta charset="utf-8">/);
    assert.ok(page.includes('href="../index.html"'), `${prototype.id} links back to the list`);
    assert.ok(page.includes("window.greenworthBrowserDownloads = {"), `${prototype.id} defines the download fallback`);
    assert.ok(page.includes("let downloadsApi = window.claude ? null : (window.greenworthBrowserDownloads || null);"));
    assert.ok(!page.includes("let downloadsApi = null;"));
    // 시나리오 이름 예시에 실제 사업명을 쓰지 않는다는 점검(원래 의도). 공개 보도로 확인된 입찰 선정 사업지처럼
    // 출처가 있는 사업명은 본문에 남을 수 있어, 예시 문구 자체만 확인한다.
    assert.ok(!page.includes("예: 안좌 96MW 기본안"), `${prototype.id} does not carry the real project name in the scenario placeholder`);
    assert.ok(page.includes('type: "greenworth-result"'), `${prototype.id} site page reports results to the integrated shell`);
    const zipPage = buildStandalone(await read(`prototypes/src/${prototype.id}.html`), prototype, { nav: false });
    assert.ok(!zipPage.includes("gw-site-nav"), `${prototype.id} zip page has no list link`);
    assert.ok(!zipPage.includes("greenworth-result"), `${prototype.id} zip page has no shell bridge`);
  }
});

test("hub links every prototype page and zip download", () => {
  const hub = buildHub();
  for (const prototype of PROTOTYPES) {
    assert.ok(hub.includes(`href="${prototype.id}/index.html"`));
    assert.ok(hub.includes(`href="downloads/${prototype.zip}"`));
  }
  assert.ok(hub.includes('href="../index.html"'));
  assert.ok(hub.includes('href="analysis/index.html"'), "hub links the integrated analysis page");
});

test("createZip writes a readable archive with UTF-8 names and valid checksums", () => {
  // Given: two entries, one with a non-ASCII name.
  const entries = [{ name: "a/index.html", data: "<p>안녕</p>" }, { name: "a/안내.md", data: "# 제목\n" }];
  const archive = createZip(entries);
  // When: the central directory is read back.
  const end = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end > 0);
  assert.equal(archive.readUInt16LE(end + 10), entries.length);
  let cursor = archive.readUInt32LE(end + 16);
  for (const entry of entries) {
    assert.equal(archive.readUInt32LE(cursor), 0x02014b50);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const packedSize = archive.readUInt32LE(cursor + 20);
    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    // Then: names, sizes and CRC-32 match the original data.
    assert.equal(name, entry.name);
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const packed = archive.subarray(localOffset + 30 + localNameLength, localOffset + 30 + localNameLength + packedSize);
    const data = inflateRawSync(packed);
    assert.equal(data.toString("utf8"), entry.data);
    assert.equal(archive.readUInt32LE(cursor + 16), crc32(data) >>> 0);
    cursor += 46 + nameLength;
  }
});

test("local static server allowlists the generated prototype pages", async () => {
  const server = await read("scripts/serve.mjs");
  for (const path of ["prototypes/index.html", "prototypes/analysis/index.html", ...PROTOTYPES.map((p) => `prototypes/${p.id}/index.html`)]) {
    assert.ok(server.includes(`"${path}"`), `${path} is served by npm run serve`);
  }
  assert.ok(ROOT.length > 0);
});
