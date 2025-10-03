import React, { useState } from 'react';
import SessionManagerConnected from './SessionManagerConnected';
import GameAreaConnected from './GameAreaConnected';
import TreeView from './TreeView';
import ComparisonView from './ComparisonView';
import MyProgressView from './MyProgressView';
import './BridgeGame.css';

function BridgeGame({ currentUser, onLogout }) {
  const [currentView, setCurrentView] = useState('sessions');
  const [currentSession, setCurrentSession] = useState(null);
  const [currentDealIndex, setCurrentDealIndex] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [reloadTimestamp, setReloadTimestamp] = useState(null); // Timestamp to trigger one-time reload

  // Load sessions when component first loads
  React.useEffect(() => {
    const savedSessions = localStorage.getItem('bridgeSessions');
    if (savedSessions) {
      const sessionsList = JSON.parse(savedSessions);
      setSessions(sessionsList);
    }
  }, []);

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

  // Simple function to show comparison view (shows auction tree)
  const showComparisonView = (session) => {
    setCurrentSession(session);
    setCurrentView('tree');
  };

  // Simple function to show progress view
  const showProgressView = (dealIndex) => {
    setCurrentDealIndex(dealIndex);
    setCurrentView('progress');
  };

  // Simple function to hide progress view
  const hideProgressView = (shouldReload = false) => {
    // Handle case where shouldReload might be an event object
    const needsReload = shouldReload === true;

    if (needsReload) {
      setReloadTimestamp(Date.now()); // Set timestamp to trigger reload
    } else {
      setReloadTimestamp(null); // Clear timestamp - no reload needed
    }
    setCurrentView('game');
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
        <SessionManagerConnected
          onEnterSession={enterSession}
          onViewComparison={showComparisonView}
        />
      )}

      {currentView === 'game' && currentSession && (
        <GameAreaConnected
          session={currentSession}
          onBackToSessions={backToSessions}
          onShowTreeView={showTreeView}
          onShowProgressView={showProgressView}
          onUpdateSession={updateSession}
          reloadTimestamp={reloadTimestamp}
          onReloadComplete={() => setReloadTimestamp(null)}
          initialDealNumber={currentDealIndex}
          onDealChange={(dealNumber) => setCurrentDealIndex(dealNumber)}
        />
      )}

      {currentView === 'tree' && currentSession && (
        <TreeView
          session={currentSession}
          onBackToGame={backToSessions}
        />
      )}

      {currentView === 'comparison' && currentSession && (
        <ComparisonView
          session={currentSession}
          onBackToSessions={backToSessions}
        />
      )}

      {currentView === 'progress' && currentSession && currentDealIndex && (
        <MyProgressView
          session={currentSession}
          dealIndex={currentDealIndex}
          onBackToGame={hideProgressView}
        />
      )}

    </div>
  );
}

export default BridgeGame;
