@echo off
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
echo [STEP 1/2] Installing dependencies...
call npm install --production
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)
echo [OK] Dependencies installed.
echo.

:: Launch
echo [STEP 2/2] Launching Tally Konnect Bridge...
echo.
echo ============================================
echo   Bridge is starting...
echo   You can close this window after the app opens.
echo ============================================
echo.
npx electron .
