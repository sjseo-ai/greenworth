// 해상풍력 초안 변환 공통 — 파일 상태·교체 도구·터빈 데이터
import { readFileSync, writeFileSync } from "node:fs";
export const SP = "C:/Users/KCH/AppData/Local/Temp/claude/c--Users-KCH-OneDrive--------------------/9deb6861-b75c-48d3-9c63-cddac223fff7/scratchpad";
export const SOLAR = `${SP}/solar-v4-backup.html`; // 태양광 v4 결과(태양광 5단계 이후 파일이 바뀌어도 풍력 변환 기준은 고정)
export const OUT = `${SP}/wind-bid-price-prototype.html`;
export const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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
    between(start, end, to, includeEnd = true) {
      if (count(start) !== 1) throw new Error(`between: start not unique (${count(start)}): ${start.slice(0, 100)}`);
      const a = s.indexOf(start), b = s.indexOf(end, a + start.length);
      if (b < 0) throw new Error(`between: end not found: ${end.slice(0, 100)}`);
      s = s.slice(0, a) + to + s.slice(includeEnd ? b + end.length : b);
    },
    reRep(re, to, n) {
      const m = s.match(re);
      if (!m || m.length !== n) throw new Error(`reRep: expected ${n}, found ${m ? m.length : 0}: ${re}`);
      s = s.replace(re, to);
    },
    save(label) { writeFileSync(OUT, s, "utf8"); console.log(`${label}: ${s.split("\n").length} lines`); },
  };
}

// 터빈 — 스펙은 제조사 사양·보도, 단가(억원/MW)·가용률은 공개 자료가 없어 예시 가정.
export const TURBINES = [
  { id: "doosan10", origin: "domestic", maker: "두산에너빌리티", model: "DS205-10MW", mw: 10, rotor: 205, avail: 95, degA: "0.2", price: 24, local: 70, specLabel: "형식인증(보도)",
    source: "두산에너빌리티 DS205-10MW — 로터 205m, 부품 국산화율 약 70%, UL 형식인증 취득(보도). 2025년 상반기 공공주도형 입찰에서 압해(80MW)·다대포(99MW)·한동·평대(100MW) 3개 단지가 채택. 국내 운영 실적 참고: 한림해상풍력(두산 5.56MW, 100MW) 예상 이용률 30.14% · 실제 27~29%, MW당 사업비 약 70억(2019년 전후 계약)." },
  { id: "unison10", origin: "domestic", maker: "유니슨", model: "U210-10MW", mw: 10, rotor: 210, avail: 94, degA: "0.2", price: 23, local: 60, specLabel: "설계인증·실증 중",
    source: "유니슨 U210-10MW — 로터 210m, 기어박스 없는 직접구동, 설계 수명 30년. 에너지기술평가원 설계인증 완료, 2026년 상반기 형식인증 목표(실증 중). 상업 운전 실적이 없어 가용률을 보수적으로 가정." },
  { id: "vestas15", origin: "foreign", maker: "Vestas", model: "V236-15.0MW", mw: 15, rotor: 236, avail: 97, degA: "0.2", price: 29, local: 20, specLabel: "제조사 사양",
    source: "Vestas V236-15.0MW — 정격 15MW, 로터 236m(블레이드 115.5m), 소풍면적 43,743m². 2025년 상반기 일반형 입찰에서 해송3이 제시했으나 미선정." },
  { id: "sgre14", origin: "foreign", maker: "Siemens Gamesa", model: "SG 14-236 DD", mw: 14, rotor: 236, avail: 97, degA: "0.2", price: 28, local: 20, specLabel: "제조사 사양",
    source: "Siemens Gamesa SG 14-236 DD — 정격 14MW(Power Boost 15MW), 로터 236m, 직접구동. 국내 운영 실적 참고: 전남해상풍력1(SGRE 9.6MW급, 96MW) 예상 이용률 35.67% · 실제 30~38%, MW당 사업비 약 90억." },
  { id: "ge147", origin: "foreign", maker: "GE Vernova", model: "Haliade-X 14.7MW", mw: 14.7, rotor: 220, avail: 96, degA: "0.2", price: 27, local: 15, specLabel: "제조사 사양",
    source: "GE Vernova Haliade-X — 정격 14.7MW, 로터 220m. 국내 상업 운전 실적 없음." },
  { id: "mingyang16", origin: "foreign", maker: "Mingyang", model: "MySE 16.0-242", mw: 16, rotor: 242, avail: 95, degA: "0.2", price: 18, local: 10, specLabel: "제조사 사양",
    source: "Mingyang MySE 16.0-242 — 정격 16MW, 로터 242m(중국). 국내 실적 없음. 안보 지표(국가자원안보·정보보안)와 공급망 평가에서 불리할 수 있음." },
];
export const specificPower = (t) => (t.mw * 1e6) / (Math.PI * (t.rotor / 2) ** 2);
