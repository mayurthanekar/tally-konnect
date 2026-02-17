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

:: Check for .env file
if not exist ".env" (
    echo [INFO] .env file missing. Creating from example...
    if exist ".env.example" (
        copy ".env.example" ".env"
        echo [IMPORTANT] A new .env file has been created.
        echo Please enter your BRIDGE_API_KEY in the file that opens.
        start notepad ".env"
        pause
    ) else (
        echo [WARNING] .env.example not found. Please create .env manually.
    )
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
