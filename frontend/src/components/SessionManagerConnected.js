import React, { useState, useEffect } from 'react';
import { sessionService } from '../utils/gameService';
import CreateSessionModalConnected from './CreateSessionModalConnected';
import './SessionManager.css';

function SessionManagerConnected({ onEnterSession, onViewComparison, onShowTreeView }) {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const data = await sessionService.getSessions();
      setSessions(data.results || data);
      setError('');
    } catch (err) {
      setError('Failed to load sessions');
      console.error('Load sessions error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSessionCreated = (newSession) => {
    setSessions(prevSessions => [newSession, ...prevSessions]);
  };

  const handleDeleteSession = async (sessionId) => {
    if (window.confirm('Are you sure you want to delete this session?')) {
      try {
        await sessionService.deleteSession(sessionId);
        setSessions(prevSessions => prevSessions.filter(s => s.id !== sessionId));
      } catch (err) {
        setError('Failed to delete session');
        console.error('Delete session error:', err);
      }
    }
  };

  const countCompletedBids = (session) => {
    if (!session.player_games) return 0;

    const completedCount = session.player_games.filter(pg =>
      pg.bidding_history && pg.bidding_history.length > 0
    ).length;

    return completedCount;
  };

  const renderSessionItems = () => {
    if (isLoading) {
      return <div className="loading">Loading sessions...</div>;
    }

    if (error) {
      return <div className="error">{error}</div>;
    }

    if (sessions.length === 0) {
      return (
        <div className="no-sessions">
          <p>No sessions yet. Create your first session!</p>
        </div>
      );
    }

    return sessions.map(session => {
      const completedBids = countCompletedBids(session);

      return (
        <div key={session.id} className="session-item">
          <h3>{session.name}</h3>
          <p><strong>Partner:</strong> {session.partner?.email || session.partner?.username}</p>
          <p><strong>Created:</strong> {new Date(session.create_at).toLocaleDateString()}</p>
          <p><strong>Dealer:</strong> {session.dealer}</p>
          <p><strong>Vulnerability:</strong> {session.vulnerability}</p>
          <p><strong>Players with bids:</strong> {completedBids}</p>

          <div className="session-actions">
            <button
              className="create-session"
              onClick={() => onEnterSession(session)}
            >
              Enter Session
            </button>
            <button
              className="create-session tree-btn"
              onClick={() => onShowTreeView(session)}
            >
              View Auction Tree
            </button>
            {completedBids >= 2 && (
              <button
                className="create-session comparison-btn"
                onClick={() => onViewComparison(session)}
              >
                View Comparison
              </button>
            )}
            <button
              className="create-session"
              style={{ background: '#dc3545' }}
              onClick={() => handleDeleteSession(session.id)}
            >
              Delete
            </button>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="session-manager">
      <div className="session-header">
        <h2>Your Bidding Sessions</h2>
        <button
          className="create-session"
          onClick={() => setShowCreateModal(true)}
        >
          Create New Session
        </button>
      </div>

      <div className="session-list">
        {renderSessionItems()}
      </div>

      {showCreateModal && (
        <CreateSessionModalConnected
          onClose={() => setShowCreateModal(false)}
          onSessionCreated={handleSessionCreated}
        />
      )}
    </div>
  );
}

export default SessionManagerConnected;