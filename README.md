# Bridge Auction Trainer

[![React](https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![Django](https://img.shields.io/badge/Django-5.2.5-092E20?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![DRF](https://img.shields.io/badge/Django_REST_Framework-3.16.1-ff1709?logo=django&logoColor=white)](https://www.django-rest-framework.org/)
[![Python](https://img.shields.io/badge/Python-3.8+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive Bridge Partnership Bidding Practice System designed to help players improve their bridge auction skills through interactive training sessions.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Development](#development)
- [License](#license)

## Features

- **Interactive Bidding Practice**: Practice bridge auction bidding in a simulated environment
- **User Authentication**: Secure JWT-based authentication system
- **Session Management**: Track and manage practice sessions
- **Real-time Feedback**: Get immediate feedback on bidding decisions
- **Progress Tracking**: Monitor your improvement over time
- **RESTful API**: Well-documented API with interactive documentation

## Tech Stack

### Frontend
- **React** 18.2.0 - Modern UI framework
- **React Scripts** 5.0.1 - Build tooling and configuration

### Backend
- **Django** 5.2.5 - High-level Python web framework
- **Django REST Framework** 3.16.1 - Powerful toolkit for building Web APIs
- **djangorestframework-simplejwt** 5.5.1 - JWT authentication
- **django-cors-headers** 4.7.0 - Cross-Origin Resource Sharing (CORS) support
- **drf-spectacular** 0.28.0 - OpenAPI 3.0 schema generation

### Database
- **SQLite** - Lightweight, file-based database

## Prerequisites

Before running the application, ensure you have:

- **Python** 3.8 or higher - [Download Python](https://www.python.org/downloads/)
- **Node.js** 16 or higher - [Download Node.js](https://nodejs.org/)
- **pip** - Python package manager (included with Python)
- **npm** - Node package manager (included with Node.js)

## Quick Start

### Windows

#### Option 1: Batch Script (Recommended)
```bash
# Double-click start.bat or run in Command Prompt
start.bat
```

#### Option 2: PowerShell
```powershell
# Right-click start.ps1 and select "Run with PowerShell"
# Or run in PowerShell:
.\start.ps1
```

### macOS/Linux

```bash
# Make the script executable (first time only)
chmod +x start.sh

# Run the startup script
./start.sh
```

The application will automatically:
- Set up Python virtual environment
- Install all dependencies
- Initialize the database
- Start both backend and frontend servers
- Open your browser to http://localhost:3000

## Installation

### Manual Installation

#### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Start development server
python manage.py runserver
```

The backend API will be available at http://localhost:8000

#### Frontend Setup

Open a new terminal window:

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

The frontend will be available at http://localhost:3000

## Project Structure

```
CITS5206/
├── backend/                # Django backend application
│   ├── backend/           # Main backend configuration
│   ├── game/              # Game logic and API
│   ├── users/             # User authentication and management
│   ├── manage.py          # Django management script
│   ├── requirements.txt   # Python dependencies
│   └── db.sqlite3        # SQLite database
├── frontend/              # React frontend application
│   ├── src/              # Source files
│   ├── public/           # Static files
│   └── package.json      # Node dependencies
├── doc/                   # Documentation
│   ├── README_DEV.md     # Developer documentation
│   ├── rules.md          # Game rules
│   └── API test reports  # API testing documentation
├── start.bat             # Windows startup script
├── start.ps1             # PowerShell startup script
├── start.sh              # macOS/Linux startup script
└── STARTUP_GUIDE.md      # Detailed startup instructions

```

## API Documentation

The backend provides a comprehensive RESTful API. Once the backend server is running, you can access:

- **Interactive API Documentation**: http://localhost:8000/api/schema/swagger-ui/
- **OpenAPI Schema**: http://localhost:8000/api/schema/

### Main API Endpoints

- `/api/users/` - User management and authentication
- `/api/game/` - Game sessions and bidding logic
- `/api/token/` - JWT token authentication
- `/api/token/refresh/` - Token refresh

For detailed API documentation, refer to `doc/USER_API_TEST_REPORT.md` and `doc/GAME_API_TEST_REPORT.md`.

## Development

### Running Tests

#### Backend Tests
```bash
cd backend
python manage.py test
```

#### Frontend Tests
```bash
cd frontend
npm test
```

### Development Resources

- See `doc/README_DEV.md` for detailed development guidelines
- See `doc/rules.md` for bridge game rules implementation
- Check `STARTUP_GUIDE.md` for troubleshooting common issues

### Environment Setup

First-time setup may take 5-10 minutes as it:
- Creates Python virtual environment
- Installs backend dependencies
- Installs frontend dependencies
- Sets up the database with initial migrations

## Troubleshooting

### Port Already in Use

**Windows:**
```cmd
netstat -ano | findstr :8000
taskkill /PID [PID_NUMBER] /F
```

**macOS/Linux:**
```bash
lsof -i :8000
kill -9 [PID_NUMBER]
```

### Common Issues

- **Python Not Found**: Ensure Python is added to PATH
- **Node.js Not Found**: Restart terminal after Node.js installation
- **Dependencies Failed**: Check internet connection and try again

For more troubleshooting help, see `STARTUP_GUIDE.md`.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Support

For issues, questions, or contributions, please open an issue on the project repository.

---

Copyright (c) 2024 Bridge Auction Trainer
