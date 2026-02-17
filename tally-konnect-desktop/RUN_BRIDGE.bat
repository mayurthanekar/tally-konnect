@echo off
title Tally Konnect Bridge - Runner
cd /d "%~dp0"

echo ============================================
echo   Tally Konnect Bridge - Smart Launcher
echo ============================================
echo.

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check dependencies
if not exist "node_modules" (
    echo [INFO] Dependencies missing. Installing...
    call npm install --omit=dev
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
)

:: Launch
echo [INFO] Starting Bridge...
call npx electron .
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Application crashed or failed to start.
    pause
    exit /b 1
)
