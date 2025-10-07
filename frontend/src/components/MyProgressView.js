import React, { useState, useEffect } from 'react';
import { sessionService } from '../utils/gameService';
import './MyProgressView.css';

function MyProgressView({ session, dealIndex, onBackToGame }) {
  const [progressData, setProgressData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRewindModal, setShowRewindModal] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [rewindLoading, setRewindLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Load current user from localStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setCurrentUser(user);
  }, []);

  useEffect(() => {
    if (session && session.id && dealIndex) {
      loadProgress();
    }
  }, [session, dealIndex]);

  const loadProgress = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await sessionService.fetchMyProgress(session.id, dealIndex);
      setProgressData(data);
    } catch (err) {
      console.error('Failed to load progress:', err);
      setError('Failed to load your progress');
    } finally {
      setLoading(false);
    }
  };

  const handleRewindClick = (node) => {
    setSelectedNode(node);
    setShowRewindModal(true);
  };

  const handleRewindConfirm = async () => {
    if (!selectedNode) return;

    try {
      setRewindLoading(true);
      const result = await sessionService.rewindToNode(
        session.id,
        dealIndex,
        selectedNode.node_id
      );

      if (result.ok) {
        // Build success message with recomputation statistics
        const stats = result.recompute_stats || {};
        const messages = [
          `Successfully rewound to node.`,
          `${result.deleted_response_count || 0} answer(s) deleted.`,
        ];

        // Add interesting stats if available
        if (stats.nodes_reopened > 0) {
          messages.push(`${stats.nodes_reopened} branch(es) reopened.`);
        }
        if (stats.divergences_changed > 0) {
          messages.push(`${stats.divergences_changed} divergence(s) updated.`);
        }

        // Show next action
        if (result.next_action) {
          if (result.next_action.node_id) {
            messages.push(`\nNext: ${result.next_action.scheduler_reason || 'Continue bidding'}`);
          } else {
            messages.push(`\n${result.next_action.message || 'All caught up!'}`);
          }
        }

        alert(messages.join('\n'));

        // Navigate back to game to continue bidding
        // The game will reload with the updated sequence
        onBackToGame(true); // Pass true to indicate reload is needed
      } else {
        alert('Failed to rewind: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Rewind error:', err);
      alert('Failed to rewind: ' + err.message);
    } finally {
      setRewindLoading(false);
      setShowRewindModal(false);
      setSelectedNode(null);
    }
  };

  const handleRewindCancel = () => {
    setShowRewindModal(false);
    setSelectedNode(null);
  };

  if (loading) {
    return (
      <div className="progress-page">
        <div className="progress-header">
          <h1>My Progress - Loading...</h1>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="progress-page">
        <div className="progress-header">
          <h1>My Progress</h1>
        </div>
        <div className="error-message">{error}</div>
        <button onClick={() => onBackToGame()} className="back-btn">Back to Game</button>
      </div>
    );
  }

  if (!progressData || !progressData.nodes || progressData.nodes.length === 0) {
    return (
      <div className="progress-page">
        <div className="progress-header">
          <h1>My Progress</h1>
          <button onClick={() => onBackToGame()} className="back-btn">Back to Game</button>
        </div>
        <div className="empty-state">
          <p>No answers yet. Make your first call to start your path.</p>
        </div>
      </div>
    );
  }

  const { nodes, current_node_id, dealer, vul } = progressData;

  return (
    <div className="progress-page">
      <div className="progress-header">
        <h1>My Progress - Current Deal</h1>
        <div className="deal-info">
          <span>Dealer: {dealer}</span>
          <span>Vulnerability: {vul}</span>
        </div>
        <button onClick={() => onBackToGame()} className="back-btn">Back to Game</button>
      </div>

      <div className="progress-container">
        <div className="timeline-section">
          <h2>Timeline</h2>
          <div className="timeline">
            {nodes.map((node, index) => {
              const isCurrent = node.node_id === current_node_id;
              const canRewind = index > 0 && index < nodes.length - 1;
              const isAtCurrentNode = node.node_id === current_node_id;

              // Determine who_needs class based on current user perspective
              // Pink = current user needs, Light-blue = partner needs
              let whoNeedsClass = '';
              if (node.who_needs === 'both') {
                whoNeedsClass = 'who-needs-both';
              } else if (node.who_needs === 'none') {
                whoNeedsClass = 'who-needs-none';
              } else if (node.who_needs === 'creator') {
                whoNeedsClass = currentUser?.id === session?.creator?.id ? 'who-needs-me' : 'who-needs-partner-user';
              } else if (node.who_needs === 'partner') {
                whoNeedsClass = currentUser?.id === session?.partner?.id ? 'who-needs-me' : 'who-needs-partner-user';
              }

              return (
                <div
                  key={node.node_id}
                  className={`timeline-node ${isCurrent ? 'timeline-node--current' : ''} ${
                    node.is_terminal ? 'timeline-node--terminal' : ''
                  } ${whoNeedsClass}`}
                >
                  <div className="timeline-node-marker">{index}</div>
                  <div className="timeline-node-content">
                    <div className="node-header">
                      <span className="node-seat">Seat: {node.seat}</span>
                      {node.your_call && (
                        <span className="node-call">Call: {node.your_call}</span>
                      )}
                    </div>
                    <div className="node-history">
                      History: {node.history || '(Start)'}
                    </div>
                    {node.created_at && (
                      <div className="node-time">
                        {new Date(node.created_at).toLocaleString()}
                      </div>
                    )}
                    {canRewind && (
                      <button
                        onClick={() => handleRewindClick(node)}
                        className="rewind-btn"
                        disabled={isAtCurrentNode}
                        title={isAtCurrentNode ? "You're here already" : "Rewind to this node"}
                      >
                        Rewind
                      </button>
                    )}
                    {isAtCurrentNode && (
                      <span className="current-badge">You're here</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        

       
      </div>
      

      {showRewindModal && (
        <div className="modal-overlay" onClick={handleRewindCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Rewind to this node?</h2>
            <div className="modal-body">
              <p>
                You will <strong>delete all your answers after this node</strong> on this branch.
              </p>
              <p>The system will automatically:</p>
              <ul style={{ textAlign: 'left', paddingLeft: '20px' }}>
                <li>Recompute divergences and tree structure</li>
                <li>Update node states (open/closed)</li>
                <li>Recalculate which nodes need answers</li>
                <li>Assign you the next task via the scheduler</li>
              </ul>
              <p><em>This does not affect your partner's answers.</em></p>
            </div>
            <div className="modal-actions">
              <button
                onClick={handleRewindCancel}
                className="modal-btn cancel-btn"
                disabled={rewindLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleRewindConfirm}
                className="modal-btn confirm-btn"
                disabled={rewindLoading}
              >
                {rewindLoading ? 'Rewinding...' : 'Rewind'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyProgressView;
