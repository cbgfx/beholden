@echo off
setlocal

:: ── Check Node.js ─────────────────────────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Install it from https://nodejs.org then try again.
    pause
    exit /b 1
)

:: ── Install deps (first run only) ─────────────────────────────────────────
if not exist node_modules (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 goto :fail
)

:: ── Start Beholden development environment ──────────────────────────────
echo Starting Beholden development environment...
call npm run dev
if errorlevel 1 goto :fail

start "" "http://localhost:5173"
start "" "http://localhost:5175"

echo.
echo DM view is running at http://localhost:5173
echo Player view is running at http://localhost:5175
echo.
echo Beholden is running. Keep this window open.
echo Close this window to stop Beholden.
exit /b 0

:fail
echo.
echo Failed. See error above.
pause
exit /b 1
