import React, { useState } from 'react';
import SessionManager from './SessionManager';
import GameArea from './GameArea';
import TreeView from './TreeView';
import ComparisonView from './ComparisonView';
import CreateSessionModal from './CreateSessionModal';
import './BridgeGame.css';

function BridgeGame({ currentUser, onLogout }) {
  const [currentView, setCurrentView] = useState('sessions');
  const [currentSession, setCurrentSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Load sessions when component first loads
  React.useEffect(() => {
    const savedSessions = localStorage.getItem('bridgeSessions');
    if (savedSessions) {
      const sessionsList = JSON.parse(savedSessions);
      setSessions(sessionsList);
    }
  }, []);

  // Simple function to create a new session
  const createSession = (sessionData) => {
    const newSession = {
      id: Date.now(),
      name: sessionData.name,
      partner: sessionData.partner,
      created: new Date().toISOString(),
      deals: []
    };
    
    const newSessionsList = [...sessions, newSession];
    setSessions(newSessionsList);
    localStorage.setItem('bridgeSessions', JSON.stringify(newSessionsList));
    setShowCreateModal(false);
  };

  // Simple function to enter a session
  const enterSession = (session) => {
    setCurrentSession(session);
    setCurrentView('game');
  };

  // Simple function to go back to sessions
  const backToSessions = () => {
    setCurrentView('sessions');
    setCurrentSession(null);
  };

  // Simple function to show tree view
  const showTreeView = () => {
    setCurrentView('tree');
  };

  // Simple function to hide tree view
  const hideTreeView = () => {
    setCurrentView('game');
  };

  // Simple function to show comparison view
  const showComparisonView = (session) => {
    setCurrentSession(session);
    setCurrentView('comparison');
  };

  // Simple function to update session
  const updateSession = (updatedSession) => {
    const newSessionsList = [];
    for (let i = 0; i < sessions.length; i++) {
      if (sessions[i].id === updatedSession.id) {
        newSessionsList.push(updatedSession);
      } else {
        newSessionsList.push(sessions[i]);
      }
    }
    
    setSessions(newSessionsList);
    setCurrentSession(updatedSession);
    localStorage.setItem('bridgeSessions', JSON.stringify(newSessionsList));
  };

  return (
    <div className="bridge-game">
      <div className="header">
        <h1>Bridge Auction Trainer</h1>
        <p>Partnership Bidding Practice System</p>
        <div className="user-info">
          <span>Welcome, {currentUser.username}!</span>
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </div>

      {currentView === 'sessions' && (
        <SessionManager
          sessions={sessions}
          onCreateSession={() => setShowCreateModal(true)}
          onEnterSession={enterSession}
          onViewComparison={showComparisonView}
        />
      )}

      {currentView === 'game' && currentSession && (
        <GameArea
          session={currentSession}
          onBackToSessions={backToSessions}
          onShowTreeView={showTreeView}
          onUpdateSession={updateSession}
        />
      )}

      {currentView === 'tree' && currentSession && (
        <TreeView
          session={currentSession}
          onBackToGame={hideTreeView}
        />
      )}

      {currentView === 'comparison' && currentSession && (
        <ComparisonView
          session={currentSession}
          onBackToSessions={backToSessions}
        />
      )}

      {showCreateModal && (
        <CreateSessionModal
          onClose={() => setShowCreateModal(false)}
          onCreateSession={createSession}
        />
      )}
    </div>
  );
}

export default BridgeGame;
