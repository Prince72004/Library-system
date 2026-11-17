@echo off
echo ===================================================
echo Library Issue and Service Request System
echo Department of Computer Science - AMU
echo Author: Prince Kaushal (25CAMSA123 / Gr0683)
echo ===================================================
echo.

echo Checking node and npm...
call node -v
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH! Please install Node.js from https://nodejs.org
    pause
    exit /b %ERRORLEVEL%
)

if not exist node_modules (
    echo Installing npm dependencies...
    call npm install
)

echo.
echo Starting application server...
echo Access the application at: http://localhost:3000
echo.
call npm start
pause
