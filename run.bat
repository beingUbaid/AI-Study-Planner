@echo off
title AI Study Planner Runner
echo ===================================================
echo           Starting AI Study Planner
echo ===================================================
echo.

:: Check Backend
cd backend
if not exist node_modules (
    echo Installing backend dependencies...
    call npm install
)
echo Starting Backend Server...
start "AI Study Planner - Backend" cmd /k "npm run dev"
cd ..

:: Check Frontend
cd frontend
if not exist node_modules (
    echo Installing frontend dependencies...
    call npm install
)
echo Starting Frontend Server...
start "AI Study Planner - Frontend" cmd /k "npm run dev"
cd ..

echo.
echo ===================================================
echo  Services started! 
echo  - Backend running on: http://localhost:5000
echo  - Frontend running on: http://localhost:5173
echo ===================================================
echo.
pause
