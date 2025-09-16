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
  const [pollingInterval, setPollingInterval] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [totalDeals, setTotalDeals] = useState(0);
  const [userSequence, setUserSequence] = useState([]); // User's own bidding sequence
  const [partnerSequence, setPartnerSequence] = useState([]); // Partner's bidding sequence
  const [viewMode, setViewMode] = useState('bidding'); // 'bidding' or 'comparison'

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

    // Set up polling interval to sync partner's sequence
    const interval = setInterval(() => {
      if (currentDealNumber && viewMode === 'comparison') {
        syncUserSequences();
      }
    }, 2000); // Poll every 2 seconds
    setPollingInterval(interval);

    // Cleanup on unmount
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [session.id, currentDealNumber]);

  const loadOrCreateDeal = async () => {
    setIsLoading(true);
    setError('');

    try {
      // First check all deals to see what's available
      const allDealsResponse = await sessionService.getAllDeals(session.id);

      if (allDealsResponse.error || allDealsResponse.total === 0) {
        // No deals exist, create the first one
        const newDeal = await sessionService.createDeal(session.id);
        setCurrentDeal(newDeal);
        setCurrentDealNumber(newDeal.deal_number);
        setCurrentPosition(newDeal.dealer);
        setTotalDeals(1);
      } else {
        // Load the latest deal that exists
        setTotalDeals(allDealsResponse.total);
        const latestDealNumber = allDealsResponse.latest_deal_number;
        const dealResponse = await sessionService.getDeal(session.id, latestDealNumber);

        if (!dealResponse.error) {
          setCurrentDeal(dealResponse);
          setCurrentDealNumber(dealResponse.deal_number);
          // Start bidding from dealer position
          setCurrentBiddingPosition(dealResponse.dealer);
          // Load user's sequence if exists
          loadUserSequences(latestDealNumber);
        }
      }
    } catch (err) {
      setError('Failed to load deal. Please try again.');
      console.error('Deal loading error:', err);
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
            const nextPos = calculateNextPositionFromSequence(currentUserSequence.sequence, currentDeal?.dealer);
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

  const syncUserSequences = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await loadUserSequences(currentDealNumber);
      setLastSyncTime(new Date());
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const calculateNextPositionFromSequence = (sequence, dealer) => {
    if (!sequence || sequence.length === 0) {
      return dealer || 'N';
    }

    const positions = ['W', 'N', 'E', 'S'];
    const lastCall = sequence[sequence.length - 1];
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

        if (response.auction_complete) {
          handleAuctionComplete();
        } else {
          // Move to next position
          const positions = ['W', 'N', 'E', 'S'];
          const currentIndex = positions.indexOf(currentBiddingPosition);
          setCurrentBiddingPosition(positions[(currentIndex + 1) % 4]);
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
      // First check if next deal already exists (created by partner)
      const allDealsResponse = await sessionService.getAllDeals(session.id);
      const nextDealNumber = currentDealNumber + 1;
      setTotalDeals(allDealsResponse.total || 0);

      // Check if the next deal already exists
      const existingNextDeal = allDealsResponse.deals?.find(d => d.deal_number === nextDealNumber);

      if (existingNextDeal) {
        // Load the existing next deal
        setCurrentDeal(existingNextDeal);
        setCurrentDealNumber(existingNextDeal.deal_number);
        setCurrentBiddingPosition(existingNextDeal.dealer);
        setAlertText('');
        setUserSequence([]);
        setPartnerSequence([]);
        loadUserSequences(existingNextDeal.deal_number);
      } else {
        // Create new deal
        const newDeal = await sessionService.createDeal(session.id);
        setCurrentDeal(newDeal);
        setCurrentDealNumber(newDeal.deal_number);
        setCurrentBiddingPosition(newDeal.dealer);
        setAlertText('');
        setUserSequence([]);
        setPartnerSequence([]);
        setTotalDeals(prev => prev + 1);
      }
    } catch (err) {
      setError('Failed to create new deal. Please try again.');
      console.error('New deal error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToDeal = async (dealNumber) => {
    setIsLoading(true);
    setError('');

    try {
      const dealResponse = await sessionService.getDeal(session.id, dealNumber);

      if (!dealResponse.error) {
        setCurrentDeal(dealResponse);
        setCurrentDealNumber(dealResponse.deal_number);
        setCurrentBiddingPosition(dealResponse.dealer);
        setAlertText('');
        setUserSequence([]);
        setPartnerSequence([]);
        loadUserSequences(dealResponse.deal_number);
      } else {
        setError(`Deal ${dealNumber} not found.`);
      }
    } catch (err) {
      setError('Failed to load deal.');
      console.error('Navigate deal error:', err);
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
    const sequence = viewMode === 'comparison' && partnerSequence.length > 0 ? partnerSequence : userSequence;

    if (!sequence || sequence.length === 0) {
      return <p>No bids yet. Dealer: {currentDeal?.dealer || 'N'} starts.</p>;
    }

    const positions = ['W', 'N', 'E', 'S'];
    const rows = [];

    // Start from dealer position
    const dealerIndex = positions.indexOf(currentDeal?.dealer || 'N');
    let currentRow = new Array(4).fill(null);
    let expectedPosition = dealerIndex;

    for (const call of sequence) {
      const callPositionIndex = positions.indexOf(call.position);
      currentRow[callPositionIndex] = call;

      // Move to next expected position
      expectedPosition = (expectedPosition + 1) % 4;

      // If we've completed a row (back to dealer position), start a new row
      if (expectedPosition === dealerIndex) {
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
                  <span className={`call-text ${call.type}`}>
                    {call.call}
                  </span>
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
        <h2>{session.name} - Deal {currentDeal?.deal_number || '...'}</h2>
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
          <h3>Current Position</h3>
          <div className="value">{currentBiddingPosition || '-'}</div>
        </div>
      </div>

      {renderHands()}

      <div className="bidding-area">
        <div className="auction-history">
          <h3>
            {viewMode === 'comparison' ? 'Partner\'s Auction' : 'Your Auction'}
            <button
              onClick={() => {
                setViewMode(viewMode === 'bidding' ? 'comparison' : 'bidding');
                if (viewMode === 'bidding') {
                  loadUserSequences(currentDealNumber);
                }
              }}
              style={{
                marginLeft: '20px',
                padding: '5px 10px',
                fontSize: '12px',
                background: '#00d4ff',
                color: '#1a1a2e',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              {viewMode === 'comparison' ? 'Show My Auction' : 'Compare with Partner'}
            </button>
          </h3>
          {renderAuctionHistory()}
        </div>

        <div className="bid-controls">
          <h3>Make Your Call</h3>
          {renderBidButtons()}

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
            <button
              className="special-call"
              onClick={async () => {
                if (currentDeal) {
                  try {
                    await sessionService.resetUserSequence(session.id, currentDeal.id);
                    setUserSequence([]);
                    setCurrentBiddingPosition(currentDeal?.dealer || 'N');
                    setError('');
                  } catch (err) {
                    setError('Failed to reset bidding');
                  }
                }
              }}
              style={{ background: '#ff5722' }}
            >
              Reset Bidding
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
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      <div className="game-controls">
        <button className="create-session tree-btn" onClick={onShowTreeView}>
          View Auction Tree
        </button>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="create-session"
            onClick={() => navigateToDeal(currentDealNumber - 1)}
            disabled={isLoading || currentDealNumber <= 1}
            style={{ padding: '10px 20px' }}
          >
            ← Previous
          </button>
          <span style={{ fontSize: '14px', color: '#666' }}>
            Deal {currentDealNumber} of {Math.max(totalDeals, currentDealNumber || 1)}
          </span>
          <button
            className="create-session next-btn"
            onClick={() => {
              if (currentDealNumber < totalDeals) {
                navigateToDeal(currentDealNumber + 1);
              } else {
                startNewDeal();
              }
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : (currentDealNumber < totalDeals ? 'Next Deal →' : 'New Deal +')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GameAreaConnected;