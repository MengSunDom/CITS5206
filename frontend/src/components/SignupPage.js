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
              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? 'SIGNING UP...' : 'SIGN UP'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
