# Bridge Game Startup Script for PowerShell

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Bridge Game - Starting Application" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to print colored messages
function Write-ErrorMessage {
    param([string]$Message)
    Write-Host "ERROR: $Message" -ForegroundColor Red
}

function Write-SuccessMessage {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Green
}

function Write-WarningMessage {
    param([string]$Message)
    Write-Host "WARNING: $Message" -ForegroundColor Yellow
}

# Check if Python is installed
try {
    $pythonVersion = python --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw
    }
} catch {
    Write-ErrorMessage "Python is not installed or not in PATH."
    Write-Host ""
    Write-Host "Please install Python from: https://www.python.org/downloads/"
    Write-Host "Make sure to check 'Add Python to PATH' during installation."
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Check if Node.js is installed
try {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw
    }
} catch {
    Write-ErrorMessage "Node.js is not installed or not in PATH."
    Write-Host ""
    Write-Host "Please install Node.js from: https://nodejs.org/"
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "[1/4] Setting up backend environment..."
Set-Location -Path backend

# Check if venv exists, if not create it
if (-not (Test-Path "venv")) {
    Write-Host "Creating Python virtual environment..."
    python -m venv venv
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMessage "Failed to create virtual environment."
        Write-Host "Please ensure Python is properly installed with venv module."
        Write-Host ""
        Write-Host "Press any key to exit..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}

# Install dependencies
Write-Host "Installing backend dependencies..."
& "venv\Scripts\python.exe" -m pip install -r requirements.txt 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-WarningMessage "Some Python packages may not have installed correctly."
    Write-Host "Attempting to install essential packages..."
    & "venv\Scripts\python.exe" -m pip install django djangorestframework django-cors-headers djangorestframework-simplejwt drf-spectacular
}

# Run migrations
Write-Host "[2/4] Setting up database..."
& "venv\Scripts\python.exe" manage.py migrate --no-input 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-WarningMessage "Database migrations encountered issues."
    Write-Host "The application may still work with existing database."
}

# Check if this is first run (no users exist)
Write-Host "[2.5/4] Checking for initial setup..."
$checkUser = & "venv\Scripts\python.exe" -c "from django.contrib.auth import get_user_model; User = get_user_model(); exit(0 if User.objects.filter(username='alice').exists() else 1)" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "First time setup detected. Creating mock users and demo session..."
    & "venv\Scripts\python.exe" manage.py create_mock_users --with-session 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-SuccessMessage "Mock users created successfully:"
        Write-Host "  - alice@example.com / TestPass123!" -ForegroundColor Yellow
        Write-Host "  - bob@example.com / TestPass123!" -ForegroundColor Yellow
        Write-Host "  - charlie@example.com / TestPass123!" -ForegroundColor Yellow
        Write-Host "  - diana@example.com / TestPass123!" -ForegroundColor Yellow
    } else {
        Write-WarningMessage "Could not create mock users automatically."
    }
} else {
    Write-Host "Mock users already exist. Skipping creation."
}

# Start backend server in background
Write-Host "[3/4] Starting backend server..."
$backendProcess = Start-Process -FilePath "venv\Scripts\python.exe" -ArgumentList "manage.py", "runserver" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 3

# Check if backend is running
$tcpConnection = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if (-not $tcpConnection) {
    Write-ErrorMessage "Backend server failed to start."
    Write-Host "Please check if port 8000 is already in use."
    Write-Host ""
    Stop-Process $backendProcess -Force -ErrorAction SilentlyContinue
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-SuccessMessage "Backend server started successfully on http://localhost:8000"

# Setup frontend
Set-Location -Path ..\frontend

Write-Host "[4/4] Setting up frontend..."
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies (this may take a few minutes)..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMessage "Failed to install frontend dependencies."
        Write-Host "Please check your internet connection and try again."
        Write-Host ""
        Stop-Process $backendProcess -Force -ErrorAction SilentlyContinue
        Write-Host "Press any key to exit..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}

# Start frontend
Write-Host "Starting frontend application..."
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Application is starting..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-SuccessMessage "The application will open in your browser automatically."
Write-Host "If it doesn't, please open: http://localhost:3000"
Write-Host ""
Write-Host "To stop the application, press Ctrl+C in this window."
Write-Host ""

try {
    npm start
} finally {
    # When npm start is terminated, also kill the backend
    Write-Host ""
    Write-Host "Shutting down servers..."
    Stop-Process $backendProcess -Force -ErrorAction SilentlyContinue
    Write-Host "Application stopped."
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}