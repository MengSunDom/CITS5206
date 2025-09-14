import React, { useState } from 'react';
import { sessionService } from '../utils/gameService';

function CreateSessionModalConnected({ onClose, onSessionCreated }) {
  const [sessionName, setSessionName] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const sessionData = {
        name: sessionName,
        partnerEmail: partnerEmail,
      };

      const response = await sessionService.createSession(sessionData);

      if (response.error) {
        setError(response.error);
      } else {
        onSessionCreated(response);
        onClose();
      }
    } catch (err) {
      setError('Failed to create session. Please try again.');
      console.error('Session creation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <span className="close" onClick={onClose}>&times;</span>
        <h2>Create New Bidding Session</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="sessionName">Session Name:</label>
            <input
              type="text"
              id="sessionName"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g., John and Jane - ACOL System"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="partnerEmail">Partner Email:</label>
            <input
              type="email"
              id="partnerEmail"
              value={partnerEmail}
              onChange={(e) => setPartnerEmail(e.target.value)}
              placeholder="partner@example.com"
              required
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="error-message" style={{ color: 'red', marginBottom: '10px' }}>
              {error}
            </div>
          )}

          <div className="button-group" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" className="create-session" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Session'}
            </button>
            <button
              type="button"
              className="create-session"
              style={{ background: '#6c757d' }}
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateSessionModalConnected;