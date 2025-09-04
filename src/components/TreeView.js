import React from 'react';

function TreeView({ session, onBackToGame }) {
  return (
    <div className="tree-view">
      <div className="tree-header">
        <button className="back-btn" onClick={onBackToGame}>
          ← Back to Game
        </button>
        <h2>Auction Tree - {session.name}</h2>
      </div>
      
      <div className="tree-container">
        <h3>Auction Paths</h3>
        <p>Tree visualization will be implemented here.</p>
        <p>This will show the different bidding paths and decisions.</p>
      </div>
    </div>
  );
}

export default TreeView;
