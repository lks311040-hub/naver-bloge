@echo off
title 네이버 블로그 자동화 대시보드
cd /d "%~dp0"

echo.
echo   네이버 블로그 자동화 대시보드를 시작합니다.
echo.
echo   - 잠시 후 브라우저가 자동으로 열립니다 (10초쯤 걸립니다).
echo   - 이 검은 창은 끄지 마세요. 창을 닫으면 프로그램도 함께 꺼집니다.
echo   - 끝내실 때는 이 창을 닫으면 됩니다.
echo.

where npm >nul 2>nul
if errorlevel 1 goto NONODE

if not exist "node_modules" (
  echo   처음 실행이라 필요한 파일을 내려받습니다. 몇 분 걸릴 수 있습니다...
  echo.
  call npm install
  if errorlevel 1 goto INSTALLFAIL
)

rem 서버가 뜰 때까지 기다렸다가 브라우저를 연다. start 로 띄워야 아래
rem npm run dev 가 곧바로 이어서 실행된다.
start "" /min powershell -NoProfile -Command "Start-Sleep -Seconds 10; Start-Process 'http://localhost:5173'"

call npm run dev

echo.
echo   프로그램이 종료됐습니다.
pause
exit /b 0

:NONODE
echo   [오류] Node.js를 찾지 못했습니다.
echo   https://nodejs.org 에서 설치한 뒤 이 파일을 다시 실행해주세요.
echo.
pause
exit /b 1

:INSTALLFAIL
echo.
echo   [오류] 설치에 실패했습니다. 위 메시지를 확인해주세요.
echo.
pause
exit /b 1
