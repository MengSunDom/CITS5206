import React, { useState, useEffect } from 'react';
import { sessionService } from '../utils/gameService';
import './GameArea.css';

function GameAreaConnected({ session, onBackToSessions, onShowTreeView, onUpdateSession }) {
  const [currentDeal, setCurrentDeal] = useState(null);
  const [currentDealNumber, setCurrentDealNumber] = useState(null);
  const [currentBiddingPosition, setCurrentBiddingPosition] = useState(''); // Position currently bidding
  const [alertText, setAlertText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [userPosition, setUserPosition] = useState('S'); // User's actual position in the game
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [totalDeals, setTotalDeals] = useState(0);
  const [userSequence, setUserSequence] = useState([]); // User's own bidding sequence
  const [partnerSequence, setPartnerSequence] = useState([]); // Partner's bidding sequence
  const [viewMode, setViewMode] = useState('practice'); // 'practice' or 'history'
  const [dealHistory, setDealHistory] = useState([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);

  // Load initial deal from backend when component mounts
  useEffect(() => {
    loadNextPractice();
    // Get user's actual position from session
    if (session.player_games) {
      const currentUserGame = session.player_games.find(pg =>
        pg.player.email === localStorage.getItem('userEmail') ||
        pg.player.username === JSON.parse(localStorage.getItem('user') || '{}').username
      );
      if (currentUserGame) {
        setUserPosition(currentUserGame.position);
      }
    }
  }, [session.id]);

  const loadDealHistory = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await sessionService.getDealHistory(session.id);

      if (response.error) {
        setError(response.error);
        return;
      }

      if (response.history && response.history.length > 0) {
        setDealHistory(response.history);
        setCurrentHistoryIndex(0);
        // Display the first completed deal
        const firstDeal = response.history[0];
        setCurrentDeal(firstDeal);
        setCurrentDealNumber(firstDeal.deal_number);
        setUserSequence(firstDeal.sequence);
        setViewMode('history');
      } else {
        setError('No completed deals to review yet.');
      }
    } catch (err) {
      setError('Failed to load history. Please try again.');
      console.error('History loading error:', err);
    } finally {
      setIsLoading(false);
    }
  };

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

  const returnToPractice = () => {
    setViewMode('practice');
    setDealHistory([]);
    setCurrentHistoryIndex(0);
    loadNextPractice();
  };

  const loadNextPractice = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await sessionService.getNextPractice(session.id);

      if (response.completed) {
        // Set special completion message
        setError('COMPLETION:All deals completed! Great job!');
        return;
      }

      if (response.error) {
        setError(response.error);
        return;
      }

      // Set the deal and position from backend
      setCurrentDeal(response.deal);
      setCurrentDealNumber(response.deal.deal_number);
      setCurrentBiddingPosition(response.position);
      setUserSequence(response.user_sequence || []);
      setTotalDeals(response.total_deals);
      setAlertText('');
    } catch (err) {
      setError('Failed to load next practice. Please try again.');
      console.error('Practice loading error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserSequences = async (dealNumber) => {
    try {
      const response = await sessionService.getUserSequences(session.id, dealNumber || currentDealNumber);
      if (!response.error) {
        // Find current user's sequence
        const currentUserSequence = response.user_sequences?.find(
          seq => seq.user === JSON.parse(localStorage.getItem('user') || '{}').username
        );
        if (currentUserSequence) {
          setUserSequence(currentUserSequence.sequence || []);
          // Update current bidding position based on sequence
          if (currentUserSequence.sequence.length > 0) {
            const positions = ['W', 'N', 'E', 'S'];
            const lastCall = currentUserSequence.sequence[currentUserSequence.sequence.length - 1];
            const lastIndex = positions.indexOf(lastCall.position);
            const nextPos = positions[(lastIndex + 1) % 4];
            setCurrentBiddingPosition(nextPos);
          }
        }

        // Find partner's sequence
        const partnerSeq = response.user_sequences?.find(
          seq => seq.user !== JSON.parse(localStorage.getItem('user') || '{}').username
        );
        if (partnerSeq) {
          setPartnerSequence(partnerSeq.sequence || []);
        }
      }
    } catch (err) {
      console.error('Failed to load user sequences:', err);
    }
  };

  // Helper function to rotate positions for display
  const rotatePosition = (position) => {
    // This function rotates the table so that the user always appears at South
    const positions = ['N', 'E', 'S', 'W'];
    const userIdx = positions.indexOf(userPosition);
    const posIdx = positions.indexOf(position);

    // Calculate rotation needed to put user at South (index 2)
    const rotation = (posIdx - userIdx + 2) % 4;
    return positions[rotation];
  };

  // Get display positions after rotation
  const getDisplayPositions = () => {
    return {
      'N': rotatePosition('N'),
      'E': rotatePosition('E'),
      'S': rotatePosition('S'),
      'W': rotatePosition('W')
    };
  };

  const makeCall = async (call) => {
    if (!currentDeal) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await sessionService.makeUserCall(
        session.id,
        currentDeal.id,
        currentBiddingPosition,
        call,
        alertText
      );

      if (response.error) {
        setError(response.error);
      } else {
        setUserSequence(response.user_sequence.sequence);
        setAlertText('');

        // Check if this deal's auction is complete
        if (response.auction_complete) {
          alert(`Deal #${currentDealNumber} has been completed!`);
        }

        // Automatically get next deal/position from backend after each call
        setTimeout(() => {
          loadNextPractice();
        }, 1000); // 1 second delay before auto-transition
      }
    } catch (err) {
      setError('Failed to make call. Please try again.');
      console.error('Call error:', err);
    } finally {
      setIsLoading(false);
    }
  };




  const isLegalBid = (bid) => {
    if (!userSequence || userSequence.length === 0) return true;

    // Find last bid in user's own sequence
    let lastBidValue = -1;
    for (const call of userSequence) {
      if (call.call && call.call[0].match(/[1-7]/)) {
        lastBidValue = getBidValue(call.call);
      }
    }

    const newBidValue = getBidValue(bid);
    return newBidValue > lastBidValue;
  };

  const getBidValue = (bid) => {
    if (!bid.match(/^[1-7][CDHSNT]+$/)) return -1;

    const level = parseInt(bid[0]);
    const suit = bid.substring(1);
    const suitValues = { 'C': 0, 'D': 1, 'H': 2, 'S': 3, 'NT': 4 };

    return level * 5 + suitValues[suit];
  };

  const getSuitSymbol = (suit) => {
    const symbols = {
      'S': '♠',
      'H': '♥',
      'D': '♦',
      'C': '♣',
      'NT': 'NT'
    };
    return symbols[suit] || suit;
  };

  const renderHands = () => {
    if (!currentDeal || !currentDeal.hands) {
      return <p>No hands dealt yet.</p>;
    }

    const displayPositions = getDisplayPositions();
    const positionNames = {
      'N': 'North',
      'E': 'East',
      'S': 'South',
      'W': 'West'
    };

    // Create rotated display with user always at South
    const tablePositions = {
      north: displayPositions['N'],
      east: displayPositions['E'],
      south: userPosition, // User's actual position shown at South
      west: displayPositions['W']
    };

    return (
      <div className="bridge-table">
        {/* North position (top) */}
        <div className="position north">
          <div className="position-label">
            {tablePositions.north === userPosition ? `${positionNames[tablePositions.north]} (Partner)` : positionNames[tablePositions.north]}
          </div>
          <div className="cards">
            {currentDeal.hands[tablePositions.north] && Object.entries(currentDeal.hands[tablePositions.north]).map(([suit, cards]) => (
              <div key={suit} className="suit-row">
                <span className={`suit-symbol suit-${suit.toLowerCase()}`}>
                  {getSuitSymbol(suit)}
                </span>
                <span className="cards-list">{cards}</span>
              </div>
            ))}
          </div>
        </div>

        {/* West position (left) */}
        <div className="position west">
          <div className="position-label">{positionNames[tablePositions.west]}</div>
          <div className="cards">
            {currentDeal.hands[tablePositions.west] && Object.entries(currentDeal.hands[tablePositions.west]).map(([suit, cards]) => (
              <div key={suit} className="suit-row">
                <span className={`suit-symbol suit-${suit.toLowerCase()}`}>
                  {getSuitSymbol(suit)}
                </span>
                <span className="cards-list">{cards}</span>
              </div>
            ))}
          </div>
        </div>

        {/* East position (right) */}
        <div className="position east">
          <div className="position-label">{positionNames[tablePositions.east]}</div>
          <div className="cards">
            {currentDeal.hands[tablePositions.east] && Object.entries(currentDeal.hands[tablePositions.east]).map(([suit, cards]) => (
              <div key={suit} className="suit-row">
                <span className={`suit-symbol suit-${suit.toLowerCase()}`}>
                  {getSuitSymbol(suit)}
                </span>
                <span className="cards-list">{cards}</span>
              </div>
            ))}
          </div>
        </div>

        {/* South position (bottom) - Always the user */}
        <div className="position south">
          <div className="position-label">
            {positionNames[userPosition]} (You)
          </div>
          <div className="cards">
            {currentDeal.hands[userPosition] && Object.entries(currentDeal.hands[userPosition]).map(([suit, cards]) => (
              <div key={suit} className="suit-row">
                <span className={`suit-symbol suit-${suit.toLowerCase()}`}>
                  {getSuitSymbol(suit)}
                </span>
                <span className="cards-list">{cards}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderAuctionHistory = () => {
    // Show user's own sequence
    const sequence = userSequence;

    // Get dealer from currentDeal
    const dealer = currentDeal?.dealer || 'N';

    if (!sequence || sequence.length === 0) {
      return <p>No bids yet. Dealer: {dealer} starts.</p>;
    }

    // Standard bridge table columns: W-N-E-S
    const positions = ['W', 'N', 'E', 'S'];

    // Create the auction grid
    const createAuctionGrid = (dealer, sequence) => {
      const rows = [];
      let currentRow = [null, null, null, null]; // W, N, E, S
      let callsPlacedInRow = 0;

      for (let i = 0; i < sequence.length; i++) {
        const call = sequence[i];
        const callPosition = call.position;
        const callColumnIndex = positions.indexOf(callPosition);

        // Place the call
        currentRow[callColumnIndex] = call;
        callsPlacedInRow++;

        // Check if we need a new row AFTER placing the call
        if (callsPlacedInRow >= 4 && i < sequence.length - 1) {
          // Row is full and there are more calls to place
          rows.push([...currentRow]);
          currentRow = [null, null, null, null];
          callsPlacedInRow = 0;
        }
      }

      // Add the last row if it has any content
      if (callsPlacedInRow > 0 || rows.length === 0) {
        rows.push(currentRow);
      }

      return rows;
    };

    const rows = createAuctionGrid(dealer, sequence);

    // Format bid with suit symbols
    const formatBid = (bid) => {
      if (!bid) return bid;
      if (bid === 'Pass' || bid === 'X' || bid === 'XX') return bid;

      // Replace suit letters with symbols for numbered bids
      if (bid.match(/^[1-7]/)) {
        const level = bid[0];
        const suit = bid.substring(1);
        const suitSymbols = {
          'C': '♣',
          'D': '♦',
          'H': '♥',
          'S': '♠',
          'NT': 'NT'
        };
        return level + (suitSymbols[suit] || suit);
      }
      return bid;
    };

    return (
      <div className="auction-table">
        <div className="auction-header">West</div>
        <div className="auction-header">North</div>
        <div className="auction-header">East</div>
        <div className="auction-header">South</div>
        {rows.map((row, rowIndex) => (
          row.map((cell, colIndex) => (
            <div key={`${rowIndex}-${colIndex}`} className="auction-cell">
              {cell ? (
                <>
                  <span
                    className={`call-text ${cell.call && cell.call.match(/^[1-7]/) ? 'bid' : ''}`}
                    data-call={cell.call}
                  >
                    {formatBid(cell.call)}
                  </span>
                  {cell.alert && <span className="alert-indicator">✱</span>}
                </>
              ) : (
                ''
              )}
            </div>
          ))
        ))}
      </div>
    );
  };

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
                  className={`bid-button suit-${suit === 'NT' ? 'nt' : suit.toLowerCase()}`}
                  onClick={() => makeCall(bid)}
                  disabled={!isLegal || isLoading}
                >
                  <div className="bid-content">
                    {level}<br />{getSuitSymbol(suit)}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  if (isLoading && !currentDeal) {
    return <div className="loading">Loading deal...</div>;
  }

  return (
    <div className="game-area">
      <div className="game-header" style={{ position: 'relative' }}>
        <button className="back-btn" onClick={onBackToSessions}>
          ← Back to Sessions
        </button>
        <h2>{session.name} {viewMode === 'history' ? '- History Review' : ''}</h2>
        <div style={{
          position: 'absolute',
          right: '20px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '12px',
          color: '#666'
        }}>
          {isSyncing && <span>🔄 Syncing...</span>}
          {!isSyncing && lastSyncTime && (
            <span>✓ Synced {Math.floor((new Date() - lastSyncTime) / 1000)}s ago</span>
          )}
        </div>
      </div>

      {error && (
        <div
          className="error-message"
          style={{
            color: error.startsWith('COMPLETION:') ? 'white' : 'red',
            backgroundColor: error.startsWith('COMPLETION:') ? 'red' : 'transparent',
            padding: error.startsWith('COMPLETION:') ? '15px' : '0',
            borderRadius: error.startsWith('COMPLETION:') ? '5px' : '0',
            fontWeight: error.startsWith('COMPLETION:') ? 'bold' : 'normal',
            textAlign: error.startsWith('COMPLETION:') ? 'center' : 'left',
            margin: '10px 0'
          }}
        >
          {error.startsWith('COMPLETION:') ? error.replace('COMPLETION:', '') : error}
        </div>
      )}

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

      {renderHands()}

      <div className="bidding-area">
        <div className="auction-history">
          <h3>Auction History</h3>
          {renderAuctionHistory()}
        </div>

        <div className="bid-controls">
          {viewMode === 'practice' ? (
            <>
              <h3>Make Your Call (Position: {currentBiddingPosition})</h3>
              {renderBidButtons()}
            </>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <h3>Reviewing Completed Deal #{currentDealNumber}</h3>
              <p style={{ color: '#666', marginTop: '10px' }}>
                This deal has been completed. Use the navigation buttons below to browse through your history.
              </p>
            </div>
          )}

          {viewMode === 'practice' && (
            <div className="special-calls">
              <button
                className="special-call"
                onClick={() => makeCall('Pass')}
                disabled={isLoading}
              >
                Pass
              </button>
              <button
                className="special-call"
                onClick={() => makeCall('X')}
                disabled={isLoading}
              >
                Double (X)
              </button>
              <button
                className="special-call"
                onClick={() => makeCall('XX')}
                disabled={isLoading}
              >
                Redouble (XX)
              </button>
            </div>
          )}

          {viewMode === 'practice' && (
            <div className="alert-section">
              <label htmlFor="alertText">Alert (optional):</label>
              <input
                type="text"
                id="alertText"
                className="alert-input"
                placeholder="Explain your call..."
                value={alertText}
                onChange={(e) => setAlertText(e.target.value)}
                disabled={isLoading}
              />
            </div>
          )}
        </div>
      </div>

      <div className="game-controls">
        <button className="create-session tree-btn" onClick={onShowTreeView}>
          View Auction Tree
        </button>
        {viewMode === 'practice' ? (
          <button
            className="create-session"
            onClick={() => {
              // Switch to history view
              loadDealHistory();
            }}
            disabled={isLoading}
            style={{ padding: '10px 20px' }}
          >
            📜 View History
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