@echo off
REM Quick Start Script for Attendance Tracking System

echo.
echo ============================================
echo Attendance Tracking System - Quick Start
echo ============================================
echo.

echo Step 1: Starting Backend Setup...
echo.

REM Check if backend node_modules exists
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend
    call npm install
    cd ..
    echo Backend dependencies installed!
) else (
    echo Backend dependencies already installed.
)

echo.
echo Step 2: Checking MongoDB...
echo.
echo Please ensure MongoDB is running:
echo   1. If installed locally: Run 'mongod' in another terminal
echo   2. If using MongoDB Atlas: Make sure MONGO_URI in backend\.env is correct
echo.
pause

echo.
echo Step 3: Starting Backend Server...
echo.
start cmd /k "cd backend && npm start"
timeout /t 3

echo.
echo Step 4: Installing Frontend Dependencies...
echo.

REM Check if frontend node_modules exists
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
    echo Frontend dependencies installed!
) else (
    echo Frontend dependencies already installed.
)

echo.
echo Step 5: Starting Frontend Development Server...
echo.
start cmd /k "npm run dev"

echo.
echo ============================================
echo Both servers are now starting...
echo.
echo Frontend URL: http://localhost:5173
echo Backend URL: http://localhost:5000
echo.
echo New terminals have been opened for:
echo   - Backend server (Express on port 5000)
echo   - Frontend development server (Vite on port 5173)
echo.
echo ============================================
echo.
pause
