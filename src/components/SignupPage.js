import React, { useState } from 'react';
import './LoginPage.css'; // Reusing the same styles

function SignupPage({ onSignup, onShowLogin }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  // Simple function to handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!username || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match!');
      return;
    }

    // Check if username already exists
    const savedUsers = localStorage.getItem('bridgeUsers');
    let users = [];
    if (savedUsers) {
      users = JSON.parse(savedUsers);
    }
    
    let usernameExists = false;
    for (let i = 0; i < users.length; i++) {
      if (users[i].username === username) {
        usernameExists = true;
        break;
      }
    }
    
    if (usernameExists) {
      setError('Username already exists! Please choose a different username.');
      return;
    }

    // Create new user
    const newUser = {
      id: Date.now(),
      username: username,
      email: email,
      password: password,
      created: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem('bridgeUsers', JSON.stringify(users));
    
    onSignup(newUser);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-left">
          <div className="login-nav">
            <a href="#home">Home</a>
            <a href="#" onClick={onShowLogin}>Back to Login</a>
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
          
          <h1 className="login-title">CREATE NEW ACCOUNT</h1>
          
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
              <label>Email Address:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email"
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
            
            <div className="form-group">
              <label>Confirm Password:</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
              />
            </div>
            
            <div className="login-actions">
              <span>
                Already have an account?{' '}
                <a href="#" className="signup-link" onClick={onShowLogin}>
                  Login here
                </a>
              </span>
              <button type="submit" className="login-btn">SIGN UP</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
