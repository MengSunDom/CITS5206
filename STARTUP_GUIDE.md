# Bridge Game - Quick Start Guide

## Prerequisites

Before running the application, ensure you have the following installed:

1. **Python 3.8 or higher** - [Download Python](https://www.python.org/downloads/)
2. **Node.js 16 or higher** - [Download Node.js](https://nodejs.org/)

## How to Start the Application

### Windows Users

#### Option 1: Using Batch Script (Recommended)
1. Double-click on `start.bat`
2. The application will automatically set up and start
3. Your browser will open to http://localhost:3000

#### Option 2: Using PowerShell
1. Right-click on `start.ps1`
2. Select "Run with PowerShell"
3. If prompted about execution policy, type `Y` and press Enter
4. The application will automatically set up and start

### Mac/Linux Users

1. Open Terminal
2. Navigate to the project directory
3. Make the script executable (first time only):
   ```bash
   chmod +x start.sh
   ```
4. Run the script:
   ```bash
   ./start.sh
   ```
5. Your browser will open to http://localhost:3000

## First Time Setup

The first time you run the application, it will:
- Create a Python virtual environment
- Install backend dependencies (Django, etc.)
- Install frontend dependencies (React, etc.)
- Set up the database

This may take 5-10 minutes depending on your internet connection.

## Stopping the Application

To stop the application, press `Ctrl+C` in the terminal/command window.

## Troubleshooting

### Port Already in Use

If you see an error about port 8000 or 3000 being in use:

**Windows:**
1. Open Command Prompt as Administrator
2. Run: `netstat -ano | findstr :8000` (or `:3000`)
3. Note the PID (last column)
4. Run: `taskkill /PID [PID_NUMBER] /F`

**Mac/Linux:**
1. Open Terminal
2. Run: `lsof -i :8000` (or `:3000`)
3. Note the PID
4. Run: `kill -9 [PID_NUMBER]`

### Python Not Found

- Ensure Python is installed and added to PATH
- On Windows, reinstall Python and check "Add Python to PATH"
- On Mac/Linux, you might need to use `python3` instead of `python`

### Node.js Not Found

- Ensure Node.js is installed
- Restart your terminal/command prompt after installation
- Verify with `node --version` and `npm --version`

### Dependencies Installation Failed

- Check your internet connection
- Try running the script again
- Manually install dependencies:
  - Backend: `cd backend && pip install -r requirements.txt`
  - Frontend: `cd frontend && npm install`

## Manual Start (Advanced Users)

If the scripts don't work, you can start manually:

### Backend:
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend (in a new terminal):
```bash
cd frontend
npm install
npm start
```

## Support

For issues or questions, please contact the development team or check the project documentation.