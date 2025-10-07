import React from 'react';
import { getSuitSymbol, validateCall, getAuctionState } from '../utils/bridgeUtils';

/**
 * BiddingControls component - displays bidding buttons and controls
 * Separates bidding UI from game logic
 */
const BiddingControls = ({
  currentDeal,
  currentBiddingPosition,
  userSequence,
  alertText,
  setAlertText,
  isLoading,
  isAllCompleted,
  viewMode,
  currentDealNumber,
  onMakeCall,
  onUndo
}) => {
  /**
   * Check if a bid is legal
   */
  const isLegalBid = (bid) => {
    const auctionState = getAuctionState(userSequence, currentDeal?.dealer);
    const validation = validateCall(auctionState, bid, currentBiddingPosition);
    return validation.ok;
  };

  /**
   * Render bid buttons grid
   */
  const renderBidButtons = () => {
    const levels = ['1', '2', '3', '4', '5', '6', '7'];
    const suits = ['C', 'D', 'H', 'S', 'NT'];

    return (
      <div className="bid-buttons">
        {levels.map(level => (
          <div key={level} className="bid-row">
            {suits.map(suit => {
              const bid = level + suit;
              const isLegal = isLegalBid(bid);

              return (
                <button
                  key={bid}
                  className={`bid-button suit-${suit === 'NT' ? 'nt' : suit.toLowerCase()} ${isLegal ? 'legal' : 'illegal'}`}
                  onClick={() => onMakeCall(bid)}
                  disabled={!isLegal || isLoading || getAuctionState(userSequence, currentDeal?.dealer).auctionEnded || isAllCompleted}
                >
                  <div className="bid-content">
                    <span className="bid-level">{level}</span>
                    <span className="bid-suit">{getSuitSymbol(suit)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // History mode view
  if (viewMode === 'history') {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h3>Reviewing Completed Deal #{currentDealNumber}</h3>
        <p style={{ color: '#666', marginTop: '10px' }}>
          This deal has been completed. Use the navigation buttons below to browse through your history.
        </p>
      </div>
    );
  }

  // Practice mode view
  return (
    <>
      <h3>Make Your Call (Position: {currentBiddingPosition})</h3>
      {renderBidButtons()}

      {/* Special calls */}
      <div className="special-calls">
        <button
          className="special-call pass-btn"
          onClick={() => onMakeCall('Pass')}
          disabled={isLoading || getAuctionState(userSequence, currentDeal?.dealer).auctionEnded || isAllCompleted}
        >
          Pass
        </button>
        <button
          className="special-call double-btn"
          onClick={() => onMakeCall('X')}
          disabled={isLoading || !isLegalBid('X') || isAllCompleted}
        >
          Double (X)
        </button>
        <button
          className="special-call redouble-btn"
          onClick={() => onMakeCall('XX')}
          disabled={isLoading || !isLegalBid('XX') || isAllCompleted}
        >
          Redouble (XX)
        </button>
      </div>

      {/* Undo button */}
      <div className="special-calls">
        <button
          className="special-call"
          onClick={onUndo}
          disabled={isLoading || isAllCompleted}
          style={{ backgroundColor: '#ff9800' }}
          title="Undo your most recent response (any deal)"
        >
          Undo Last Bid
        </button>
      </div>

      {/* Alert input */}
      <div className="alert-section">
        <label htmlFor="alertText">Alert (optional):</label>
        <input
          type="text"
          id="alertText"
          className="alert-input"
          placeholder="Explain your call..."
          value={alertText}
          onChange={(e) => setAlertText(e.target.value)}
          disabled={isLoading || isAllCompleted}
        />
      </div>
    </>
  );
};

export default BiddingControls;
