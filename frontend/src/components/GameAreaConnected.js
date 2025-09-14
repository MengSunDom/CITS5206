import React, { useState, useEffect } from 'react';
import { sessionService } from '../utils/gameService';
import './GameArea.css';

function GameAreaConnected({ session, onBackToSessions, onShowTreeView, onUpdateSession }) {
  const [currentDeal, setCurrentDeal] = useState(null);
  const [currentPosition, setCurrentPosition] = useState('');
  const [alertText, setAlertText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [userPosition, setUserPosition] = useState('S'); // User's actual position

  // Load or create initial deal when component mounts
  useEffect(() => {
    loadOrCreateDeal();
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

  const loadOrCreateDeal = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Try to get current deal
      const response = await sessionService.getCurrentDeal(session.id);

      if (response.error) {
        // No deal exists, create one
        const newDeal = await sessionService.createDeal(session.id);
        setCurrentDeal(newDeal);
        setCurrentPosition(newDeal.dealer);
      } else {
        setCurrentDeal(response);
        // Calculate current position based on auction history
        const nextPos = calculateNextPosition(response);
        setCurrentPosition(nextPos);
      }
    } catch (err) {
      setError('Failed to load deal. Please try again.');
      console.error('Deal loading error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateNextPosition = (deal) => {
    if (!deal.auction_history || deal.auction_history.length === 0) {
      return deal.dealer;
    }

    const positions = ['W', 'N', 'E', 'S'];
    const lastCall = deal.auction_history[deal.auction_history.length - 1];
    const lastIndex = positions.indexOf(lastCall.position);
    return positions[(lastIndex + 1) % 4];
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
      const response = await sessionService.makeCall(
        session.id,
        currentDeal.id,
        call,
        alertText
      );

      if (response.error) {
        setError(response.error);
      } else {
        setCurrentDeal(response.deal);
        setAlertText('');

        if (response.auction_complete) {
          handleAuctionComplete();
        } else {
          // Update current position
          const nextPos = calculateNextPosition(response.deal);
          setCurrentPosition(nextPos);
        }
      }
    } catch (err) {
      setError('Failed to make call. Please try again.');
      console.error('Call error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuctionComplete = () => {
    alert('Auction complete! The bidding has ended.');
  };

  const startNewDeal = async () => {
    setIsLoading(true);
    setError('');

    try {
      const newDeal = await sessionService.createDeal(session.id);
      setCurrentDeal(newDeal);
      setCurrentPosition(newDeal.dealer);
      setAlertText('');
    } catch (err) {
      setError('Failed to create new deal. Please try again.');
      console.error('New deal error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const isLegalBid = (bid) => {
    if (!currentDeal || !currentDeal.auction_history) return true;

    // Find last bid in auction history
    let lastBidValue = -1;
    for (const call of currentDeal.auction_history) {
      if (call.type === 'bid') {
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
    if (!currentDeal || !currentDeal.auction_history || currentDeal.auction_history.length === 0) {
      return <p>No bids yet. Dealer starts.</p>;
    }

    // Organize auction history in rows of 4
    const rows = [];
    const history = currentDeal.auction_history;
    const positions = ['W', 'N', 'E', 'S'];

    // Start from dealer position
    const dealerIndex = positions.indexOf(currentDeal.dealer);
    let currentRow = new Array(4).fill(null);
    let rowPosition = dealerIndex;

    for (const call of history) {
      currentRow[rowPosition] = call;
      rowPosition = (rowPosition + 1) % 4;

      if (rowPosition === dealerIndex) {
        rows.push([...currentRow]);
        currentRow = new Array(4).fill(null);
      }
    }

    // Add partial row if exists
    if (currentRow.some(c => c !== null)) {
      rows.push(currentRow);
    }

    return (
      <div className="auction-table">
        <div className="auction-header">West</div>
        <div className="auction-header">North</div>
        <div className="auction-header">East</div>
        <div className="auction-header">South</div>
        {rows.map((row, rowIndex) => (
          row.map((call, colIndex) => (
            <div key={`${rowIndex}-${colIndex}`} className="auction-cell">
              {call ? (
                <>
                  <span className={`call-text ${call.type}`}>{call.call}</span>
                  {call.alert && <span className="alert-indicator">*</span>}
                </>
              ) : ''}
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
                  disabled={!isLegal || isLoading || (currentDeal && currentDeal.is_complete)}
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
      <div className="game-header">
        <button className="back-btn" onClick={onBackToSessions}>
          ← Back to Sessions
        </button>
        <h2>{session.name} - Deal {currentDeal?.deal_number || '...'}</h2>
      </div>

      {error && (
        <div className="error-message" style={{ color: 'red', margin: '10px 0' }}>
          {error}
        </div>
      )}

      <div className="game-info">
        <div className="info-card">
          <h3>Current Deal</h3>
          <div className="value">{currentDeal?.deal_number || '-'}</div>
        </div>
        <div className="info-card">
          <h3>Dealer</h3>
          <div className="value">{currentDeal?.dealer || '-'}</div>
        </div>
        <div className="info-card">
          <h3>Vulnerability</h3>
          <div className="value">{currentDeal?.vulnerability || '-'}</div>
        </div>
        <div className="info-card">
          <h3>Current Turn</h3>
          <div className="value">{currentPosition || '-'}</div>
        </div>
      </div>

      {renderHands()}

      <div className="bidding-area">
        <div className="auction-history">
          <h3>Auction History</h3>
          {renderAuctionHistory()}
        </div>

        <div className="bid-controls">
          <h3>Make Your Call</h3>
          {renderBidButtons()}

          <div className="special-calls">
            <button
              className="special-call"
              onClick={() => makeCall('Pass')}
              disabled={isLoading || (currentDeal && currentDeal.is_complete)}
            >
              Pass
            </button>
            <button
              className="special-call"
              onClick={() => makeCall('X')}
              disabled={isLoading || (currentDeal && currentDeal.is_complete)}
            >
              Double (X)
            </button>
            <button
              className="special-call"
              onClick={() => makeCall('XX')}
              disabled={isLoading || (currentDeal && currentDeal.is_complete)}
            >
              Redouble (XX)
            </button>
          </div>

          <div className="alert-section">
            <label htmlFor="alertText">Alert (optional):</label>
            <input
              type="text"
              id="alertText"
              className="alert-input"
              placeholder="Explain your call..."
              value={alertText}
              onChange={(e) => setAlertText(e.target.value)}
              disabled={isLoading || (currentDeal && currentDeal.is_complete)}
            />
          </div>
        </div>
      </div>

      <div className="game-controls">
        <button className="create-session tree-btn" onClick={onShowTreeView}>
          View Auction Tree
        </button>
        <button
          className="create-session next-btn"
          onClick={startNewDeal}
          disabled={isLoading}
        >
          {isLoading ? 'Creating...' : 'Next Deal'}
        </button>
      </div>
    </div>
  );
}

export default GameAreaConnected;