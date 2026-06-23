// .\run_project.bat

@echo off
echo ==========================================
echo Starting Quantum IDE Simulator
echo ==========================================
echo.

echo Starting FastAPI Backend...
start cmd /k "cd backend && if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat) && uvicorn main:app --reload --port 8000"

echo Starting Vite Frontend...
start cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are starting in separate windows.
echo Frontend URL: http://localhost:5173
echo Backend URL:  http://localhost:8000
echo.
pause
