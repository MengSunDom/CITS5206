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
    setLoading(false);
  };

  return (
    <div
      className="login-page"
      style={{
        background: `url('/images/bridge-bg2.jpg') center center/cover no-repeat`,
        minHeight: '100vh'
      }}
    >
      <div className="login-center-container">
        <div className="login-header">
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
  );
}

export default LoginPage;
