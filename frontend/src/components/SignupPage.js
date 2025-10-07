import React, { useState } from 'react';
import './LoginPage.css'; // Reusing the same styles

function SignupPage({ onSignup, onShowLogin }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle form submission with backend API
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match!');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/auth/register/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          email: email,
          password: password,
          password2: confirmPassword
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
        
        onSignup(userData);
      } else {
        // Handle specific error messages from backend
        if (data.username) {
          setError(data.username[0]);
        } else if (data.email) {
          setError(data.email[0]);
        } else if (data.password) {
          setError(data.password[0]);
        } else {
          setError(data.detail || 'Registration failed. Please try again.');
        }
      }
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-page"
      style={{
        background: `url('/images/bridge-bg3.jpg') center center/cover no-repeat`,
        minHeight: '100vh'
      }}
    >
      <div className="login-center-container">
        <div className="login-header">
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
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'SIGNING UP...' : 'SIGN UP'}
            </button>
          </div>
        </form>
        <button
          type="button"
          className="back-btn"
          onClick={onShowLogin}
          style={{ marginTop: '24px', marginBottom: '20px' }}
        >
          &larr; Back to Login Page
        </button>
      </div>
    </div>
  );
}

export default SignupPage;
