import React, { useState, useEffect } from 'react';
import { sessionService } from '../utils/gameService';
import './GameArea.css';

// Card component defined within the same file
const Card = ({ rank, suit, isBack = false, isVisible = true, className = '', onClick = null }) => {
  const getSuitSymbol = (suit) => {
    const symbols = {
      'S': '♠',
      'H': '♥',
      'D': '♦',
      'C': '♣'
    };
    return symbols[suit] || suit;
  };

  const getSuitColor = (suit) => {
    return (suit === 'H' || suit === 'D') ? 'red' : 'black';
  };

  if (!isVisible) {
    return null;
  }

  if (isBack) {
    return (
      <div className={`card-back ${className}`} onClick={onClick}>
        {/* Card back pattern is handled by CSS */}
      </div>
    );
  }

  return (
    <div 
      className={`playing-card ${getSuitColor(suit)} ${className}`} 
      onClick={onClick}
    >
      <div className="rank">{rank}</div>
      <div className="suit">{getSuitSymbol(suit)}</div>
      <div className="center-suit">{getSuitSymbol(suit)}</div>
      <div className="rank bottom-right" style={{ transform: 'rotate(180deg)', alignSelf: 'flex-end', fontSize: '10px' }}>
        {rank}
      </div>
    </div>
  );
};

function GameAreaConnected({ session, onBackToSessions}) {
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
  const [viewMode, setViewMode] = useState('practice'); // 'practice' or 'history'
  const [dealHistory, setDealHistory] = useState([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);
  const [isBiddingPhase, setIsBiddingPhase] = useState(true);
  const [gameTerminated, setGameTerminated] = useState(false);
  
  // Simulated deck for unique card distribution
  const createDeck = () => {
    const suits = ['S', 'H', 'D', 'C'];
    const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
    const deck = [];
    
    suits.forEach(suit => {
      ranks.forEach(rank => {
        deck.push(`${rank}${suit}`);
      });
    });
    
    return deck;
  };

  // Shuffle and deal cards properly
  const dealCards = () => {
    const deck = createDeck();
    
    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    // Deal 13 cards to each position
    const hands = {
      'N': { 'S': '', 'H': '', 'D': '', 'C': '' },
      'E': { 'S': '', 'H': '', 'D': '', 'C': '' },
      'S': { 'S': '', 'H': '', 'D': '', 'C': '' },
      'W': { 'S': '', 'H': '', 'D': '', 'C': '' }
    };
    
    const positions = ['N', 'E', 'S', 'W'];
    let cardIndex = 0;
    
    // Deal one card at a time to each position (proper bridge dealing)
    for (let round = 0; round < 13; round++) {
      positions.forEach(position => {
        const card = deck[cardIndex++];
        const suit = card.slice(-1);
        const rank = card.slice(0, -1);
        hands[position][suit] += rank;
      });
    }
    
    // Sort each suit by rank
    const rankOrder = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
    Object.keys(hands).forEach(position => {
      ['S', 'H', 'D', 'C'].forEach(suit => {
        const cards = hands[position][suit];
        const sortedCards = cards.match(/(?:10|[AKQJ2-9])/g) || [];
        hands[position][suit] = sortedCards.sort((a, b) => 
          rankOrder.indexOf(a) - rankOrder.indexOf(b)
        ).join('');
      });
    });
    
    return hands;
  };

  // Load initial deal from backend when component mounts
  useEffect(() => {
    // Get user's actual position from session first
    if (session.player_games) {
      const currentUserGame = session.player_games.find(pg =>
        pg.player.email === localStorage.getItem('userEmail') ||
        pg.player.username === JSON.parse(localStorage.getItem('user') || '{}').username
      );
      if (currentUserGame) {
        setUserPosition(currentUserGame.position);
      }
    }
    
    // Initialize first deal
    initializeNewDeal();
  }, [session.id]);

  const initializeNewDeal = () => {
    const newDealNumber = (currentDealNumber || 0) + 1;
    const dealer = 'N'; // Always start with North as dealer for each game
    const hands = dealCards();
    
    const newDeal = {
      id: `deal-${newDealNumber}`,
      deal_number: newDealNumber,
      dealer: dealer,
      vulnerability: 'None', // Simplified for now
      hands: hands
    };
    
    setCurrentDeal(newDeal);
    setCurrentDealNumber(newDealNumber);
    setCurrentBiddingPosition(dealer); // Bidding starts with dealer
    setUserSequence([]);
    setIsBiddingPhase(true);
    setGameTerminated(false);
  };

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
        setIsBiddingPhase(false);
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
    initializeNewDeal();
  };

  const startNewGame = () => {
    initializeNewDeal();
    setError('');
  };

  // Get next bidding position
  const getNextBiddingPosition = (currentPos) => {
    const positions = ['N', 'E', 'S', 'W'];
    const currentIndex = positions.indexOf(currentPos);
    return positions[(currentIndex + 1) % 4];
  };

  const makeCall = async (call) => {
    if (!currentDeal || gameTerminated) return;

    // Validate the call before processing
    const auctionState = getAuctionState();
    const validation = validateCall(auctionState, call, currentBiddingPosition);

    if (!validation.ok) {
      setError(validation.error);
      // Clear error after 3 seconds
      setTimeout(() => {
        setError('');
      }, 3000);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Add the call to the sequence
      const newCall = {
        position: currentBiddingPosition,
        call: call,
        alert: alertText || null
      };
      
      const newSequence = [...userSequence, newCall];
      setUserSequence(newSequence);
      setAlertText('');

      // Check auction state after the call
      const newAuctionState = getAuctionStateFromSequence(newSequence);
      
      // Move to next bidding position
      const nextPosition = getNextBiddingPosition(currentBiddingPosition);
      setCurrentBiddingPosition(nextPosition);
      
      // Check if auction has ended
      if (newAuctionState.auctionEnded) {
        setIsBiddingPhase(false);
        setGameTerminated(true);
        
        if (newAuctionState.finalContract === 'Passed Out') {
          setError('GAME_END:The game is terminated - All Passed!');
        } else {
          setError(`GAME_END:Game completed! Final contract: ${newAuctionState.finalContract}`);
        }
      }

    } catch (err) {
      setError('Failed to make call. Please try again.');
      console.error('Call error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const isLegalBid = (bid) => {
    const auctionState = getAuctionState();
    const validation = validateCall(auctionState, bid, currentBiddingPosition);
    return validation.ok;
  };

  const getBidValue = (bid) => {
    if (!bid.match(/^[1-7][CDHSNT]+$/)) return -1;

    const level = parseInt(bid[0]);
    const suit = bid.substring(1);
    const suitValues = { 'C': 0, 'D': 1, 'H': 2, 'S': 3, 'NT': 4 };

    return level * 5 + suitValues[suit];
  };

  // Complete bridge auction validation function
  const validateCall = (auctionState, call, seat) => {
    const { toActSeat, highestBid, dblStatus, auctionEnded } = auctionState;

    // Check if auction has already ended
    if (auctionEnded) {
      return { ok: false, error: "Auction already ended" };
    }

    // Check if it's the correct seat's turn
    if (seat !== toActSeat) {
      return { ok: false, error: `It's ${toActSeat}'s turn to act, not ${seat}'s` };
    }

    // Normalize call format
    if (call === 'P') call = 'Pass';
    if (call === 'Double') call = 'X';
    if (call === 'Redouble') call = 'XX';

    // Handle Pass - always legal
    if (call === 'Pass') {
      return { ok: true };
    }

    // Handle numbered bids (1C through 7NT)
    if (call.match(/^[1-7][CDHSNT]+$/)) {
      const level = parseInt(call[0]);
      const suit = call.substring(1);

      // Validate bid format
      if (level < 1 || level > 7) {
        return { ok: false, error: `Invalid bid level: ${level}` };
      }

      const validSuits = ['C', 'D', 'H', 'S', 'NT'];
      if (!validSuits.includes(suit)) {
        return { ok: false, error: `Invalid bid suit: ${suit}` };
      }

      // Check if bid is higher than current highest bid
      if (highestBid) {
        const newBidValue = getBidValue(call);
        const currentBidValue = getBidValue(highestBid.bid);
        if (newBidValue <= currentBidValue) {
          return { ok: false, error: `Illegal bid: not higher than current highest bid (${highestBid.bid})` };
        }
      }
      return { ok: true };
    }

    // Handle Double (X)
    if (call === 'X') {
      // Must have a bid to double
      if (!highestBid) {
        return { ok: false, error: "Illegal double: no bid to double" };
      }
      // Cannot double if already doubled or redoubled
      if (dblStatus !== '') {
        return { ok: false, error: "Illegal double: current contract is already doubled or redoubled" };
      }
      // Check if opponents hold the current contract
      const positions = ['W', 'N', 'E', 'S'];
      const seatIndex = positions.indexOf(seat);
      const bidderIndex = positions.indexOf(highestBid.seat);
      const isOpponent = (seatIndex % 2) !== (bidderIndex % 2);
      if (!isOpponent) {
        return { ok: false, error: "Illegal double: opponents do not hold the current contract" };
      }
      return { ok: true };
    }

    // Handle Redouble (XX)
    if (call === 'XX') {
      // Must have a bid to redouble
      if (!highestBid) {
        return { ok: false, error: "Illegal redouble: no bid to redouble" };
      }
      // Can only redouble a doubled bid
      if (dblStatus !== 'X') {
        return { ok: false, error: "Illegal redouble: current contract is not doubled" };
      }
      // Check if current player's side holds the doubled contract
      const positions = ['W', 'N', 'E', 'S'];
      const seatIndex = positions.indexOf(seat);
      const bidderIndex = positions.indexOf(highestBid.seat);
      const isSameSide = (seatIndex % 2) === (bidderIndex % 2);
      if (!isSameSide) {
        return { ok: false, error: "Illegal redouble: your side is not currently doubled" };
      }
      return { ok: true };
    }

    return { ok: false, error: `Unknown call: ${call}` };
  };

  // Get auction state from current sequence
  const getAuctionState = () => {
    return getAuctionStateFromSequence(userSequence);
  };

  // Separate function to get auction state from any sequence
  const getAuctionStateFromSequence = (sequence) => {
    const positions = ['W', 'N', 'E', 'S'];
    const dealer = currentDeal?.dealer || 'N';
    let toActSeat = dealer;
    let highestBid = null;
    let dblStatus = '';
    let consecutivePasses = 0;
    let auctionEnded = false;
    let finalContract = null;

    // If no calls yet, next to act is dealer
    if (sequence.length === 0) {
      return {
        toActSeat: dealer,
        highestBid: null,
        dblStatus: '',
        consecutivePasses: 0,
        history: [],
        auctionEnded: false,
        finalContract: null
      };
    }

    // Process each call in sequence
    for (let i = 0; i < sequence.length; i++) {
      const call = sequence[i];
      const callText = call.call;

      // Normalize call format
      let normalizedCall = callText;
      if (normalizedCall === 'P') normalizedCall = 'Pass';
      if (normalizedCall === 'Double') normalizedCall = 'X';
      if (normalizedCall === 'Redouble') normalizedCall = 'XX';

      // Update state based on the call
      if (normalizedCall === 'Pass') {
        consecutivePasses++;
        
        // Bridge rules: 
        // - 4 consecutive passes from start = all passed
        // - 3 consecutive passes after any bid = auction ends
        if (consecutivePasses === 4 && !highestBid) {
          auctionEnded = true;
          finalContract = 'Passed Out';
          break;
        }
        if (consecutivePasses === 3 && highestBid) {
          auctionEnded = true;
          finalContract = highestBid.bid;
          if (dblStatus) finalContract += ` ${dblStatus}`;
          break;
        }
      } else {
        consecutivePasses = 0; // Reset on any non-pass

        if (normalizedCall.match(/^[1-7][CDHSNT]+$/)) {
          // New bid
          highestBid = { bid: normalizedCall, seat: call.position };
          dblStatus = ''; // Reset double status on new bid
        } else if (normalizedCall === 'X') {
          dblStatus = 'X';
        } else if (normalizedCall === 'XX') {
          dblStatus = 'XX';
        }
      }

      // Rotate to next seat
      const currentIndex = positions.indexOf(toActSeat);
      toActSeat = positions[(currentIndex + 1) % 4];
    }

    return {
      toActSeat,
      highestBid,
      dblStatus,
      consecutivePasses,
      history: sequence,
      auctionEnded,
      finalContract
    };
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

  // Parse card string to get individual cards
  const parseCards = (cardString) => {
    if (!cardString) return [];
    
    const cards = [];
    const matches = cardString.match(/(?:10|[AKQJ2-9])/g);
    return matches || [];
  };

  // Should show card backs for other positions during bidding
  const shouldShowCardBacks = (position) => {
    return isBiddingPhase && position !== currentBiddingPosition && viewMode === 'practice';
  };

  // Generate card backs for a position
  const generateCardBacks = (position) => {
    if (!currentDeal || !currentDeal.hands || !currentDeal.hands[position]) return [];
    
    // Generate array of card backs (should be 13 cards)
    return Array(13).fill().map((_, index) => (
      <Card key={`back-${position}-${index}`} isBack={true} className="card-deal" />
    ));
  };

  const renderHands = () => {
    if (!currentDeal || !currentDeal.hands) {
      return <p>No hands dealt yet.</p>;
    }

    const positionNames = {
      'N': 'North',
      'E': 'East', 
      'S': 'South',
      'W': 'West'
    };

    const renderPositionCards = (actualPosition, displayClass) => {
      const isCurrentBidder = currentBiddingPosition === actualPosition;
      const positionClasses = `position ${displayClass} ${isCurrentBidder ? 'current-bidder' : ''} ${shouldShowCardBacks(actualPosition) ? 'hidden-cards' : ''}`;

      return (
        <div key={actualPosition} className={positionClasses}>
          <div className="position-label">
            {positionNames[actualPosition]}
            {actualPosition === userPosition && <span style={{color: '#ffd700', marginLeft: '5px'}}>(You)</span>}
            {isCurrentBidder && <span style={{color: '#00d4ff', marginLeft: '10px'}}>• Bidding</span>}
          </div>
          
          <div className="cards-container">
            {shouldShowCardBacks(actualPosition) ? (
              // Show card backs during bidding phase for positions not currently bidding
              generateCardBacks(actualPosition)
            ) : (
              // Show actual cards for the current bidding position or when not in bidding phase
              currentDeal.hands[actualPosition] && Object.entries(currentDeal.hands[actualPosition]).map(([suit, cards]) => (
                <div key={suit} className="suit-row">
                  <span className={`suit-symbol suit-${suit.toLowerCase()}`}>
                    {getSuitSymbol(suit)}
                  </span>
                  <div className="cards-in-suit">
                    {parseCards(cards).map((rank, index) => (
                      <Card 
                        key={`${suit}-${rank}-${index}`}
                        rank={rank}
                        suit={suit}
                        className="card-deal"
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    };

    return (
      <div className={`bridge-table ${isBiddingPhase ? 'bidding-view' : ''}`}>
        {/* Fixed position rendering - each position renders correctly */}
        {renderPositionCards('N', 'north')}
        {renderPositionCards('W', 'west')}
        {renderPositionCards('E', 'east')}
        {renderPositionCards('S', 'south')}
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

    // Create the auction grid with proper dealer offset
    const createAuctionGrid = (dealerSeat, sequence) => {
      const cols = ['W', 'N', 'E', 'S'];
      const startCol = cols.indexOf(dealerSeat);
      const grid = [];

      // Initialize grid with enough rows
      const totalCalls = sequence.length;
      const numRows = Math.ceil((startCol + totalCalls) / 4);

      for (let i = 0; i < numRows; i++) {
        grid.push([null, null, null, null]);
      }

      // Place each call in the grid
      for (let i = 0; i < sequence.length; i++) {
        const absIndex = startCol + i;
        const row = Math.floor(absIndex / 4);
        const col = absIndex % 4;
        grid[row][col] = sequence[i];
      }

      return grid;
    };

    const rows = createAuctionGrid(dealer, sequence);

    // Format bid with suit symbols
    const formatBid = (bid) => {
      if (!bid) return bid;
      if (bid === 'Pass' || bid === 'P') return 'Pass';
      if (bid === 'X') return 'Dbl';
      if (bid === 'XX') return 'Rdbl';

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
    if (gameTerminated || !isBiddingPhase) return null;
    
    const levels = ['1', '2', '3', '4', '5', '6', '7'];
    const suits = ['C', 'D', 'H', 'S', 'NT'];

    return (
      <div className="bid-buttons-container">
        {levels.map(level => (
          <div key={level} className="bid-level-row">
            <div className="level-label">{level}</div>
            <div className="suit-buttons">
              {suits.map(suit => {
                const bid = level + suit;
                const isLegal = isLegalBid(bid);

                return (
                  <button
                    key={bid}
                    className={`bid-button suit-${suit === 'NT' ? 'nt' : suit.toLowerCase()} ${!isLegal ? 'disabled' : ''}`}
                    onClick={() => makeCall(bid)}
                    disabled={!isLegal || isLoading}
                  >
                    <div className="bid-content">
                      <span className="bid-suit">{getSuitSymbol(suit)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading && !currentDeal) {
    return <div className="loading">Loading deal...</div>;
  }

  return (
    <div className={`game-area ${isBiddingPhase ? 'bidding-view' : ''}`}>
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
            color: 'white',
            backgroundColor: error.startsWith('GAME_END:') ? '#28a745' : '#dc3545',
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
          {error.startsWith('GAME_END:') ? 
            '✅ ' + error.replace('GAME_END:', '') : 
            `⚠️ ${error}`
          }
          {error.startsWith('GAME_END:') && (
            <div style={{ marginTop: '10px' }}>
              <button 
                onClick={startNewGame}
                style={{
                  background: '#ffffff',
                  color: '#28a745',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Start New Game
              </button>
            </div>
          )}
        </div>
      )}

      {/* Elevated Game Info to avoid overlap */}
      <div className="game-info elevated">
        <div className="info-card">
          <h3>Dealer</h3>
          <div className="value">{currentDeal?.dealer || '-'}</div>
        </div>
        <div className="info-card">
          <h3>Deal #</h3>
          <div className="value">{currentDealNumber || '-'}</div>
        </div>
        <div className="info-card">
          <h3>Current Turn</h3>
          <div className="value">{currentBiddingPosition || '-'}</div>
        </div>
        <div className="info-card">
          <h3>Your Position</h3>
          <div className="value">{userPosition || '-'}</div>
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
              
              {!gameTerminated && isBiddingPhase && (
                <div className="special-calls">
                  <button
                    className="special-call pass"
                    onClick={() => makeCall('Pass')}
                    disabled={isLoading}
                  >
                    Pass
                  </button>
                  <button
                    className="special-call double"
                    onClick={() => makeCall('X')}
                    disabled={isLoading || !isLegalBid('X')}
                  >
                    Double
                  </button>
                  <button
                    className="special-call redouble"
                    onClick={() => makeCall('XX')}
                    disabled={isLoading || !isLegalBid('XX')}
                  >
                    Redouble
                  </button>
                </div>
              )}

              {!gameTerminated && isBiddingPhase && (
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
            </>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <h3>Reviewing Completed Deal #{currentDealNumber}</h3>
              <p style={{ color: '#666', marginTop: '10px' }}>
                This deal has been completed. Use the navigation buttons below to browse through your history.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="game-controls">
        {viewMode === 'practice' ? (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="create-session"
              onClick={() => {
                loadDealHistory();
              }}
              disabled={isLoading}
              style={{ padding: '10px 20px' }}
            >
              📜 View History
            </button>
            {gameTerminated && (
              <button
                className="create-session"
                onClick={startNewGame}
                disabled={isLoading}
                style={{ padding: '10px 20px', background: '#28a745' }}
              >
                🔄 New Game
              </button>
            )}
          </div>
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