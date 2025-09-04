import React, { useState } from 'react';
import './LoginPage.css';

function LoginPage({ onLogin, onShowSignup }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Simple function to handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    // Check if user exists in localStorage
    const savedUsers = localStorage.getItem('bridgeUsers');
    if (!savedUsers) {
      setError('Invalid username or password. Please try again or sign up.');
      return;
    }

    const users = JSON.parse(savedUsers);
    let userFound = false;
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      if (user.username === username && user.password === password) {
        userFound = true;
        onLogin(user);
        break;
      }
    }
    
    if (!userFound) {
      setError('Invalid username or password. Please try again or sign up.');
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-left">
          <div className="login-nav">
            <a href="#home">Home</a>
            <a href="#about">About Us</a>
            <a href="#help">Help</a>
          </div>
          <div className="login-background">
            <div className="contact-info">
              <div className="contact-item">
                <span className="contact-icon">📞</span>
                <span>+123-456-7890</span>
              </div>
              <div className="contact-item">
                <span className="contact-icon">🌐</span>
                <span>www.reallygreatsite.com</span>
              </div>
              <div className="contact-item">
                <span className="contact-icon">✉️</span>
                <span>hello@reallygreatsite.com</span>
              </div>
              <div className="contact-item">
                <span className="contact-icon">🏠</span>
                <span>123 Anywhere St., Any City</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="login-right">
          <div className="login-header">
            <span className="logo">G</span>
            <span>Bridge partnership system</span>
          </div>
          
          <h1 className="login-title">LOGIN TO YOUR ACCOUNT</h1>
          
          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="error-message">{error}</div>}
            
            <div className="form-group">
              <label>Username:</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Password:</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>
            
            <div className="login-actions">
              <span>
                Don't have an account?{' '}
                <a href="#" className="signup-link" onClick={onShowSignup}>
                  Sign Up now
                </a>
              </span>
              <button type="submit" className="login-btn">LOGIN</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
