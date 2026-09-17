// 해상풍력 4 — 상한가 진입 조건(한 가지만 바꿔 상한가에 맞출 때) + 입찰 사례로 사업성 추정 탭
// wind-3 다음에 실행한다(파이프라인: 1a → 1b → 1c → 2a → 2b → 2c → 2d → 3 → 4).
import { open, OUT } from "./wind-lib.mjs";
const f = open(OUT);

// 입찰 사례 — 공개 보도·사업자 발표·Renewable Korea 프로젝트 표에서 확인한 사실만. 없는 값은 null.
//  capexPerMW: 보도 총사업비(억원/MW) · epcAmount: EPC·도급 계약금액(억원, 총사업비가 없을 때 역산용)
//  genGWh: 연간 발전량(GWh) · cf: 보도 이용률(%) — 없으면 발전량으로 계산 · distanceKm·depthM: 이안거리·평균 수심(REC 가중치 추정용, 둘 다 있을 때만)
const CASES = [
  { id: "c23_sinanui", round: "2023", track: "general", name: "신안우이", mw: 390, cap: 167.778, smp: 86.35,
    turbine: "Vestas V236-15MW", developer: "한화오션(개발·EPC 주간사) · 한국중부발전 참여 · 국민성장펀드 1호 투자",
    turbineDetail: "Vestas V236-15.0MW × 26기", epc: "한화오션 · 현대건설 (도급 약 2조6천억원)",
    suppliers: "하부구조물 현대스틸산업(6,115억원) · 해저케이블 LS전선 · 후육강관 세아제강 · 설치선·해상변전소 한화오션",
    capexPerMW: 87.2, capexText: "약 3조4천억원 (MW당 약 87.2억)", epcAmount: null, genGWh: 1052, cf: 29.6,
    siteText: "신안 우이도 남동 약 4km 해상", distanceKm: null, depthM: null,
    status: "2026-07 착공 · 2029-01 상업운전 목표",
    note: "이용률은 국회 지적 보도(예상 평균 출력 29.6%)를 기본값으로 두었고, 사업자 발표 연 1,052GWh로 계산하면 약 30.8%",
    sources: "한국경제·아주경제·뉴스핌(2026-07), 한화 뉴스룸(도급계약), 스마트투데이(하부구조물), 여성종합뉴스(이용률 29.6%)" },
  { id: "c23_nakwol", round: "2023", track: "general", name: "낙월", mw: 364.8, cap: 167.778, smp: 86.35,
    turbine: "Vensys 5.8MW급", developer: "낙월블루하트(명운산업개발 51% · 비그림파워 49%)",
    turbineDetail: "Vensys(골드윈드 계열) 5.8MW급 × 64기 (보도상 5.7MW)", epc: "시공 호반블루에너지 참여(보도)",
    suppliers: "모노파일 하부구조 64기 시공 완료(에너지데일리)", capexPerMW: 63.0, capexText: "약 2조3천억원 (MW당 약 63억)", epcAmount: null, genGWh: 900, cf: null,
    siteText: "영광 계마항에서 약 20km 해상", distanceKm: null, depthM: null,
    status: "2025-12 첫 호기 상업운전 · 2026-06 공정률 83.6%", note: "",
    sources: "일렉트릭파워·스마트투데이(상업발전), 에너지경제(2025-12), 헤럴드경제(공정률), Renewable Korea 표(Vensys 170/5800 × 64)" },
  { id: "c23_geumil1", round: "2023", track: "general", name: "완도 금일 1단계", mw: 210, cap: 167.778, smp: 86.35,
    turbine: "Vestas 15MW급(우선협상)", developer: "한국남동발전 · 영림산업 · 하나증권 컨소시엄",
    turbineDetail: "Vestas 15MW급 (1·2단계 합계 40기, 우선협상)", epc: "한국전력기술 참여 EPC 컨소시엄",
    suppliers: "", capexPerMW: 65, capexText: "1·2단계 합계 약 3조9천억원(600MW → MW당 약 65억), 2026-06 보도 4조원 초과", epcAmount: null, genGWh: null, cf: null,
    siteText: "완도 금일읍 평일도 남측 해상 · 완도변전소 연계", distanceKm: null, depthM: null,
    status: "2027년 착공 예정(국민성장펀드 1조원 조달 보도)", note: "선정 결과 용량 210MW(보도상 1단계 195~200MW)",
    sources: "일렉트릭파워·에너지신문(남동발전), 아시아투데이(2026-06 사업비 4조 초과 · 2026-08 착공 계획), 전기신문(터빈 입찰)" },
  { id: "c23_geumil2", round: "2023", track: "general", name: "완도 금일 2단계", mw: 390, cap: 167.778, smp: 86.35,
    turbine: "Vestas 15MW급(우선협상)", developer: "한국남동발전 · 영림산업 · 하나증권 컨소시엄",
    turbineDetail: "Vestas 15MW급 (1·2단계 합계 40기, 우선협상)", epc: "한국전력기술 참여 EPC 컨소시엄",
    suppliers: "", capexPerMW: 65, capexText: "1·2단계 합계 약 3조9천억원(MW당 약 65억), 2026-06 보도 4조원 초과", epcAmount: null, genGWh: null, cf: null,
    siteText: "완도 금일읍 평일도 남측 해상", distanceKm: null, depthM: null,
    status: "2027년 착공 예정", note: "선정 결과 용량 390MW(보도상 2단계 400~405MW)",
    sources: "1단계와 같음" },
  { id: "c23_gochang", round: "2023", track: "general", name: "고창", mw: 76.2, cap: 167.778, smp: 86.35,
    turbine: "유니슨 6.35MW", developer: "동촌풍력발전(발주) · 한국중부발전 협력",
    turbineDetail: "유니슨 6.35MW × 12기", epc: "유니슨 · 포스코이앤씨 공동수급 (EPC 2,973.8억원, 유니슨 몫 993억원)",
    suppliers: "", capexPerMW: null, capexText: "총사업비 미공개 — EPC 2,973.8억원으로 역산", epcAmount: 2973.8, genGWh: null, cf: null,
    siteText: "", distanceKm: null, depthM: null,
    status: "2026-07 중부발전·유니슨 협약, 2026-08 EPC 수주", note: "",
    sources: "블로터·시대(2026-08 수주), 에너지데일리(터빈 공급), 메트로서울·ZDNet(2026-07 협약)" },
  { id: "c24_anma", round: "2024", track: "general", name: "안마 1·2", mw: 532, cap: 176.565, smp: 86.35,
    turbine: "Siemens Gamesa 14MW", developer: "안마해상풍력(에퀴스 · IBK자산운용 · 대명에너지 · CS윈드)",
    turbineDetail: "Siemens Gamesa 14MW × 38기 (두산에너빌리티 공동생산)", epc: "운송·설치(T&I) SK에코플랜트 우선협상",
    suppliers: "하부구조물 SK오션플랜트(4,169억원) · 타워 CS윈드(367억원) — 2026-04 계약 중단 공시 · 해저케이블 LS전선·대한전선",
    capexPerMW: null, capexText: "보도 3조원 ~ 4조9천억원으로 엇갈려 미반영", epcAmount: null, genGWh: 1400, cf: null,
    siteText: "영광 안마도 인근 약 40km 해상", distanceKm: null, depthM: null,
    status: "국방과학연구소 시험 해역 중첩으로 공유수면 허가 난항 · 착공 지연", note: "",
    sources: "딜사이트·에너지신문(개요), 전기신문(에퀴스 인터뷰), 서울경제(2026-04 계약 중단), SK에코플랜트 뉴스룸" },
  { id: "c24_taean", round: "2024", track: "general", name: "태안", mw: 504, cap: 176.565, smp: 86.35,
    turbine: "Siemens Gamesa 14MW", developer: "태안풍력발전(뷔나에너지) · 한국서부발전 · CIP 공동개발",
    turbineDetail: "Siemens Gamesa 14MW급 (두산에너빌리티 기술이전·국내 생산)", epc: "미공개",
    suppliers: "해저케이블 LS전선(우선협상) · LS마린솔루션", capexPerMW: 99.2, capexText: "약 5조원 (MW당 약 99억, 한국경제 2026-08)", epcAmount: null, genGWh: null, cf: null,
    siteText: "태안 서쪽 약 30km 해상 · 수심 20~40m · 재킷식 기초", distanceKm: 30, depthM: 30,
    status: "2026년 하반기 착공 · 2029년 하반기~2030년 상업운전 목표", note: "REC 가중치는 이안거리 30km · 평균 수심 30m로 추정(연계거리와 다를 수 있음)",
    sources: "전기신문(케이블), 한국경제·비즈니스코리아(2026-08, 5조원), 헤럴드경제·에너지데일리(서부발전), 미디어i(수심·재킷)" },
  { id: "c24_yawol", round: "2024", track: "general", name: "야월", mw: 104, cap: 176.565, smp: 86.35,
    turbine: "두산 DS205-8MW", developer: "야월해상풍력(주)",
    turbineDetail: "두산에너빌리티 DS205-8MW × 13기 (국산 8MW 첫 공급)", epc: "두산에너빌리티 (EPC 약 5,750억원)",
    suppliers: "", capexPerMW: null, capexText: "총사업비 미공개 — EPC 5,750억원으로 역산", epcAmount: 5750, genGWh: null, cf: null,
    siteText: "영광 해상", distanceKm: null, depthM: null,
    status: "2029-03 준공 목표 · 2054년까지 25년 운영", note: "",
    sources: "이투뉴스·이넷뉴스·해사경제신문(2025-12 EPC 계약), 중앙이코노미뉴스" },
  { id: "c24_bandi", round: "2024", track: "floating", name: "반딧불이 (부유식)", mw: 750, cap: 176.565, smp: 86.35,
    turbine: "SG 14-236 DD", developer: "에퀴노르 · 반딧불이에너지",
    turbineDetail: "Siemens Gamesa SG 14-236 DD × 50기(Renewable Korea 표)", epc: "미정",
    suppliers: "삼성중공업 · 포스코이앤씨(독점공급 합의) · 두산에너빌리티 협력", capexPerMW: null, capexText: "미공개", epcAmount: null, genGWh: null, cf: null,
    siteText: "울산 동쪽 약 60~70km · 수심 150~300m", distanceKm: 70, depthM: 200,
    status: "2026-01 REC 매매계약 불발 → 에퀴노르 입찰 참여 제한(5년 → 2년 단축)", note: "계약에 이르지 못한 사례 — 부유식 사업비를 넣어 사업성 부족 폭을 확인해 볼 수 있음",
    sources: "전기신문(2026-01~04 계약 불발·입찰 제한), 국토일보·에너지경제(개요), 포스코 뉴스룸" },
  { id: "c25_aphae", round: "2025 상반기", track: "public", name: "압해", mw: 80, cap: 176.565, smp: 86.35,
    turbine: "두산 8MW급", developer: "한국전력기술 컨소시엄 (우리기술 등)",
    turbineDetail: "두산에너빌리티 8MW × 10기(보도) — Renewable Korea 표는 DS205-9.77MW × 9기(87.93MW)", epc: "미공개",
    suppliers: "", capexPerMW: 50, capexText: "약 4,000억원 (MW당 약 50억)", epcAmount: null, genGWh: null, cf: null,
    siteText: "신안 압해읍 공유수면", distanceKm: null, depthM: null,
    status: "2025-09 공공주도형 선정", note: "보도 사업비(MW당 약 50억)가 최근 사례(65~99억)보다 크게 낮아 사업성이 과대 추정될 수 있음 — 발표 시점·범위 확인 필요. 용량·터빈 구성도 자료마다 다름",
    sources: "이투데이·더벨(우리기술 선정 공시), 그린포스트코리아(두산 채택), Renewable Korea 표" },
  { id: "c25_dadaepo", round: "2025 상반기", track: "public", name: "다대포", mw: 99, cap: 176.565, smp: 86.35,
    turbine: "두산 9.9MW(R&D 국산)", developer: "코리오 · 한국남부발전",
    turbineDetail: "두산에너빌리티 9.9MW × 10기 (정부 R&D 10MW급, 96MW·12기에서 변경)", epc: "시공 대우건설",
    suppliers: "", capexPerMW: 60.6, capexText: "약 6,000억원 (Renewable Korea 표 기준)", epcAmount: null, genGWh: 260, cf: null,
    siteText: "부산 사하구 다대포항 인근 해상", distanceKm: null, depthM: null,
    status: "2025 공공주도형 선정 · 2026-06 사업 착수 보도", note: "정부 R&D 실증 터빈이라 공공주도형 추가 우대가격(27.84원/kWh) 대상일 수 있음 — 기본은 기본 우대만 반영",
    sources: "부산일보(2025-07), 에너지데일리·전력산업신문(남부발전), 네이트뉴스(2026-06), Renewable Korea 표" },
  { id: "c25_handong", round: "2025 상반기", track: "public", name: "한동·평대", mw: 105, cap: 176.565, smp: 86.35,
    turbine: "두산 8MW급", developer: "한국동서발전 컨소시엄 · 제주에너지공사",
    turbineDetail: "두산에너빌리티 8MW급(최신 보도 · 과거 계획 5.5MW × 19기)", epc: "미공개",
    suppliers: "", capexPerMW: 56.2, capexText: "약 5,900억원 (105MW → MW당 약 56억)", epcAmount: null, genGWh: null, cf: null,
    siteText: "제주 구좌읍 한동·평대리 해상", distanceKm: null, depthM: null,
    status: "2025 공공주도형 선정(이투뉴스) · 2026-06 사업 시동", note: "공모 용량 105MW(선정 보도상 100MW)",
    sources: "일렉트릭파워(우협 선정·본격화), 이투뉴스(입찰 선정), 에너지신문, 제주에너지공사 보도자료" },
  { id: "c25_seonamhae", round: "2025 상반기", track: "public", name: "서남해 시범단지", mw: 400, cap: 176.565, smp: 86.35,
    turbine: "국산(두산·유니슨 경합)", developer: "한국해상풍력(한전 계열) · 한전 기술지원",
    turbineDetail: "국산 터빈 — 2026년 약 8천억원 터빈 입찰에서 두산에너빌리티·유니슨 경합 보도", epc: "과거 두산중공업·현대건설 EPC 계약",
    suppliers: "", capexPerMW: 65, capexText: "공사비 약 2조6천억원 (MW당 약 65억)", epcAmount: null, genGWh: null, cf: null,
    siteText: "전북 부안·고창 해상(서남해)", distanceKm: null, depthM: null,
    status: "2025 공공주도형 선정 보도(그린포스트코리아) — 공단 선정 결과로 확인 필요", note: "선정 여부가 보도마다 달라 확인 필요",
    sources: "그린포스트코리아(2025-09), 전기신문(한전 협약·터빈 경합), 한국해상풍력 사업소개" },
  { id: "c26_geumo", round: "2026 상반기", track: "public", name: "금오도", mw: 160, cap: 171.229, smp: 86.35,
    turbine: "국산 터빈", developer: "한국중부발전 · DL에너지",
    turbineDetail: "국산 풍력터빈 (모델 미공개)", epc: "EPC 업체 협의 중",
    suppliers: "", capexPerMW: null, capexText: "미공개", epcAmount: null, genGWh: null, cf: null,
    siteText: "여수 금오도 해상", distanceKm: null, depthM: null,
    status: "2026 상반기 공공주도형 선정(2개 사업 560MW 경쟁) · 2027-12 투자결정 · 2030 상업운전 목표", note: "우대가격은 2025년 값(3.66원)으로 가정",
    sources: "디지털데일리·에너지데일리·브릿지경제(2026-07)" },
  { id: "c26_hanbit", round: "2026 상반기", track: "general", name: "한빛", mw: 340, cap: 171.229, smp: 86.35,
    turbine: "유니슨 13.6MW", developer: "명운산업개발",
    turbineDetail: "유니슨 13.6MW × 25기", epc: "미공개",
    suppliers: "", capexPerMW: 64.7, capexText: "약 2조2천억원 (MW당 약 65억)", epcAmount: null, genGWh: 834, cf: null,
    siteText: "영광 낙월면 안마도·송이도 인근 해상", distanceKm: null, depthM: null,
    status: "환경영향평가·계통연계 계약 완료 · 2027-07 착공 · 2029-12 준공 목표", note: "",
    sources: "더구루(인허가 완료), 이데일리·뉴스핌·전자신문(2026-07 터빈 공급), 파이낸스스코프" },
  { id: "c26_gulup", round: "2026 상반기", track: "general", name: "굴업도", mw: 250, cap: 171.229, smp: 86.35,
    turbine: "두산 10MW", developer: "씨앤아이레저산업 · SK이터닉스 · 대우건설",
    turbineDetail: "두산에너빌리티 10MW급", epc: "대우건설 참여",
    suppliers: "", capexPerMW: 70.3, capexText: "약 1조8천억원 (Renewable Korea 표 · 원문 미확인)", epcAmount: null, genGWh: null, cf: null,
    siteText: "인천 옹진 굴업도 인근 해상", distanceKm: null, depthM: null,
    status: "2026 상반기 일반 고정식 선정", note: "사업비는 원문 확인 필요",
    sources: "아시아경제·다음(2026-06 선정), Renewable Korea 표" },
  { id: "c26_haesong3", round: "2026 상반기", track: "general", name: "해송3", mw: 504, cap: 171.229, smp: 86.35,
    turbine: "Siemens Gamesa 14MW", developer: "CIP (개발 COP)",
    turbineDetail: "Siemens Gamesa 14MW (두산에너빌리티 창원공장 조립)", epc: "미공개",
    suppliers: "해저케이블·시공 LS전선·LS마린솔루션(우선협상)", capexPerMW: null, capexText: "미공개", epcAmount: null, genGWh: null, cf: null,
    siteText: "신안 흑산도 인근 해상(해송 1·3 각 504MW)", distanceKm: null, depthM: null,
    status: "2026 상반기 일반 고정식 선정", note: "",
    sources: "아시아경제·국민일보(2026-06 선정), LS전선 뉴스룸, 인사이트코리아" },
  { id: "c26_haeuli2", round: "2026 상반기", track: "floating", name: "해울이2 (부유식)", mw: 532, cap: 175.1, smp: 86.35,
    turbine: "Siemens Gamesa 14MW", developer: "CIP",
    turbineDetail: "Siemens Gamesa 14MW급 (국내 생산)", epc: "미공개",
    suppliers: "", capexPerMW: null, capexText: "미공개 — 부유식은 입력 권장", epcAmount: null, genGWh: null, cf: null,
    siteText: "울산 동해 해상(해울이 1~3 각 약 0.5GW)", distanceKm: null, depthM: null,
    status: "2026 상반기 부유식 선정(3개 사업 1.47GW 경쟁)", note: "",
    sources: "울산저널·에너지경제(2026-06 선정), 시사저널e" },
];
// 환경영향평가정보지원시스템(EIASS) 사업 검색으로 확인한 사업코드·협의 이력(2026-09-14 조회). 검색되지 않은 사업은 그렇게 표시.
const EIASS = {
  c23_sinanui: "신안 우이 해상풍력 발전사업 · ME2021C012 · 초안 완료 2021-12-28 · 본협의 완료 2023-08-22 · 변경1차 완료 2024-07-26",
  c23_nakwol: "영광 낙월 해상풍력발전단지 건설사업 · ME2019C003 · 초안 완료 2019-08-14 · 본협의 완료 2020-12-30 · 사후환경조사 2024·2025년 승인",
  c23_geumil1: "완도 금일 해상풍력 발전사업 · ME2022C019 · 초안 완료 2022-11-15 · 본협의 완료 2023-09-20",
  c23_geumil2: "완도 금일 해상풍력 발전사업 · ME2022C019 · 초안 완료 2022-11-15 · 본협의 완료 2023-09-20",
  c24_anma: "영광 안마 해상풍력 발전사업 · ME2022C008 · 변경1차 완료 2024-09-26 · 변경2차 완료 2025-04-16",
  c24_taean: "태안 해상풍력 발전사업 · ME2021C010 · 본협의 완료 2023-08-18",
  c24_yawol: "영광 야월 해상풍력 발전사업 · ME2022C005 · 초안 완료 2022-06-03 · 본협의 완료 2024-04-01 · 변경1차 완료 2025-08-07",
  c24_bandi: "반딧불 부유식 해상풍력 발전사업 · ME2022C023 · 초안 완료 2022-12-13 · 본협의 완료 2024-07-09",
  c25_seonamhae: "전북 서남권 해상풍력 시범단지 건설사업 · ME2021C006 · 초안 완료 2021-12-23 · 본협의 완료 2024-03-15",
  c26_geumo: "여수 금오도 해상풍력사업 · ME2024C013 · 초안 완료 2024-12-17 · 본협의 완료 2025-11-25",
  c26_hanbit: "영광 한빛해상풍력발전단지 조성사업 · ME2024C001 · 초안 완료 2024-03-29 · 본협의 완료 2024-11-14",
  c26_gulup: "굴업도 해상풍력 발전사업 · ME2023C026 · 초안 완료 2024-02-01 · 본협의 완료 2025-09-22",
  c26_haesong3: "신안 해송 해상풍력1,3 발전사업 · 발전단지~육상변전소 구간 ME2024C009 본협의 완료 2025-06-19 · 육상 345kV 송전선로 구간 YS2024C002(영산강유역환경청) 본협의 완료 2025-06-25",
  c26_haeuli2: "울산 해울이(1,2,3) 해상풍력발전사업 · ME2023C007 · 초안 완료 2023-05-23 · 본협의 완료 2024-07-09",
};
CASES.forEach((c) => { c.eiass = EIASS[c.id] || "EIASS 사업 검색에서 확인되지 않음(100MW 안팎 규모 · 다른 사업명 등록 가능성)"; });
// EIASS 사업 상세(eiaInfo.do) 표에서 읽은 협의 등록 제원 — 규모(MW)·사업비(억원)·사업시행자·평가대행자(2026-09-14 조회).
// 사업비가 보도되지 않은 사례는 등록 사업비 ÷ 등록 규모를 총사업비 기본값으로 쓴다(capexOk: false면 제외).
const EIASS_REG = {
  c23_sinanui: { mw: 390, capex: 24000, dev: "한화건설(주) · 한국남동발전(주) · SK D&D(주)", agent: "(주)세광종합기술단", extra: "본문 표기 400MW · 우이도 남측 약 4km · 해상·육상 154kV 송전선로" },
  c23_nakwol: { mw: 352.8, capex: 17000, dev: "명운산업개발(주)", agent: "(주)한국종합기술", extra: "협의 등록 규모(352.8MW)가 입찰 용량과 다름" },
  c23_geumil1: { mw: 600, capex: 32710, dev: "한국남동발전(주)", agent: "(주)한국종합기술", extra: "금일 1·2 합산 등록 · 완도변전소 연계" },
  c23_geumil2: { mw: 600, capex: 32710, dev: "한국남동발전(주)", agent: "(주)한국종합기술", extra: "금일 1·2 합산 등록 · 완도변전소 연계" },
  c24_anma: { mw: 546, capex: 33967, dev: "안마해상풍력(주)", agent: "(주)한솔이엔씨" },
  c24_taean: { mw: null, capex: 26000, dev: "㈜태안풍력발전", agent: "(주)도화엔지니어링", extra: "규모란이 용량 대신 39.3km(연장)로 등록" },
  c24_yawol: { mw: 104, capex: 4500, dev: "(주)재원에너지", agent: "(주)세광종합기술단", extra: "사업규모 104MW(8MW×13기) · 협의 사업비는 EPC 계약(5,750억원) 이전 값" },
  c24_bandi: { mw: 810, capex: 57000, dev: "반딧불이에너지(주)(당초 파이어플라이플로팅오프쇼어윈드(주))", agent: "(주)세광종합기술단" },
  c25_seonamhae: { mw: 460, capex: 24000, dev: "한국해상풍력(주)", agent: "(주)세광종합기술단 · (주)유신 · (주)마린", extra: "부안 위도 대리 남측 해상 및 고창 전면 해역" },
  c26_geumo: { mw: 160, capex: 8601, dev: "금오도해상풍력(주)(DL에너지 → 2025-03-31 사업 양수인가)", agent: "(주)한국종합기술", extra: "본문 표기 166.8MW(5.56MW×30기) · 송전선로 57.7km(해저 51.6km · 육상 지중 6.1km) · 해상변전소 1개소" },
  c26_hanbit: { mw: 340, capex: 22100, dev: "한빛해상풍력(주)", agent: "한국종합기술" },
  c26_gulup: { mw: 250, capex: 18000, dev: "굴업풍력개발(주)", agent: "(주)세광종합기술단" },
  c26_haesong3: { mw: 1008, capex: 4575, capexOk: false, dev: "(주)해송해상풍력발전1 · (주)해송해상풍력발전3", agent: "(주)도화엔지니어링", extra: "HS1 504MW + HS3 504MW · 신안 서남측 약 84~92km 공유수면 · 육상변전소 해남 문내면 · 등록 사업비가 1,008MW에 비해 지나치게 작아(일부 구간 값으로 추정) 기본값에 쓰지 않음" },
  c26_haeuli2: { mw: 1500, capex: 105768, dev: "(주)해울이해상풍력발전1 · 2 · 3", agent: "(주)한국종합기술", extra: "해울이 1~3 합산 등록" },
};
CASES.forEach((c) => {
  const g = EIASS_REG[c.id];
  if (!g) return;
  const per = g.mw && g.capex && g.capexOk !== false ? Math.round((g.capex / g.mw) * 10) / 10 : null;
  c.eiassCapexPerMW = per;
  c.eiassReg = [g.mw ? `등록 규모 ${g.mw.toLocaleString("en-US")}MW` : "", g.capex ? `협의 사업비 ${g.capex.toLocaleString("en-US")}억원${per != null ? `(MW당 ${per}억원)` : ""}` : "",
    `사업시행자 ${g.dev}`, `평가대행 ${g.agent}`, g.extra || ""].filter(Boolean).join(" · ");
});

// ── 마크업 ────────────────────────────────────────────────────
f.rep(`<button type="button" class="tab" role="tab" id="tab-price" aria-controls="panel-price" data-panel="panel-price" aria-selected="false">선정평가</button>`,
  `<button type="button" class="tab" role="tab" id="tab-price" aria-controls="panel-price" data-panel="panel-price" aria-selected="false">선정평가</button>
        <button type="button" class="tab" role="tab" id="tab-cases" aria-controls="panel-cases" data-panel="panel-cases" aria-selected="false">입찰 사례</button>`);
f.rep(`            <div class="warn" role="status" id="priceCapWarn"></div>
`, `            <div class="warn" role="status" id="priceCapWarn"></div>

            <div class="subtotal strong"><span>상한가 진입 조건 — 한 가지만 바꿀 때 (SPC 기준, KCH 수수료 제외)</span><span></span></div>
            <p class="callout-sm" id="entryNote"></p>
            <table class="kv"><tbody id="entryBody"></tbody></table>
            <p class="hint">각 행은 A. 산정 기준의 목표 수익을 지키면서 입찰가격을 상한가에 맞추기 위해 <strong>그 항목 하나만</strong> 바꿨을 때의 값입니다(다른 조건은 그대로). 입찰가격 1원 인하는 수령단가로 가중치만큼(예: 3.7배) 줄어드는 것이라, 비용·이용률 쪽 조정폭이 생각보다 커질 수 있습니다. 여러 항목을 함께 조정하면 필요한 폭은 줄어듭니다. KCH 수수료 환산분까지 입찰가에 얹을 경우의 초과분은 위 경고에 따로 표시됩니다.</p>
`);
f.rep(`      <!-- KCH 개발수수료 -->`, `      <!-- 입찰 사례 -->
      <div class="tabpanel" role="tabpanel" id="panel-cases" aria-labelledby="tab-cases" hidden>
        <section class="panel">
          <h2>입찰 사례로 사업성 추정 — 해상풍력 경쟁입찰 선정 단지</h2>
          <div class="panel-body">
            <p class="callout-sm"><strong>사업별 낙찰가는 공개되지 않습니다.</strong> 그래서 공개된 사실(차수·트랙·단지·용량·터빈·그 차수 상한가·보도된 사업비·EPC 금액·발전량·이안거리·수심)에 <strong>"상한가 대비 인하율" 가정</strong>을 더해, 그 조건이면 사업성이 어느 정도였을지를 같은 재무 엔진으로 추정합니다. 낙찰자는 상한가 이하로 썼으므로 <strong>인하율 0%(상한가 입찰)가 그 사업이 받을 수 있었던 최대 사업성</strong>입니다. 금융·세무·공사 일정·손실률·성능저하는 현재 페이지 조건을 쓰고, 사업비 외 CAPEX·OPEX 항목은 사례 용량에 비례해 환산합니다. 사업자·터빈·EPC·공급사·현황은 아래 "사례 상세"에 정리했습니다.</p>
            <div class="calc-grid" style="margin-top:0;">
              <div class="field"><label for="caseDiscountAll">모든 사례 인하율</label><div class="iw"><input id="caseDiscountAll" type="number" value="3" step="0.5" min="0"><span class="unit">% (상한가 대비)</span></div></div>
            </div>
            <div class="module-link">
              <button type="button" class="btn btn-soft" id="applyCaseDiscount">인하율 일괄 적용</button>
              <button type="button" class="btn" id="resetCaseDiscount">0% (상한가 입찰 = 최대 사업성)</button>
            </div>
            <p class="callout-sm" id="caseSummary"></p>
            <div class="subtotal strong"><span>사례 조건 (빈 칸 = 현재 페이지 가정 · 칸 안 흐린 글씨 = 계산 방식)</span><span></span></div>
            <div class="table-wrap">
              <table class="module-table">
                <thead><tr><th class="mk-name">사례 · 차수 · 트랙</th><th>상한가<br>(원/kWh)</th><th>총사업비<br>(억원/MW)</th><th>순이용률<br>(%)</th><th>REC<br>가중치</th><th>상한가 대비<br>인하율 (%)</th></tr></thead>
                <tbody id="caseInputBody"></tbody>
              </table>
            </div>
            <div class="subtotal strong"><span>추정 사업성</span><span></span></div>
            <div class="table-wrap">
              <table class="module-table">
                <thead><tr><th class="mk-name">사례</th><th>입찰가격<br>(가정)</th><th>수령단가</th><th>총사업비<br>(계산, 억원/MW)</th><th>P-IRR</th><th>E-IRR<br>(배당세전)</th><th>목표 유지<br>최대 인하율</th></tr></thead>
                <tbody id="caseResultBody"></tbody>
              </table>
            </div>
            <p class="hint">총사업비: 보도된 MW당 사업비를 현재 페이지의 사업비 구성(① 공사비 비중)으로 나눠 넣고, 총사업비가 없고 EPC·도급 금액만 있으면 그 금액을 ① 공사비로 보고 역산합니다("총사업비(계산)" 열로 확인). 순이용률: 보도 이용률이 없으면 연간 발전량 ÷ (용량 × 8,760h)로 계산합니다(보도 발전량은 보통 손실 반영 순발전량이라, 페이지의 출력제어 2%가 이중으로 빠질 수 있음). REC 가중치: 이안거리·수심이 모두 보도된 사례만 구간 산정으로 추정(실제 연계거리와 다를 수 있음). 부유식은 고정식보다 사업비가 크게 높아, 사업비를 넣지 않으면 사업성이 과대평가됩니다. "목표 유지 최대 인하율"은 A. 산정 기준의 목표를 지키면서 상한가 대비 몇 %까지 깎을 수 있었는지(가격 경쟁 여력)입니다. 새 사례는 코드의 <code>CASE_LIST</code>에 항목을 더하면 됩니다.</p>
            <div class="subtotal strong"><span>사례 상세 — 사업자 · 터빈 · EPC · 공급사 · 사업비 · 발전량 · 입지 · 현황 · 출처</span><span></span></div>
            <ul class="todo-list" id="caseSourceList"></ul>
          </div>
        </section>
      </div>

      <!-- KCH 개발수수료 -->`);
f.rep(`              <li>엑셀(.xlsx) 회신 변환기(<code>ESS_엑셀변환.bat</code>)는 ESS 전용`,
  `              <li><strong>입찰 사례</strong> — 사업별 낙찰가는 비공개라 상한가 대비 인하율을 가정해 추정(0% = 상한가 입찰 = 최대 사업성). 사례 18건의 사업자·터빈·EPC·공급사·사업비·발전량·입지는 보도·사업자 발표·Renewable Korea 표로 정리하고, 환경영향평가정보지원시스템(EIASS) 사업 검색으로 14건의 사업코드·초안/본협의/변경 협의 완료일을 확인(고창·압해·다대포·한동·평대는 검색되지 않음). 13개 사업은 EIASS 사업 상세 표에서 협의 등록 규모·사업비·사업시행자·평가대행자까지 반영(평가 당시 값이라 입찰 용량·최신 사업비와 다를 수 있음 — 해송은 등록 사업비 4,575억원이 1,008MW에 비해 지나치게 작아 제외). 평가서 본문(발전량·수심·이격거리)은 문서 뷰어 방식이라 읽지 못해 보도 기준. 총사업비는 신안우이·낙월·완도 금일·태안·압해·다대포·한동·평대·서남해·한빛·굴업도, EIASS 협의 사업비(등록 사업비 ÷ 등록 규모)는 안마·반딧불이·금오도·해울이, EPC 역산은 고창·야월, 발전량은 신안우이·낙월·안마·다대포·한빛만 확인. <strong>사업비 발표 시점이 2019~2026년으로 섞여 있어 초기 발표액(압해 MW당 50억, 한동·평대 56억 등)은 인플레이션 이전 값일 수 있음</strong> — 해당 사례의 높은 추정 수익률은 과대 추정 가능성. 2023년 상한가 167.778원은 역산, 2026년 선정 단지는 보도 기준, 금융·일정은 현재 페이지 조건</li>
              <li>엑셀(.xlsx) 회신 변환기(<code>ESS_엑셀변환.bat</code>)는 ESS 전용`);
f.rep(`전체 13개 항목 상세 보기`, `전체 14개 항목 상세 보기`);

// ── 스크립트: 사례 목록 · 공통 도우미 ─────────────────────────
const casesJs = JSON.stringify(CASES, null, 2).split("\n").join("\n  ");
f.rep(`  // 사용자 추가 터빈 — 이 브라우저(localStorage)에 저장하고, 시나리오 저장·내보내기에도 담는다.`,
  `  // 입찰 사례 — 공개 사실만 담는다. 새 사례는 항목 하나를 더하면 "입찰 사례" 탭에 자동 반영된다.
  // 필드: id(영문·숫자·_) · round · track('general' | 'public' | 'floating') · name · mw · cap(그 차수 상한가 원/kWh) · smp(기준 SMP)
  //       turbine(짧게) · developer · turbineDetail · epc · suppliers · capexPerMW(보도 총사업비 억원/MW | null) · capexText
  //       epcAmount(EPC·도급 금액 억원 | null — 총사업비가 없을 때 역산) · genGWh(연간 발전량 | null) · cf(보도 이용률 % | null)
  //       siteText · distanceKm · depthM(둘 다 있을 때만 REC 가중치 추정) · status · note · sources
  const CASE_LIST = ${casesJs};
  const CASE_TRACK_LABEL = { general: '일반 · 고정식', public: '공공주도형', floating: '일반 · 부유식' };
  // 사례 기본값 — 보도 이용률이 없으면 발전량으로, 가중치는 이안거리·수심이 모두 있을 때만 구간 산정
  const caseCfDefault = (c) => (c.cf != null ? c.cf : c.genGWh ? Math.round(c.genGWh / (c.mw * 8.76) * 1000) / 10 : null);
  const caseWeightDefault = (c) => (c.distanceKm != null && c.depthM != null ? bandWeight(c.distanceKm, 5, 5) + bandWeight(c.depthM, 20, 5) - 2.5 : null);

  // 사용자 추가 터빈 — 이 브라우저(localStorage)에 저장하고, 시나리오 저장·내보내기에도 담는다.`);

f.rep(`resultsDirty.turbine = true; }`, `resultsDirty.turbine = true; resultsDirty.entry = true; resultsDirty.cases = true; }`);
f.rep(`    else if (activeTabId === 'tab-turbine' && resultsDirty.turbine) { resultsDirty.turbine = false; renderTurbineCompare(); }`,
  `    else if (activeTabId === 'tab-turbine' && resultsDirty.turbine) { resultsDirty.turbine = false; renderTurbineCompare(); }
    else if (activeTabId === 'tab-price' && resultsDirty.entry) { resultsDirty.entry = false; renderEntryConditions(); }
    else if (activeTabId === 'tab-cases' && resultsDirty.cases) { resultsDirty.cases = false; renderCases(); }`);

f.rep(`\${fmt(bid - cap, 2)}원 초과 — 응찰 불가\``, `\${fmt(bid - cap, 2)}원 초과 — 응찰 불가 (진입 조건: 선정평가 탭)\``);

// ── 스크립트: 진입 조건 · 사례 계산 ───────────────────────────
f.rep(`  // ---------- 요약 탭`, `  // ---------- 목표 대비 여유 · 이분탐색 도우미 ----------
  // 목표(A. 산정 기준) 대비 여유 — 0 이상이면 목표 달성. IRR 기준이면 소수(0.01 = 1%p), 당사 이익 기준이면 억원.
  function targetGapOf(r) {
    if (!r || (r.errors && r.errors.length)) return NaN;
    if ($('solveMode').value === 'companyProfit') return (r[$('companyProfitKind').value] ?? NaN) - (+$('targetCompanyProfit').value || 0);
    return (r[$('irrKind').value] ?? NaN) - rate(+$('targetIrrPct').value || 0);
  }
  const isProfitTarget = () => $('solveMode').value === 'companyProfit';
  const targetMetricOf = (r) => (isProfitTarget() ? r[$('companyProfitKind').value] : r[$('irrKind').value]);
  const fmtTargetMetric = (v) => (Number.isFinite(v) ? (isProfitTarget() ? \`\${fmt(v, 1)}억원\` : \`\${fmt(v * 100, 2)}%\`) : '—');
  const targetLabel = () => (isProfitTarget()
    ? \`목표 당사 이익(\${$('companyProfitKind').selectedOptions[0].textContent.trim()}) \${fmt(+$('targetCompanyProfit').value || 0, 0)}억원\`
    : \`목표 \${$('irrKind').selectedOptions[0].textContent.trim()} \${fmt(+$('targetIrrPct').value || 0, 2)}%\`);
  const cloneModel = (m) => { try { return structuredClone(m); } catch { return JSON.parse(JSON.stringify(m)); } };
  // ok(lo)가 참이고 ok(hi)가 거짓일 때 참인 가장 큰 값 / ok(hi)가 참일 때 참인 가장 작은 값
  function bisectMax(lo, hi, ok) { for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (ok(mid)) lo = mid; else hi = mid; } return lo; }
  function bisectMin(lo, hi, ok) { for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; } return hi; }

  // ---------- 상한가 진입 조건 — 한 가지만 바꿔 입찰가격을 상한가에 맞출 때의 값(목표 수익 유지, SPC 기준) ----------
  // 상한가에 입찰했을 때의 수령단가 R_cap에서 각 항목을 바꿔 목표 여유가 0이 되는 지점을 이분탐색으로 찾는다.
  function renderEntryConditions() {
    const body = $('entryBody'), note = $('entryNote');
    const R0 = parseFloat(String($('heroBidPrice').textContent).replace(/,/g, ''));
    const base = readModel(), rv = base.revenue;
    if (rv.salesStructure !== 'fixed' || !Number.isFinite(R0) || !(rv.priceCapPerKWh > 0)) {
      note.innerHTML = '기업PPA이거나 적정 수령단가를 산정하지 못해(또는 상한가격이 없어) 상한가 진입 조건을 계산하지 않습니다.';
      body.innerHTML = '';
      return;
    }
    const cap = rv.priceCapPerKWh, w = rv.recWeightApplied, smp = rv.smpRefPerKWh, pref = rv.preferentialPerKWh;
    const P0 = bidFromReceived(R0, rv), gap = P0 - cap, Rcap = smp + (cap - smp) * w + pref;
    const mw = rv.contractCapacityMW || 1, isEpc = (it) => it.group === 'construction';
    const at = (mutate) => { const m = cloneModel(base); m.revenue.bidPricePerKWh = Rcap; if (mutate) mutate(m); return analyzeEss(m); };
    const metricCap = targetMetricOf(at());
    const row = (id, th, sub, text, value, cls = '') => \`<tr><th>\${th} <span class="sub">\${sub}</span></th><td id="\${id}" data-value="\${Number.isFinite(value) ? value : ''}" class="\${cls}">\${text}</td></tr>\`;
    const rows = [];
    if (gap <= 0) {
      note.innerHTML = \`<strong>지금 조건으로 상한가 이내입니다</strong> — 입찰가격(SPC 기준) \${fmt(P0, 2)}원/kWh, 상한가 \${fmt(cap, 3)}원까지 \${fmt(-gap, 2)}원 여유. 아래는 상한가에 그대로 입찰했을 때의 상승 여지입니다.\`;
      rows.push(row('entryGap', '상한가까지 여유', '상한가 − 입찰가격', \`\${fmt(-gap, 2)}원/kWh (수령단가로 \${fmt(-gap * w, 2)}원)\`, gap, 'best'));
      rows.push(row('entryTarget', '상한가에 입찰하면', targetLabel(), \`\${fmtTargetMetric(metricCap)} 달성\`, metricCap));
      body.innerHTML = rows.join('');
      return;
    }
    note.innerHTML = \`<strong>상한가를 \${fmt(gap, 2)}원/kWh 넘어 응찰할 수 없습니다</strong> — 입찰가격(SPC 기준) \${fmt(P0, 2)}원 → 상한가 \${fmt(cap, 3)}원. 아래 각 행은 나머지 조건은 그대로 두고 <strong>그 항목 하나만</strong> 바꿔 상한가에 입찰해도 목표를 지키는 값입니다.\`;
    rows.push(row('entryGap', '입찰가격 인하 필요', '입찰가격 − 상한가 · SMP+1REC 기준', \`\${fmt(gap, 2)}원/kWh = 수령단가 \${fmt(gap * w, 2)}원 (가중치 \${fmt(w, 2)}배)\`, gap, 'over'));
    rows.push(row('entryTarget', '목표 수익을 낮추면', \`\${targetLabel()} →\`, \`\${fmtTargetMetric(metricCap)}까지 낮추면 상한가 입찰 가능\`, metricCap));
    const epc0 = sum(base.capex.items.filter(isEpc).map((it) => it.value)) / mw;
    const epcOk = (e) => targetGapOf(at((m) => {
      m.capex = { ...m.capex, items: [{ id: 'epcLumpSum', label: 'EPC', value: e * mw, category: '기자재', group: 'construction' }, ...m.capex.items.filter((it) => !isEpc(it))] };
    })) >= 0;
    const epcReq = epcOk(0) ? bisectMax(0, epc0, epcOk) : NaN;
    rows.push(row('entryEpc', 'EPC 단가를 낮추면', '① 공사비 ÷ 설비용량', Number.isFinite(epcReq)
      ? \`\${fmt(epc0, 1)} → \${fmt(epcReq, 2)}억원/MW (−\${fmt((1 - epcReq / epc0) * 100, 1)}%)\` : 'EPC를 0으로 해도 부족', epcReq, Number.isFinite(epcReq) ? '' : 'over'));
    const rates0 = rv.operatingRatesPct, kMax = 60 / Math.max(...rates0, 0.01);
    const cfOk = (k) => targetGapOf(at((m) => { m.revenue.operatingRatesPct = rates0.map((v) => v * k); })) >= 0;
    const kReq = cfOk(kMax) ? bisectMin(1, kMax, cfOk) : NaN;
    rows.push(row('entryCf', '순이용률을 높이면', '전 연차를 같은 비율로', Number.isFinite(kReq)
      ? \`1년차 \${fmt(rates0[0], 2)}% → \${fmt(rates0[0] * kReq, 2)}% (+\${fmt(rates0[0] * (kReq - 1), 2)}%p)\` : '이용률 60%로도 부족', Number.isFinite(kReq) ? rates0[0] * kReq : NaN, Number.isFinite(kReq) ? '' : 'over'));
    const opex0 = sum(base.opex.items.map((it) => it.value));
    const opOk = (fct) => targetGapOf(at((m) => { m.opex = { ...m.opex, items: m.opex.items.map((it) => ({ ...it, value: it.value * fct })) }; })) >= 0;
    const fReq = opOk(0) ? bisectMax(0, 1, opOk) : NaN;
    rows.push(row('entryOpex', '고정 O&amp;M을 줄이면', 'E. OPEX 고정비 항목 합계', Number.isFinite(fReq)
      ? \`연 \${fmt(opex0, 1)} → \${fmt(opex0 * fReq, 1)}억원 (−\${fmt((1 - fReq) * 100, 1)}%)\` : '고정 O&amp;M을 0으로 해도 부족', Number.isFinite(fReq) ? opex0 * fReq : NaN, Number.isFinite(fReq) ? '' : 'over'));
    // 가중치는 수령단가가 그대로라 닫힌 식: 상한가 = SMP + (R − 우대 − SMP) ÷ w  ⇒  w = (R − 우대 − SMP) ÷ (상한가 − SMP)
    const wReq = cap > smp ? (R0 - pref - smp) / (cap - smp) : NaN;
    rows.push(row('entryWeight', 'REC 가중치가 높으면', '수령단가 그대로 · 가중치만', Number.isFinite(wReq)
      ? \`\${fmt(w, 2)} → \${fmt(wReq, 3)} 이상 (구간 약 \${Math.max(1, Math.ceil((wReq - w) / 0.4 - 1e-9))}단계, 1단계 ≈ +0.4)\` : '—', wReq));
    if (rv.tenderTrack === 'public' && $('prefMode').value !== 'rnd') {
      const Prnd = smp + (R0 - PREF_PRICES.rnd - smp) / w, fits = Prnd <= cap;
      rows.push(row('entryRnd', '정부 R&amp;D 실증 터빈 우대를 받으면', '우대가격 31.50원/kWh', \`입찰가격 \${fmt(Prnd, 2)}원 — \${fits ? \`상한 이내(\${fmt(cap - Prnd, 2)}원 여유)\` : \`여전히 \${fmt(Prnd - cap, 2)}원 초과\`}\`, Prnd, fits ? 'best' : 'over'));
    }
    body.innerHTML = rows.join('');
  }

  // ---------- 입찰 사례 탭 — 공개 사실 + 인하율 가정으로 사례별 사업성 추정 ----------
  function renderCaseRows() {
    const h = escapeHtml;
    const inp = (c, fld, v, step, label, ph) => \`<input id="cs-\${h(c.id)}-\${fld}" type="number" value="\${v ?? ''}" step="\${step}" min="0" placeholder="\${ph}" aria-label="\${h(c.name)} \${label}">\`;
    $('caseInputBody').innerHTML = CASE_LIST.map((c) => {
      const w = caseWeightDefault(c);
      return \`
      <tr data-cs-row="\${h(c.id)}">
        <th class="mk-name">\${h(c.name)}<span class="sub">\${h(c.round)} · \${CASE_TRACK_LABEL[c.track] || h(c.track)} · \${fmt(c.mw, 1)}MW · \${h(c.turbine)}</span></th>
        <td>\${fmt(c.cap, 3)}</td>
        <td>\${inp(c, 'capex', c.capexPerMW ?? (c.epcAmount ? null : c.eiassCapexPerMW), 0.5, '총사업비', c.epcAmount ? 'EPC 역산' : '현재')}</td>
        <td>\${inp(c, 'cf', caseCfDefault(c), 0.1, '순이용률', '현재')}</td>
        <td>\${inp(c, 'w', w != null ? Number(w.toFixed(2)) : null, 0.1, 'REC 가중치', '현재')}</td>
        <td>\${inp(c, 'disc', 0, 0.5, '상한가 대비 인하율', '0')}</td>
      </tr>\`;
    }).join('');
    $('caseResultBody').innerHTML = CASE_LIST.map((c) => \`
      <tr data-cs-row="\${h(c.id)}">
        <th class="mk-name">\${h(c.name)}<span class="sub">\${h(c.round)} · \${c.capexPerMW != null ? '사업비 보도' : c.epcAmount ? 'EPC 금액 역산' : c.eiassCapexPerMW != null ? 'EIASS 협의 사업비' : '사업비 미공개'}\${caseCfDefault(c) != null ? (c.cf != null ? ' · 이용률 보도' : ' · 발전량 환산') : ''}</span></th>
        <td id="cs-\${h(c.id)}-bid">—</td><td id="cs-\${h(c.id)}-r">—</td><td id="cs-\${h(c.id)}-inv">—</td><td id="cs-\${h(c.id)}-pirr">—</td><td id="cs-\${h(c.id)}-eirr">—</td><td id="cs-\${h(c.id)}-max">—</td>
      </tr>\`).join('');
    const part = (label, v) => (v ? \`<br><span class="sub" style="display:inline;">\${label}</span> \${h(v)}\` : '');
    $('caseSourceList').innerHTML = CASE_LIST.map((c) => {
      const cfd = caseCfDefault(c);
      const gen = c.genGWh ? \`연 \${fmt(c.genGWh, 0)}GWh (이용률 약 \${fmt(c.genGWh / (c.mw * 8.76) * 100, 1)}%)\${c.cf != null ? \` · 보도 이용률 \${fmt(c.cf, 1)}%\` : ''}\` : (c.cf != null ? \`보도 이용률 \${fmt(c.cf, 1)}%\` : '');
      return \`<li data-cs-detail="\${h(c.id)}"><strong>\${h(c.round)} · \${h(c.name)}</strong> (\${fmt(c.mw, 1)}MW · \${CASE_TRACK_LABEL[c.track] || h(c.track)})\`
        + part('사업자', c.developer) + part('터빈', c.turbineDetail) + part('EPC·시공', c.epc) + part('주요 공급사', c.suppliers)
        + part('사업비', c.capexText) + part('발전량', gen) + part('입지', c.siteText) + part('현황', c.status) + part('참고', c.note)
        + part('환경영향평가(EIASS)', c.eiass) + part('EIASS 등록 제원', c.eiassReg) + part('출처', c.sources) + (cfd == null && c.capexPerMW == null && !c.epcAmount ? '' : '') + '</li>';
    }).join('');
  }
  function renderCases() {
    const base = readModel(), rv = base.revenue, n = rv.operatingRatesPct.length || 1;
    const curMW = rv.contractCapacityMW || 1, isEpc = (it) => it.group === 'construction';
    const baseInv = solveInvestment(base, buildCalendar(base.project)).totalInvestment;
    // 보도 총사업비(억원/MW)를 현재 페이지의 사업비 구성으로 공사비에 환산 — ① 공사비 ÷ 총투자비 비중
    const epcShare = baseInv > 0 ? sum(base.capex.items.filter(isEpc).map((it) => it.value)) / baseInv : 0.8;
    const baseCf = rv.operatingRatesPct[0] || 0, d = rate(+$('degradationPct').value || 0);
    const pirrs = [];
    let metCount = 0;
    CASE_LIST.forEach((c) => {
      const num = (fld) => { const v = $(\`cs-\${c.id}-\${fld}\`).value; return v === '' ? NaN : +v; };
      // 총사업비 입력이 없으면: EPC·도급 금액이 있으면 그 금액을 ① 공사비로 보고 총사업비로 역산, 없으면 현재 페이지 가정
      const epcTotal = num('capex') > 0 ? num('capex') * c.mw * epcShare : c.epcAmount ? c.epcAmount : (baseInv / curMW) * c.mw * epcShare;
      const cf = num('cf') > 0 ? num('cf') : baseCf;
      const w = num('w') > 0 ? num('w') : rv.recWeightApplied;
      const disc = Math.min(90, Math.max(0, num('disc') || 0));
      const pref = c.track === 'public' ? PREF_PRICES.base : 0, ratio = c.mw / curMW;
      const build = (discPct) => {
        const m = cloneModel(base);
        m.revenue.contractCapacityMW = c.mw;
        m.revenue.operatingRatesPct = Array.from({ length: n }, (_, i) => cf * (1 - d) ** i);
        m.capex = { ...m.capex, items: [{ id: 'epcLumpSum', label: \`EPC (\${c.name})\`, value: epcTotal, category: '기자재', group: 'construction' },
          ...m.capex.items.filter((it) => !isEpc(it)).map((it) => ({ ...it, value: it.value * ratio }))] };
        m.opex = { ...m.opex, items: m.opex.items.map((it) => ({ ...it, value: it.value * ratio })) };
        m.finance = { ...m.finance, fundingMode: 'ratio' };
        const P = c.cap * (1 - discPct / 100);
        m.revenue.bidPricePerKWh = c.smp + (P - c.smp) * w + pref;
        return { m, P };
      };
      const { m, P } = build(disc), r = analyzeEss(m), ok = !(r.errors && r.errors.length);
      const set = (fld, text, cls = '') => { const el = $(\`cs-\${c.id}-\${fld}\`); el.textContent = text; el.className = cls; };
      set('bid', \`\${fmt(P, 2)}원\${disc ? \` (−\${fmt(disc, 1)}%)\` : ''}\`);
      set('r', \`\${fmt(m.revenue.bidPricePerKWh, 2)}원\`);
      if (!ok) { ['inv', 'pirr', 'eirr', 'max'].forEach((fld) => set(fld, '산정 불가')); return; }
      set('inv', fmt(r.totalInvestment / c.mw, 1));
      const gapNow = targetGapOf(r);
      if (gapNow >= 0) metCount++;
      set('pirr', \`\${fmt(r.projectIrr * 100, 2)}%\`);
      set('eirr', \`\${fmt(r.equityIrr * 100, 2)}%\`);
      pirrs.push(r.projectIrr);
      // 목표 유지 최대 인하율 — 인하율이 클수록 목표 여유가 줄어드는 단조 관계라 이분탐색
      const gapAt = (x) => targetGapOf(analyzeEss(build(x).m));
      if (!(gapAt(0) >= 0)) set('max', '상한가로도 목표 미달', 'over');
      else {
        const mx = gapAt(60) >= 0 ? 60 : bisectMax(0, 60, (x) => gapAt(x) >= 0);
        set('max', mx >= 60 ? '60% 이상' : \`\${fmt(mx, 1)}%\`, gapNow >= 0 ? 'best' : '');
      }
    });
    const sorted = [...pirrs].sort((a, b) => a - b), med = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : NaN;
    // 우리 사업(현재 조건)을 상한가에 입찰했을 때와 비교
    let ours = '';
    const R0 = parseFloat(String($('heroBidPrice').textContent).replace(/,/g, ''));
    if (rv.salesStructure === 'fixed' && Number.isFinite(R0)) {
      const m = cloneModel(base);
      m.revenue.bidPricePerKWh = rv.smpRefPerKWh + (rv.priceCapPerKWh - rv.smpRefPerKWh) * rv.recWeightApplied + rv.preferentialPerKWh;
      const r = analyzeEss(m);
      if (!(r.errors && r.errors.length)) ours = \` · 우리 사업(현재 조건)을 상한가 \${fmt(rv.priceCapPerKWh, 3)}원에 입찰하면 P-IRR \${fmt(r.projectIrr * 100, 2)}%\`;
    }
    $('caseSummary').innerHTML = sorted.length
      ? \`<strong>사례 \${sorted.length}건 추정 P-IRR \${fmt(sorted[0] * 100, 2)}% ~ \${fmt(sorted[sorted.length - 1] * 100, 2)}% (중앙값 \${fmt(med * 100, 2)}%)</strong> — 지금 인하율 가정에서 \${targetLabel()} 달성 \${metCount}건\${ours}.\`
      : '사례를 계산하지 못했습니다.';
  }

  // ---------- 요약 탭`);

// ── 리스너 · 초기화 ───────────────────────────────────────────
f.rep(`  // ---------- 새 터빈 등록 · 삭제 · 내보내기 · 불러오기 ----------`, `  // 입찰 사례 — 사례 칸은 본 모델과 무관해 재계산 없이 사례 표만 다시 그린다(탭이 보일 때).
  $('panel-cases').addEventListener('input', (e) => {
    if (!e.target.id || !e.target.id.startsWith('cs-')) return;
    resultsDirty.cases = true;
    renderActiveTab();
  });
  const setAllCaseDiscount = (v) => {
    document.querySelectorAll('input[id^="cs-"][id$="-disc"]').forEach((el) => { el.value = String(v); });
    resultsDirty.cases = true;
    renderActiveTab();
  };
  $('applyCaseDiscount').addEventListener('click', () => setAllCaseDiscount(Math.max(0, +$('caseDiscountAll').value || 0)));
  $('resetCaseDiscount').addEventListener('click', () => setAllCaseDiscount(0));

  // ---------- 새 터빈 등록 · 삭제 · 내보내기 · 불러오기 ----------`);
f.rep(`el.id.startsWith('tb-') || el.id.startsWith('newTb') ||`, `el.id.startsWith('tb-') || el.id.startsWith('newTb') || el.id.startsWith('cs-') || el.id === 'caseDiscountAll' ||`);
f.rep(`  renderTurbineUI(); // 카탈로그 + 사용자 추가 터빈으로 선택 목록·터빈 표를 그린다(스펙 칸을 읽는 계산보다 먼저)`,
  `  renderTurbineUI(); // 카탈로그 + 사용자 추가 터빈으로 선택 목록·터빈 표를 그린다(스펙 칸을 읽는 계산보다 먼저)
  renderCaseRows(); // 입찰 사례 목록으로 사례 표를 그린다`);

f.save("wind-4");
