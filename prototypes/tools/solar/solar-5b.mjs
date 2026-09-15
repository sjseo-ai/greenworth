// 태양광 5b — 상한가 진입 조건(선정평가 탭) + 입찰 사례 탭(경쟁입찰 회차별 결과 · 대형 사업 보도/EIASS)
// solar-5a 결과(solar-bid-price-prototype.html)를 읽어 같은 파일로 쓴다. 파이프라인: solar-5a → solar-5b
import { open, OUT, snippets } from "./solar-lib.mjs";
const S = snippets("solar-5b-snippets.txt");
const f = open(OUT);

// ── 경쟁입찰 회차 — 공단 공고·선정 결과 발표값과 보도(2026-09-15 확인) ──
const ROUNDS = [
  { id: "r22h1", label: "2022년 상반기", announcedMW: 2000, receivedMW: 1043, selectedMW: null, receivedCount: null, selectedCount: null,
    cap: 160.603, avg: 155.255, premiums: null, period: "공고 2022-06-08 · 결과 발표 2022-08-19",
    note: "상한가 육지 160,603 · 제주 163,531원/MWh(SMP+1REC), 기준 SMP 85,900원. 낙찰 평균가는 직전 회차(2021년 하반기 143,120원) 대비 8.47% 상승. 접수 약 1,043MW로 공고 2GW에 미달(보도)",
    sources: "신·재생에너지센터 공고 제2022-13호(상한가·기준 SMP), 에너지경제(낙찰 평균가), 전기신문 2023-12-20(회차 비교)" },
  { id: "r23h1", label: "2023년 상반기", announcedMW: 1000, receivedMW: 298, selectedMW: null, receivedCount: null, selectedCount: null,
    cap: 153.494, avg: 151.618, premiums: null, period: "2023년 상반기 공고 · 선정 결과 발표(신·재생에너지센터)",
    note: "접수 약 298MW(공고의 29.8%)",
    sources: "전기신문 2023-12-20(회차 비교), 신·재생에너지센터 「2023년 상반기 태양광 고정가격계약 경쟁입찰 사업자 선정 결과」" },
  { id: "r23h2", label: "2023년 하반기", announcedMW: 1000, receivedMW: 65.8, selectedMW: 59.7, receivedCount: 188, selectedCount: 175,
    cap: 153.494, avg: 150.947, premiums: null, period: "결과 확정·통보 2023-12-20",
    note: "934.2MW 미달 — 태양광 장기 고정가격 입찰 3회 연속 미달",
    sources: "전기신문 2023-12-20 「하반기 고정가격 입찰…태양광, 육상·해상풍력 희비교차」" },
  { id: "r24", label: "2024년 (상·하반기 통합)", announcedMW: 1000, receivedMW: 80.032, selectedMW: 71.693, receivedCount: 448, selectedCount: 429,
    cap: 157.307, avg: 155.269, premiums: null, period: "상반기 공고를 하반기로 통합 실시 · 선정 결과 통보 후 2개월 내 계약",
    note: "상한가 153,494 → 157,307원/MWh로 상향. 접수가 공고보다 적어 경쟁률 1.1 : 1이 되도록 선정 — 2022년 이후 네 번째 미달",
    sources: "신·재생에너지센터 「'24년 하반기 태양광 고정가격계약 경쟁입찰 사업자 선정 결과」(PDF), 전기신문 「태양광 고정가격계약 네 번째 미달」" },
  { id: "r25h1", label: "2025년 상반기", announcedMW: 1000, receivedMW: 51.924, selectedMW: 46.153, receivedCount: null, selectedCount: 279,
    cap: 155.742, avg: 154.655, premiums: { 1: 12, 2: 9 }, period: "결과 확인 2025-09-02 · 공급의무자 계약 기한 2025-10-31",
    note: "신규설비 시장에 탄소 등급별 우대가격 도입(1등급 12 · 2등급 9원/kWh). 제주 상한가 160,943원. 경쟁률 1.1 : 1, 낙찰 평균가는 2024년보다 약 600원 하락",
    sources: "해줌 「2025년 상반기 고정가격계약 결과 발표」, 신·재생에너지센터 선정 결과 공지(2025 상반기), 정책브리핑 「2025년도 상반기 풍력·태양광 경쟁입찰 공고」" },
  { id: "r26", label: "2026년 1차", announcedMW: 1000, receivedMW: null, selectedMW: null, receivedCount: null, selectedCount: null,
    cap: 147.686, avg: null, premiums: { 1: 16, 2: 7 }, period: "접수 2026-07-16 ~ 08-28 · 결과 9월 말 예정",
    note: "상한가 육지 147,686 · 제주 152,092원/MWh — 2025년 대비 약 8천원(5%) 인하, 첫 140원대. 기준 SMP 86.35원. 결과 발표 전이라 적용 입찰가 기본값은 상한가",
    sources: "해줌 「2026년 1차 태양광 고정가격계약 경쟁입찰 공고 분석」·「태양광 고정가격계약 상한가 하락」, 신·재생에너지센터 종합설명회 발표자료(2026-05-26)" },
];

// ── 대형 태양광 사업 — 보도 · 환경영향평가정보지원시스템(EIASS) 사업 상세(2026-09-15 조회) ──
const CASES = [
  { id: "p_haenam400", name: "해남 문내·황산 태양광", mw: 400, type: "지상형(염해 간척지) · 영농형 10MW 포함", developer: "한국남동발전",
    module: "한화큐셀 국산 셀·모듈 약 64만장(진천 생산, 장당 약 625W)", epc: "한화큐셀(EPC 우선협상대상자 선정, 2026-05)",
    capexPerMW: 17.1, capexBasis: "사업비 보도", capexText: "총사업비 6,846억원(보도에 따라 6,807억원) → MW당 약 17.1억원", epcAmount: null,
    genGWh: 529, cf: null, siteText: "전남 해남군 문내면·황산면 염해간척지 약 479만㎡",
    status: "2026-08 착공 · 2028-08 준공 목표, 주민참여 채권형(총사업비의 4%)·이익공유 약 1,500억원 계획",
    note: "RE100 기업·산업단지에 공급 계획 — 판매단가 비공개", eiass: "사업명으로는 확인되지 않음 — 같은 황산면 일대에 해남 원호 태양광 발전사업(JN20260016)·해남 송호 태양광 발전사업(JN20260015) 소규모 환경영향평가 본협의 진행(2026-07-28 접수), 이 사업과의 관계는 확인하지 못함",
    sources: "파이낸셜뉴스·다음(2026-08-06~07 착공), 완도스토리(6,807억원), 한화 뉴스룸·아주경제·ZDNet(2026-05-21 모듈 공급)" },
  { id: "p_sanaeho410", name: "해남·강진 사내호 태양광", mw: 410, type: "지상형(간척호 일원)", developer: "땅끝에너지 외 7개 사업자",
    module: "미공개", epc: "미공개", capexPerMW: 11.9, capexBasis: "EIASS 협의 사업비",
    capexText: "EIASS 협의 사업비 4,890억원 ÷ 410MW(해남 310 · 강진 100) → MW당 약 11.9억원", epcAmount: null, genGWh: null, cf: null,
    siteText: "전남 해남군 북일면 용일리·내동리, 강진군 신전면 용화리 일원 · 면적 1,872,795㎡",
    status: "환경영향평가 초안 협의 완료 2026-04-15 · 본안 협의 진행(2026-08-03 접수) · 사업기간 착공 후 36개월",
    note: "평가 단계 사업비라 실제 사업비와 다를 수 있음",
    eiass: "ME2026C006 · 해남 북일면·강진 신전면 일원 사내호 태양광발전 조성공사 · 초안 완료 2026-04-15 · 본협의 진행 · 사업시행자 땅끝에너지 외 7개소 · 규모 410MW · 사업비 4,890억원",
    sources: "EIASS 사업 상세(ME2026C006)" },
  { id: "p_jeungdo", name: "신안 증도 빛과소금·증도솔라팜", mw: 137, type: "지상형(염전 부지)", developer: "(주)신안증도태양광(SK이노베이션 투자)",
    module: "미공개", epc: "탑선(EPC 공급계약 약 1,606억원, 2025-07)", capexPerMW: 16.9, capexBasis: "EIASS 협의 사업비",
    capexText: "EIASS 협의 사업비 2,315억원 ÷ 137MW → MW당 약 16.9억원 · 보도 EPC 1,606억원(MW당 약 11.7억원)", epcAmount: 1606, genGWh: null, cf: null,
    siteText: "전남 신안군 증도면 대초리 일원 · 빛과소금 794,278㎡ + 증도솔라팜 322,600㎡(보도), EIASS 사업면적 1,300,341㎡",
    status: "상업운전 목표 2026-12(보도)", note: "용량 137MW는 보도 기준(EIASS 규모란은 면적으로 등록)",
    eiass: "ME2022C016 · 신안 증도 빛과 소금 및 증도솔라팜 태양광발전사업 · 본협의 완료 2023-02-01 · 사업시행자 (주)신안증도태양광 · 사업비 2,315억원 · 평가대행 (주)정원평가기술단",
    sources: "한국경제·뉴시스·철강금속신문(2025-07-02 탑선 EPC 수주), EIASS 사업 상세(ME2022C016)" },
  { id: "p_gsdangjin", name: "GS 당진솔라팜(당진 초락도리 염해부지)", mw: 218.2, type: "지상형(염해 간척지)", developer: "지에스당진솔라팜(주)",
    module: "미공개", epc: "LS일렉트릭·탑솔라 컨소시엄(120MW EPC 약 1,062억원, 보도)", capexPerMW: 13.0, capexBasis: "EIASS 협의 사업비",
    capexText: "EIASS 협의 사업비 2,836억원 ÷ 218.2MW → MW당 약 13.0억원 · 보도 EPC 1,062억원(120MW, MW당 약 8.9억원)", epcAmount: null, genGWh: null, cf: null,
    siteText: "충남 당진시 석문면 초락도리 일원 · 사업면적 4,251,161㎡(실제 시행면적 2,363,058㎡)",
    status: "환경영향평가 본협의 완료 2022-12-27 · 변경1차 협의 완료 2025-10-13 · 사후환경영향조사 진행",
    note: "보도된 EPC 120MW와 협의 규모 218.2MW가 달라 단계 사업일 가능성",
    eiass: "ME2021C014 · 당진 초락도리 염해부지 태양광 발전사업 · 초안 완료 2021-12-14 · 본협의 완료 2022-12-27 · 변경1차 완료 2025-10-13 · 사업시행자 지에스당진솔라팜 주식회사 · 사업규모 218.2MW · 사업비 2,836억원 · 평가대행 (주)건화",
    sources: "EIASS 사업 상세(ME2021C014), 일렉트릭파워·에너지플랫폼뉴스(LS일렉트릭 1,062억원 수주)" },
  { id: "p_dangjinhb", name: "당진 대호솔라(당진행복솔라)", mw: 179.037, type: "지상형(대호만 간척지)", developer: "당진행복솔라(주)",
    module: "미공개", epc: "미공개", capexPerMW: 13.0, capexBasis: "EIASS 협의 사업비",
    capexText: "EIASS 협의 사업비 2,335억원 ÷ 179.037MW → MW당 약 13.0억원", epcAmount: null, genGWh: null, cf: null,
    siteText: "충남 당진시 석문면 교로리·초락도리 일원 · 면적 1,722,123㎡",
    status: "환경영향평가 초안 협의 완료 2026-01-14 · 본안 협의 진행(2026-08-26 접수)", note: "평가 단계 사업비",
    eiass: "ME2025C036 · 당진대호솔라 태양광발전 조성사업 · 초안 완료 2026-01-14 · 본협의 진행 · 사업시행자 당진행복솔라(주) · 규모 179.037MW · 사업비 2,335억원 · 평가대행 신일이앤씨",
    sources: "EIASS 사업 상세(ME2025C036)" },
  { id: "p_daeho98", name: "서산 대호호 수상태양광", mw: 98, type: "수상형(농업용 담수호)", developer: "한국동서발전 · 한국농어촌공사",
    module: "미공개", epc: "미공개", capexPerMW: 18.4, capexBasis: "사업비 보도", capexText: "총사업비 1,800억원 → MW당 약 18.4억원", epcAmount: null,
    genGWh: 130, cf: null, siteText: "충남 서산시 대산읍 운산리 대호호 · 연계 송전선로 7.8km 전 구간 지중화",
    status: "준공(2024-12 준공식 보도), 4MW 발전수익 20년 주민 공유 · 발전수익 노후 저수지 재투자(2026-08 보도)", note: "수상형이라 지상형보다 사업비가 높음",
    eiass: "GG20210184 · 서산시 대산읍 운산리 2423번지 일원 대호호 수상태양광 발전사업(소규모 환경영향평가, 금강유역환경청) · 본협의 완료 2021-09-13 · 변경협의 완료 2022-05-04 · 2023-07-28 · 2024-07-11 · 변경협의 진행(2026-08-26)",
    sources: "일렉트릭파워·에너지타임즈·이투뉴스(준공·송전선로 지중화), 에너지프로슈머, EIASS 사업 검색" },
  { id: "p_hapcheon41", name: "합천댐 수상태양광", mw: 41, type: "수상형(댐) · 주민참여형", developer: "한국수자원공사 · 합천 주민참여",
    module: "한화큐셀 Q.PEAK DUO Poseidon(수상 전용 모듈)", epc: "한화큐셀", capexPerMW: 22.5, capexBasis: "사업비 보도",
    capexText: "총사업비 924억원 → MW당 약 22.5억원(2021년 준공 · 수상형)", epcAmount: null, genGWh: 56.388, cf: null,
    siteText: "경남 합천군 합천댐 수면", status: "2021-11 발전 개시, 주민 20년간 4~10% 수익", note: "수상형·2021년 가격이라 지상형 신규 사업보다 사업비가 높음",
    eiass: "ND20190235 · 국민참여형 합천댐 수상태양광 발전사업(소규모 환경영향평가, 낙동강유역환경청) · 본협의 완료 2020-02-18 · 2단계 20MW는 ND20230231 본협의 완료 2023-10-31",
    sources: "에너지신문·한국일보(2021-11 발전 개시, 연 56,388MWh), 그린포스트코리아·일렉트릭파워·인더스트리뉴스(한화큐셀), EIASS 사업 검색" },
  { id: "p_imha47", name: "임하댐 수상태양광", mw: 47, type: "수상형(댐) · 국내 1호 재생에너지 집적화단지", developer: "한국수력원자력 · 한국수자원공사 · 주민 재무투자(33개 마을 약 4,500명)",
    module: "신성이엔지 47MW 전량", epc: "미공개", capexPerMW: 15.6, capexBasis: "사업비 보도", capexText: "총사업비 732억원 → MW당 약 15.6억원", epcAmount: null,
    genGWh: 61.67, cf: null, siteText: "경북 안동시 임하댐 수면", status: "2024-07 착공 · 2024-12 준공 목표(보도)", note: "",
    eiass: "DG20220214 · 안동시 임하댐 수상태양광 집적화단지 사업(소규모 환경영향평가, 대구지방환경청) · 본협의 완료 2023-02-24 · 변경협의 DG20230335 완료 2023-11-28",
    sources: "에너지신문·인더스트리뉴스·한국경제·전기신문(2024-07 모듈 공급·착공, 연 61,670MWh), EIASS 사업 검색" },
  { id: "p_solaseado98", name: "해남 솔라시도 태양광", mw: 98, type: "지상형(간척지) + ESS 306MWh", developer: "(주)한양 등",
    module: "진코솔라 58MW(Cheetah 하프셀) 등 총 251,916장", epc: "(주)한양(부지 조성·EPC·O&M)", capexPerMW: null, capexBasis: "사업비 미공개(ESS 포함)",
    capexText: "총사업비 약 3,440억원(ESS 306MWh 포함) — 태양광만 분리되지 않아 총사업비 칸은 비움(현재 페이지 가정)", epcAmount: null, genGWh: 129, cf: null,
    siteText: "전남 해남군 산이면 솔라시도 기업도시 · 약 150만㎡", status: "2020-06 준공", note: "ESS 연계 사업이라 사업비 비교 불가 — 이용률 참고용", eiass: "",
    sources: "뉴스핌·아시아경제·국토일보(2020-06 준공, 연 129GWh), 인더스트리뉴스(진코솔라 58MW 공급)" },
  { id: "p_saemangeum", name: "새만금 수상태양광(환경영향평가 등록 기준)", mw: 2100, type: "수상형(방조제 내측 공유수면)", developer: "한국수력원자력(환경영향평가 사업시행자)",
    module: "1단계 지역주도형에 신성이엔지 참여(보도)", epc: "미정", capexPerMW: 12.6, capexBasis: "EIASS 협의 사업비",
    capexText: "EIASS 협의 사업비 26,520억원 ÷ 2,100MW → MW당 약 12.6억원(2020년 협의 기준)", epcAmount: null, genGWh: null, cf: null,
    siteText: "전북 군산시 비응도동 새만금 방조제 내측 공유수면 약 27.97㎢", status: "환경영향평가 본협의 완료 2020-09-02, 1단계 300MW 추진 지연(보도)",
    note: "평가 당시(2020) 사업비·계획 규모라 현재 사업 여건과 다름",
    eiass: "ME2019C010 · 새만금 수상 태양광 발전사업 · 초안 완료 2020-02-11 · 본협의 완료 2020-09-02 · 사업시행자 한국수력원자력(주) · 규모 2,100MW · 사업비 26,520억원 · 평가대행 선진엔지니어링",
    sources: "EIASS 사업 상세(ME2019C010), 에너지경제(1단계 300MW), 인더스트리뉴스·이투뉴스(신성이엔지 참여)" },
];

// ── 마크업 ──
f.rep(`<button type="button" class="tab" role="tab" id="tab-price" aria-controls="panel-price" data-panel="panel-price" aria-selected="false">선정평가</button>`,
  `<button type="button" class="tab" role="tab" id="tab-price" aria-controls="panel-price" data-panel="panel-price" aria-selected="false">선정평가</button>
        <button type="button" class="tab" role="tab" id="tab-cases" aria-controls="panel-cases" data-panel="panel-cases" aria-selected="false">입찰 사례</button>`);
f.rep(`            <div class="warn" role="status" id="priceCapWarn"></div>\n`, `            <div class="warn" role="status" id="priceCapWarn"></div>\n` + S.ENTRY_MARKUP + `\n`);
f.rep(`      <!-- KCH 개발수수료 -->`, S.CASES_MARKUP + `\n\n      <!-- KCH 개발수수료 -->`);
f.rep(`              <li>엑셀(.xlsx) 회신 변환기(<code>ESS_엑셀변환.bat</code>)는 아직 ESS 전용`,
  S.CAVEATS + `\n              <li>엑셀(.xlsx) 회신 변환기(<code>ESS_엑셀변환.bat</code>)는 아직 ESS 전용`);
f.rep(`전체 13개 항목 상세 보기`, `전체 15개 항목 상세 보기`);
f.rep("원 초과 — 응찰 불가`", "원 초과 — 응찰 불가 (진입 조건: 선정평가 탭)`");

f.rep(`  .module-table select.mk-product { width: 270px; text-align: left; }`, `  .module-table select.mk-product { width: 270px; text-align: left; }
  #panel-cases .module-table input { width: 104px; } /* 사례 표 — 소수 셋째자리 입찰가가 잘리지 않게 */`);

// ── 스크립트 ──
const js = (v) => JSON.stringify(v, null, 2).split("\n").join("\n  ");
f.rep(`resultsDirty.module = true; }`, `resultsDirty.module = true; resultsDirty.entry = true; resultsDirty.cases = true; }`);
f.rep(`    else if (activeTabId === 'tab-module' && resultsDirty.module) { resultsDirty.module = false; renderModuleCompare(); }`,
  `    else if (activeTabId === 'tab-module' && resultsDirty.module) { resultsDirty.module = false; renderModuleCompare(); }
    else if (activeTabId === 'tab-price' && resultsDirty.entry) { resultsDirty.entry = false; renderEntryConditions(); }
    else if (activeTabId === 'tab-cases' && resultsDirty.cases) { resultsDirty.cases = false; renderCases(); }`);
f.rep(`  // ---------- 요약 탭`, S.JS.split("__ROUNDS__").join(js(ROUNDS)).split("__CASES__").join(js(CASES)) + `\n\n  // ---------- 요약 탭`);
f.rep(`  // ---------- 탭 — 초기 상태를`, S.LISTENERS + `\n\n  // ---------- 탭 — 초기 상태를`);
f.rep(`el.id.startsWith('newMk') || el.type === 'file' || el.disabled) return;`, `el.id.startsWith('newMk') || el.id.startsWith('cs-') || el.id.startsWith('rd-') || el.type === 'file' || el.disabled) return;`);

f.save("solar-5b");
