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

:: ── Build web-dm ──────────────────────────────────────────────────────────
echo Building...
call npm run build
if errorlevel 1 goto :fail

:: ── Launch server in its own titled window ────────────────────────────────
echo Starting Beholden...
start "Beholden" cmd /k "npm start"

:: Give the server a moment to bind its port
:wait
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "try{$t=New-Object Net.Sockets.TcpClient;$t.Connect('127.0.0.1',5174);$t.Close();exit 0}catch{exit 1}" >nul 2>&1
if errorlevel 1 goto :wait

:: ── Open browser ──────────────────────────────────────────────────────────
start "" "http://localhost:5174"
echo.
echo Beholden is running at http://localhost:5174
echo The server window can be closed to stop it.
exit /b 0

:fail
echo.
echo Failed. See error above.
pause
exit /b 1
