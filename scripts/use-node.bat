@echo off
rem Prefer the verified local runtime matching the project's .nvmrc, when installed.
rem Otherwise use the Node.js installation already on PATH.
set "BEHOLDEN_NODE_VERSION="
set /p BEHOLDEN_NODE_VERSION=<"%~dp0..\.nvmrc"
set "BEHOLDEN_NODE_DIR=%LOCALAPPDATA%\Beholden\runtimes\node-v%BEHOLDEN_NODE_VERSION%-win-x64"
if exist "%BEHOLDEN_NODE_DIR%\node.exe" set "PATH=%BEHOLDEN_NODE_DIR%;%PATH%"
set "BEHOLDEN_NODE_VERSION="
set "BEHOLDEN_NODE_DIR="
node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major === 26 && minor >= 12 ? 0 : 1)" >nul 2>&1
if errorlevel 1 (
    echo ERROR: Beholden requires Node.js 26.12.0 or newer within Node 26. Install Node 26 and try again.
    exit /b 1
)
exit /b 0
