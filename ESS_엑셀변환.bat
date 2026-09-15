@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 set "PATH=%PATH%;C:\Program Files\nodejs"
where node >nul 2>&1
if errorlevel 1 (
  echo [오류] node.exe를 찾을 수 없습니다. Node.js를 설치해 주세요.
  pause
  exit /b 1
)
echo ============================================================
echo  ESS 적정 입찰단가 - 엑셀 회신 파일 만들기
echo  시나리오 .json 을 이 파일에 끌어다 놓으세요.
echo  여러 개를 함께 놓으면 시나리오 비교 시트가 추가됩니다.
echo  아무것도 놓지 않고 실행하면 기본값 96MW 기본안으로 만듭니다.
echo ============================================================
echo.
node ess-bidprice-xlsx.mjs %*
if errorlevel 1 (
  echo.
  echo [실패] 변환 중 오류가 발생했습니다. 위 메시지를 확인해 주세요.
  pause
  exit /b 1
)
echo.
echo 완료. 엑셀 파일은 첫 번째 json 과 같은 폴더에 만들어졌습니다. 이 창은 8초 후 닫힙니다.
timeout /t 8 >nul 2>&1
exit /b 0
