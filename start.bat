cd C:\Users\Server\Desktop\beholden\
@echo off
cd /d C:\Users\Server\Desktop\beholden\

echo === Installing deps (if needed) ===
call npm install
if errorlevel 1 goto :fail

echo === Starting dev server ===
call npm run dev
if errorlevel 1 goto :fail

goto :eof

:fail
echo.
echo === Beholden failed to start. See error above. ===
pause
