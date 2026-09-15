// 태양광 5단계 변환 공통 — v4 결과(solar-v4-backup.html)를 기준으로 교체 도구 · 모듈 카탈로그 데이터
import { readFileSync, writeFileSync } from "node:fs";
export const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
export const BASE = `${SP}/solar-v4-backup.html`;
export const OUT = `${SP}/solar-bid-price-prototype.html`;
export const MODULES = JSON.parse(readFileSync(`${SP}/solar-modules.json`, "utf8"));

// 스니펫 파일 — "//@@ 이름" 줄로 구역을 나눈 페이지 코드(템플릿 문자열 이스케이프 없이 그대로 쓰기 위함)
export function snippets(file) {
  const out = {};
  readFileSync(`${SP}/${file}`, "utf8").replace(/\r\n/g, "\n").split(/^\/\/@@ /m).slice(1).forEach((b) => {
    const i = b.indexOf("\n");
    out[b.slice(0, i).trim()] = b.slice(i + 1).replace(/\n+$/, "");
  });
  return out;
}

// 교체는 기대한 횟수만큼 맞을 때만 적용하고, 어긋나면 멈춘다(조용히 틀린 파일을 만들지 않게).
export function open(path) {
  let s = readFileSync(path, "utf8");
  const count = (n) => s.split(n).length - 1;
  return {
    rep(from, to, n = 1) {
      const c = count(from);
      if (c !== n) throw new Error(`rep: expected ${n}, found ${c}: ${from.slice(0, 100)}`);
      s = s.split(from).join(to);
    },
    between(start, end, to) {
      if (count(start) !== 1) throw new Error(`between: start not unique (${count(start)}): ${start.slice(0, 100)}`);
      const a = s.indexOf(start), b = s.indexOf(end, a + start.length);
      if (b < 0) throw new Error(`between: end not found: ${end.slice(0, 100)}`);
      s = s.slice(0, a) + to + s.slice(b + end.length);
    },
    reRep(re, to, n) {
      const m = s.match(re);
      if (!m || m.length !== n) throw new Error(`reRep: expected ${n}, found ${m ? m.length : 0}: ${re}`);
      s = s.replace(re, to);
    },
    has(t) { return count(t); },
    save(label) { writeFileSync(OUT, s, "utf8"); console.log(`${label}: ${s.split("\n").length} lines`); },
  };
}
