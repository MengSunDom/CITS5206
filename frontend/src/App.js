import React, { useState } from 'react';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import BridgeGame from './components/BridgeGame';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');

  // Simple function to handle login
  const handleLogin = (user) => {
    setCurrentUser(user);
    setCurrentView('game');
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  // Simple function to handle signup
  const handleSignup = (user) => {
    setCurrentUser(user);
    setCurrentView('game');
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  // Simple function to handle logout
  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('login');
    localStorage.removeItem('currentUser');
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
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
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
