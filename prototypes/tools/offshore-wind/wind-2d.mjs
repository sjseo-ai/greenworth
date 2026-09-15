// 해상풍력 2d — 계산 코드에 남은 태양광 주석 정리(동작 변화 없음)
import { open, OUT } from "./wind-lib.mjs";
const f = open(OUT);
f.rep(`    // 태양광 발전량(MWh) = 설비용량(MW) × 8,760h × 그해 이용률 × (1 − 출력제어·손실률), 부분연도는 operationFraction으로 안분`,
  `    // 해상풍력 발전량(MWh) = 설비용량(MW) × 8,760h × 그해 순이용률 × (1 − 출력제어), 부분연도는 operationFraction으로 안분`);
f.rep(`// 매출·발전량은 태양광 설비용량(AC) 기준`, `// 매출·발전량은 해상풍력 설비용량 기준`);
f.rep(`    // 태양광 설비용량(AC) — 발전량·매출은 이 값 기준`, `    // 해상풍력 설비용량 — 발전량·매출은 이 값 기준`);
f.rep(`    // ESS의 준공지연·이행률 페널티는 태양광 초안에서 쓰지 않는다(엔진 호환을 위해 중립값)`, `    // ESS의 준공지연·이행률 페널티는 해상풍력 초안에서 쓰지 않는다(엔진 호환을 위해 중립값)`);
f.rep(`    // 설비용량은 C. 발전매출의 태양광 설비용량에 연동 — 두 곳에 따로 입력하지 않게 한다.`, `    // 설비용량은 C. 발전매출의 해상풍력 설비용량에 연동 — 두 곳에 따로 입력하지 않게 한다.`);
f.rep(`storageMWh = 0; // 태양광: 설비용량만 연동(저장용량 없음)`, `storageMWh = 0; // 해상풍력: 설비용량만 연동(저장용량 없음)`);
// 산정 기준 기본값 — 해상풍력은 사업 규모가 커서 ESS의 "당사 이익 100억" 대신 목표 P-IRR 6%로 역산한다.
f.rep(`<option value="companyProfit" selected>당사 이익 목표</option>`, `<option value="companyProfit">당사 이익 목표</option>`);
f.rep(`<option value="irr">목표 IRR</option>`, `<option value="irr" selected>목표 IRR</option>`);
f.rep(`<input id="targetIrrPct" type="number" value="8" step="0.1">`, `<input id="targetIrrPct" type="number" value="6" step="0.1">`);
f.rep(`  syncCapexModeVisibility();
  syncSalesStructure();
  syncComboState();
  recalcAll();`, `  syncSolveModeVisibility(); // 기본 산정 기준(목표 IRR)에 맞춰 A 구역 입력 표시를 맞춘다
  syncCapexModeVisibility();
  syncSalesStructure();
  syncComboState();
  recalcAll();`);
f.save("wind-2d");
