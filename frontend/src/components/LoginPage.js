import React, { useState } from 'react';
import './LoginPage.css';

function LoginPage({ onLogin, onShowSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle form submission with backend API
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/auth/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: password
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store tokens in localStorage
        if (data.tokens) {
          localStorage.setItem('access_token', data.tokens.access);
          localStorage.setItem('refresh_token', data.tokens.refresh);
        }
        
        // Store user data
        const userData = {
          id: data.user.id,
          username: data.user.username,
          email: data.user.email
        };
        localStorage.setItem('user', JSON.stringify(userData));
        
        onLogin(userData);
      } else {
        // Handle error messages from backend
        setError(data.detail || 'Invalid username or password. Please try again.');
      }
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
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
              <label>Email:</label>
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
            
            <div className="login-actions">
              <span>
                Don't have an account?{' '}
                <a href="#" className="signup-link" onClick={onShowSignup}>
                  Sign Up now
                </a>
              </span>
              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? 'LOGGING IN...' : 'LOGIN'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
