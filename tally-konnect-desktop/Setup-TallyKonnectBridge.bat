@echo off
cd /d "%~dp0"

title Tally Konnect Bridge - Setup
echo ============================================
echo   Tally Konnect Bridge - Windows Installer
echo ============================================
echo.

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please download and install Node.js from:
    echo   https://nodejs.org/en/download/
    echo.
    echo After installing Node.js, run this script again.
    pause
    exit /b 1
)

echo [OK] Node.js found: 
node --version
echo.

:: Install dependencies
echo [STEP 1/3] Installing dependencies...
echo.
echo NOTE: Since this is a production setup, we are using 'npm install --omit=dev'.
echo If this fails, ensure you have a stable internet connection.
echo.
call npm install --omit=dev
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to install dependencies.
    echo This usually happens due to network issues or incorrect Node.js environment.
    echo.
    echo TRY MANUALLY: 
    echo 1. Open a terminal in this folder
    echo 2. Run: npm install --omit=dev
    echo.
    pause
    exit /b 1
)
echo [OK] Dependencies installed.
echo.

:: Download cloudflared binary
echo [STEP 2/3] Downloading cloudflared tunnel binary...
node scripts\download-bin.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [WARNING] cloudflared download failed. 
    echo The bridge app might not be able to establish a secure tunnel.
    echo Please check your firewall or download it manually.
    echo.
)
echo [OK] Binary ready.
echo.

:: Launch
echo [STEP 3/3] Launching Tally Konnect Bridge...
echo.
echo ============================================
echo   Bridge is starting...
echo   You can close this window after the app opens.
echo.
echo TIP: To avoid Windows SmartScreen warnings in the future,
echo use the signed TallyKonnectBridgeSetup.exe if provided.
echo ============================================
echo.
npx electron .
