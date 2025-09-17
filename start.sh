#!/bin/bash

echo "========================================"
echo "  Bridge Game - Starting Application"
echo "========================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_error() {
    echo -e "${RED}ERROR: $1${NC}"
}

print_success() {
    echo -e "${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
}

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    print_error "Python is not installed or not in PATH."
    echo ""
    echo "Please install Python from: https://www.python.org/downloads/"
    echo "Or use your package manager:"
    echo "  Ubuntu/Debian: sudo apt-get install python3 python3-pip python3-venv"
    echo "  MacOS: brew install python3"
    echo ""
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed or not in PATH."
    echo ""
    echo "Please install Node.js from: https://nodejs.org/"
    echo "Or use your package manager:"
    echo "  Ubuntu/Debian: sudo apt-get install nodejs npm"
    echo "  MacOS: brew install node"
    echo ""
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed or not in PATH."
    echo ""
    echo "Please install npm along with Node.js"
    echo ""
    exit 1
fi

echo "[1/4] Setting up backend environment..."
cd backend || exit 1

# Check if venv exists, if not create it
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        print_error "Failed to create virtual environment."
        echo "Please ensure Python is properly installed with venv module."
        echo "You may need to install python3-venv:"
        echo "  Ubuntu/Debian: sudo apt-get install python3-venv"
        echo ""
        exit 1
    fi
fi

# Activate virtual environment and install dependencies
echo "Installing backend dependencies..."
source venv/bin/activate

# Check if requirements.txt exists
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        print_warning "Some Python packages may not have installed correctly."
        echo "Attempting to install essential packages..."
        pip install django djangorestframework django-cors-headers djangorestframework-simplejwt drf-spectacular
    fi
else
    echo "No requirements.txt found, installing essential packages..."
    pip install django djangorestframework django-cors-headers djangorestframework-simplejwt drf-spectacular
fi

# Run migrations
echo "[2/4] Setting up database..."
python manage.py migrate --no-input > /dev/null 2>&1
if [ $? -ne 0 ]; then
    print_warning "Database migrations encountered issues."
    echo "The application may still work with existing database."
fi

# Check if this is first run (no users exist)
echo "[2.5/4] Checking for initial setup..."
python -c "from django.contrib.auth import get_user_model; User = get_user_model(); exit(0 if User.objects.filter(username='alice').exists() else 1)" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "First time setup detected. Creating mock users and demo session..."
    python manage.py create_mock_users --with-session > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        print_success "Mock users created successfully:"
        echo -e "${YELLOW}  - alice@example.com / TestPass123!${NC}"
        echo -e "${YELLOW}  - bob@example.com / TestPass123!${NC}"
        echo -e "${YELLOW}  - charlie@example.com / TestPass123!${NC}"
        echo -e "${YELLOW}  - diana@example.com / TestPass123!${NC}"
    else
        print_warning "Could not create mock users automatically."
    fi
else
    echo "Mock users already exist. Skipping creation."
fi

# Start backend server in background
echo "[3/4] Starting backend server..."
python manage.py runserver > /dev/null 2>&1 &
BACKEND_PID=$!
sleep 3

# Check if backend is running
if ! curl -s http://localhost:8000 > /dev/null 2>&1; then
    print_error "Backend server failed to start."
    echo "Please check if port 8000 is already in use."
    echo ""
    kill $BACKEND_PID 2> /dev/null
    exit 1
fi

print_success "Backend server started successfully on http://localhost:8000"

# Setup frontend
cd ../frontend || exit 1

echo "[4/4] Setting up frontend..."
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies (this may take a few minutes)..."
    npm install
    if [ $? -ne 0 ]; then
        print_error "Failed to install frontend dependencies."
        echo "Please check your internet connection and try again."
        echo ""
        kill $BACKEND_PID 2> /dev/null
        exit 1
    fi
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill $BACKEND_PID 2> /dev/null
    exit 0
}

# Trap SIGINT (Ctrl+C) to cleanup properly
trap cleanup SIGINT

# Start frontend
echo "Starting frontend application..."
echo ""
echo "========================================"
echo "  Application is starting..."
echo "========================================"
echo ""
print_success "The application will open in your browser automatically."
echo "If it doesn't, please open: http://localhost:3000"
echo ""
echo "To stop the application, press Ctrl+C in this window."
echo ""

npm start

# If npm start exits, cleanup
cleanup