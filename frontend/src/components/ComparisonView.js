import React from 'react';

function ComparisonView({ session, onBackToSessions }) {
  return (
    <div className="comparison-view">
      <div className="comparison-header">
        <button className="back-btn" onClick={onBackToSessions}>
          ← Back to Sessions
        </button>
        <h2>Auction Comparisons - {session.name}</h2>
      </div>
      
      <div className="comparison-content">
        <h3>Completed Games</h3>
        <p>Comparison view will be implemented here.</p>
        <p>This will show side-by-side comparisons of partner auctions.</p>
      </div>
    </div>
  );
}

export default ComparisonView;
