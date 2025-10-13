import React, { useEffect } from 'react';
import { sessionService } from '../utils/gameService';
import { validateCall, getAuctionState } from '../utils/bridgeUtils';
import { useGameState } from '../hooks/useGameState';
import { useDealLoader } from '../hooks/useDealLoader';
import BridgeTable from './BridgeTable';
import AuctionHistory from './AuctionHistory';
import BiddingControls from './BiddingControls';
import './GameArea.css';

/**
 * GameAreaConnected component - Main game area
 * Refactored for better separation of concerns and lower coupling
 */
function GameAreaConnected({
  session,
  onBackToSessions,
  onShowProgressView,
  reloadTimestamp,
  onReloadComplete,
  initialDealNumber,
  onDealChange
}) {
  // Use custom hooks for state management
  const state = useGameState();
  const {
    currentDeal,
    currentDealNumber,
    currentBiddingPosition,
    userPosition,
    userSequence,
    alertText,
    isLoading,
    error,
    isSyncing,
    lastSyncTime,
    viewMode,
    dealHistory,
    currentHistoryIndex,
    taskReason,
    isAllCompleted,
    currentHistory,
    setUserPosition,
    setError,
    setIsLoading,
    setAlertText,
    setUserSequence,
    setViewMode,
    setDealHistory,
    setCurrentHistoryIndex,
    setCurrentDeal,
    setCurrentDealNumber,
    totalDeals
  } = state;

  // Use custom hook for deal loading
  const { loadNextPractice, loadSpecificDeal, reloadCurrentDeal, loadDealHistory } = useDealLoader(
    session,
    state,
    onDealChange
  );

  /**
   * Initialize user position and load initial deal
   */
  useEffect(() => {
    // Get user's actual position from session
    if (session.player_games) {
      const currentUserGame = session.player_games.find(
        (pg) =>
          pg.player.email === localStorage.getItem('userEmail') ||
          pg.player.username === JSON.parse(localStorage.getItem('user') || '{}').username
      );
      if (currentUserGame) {
        setUserPosition(currentUserGame.position);
      }
    }

    // Load initial deal
    if (initialDealNumber) {
      loadSpecificDeal(initialDealNumber);
    } else {
      loadNextPractice();
    }
  }, [session.id]);

  /**
   * Handle reload when reloadTimestamp changes
   */
  useEffect(() => {
    if (reloadTimestamp && onReloadComplete) {
      reloadCurrentDeal(currentDealNumber).then(() => {
        onReloadComplete();
      });
    }
  }, [reloadTimestamp]);

  /**
   * Handle undo bid
   */
  const handleUndoBid = async () => {
    if (!session || !session.id) {
      console.error('session is missing, cannot undo bid');
      setError('Session not found');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const response = await sessionService.globalUndo(session.id);

      if (response.error) {
        setError(response.error);
        return;
      }

      if (response.ok) {
        const deletedCount = response.deleted_response_count;
        const dealNumber = response.affected_deal;
        const message = `Undid ${deletedCount} response(s) in Deal ${dealNumber}`;
        console.log(message);

        // Load next task
        if (response.next_action) {
          if (response.next_action.node_id) {
            loadNextPractice();
          } else {
            state.setIsAllCompleted(true);
            setError('INFO:All deals in this session are completed.');
            loadNextPractice();
          }
        } else {
          loadNextPractice();
        }
      }
    } catch (error) {
      console.error('undo bid error:', error);
      setError('Failed to undo bid: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle making a call (bid, pass, double, redouble)
   */
  const handleMakeCall = async (call) => {
    if (!currentDeal) return;

    // Validate the call before sending to backend
    const auctionState = getAuctionState(userSequence, currentDeal.dealer);
    const validation = validateCall(auctionState, call, currentBiddingPosition);

    if (!validation.ok) {
      setError(validation.error);
      setTimeout(() => setError(''), 3000);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await sessionService.makeUserCall(
        session.id,
        currentDeal.id,
        currentBiddingPosition,
        call,
        alertText,
        currentHistory
      );

      if (response.error) {
        setError(response.error);
      } else {
        setUserSequence(response.user_sequence.sequence);
        setAlertText('');

        // If auction is complete, load next task immediately
        if (response.auction_complete) {
          loadNextPractice();
        } else {
          // Delay before auto-transition
          setTimeout(() => {
            loadNextPractice();
          }, 1000);
        }
      }
    } catch (err) {
      setError('Failed to make call. Please try again.');
      console.error('Call error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Navigate through deal history
   */
  const navigateHistory = (direction) => {
    if (dealHistory.length === 0) return;

    let newIndex = currentHistoryIndex;
    if (direction === 'next' && currentHistoryIndex < dealHistory.length - 1) {
      newIndex = currentHistoryIndex + 1;
    } else if (direction === 'prev' && currentHistoryIndex > 0) {
      newIndex = currentHistoryIndex - 1;
    }

    if (newIndex !== currentHistoryIndex) {
      setCurrentHistoryIndex(newIndex);
      const deal = dealHistory[newIndex];
      setCurrentDeal(deal);
      setCurrentDealNumber(deal.deal_number);
      setUserSequence(deal.sequence);
    }
  };

  /**
   * Return to practice mode from history
   */
  const returnToPractice = () => {
    setViewMode('practice');
    setDealHistory([]);
    setCurrentHistoryIndex(0);
    loadNextPractice();
  };

  /**
   * Render task reason badge
   */
  const renderTaskReason = () => {
    // Task reason display disabled
    return null;
  };

  /**
   * Render error message
   */
  const renderError = () => {
    if (!error) return null;

    return (
      <div
        className="error-message"
        style={{
          color: error.startsWith('COMPLETION:') ? 'white' : 'white',
          backgroundColor: error.startsWith('COMPLETION:') ? '#28a745' : '#dc3545',
          padding: '15px',
          borderRadius: '5px',
          fontWeight: 'bold',
          textAlign: 'center',
          margin: '10px 20px',
          fontSize: '16px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          animation: 'slideDown 0.3s ease-in-out'
        }}
      >
        {error.startsWith('COMPLETION:') ? '✅ ' + error.replace('COMPLETION:', '') : `⚠️ ${error}`}
      </div>
    );
  };

  // Loading state
  if (isLoading && !currentDeal) {
    return <div className="loading">Loading deal...</div>;
  }

  return (
    <div className="game-area">
      {/* Header */}
      <div className="game-header">
        <button className="back-btn" onClick={onBackToSessions}>
          ← Back to Sessions
        </button>

        <h2>
          {session.name} {viewMode === 'history' ? '- History Review' : ''}
        </h2>

        <div className="sync-status">
          {isSyncing && <span>Syncing...</span>}
          {!isSyncing && lastSyncTime && (
            <span>✓ Synced {Math.floor((new Date() - lastSyncTime) / 1000)}s ago</span>
          )}
        </div>
      </div>

      {/* Task reason badge */}
      {renderTaskReason()}

      {/* Progress button */}
      {currentDealNumber && onShowProgressView && (
        <div className="progress-section">
          <button
            className="progress-btn"
            onClick={() => onShowProgressView(currentDealNumber)}
            disabled={isAllCompleted}
            style={{
              opacity: isAllCompleted ? 0.5 : 1,
              cursor: isAllCompleted ? 'not-allowed' : 'pointer'
            }}
          >
            My Progress
          </button>
        </div>
      )}

      {/* Error message */}
      {renderError()}

      {/* Game info cards */}
      <div className="game-info">
        <div className="info-card">
          <h3>Dealer</h3>
          <div className="value">{currentDeal?.dealer || '-'}</div>
        </div>
        <div className="info-card">
          <h3>Vulnerability</h3>
          <div className="value">{currentDeal?.vulnerability || '-'}</div>
        </div>
        <div className="info-card">
          <h3>Bidding As</h3>
          <div className="value">{currentBiddingPosition || '-'}</div>
        </div>
      </div>

      {/* Bridge table */}
      <BridgeTable
        currentDeal={currentDeal}
        currentBiddingPosition={currentBiddingPosition}
        userPosition={userPosition}
        viewMode={viewMode}
      />

      {/* Bidding area */}
      <div className="bidding-area">
        <div className="auction-history">
          <h3>Auction History</h3>
          <AuctionHistory userSequence={userSequence} dealer={currentDeal?.dealer} />
        </div>

        <div className="bid-controls">
          <BiddingControls
            currentDeal={currentDeal}
            currentBiddingPosition={currentBiddingPosition}
            userSequence={userSequence}
            alertText={alertText}
            setAlertText={setAlertText}
            isLoading={isLoading}
            isAllCompleted={isAllCompleted}
            viewMode={viewMode}
            currentDealNumber={currentDealNumber}
            onMakeCall={handleMakeCall}
            onUndo={handleUndoBid}
          />
        </div>
      </div>

      {/* Game controls */}
      <div className="game-controls">
        {viewMode === 'practice' ? (
          <button
            className="create-session"
            onClick={loadDealHistory}
            disabled={isLoading}
            style={{ padding: '10px 20px' }}
          >
            View History
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="create-session"
              onClick={() => navigateHistory('prev')}
              disabled={currentHistoryIndex === 0 || isLoading}
              style={{ padding: '10px 20px' }}
            >
              ← Previous
            </button>
            <span style={{ padding: '10px', alignSelf: 'center' }}>
              Deal {currentHistoryIndex + 1} of {dealHistory.length}
            </span>
            <button
              className="create-session"
              onClick={() => navigateHistory('next')}
              disabled={currentHistoryIndex >= dealHistory.length - 1 || isLoading}
              style={{ padding: '10px 20px' }}
            >
              Next →
            </button>
            <button
              className="create-session"
              onClick={returnToPractice}
              disabled={isLoading}
              style={{ padding: '10px 20px', background: '#00d4ff' }}
            >
              ↩ Back to Practice
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default GameAreaConnected;
