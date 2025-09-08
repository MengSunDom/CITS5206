import React, { useState } from 'react';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import BridgeGame from './components/BridgeGame';
import { logout as apiLogout } from './utils/api';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');

  // Handle login
  const handleLogin = (user) => {
    setCurrentUser(user);
    setCurrentView('game');
  };

  // Handle signup
  const handleSignup = (user) => {
    setCurrentUser(user);
    setCurrentView('game');
  };

  // Handle logout with backend API
  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    setCurrentUser(null);
    setCurrentView('login');
  };

  // Simple function to show signup page
  const showSignup = () => {
    setCurrentView('signup');
  };

  // Simple function to show login page
  const showLogin = () => {
    setCurrentView('login');
  };

  // Check if user is already logged in when page loads
  React.useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const accessToken = localStorage.getItem('access_token');
    
    if (savedUser && accessToken) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      setCurrentView('game');
    }
  }, []);

  return (
    <div className="App">
      {currentView === 'login' && (
        <LoginPage onLogin={handleLogin} onShowSignup={showSignup} />
      )}
      
      {currentView === 'signup' && (
        <SignupPage onSignup={handleSignup} onShowLogin={showLogin} />
      )}
      
      {currentView === 'game' && currentUser && (
        <BridgeGame 
          currentUser={currentUser} 
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

export default App;
