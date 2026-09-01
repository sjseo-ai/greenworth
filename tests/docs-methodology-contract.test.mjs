import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const phrase = "연간·누적 DSCR";

test("methodology keeps the annual and cumulative DSCR term atomic and accessible", async () => {
  const entry = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const wrappers = [...entry.matchAll(
    /<span data-methodology-term="annual-cumulative-dscr" aria-label="연간·누적 DSCR">([\s\S]*?)<\/span>/g,
  )];

  assert.equal(wrappers.length, 1, "the methodology term needs exactly one labeled inline wrapper");
  const [wrapper] = wrappers;
  assert.equal((wrapper[1].match(/&NoBreak;/g) ?? []).length, 2);
  assert.equal((wrapper[1].match(/&nbsp;/g) ?? []).length, 1);
  assert.equal(wrapper[1].replaceAll("&NoBreak;", "").replace("&nbsp;", " "), phrase);
  assert.doesNotMatch(wrapper[0], /(?:&nbsp;){2,}|aria-hidden|visually-hidden/);
});
