import React from 'react';
import './SessionManager.css';

function SessionManager({ sessions, onCreateSession, onEnterSession, onViewComparison }) {
  // Simple function to count completed deals
  const countCompletedDeals = (session) => {
    let count = 0;
    for (let i = 0; i < session.deals.length; i++) {
      const deal = session.deals[i];
      if (deal.players) {
        const playerKeys = Object.keys(deal.players);
        if (playerKeys.length === 2) {
          let bothCompleted = true;
          for (let j = 0; j < playerKeys.length; j++) {
            if (!deal.players[playerKeys[j]].completed) {
              bothCompleted = false;
              break;
            }
          }
          if (bothCompleted) {
            count = count + 1;
          }
        }
      }
    }
    return count;
  };

  // Simple function to render session items
  const renderSessionItems = () => {
    if (sessions.length === 0) {
      return (
        <div className="no-sessions">
          <p>No sessions yet. Create your first session!</p>
        </div>
      );
    }

    const sessionItems = [];
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const completedDeals = countCompletedDeals(session);
      
      const sessionItem = (
        <div key={session.id} className="session-item">
          <h3>{session.name}</h3>
          <p><strong>Partner:</strong> {session.partner}</p>
          <p><strong>Created:</strong> {new Date(session.created).toLocaleDateString()}</p>
          <p><strong>Total Deals:</strong> {session.deals.length}</p>
          <p><strong>Completed by Both:</strong> {completedDeals}</p>
          
          <div className="session-actions">
            <button 
              className="create-session" 
              onClick={() => onEnterSession(session)}
            >
              Enter Session
            </button>
            
            {completedDeals > 0 && (
              <button 
                className="create-session comparison-btn" 
                onClick={() => onViewComparison(session)}
              >
                View Comparisons
              </button>
            )}
          </div>
        </div>
      );
      
      sessionItems.push(sessionItem);
    }
    
    return sessionItems;
  };

  return (
    <div className="session-manager">
      <div className="session-header">
        <h2>Bidding Sessions</h2>
        <button className="create-session" onClick={onCreateSession}>
          Create New Session
        </button>
      </div>
      
      <div className="session-list">
        {renderSessionItems()}
      </div>
    </div>
  );
}

export default SessionManager;
