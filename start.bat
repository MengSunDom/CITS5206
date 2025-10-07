@echo off
echo ========================================
echo   Bridge Game - Starting Application
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH.
    echo.
    echo Please install Python from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [1/4] Setting up backend environment...
cd backend

REM Check if venv exists, if not create it
if not exist "venv\" (
    echo Creating Python virtual environment...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo ERROR: Failed to create virtual environment.
        echo Please ensure Python is properly installed with venv module.
        echo.
        pause
        exit /b 1
    )
)

REM Activate virtual environment and install dependencies
echo Installing backend dependencies...
call venv\Scripts\activate.bat
pip install -r requirements.txt >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: Some Python packages may not have installed correctly.
    echo Attempting to install essential packages...
    pip install django djangorestframework django-cors-headers djangorestframework-simplejwt drf-spectacular
)

REM Run migrations
echo [2/4] Setting up database...
python manage.py migrate --no-input >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: Database migrations encountered issues.
    echo The application may still work with existing database.
)

REM Check if this is first run (no users exist)
echo [2.5/4] Checking for initial setup...
python -c "from django.contrib.auth import get_user_model; User = get_user_model(); exit(0 if User.objects.filter(username='alice').exists() else 1)" 2>nul
if %errorlevel% neq 0 (
    echo First time setup detected. Creating mock users and demo session...
    python manage.py create_mock_users --with-session >nul 2>&1
    if %errorlevel% eq 0 (
        echo Mock users created successfully:
        echo   - alice@example.com / TestPass123!
        echo   - bob@example.com / TestPass123!
        echo   - charlie@example.com / TestPass123!
        echo   - diana@example.com / TestPass123!
    ) else (
        echo WARNING: Could not create mock users automatically.
    )
) else (
    echo Mock users already exist. Skipping creation.
)

REM Start backend server in background
echo [3/4] Starting backend server...
start /B cmd /c "venv\Scripts\python.exe manage.py runserver"
timeout /t 3 >nul

REM Check if backend is running
netstat -an | findstr :8000 >nul
if %errorlevel% neq 0 (
    echo ERROR: Backend server failed to start.
    echo Please check if port 8000 is already in use.
    echo.
    pause
    exit /b 1
)

echo Backend server started successfully on http://localhost:8000

REM Setup frontend
cd ..\frontend

echo [4/4] Setting up frontend...
if not exist "node_modules\" (
    echo Installing frontend dependencies (this may take a few minutes)...
    call npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install frontend dependencies.
        echo Please check your internet connection and try again.
        echo.
        pause
        exit /b 1
    )
)

REM Start frontend
echo Starting frontend application...
echo.
echo ========================================
echo   Application is starting...
echo ========================================
echo.
echo The application will open in your browser automatically.
echo If it doesn't, please open: http://localhost:3000
echo.
echo To stop the application, press Ctrl+C in this window.
echo.

call npm start

REM When npm start is terminated, also kill the backend
echo.
echo Shutting down servers...
taskkill /F /FI "WINDOWTITLE eq *manage.py runserver*" >nul 2>&1
echo Application stopped.
pause