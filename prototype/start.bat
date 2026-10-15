@echo off
REM ============================================================
REM   Карта студенческих коворкингов - запуск (Windows)
REM ============================================================
REM   Что делает: проверяет Node, ставит зависимости,
REM   создаёт базу, собирает фронт, запускает сервер.
REM
REM   Запуск: start.bat
REM   Сброс базы: start.bat --reset

setlocal enabledelayedexpansion
cd /d "%~dp0"

set PORT=3000
set ADMIN_PASSWORD=admin
if "%~1"=="--reset" set RESET=1

echo.
echo   Карта студенческих коворкингов
echo   прототип - Минск - 2026
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [X] Node.js не найден. Установите с https://nodejs.org ^(версия 22+^)
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODEV=%%v
echo   Node.js %NODEV%

if not exist node_modules (
  echo   Устанавливаю зависимости...
  call npm install --silent --no-audit --no-fund
)

if "%RESET%"=="1" (
  echo   Пересоздаю базу...
  call node seed.js
) else (
  if not exist data\kovorking.db call node seed.js
)

echo   Собираю интерфейс...
call npx vite build --logLevel warn

echo.
echo   ------------------------------------------------
echo   Карта:   http://localhost:%PORT%
echo   Админка: http://localhost:%PORT%/#/admin
echo   Пароль:  %ADMIN_PASSWORD%
echo   ------------------------------------------------
echo.

start "" "http://localhost:%PORT%"
node server.js
