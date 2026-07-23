@echo off
setlocal
cd /d "%~dp0"

echo Updating Beholden...
git pull --ff-only origin main
if errorlevel 1 goto :failed

call npm install
if errorlevel 1 goto :failed

call npm run build
if errorlevel 1 goto :failed

echo.
echo Beholden was updated successfully.
echo Restart the running Beholden server to use the new version.
exit /b 0

:failed
echo.
echo Beholden could not be updated. Review the messages above.
exit /b 1
