import React, { useState, useEffect } from 'react';
import { sessionService } from '../utils/gameService';
import './GameArea.css';


function GameAreaConnected({ session, onBackToSessions, onShowProgressView, reloadTimestamp, onReloadComplete, initialDealNumber, onDealChange }) {
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
  const handleUndoBid = async () => {
    // Check if session exists
    if (!session || !session.id) {
      console.error("session is missing, cannot undo bid");
      return;
    }
  
    // Check if total deals is valid
    if (!totalDeals || totalDeals < 1) {
      console.error("totalDeals error");
      return;
    }
    // Get previous deal number
    const previousDealNumber = currentDealNumber > 1 ? currentDealNumber - 1 : totalDeals;
  
    try {
      const response = await sessionService.undoPreviousBid(session.id, previousDealNumber);
  
      // Update
      if (response.deal && response.deal.deal_number) {
        setCurrentDealNumber(response.deal.deal_number);
        const newDeal = await sessionService.getDeal(session.id, response.deal.deal_number);
        setCurrentDeal(newDeal);
      }
  
      if (response.user_sequence) {
        setUserSequence(response.user_sequence);
        
      }
  
      if (response.position) {
        setCurrentBiddingPosition(response.position);
      }
  
    } catch (error) {
      console.error("undo bid error:", error);
    }
  };


  // Load initial deal from backend when component mounts
  useEffect(() => {
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

    // If we have an initialDealNumber (coming back from progress view), load that specific deal
    if (initialDealNumber) {
      loadSpecificDeal(initialDealNumber);
    } else {
      loadNextPractice();
    }
  }, [session.id]);

  // Reload when reloadTimestamp is set (e.g., after rewind)
  useEffect(() => {
    if (reloadTimestamp && onReloadComplete) {
      reloadCurrentDeal().then(() => {
        onReloadComplete(); // Clear the timestamp after reload
      });
    }
  }, [reloadTimestamp]);


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
      const response = await sessionService.getNextPractice(session.id, currentDealNumber || 0);


      if (response.completed && !response.deal) {
        // No deals at all in session
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
      if (onDealChange) onDealChange(response.deal.deal_number);
      setCurrentBiddingPosition(response.position);
      setUserSequence(response.user_sequence || []);
      setTotalDeals(response.total_deals);
      setAlertText('');

      // Show info message if all deals are completed
      if (response.all_completed) {
        setError('INFO:All deals in this session are completed. Showing completed deal for review.');
      }
    } catch (err) {
      setError('Failed to load next practice. Please try again.');
      console.error('Practice loading error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSpecificDeal = async (dealNumber) => {
    setIsLoading(true);
    setError('');

    try {
      // Get the specific deal from backend
      const dealResponse = await sessionService.getDeal(session.id, dealNumber);

      if (dealResponse.error) {
        setError(dealResponse.error);
        return;
      }

      // Get user sequences for this deal
      const seqResponse = await sessionService.getUserSequences(session.id, dealNumber);

      if (seqResponse.error) {
        setError(seqResponse.error);
        return;
      }

      // Find current user's sequence
      const currentUserSequence = seqResponse.user_sequences?.find(
        seq => seq.user_id === JSON.parse(localStorage.getItem('user') || '{}').id
      );

      // Set the deal and user sequence
      setCurrentDeal(dealResponse);
      setCurrentDealNumber(dealNumber);
      if (onDealChange) onDealChange(dealNumber);
      setUserSequence(currentUserSequence?.sequence || []);

      // Determine next position to act
      if (currentUserSequence?.sequence && currentUserSequence.sequence.length > 0) {
        const lastCall = currentUserSequence.sequence[currentUserSequence.sequence.length - 1];
        const positions = ['N', 'E', 'S', 'W'];
        const lastPosIdx = positions.indexOf(lastCall.position);
        const nextPosIdx = (lastPosIdx + 1) % 4;
        setCurrentBiddingPosition(positions[nextPosIdx]);
      } else {
        setCurrentBiddingPosition(dealResponse.dealer);
      }

      setAlertText('');
    } catch (err) {
      setError('Failed to load deal. Please try again.');
      console.error('Deal loading error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const reloadCurrentDeal = async () => {
    if (!currentDealNumber) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Get the specific deal from backend
      const dealResponse = await sessionService.getDeal(session.id, currentDealNumber);

      if (dealResponse.error) {
        setError(dealResponse.error);
        return;
      }

      // Get user sequences for this deal
      const seqResponse = await sessionService.getUserSequences(session.id, currentDealNumber);

      if (seqResponse.error) {
        setError(seqResponse.error);
        return;
      }

      // Find current user's sequence
      const currentUserSequence = seqResponse.user_sequences?.find(
        seq => seq.user_id === JSON.parse(localStorage.getItem('user') || '{}').id
      );

      // Set the deal and user sequence
      setCurrentDeal(dealResponse);
      setUserSequence(currentUserSequence?.sequence || []);

      // Determine next position to act
      if (currentUserSequence?.sequence && currentUserSequence.sequence.length > 0) {
        const lastCall = currentUserSequence.sequence[currentUserSequence.sequence.length - 1];
        const positions = ['N', 'E', 'S', 'W'];
        const lastPosIdx = positions.indexOf(lastCall.position);
        const nextPosIdx = (lastPosIdx + 1) % 4;
        setCurrentBiddingPosition(positions[nextPosIdx]);
      } else {
        setCurrentBiddingPosition(dealResponse.dealer);
      }

      setAlertText('');
    } catch (err) {
      setError('Failed to reload deal. Please try again.');
      console.error('Deal reload error:', err);
    } finally {
      setIsLoading(false);
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


    // Validate the call before sending to backend
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
    const positions = ['W', 'N', 'E', 'S'];
    const dealer = currentDeal?.dealer || 'N';
    let toActSeat = dealer;
    let highestBid = null;
    let dblStatus = '';
    let consecutivePasses = 0;
    let auctionEnded = false;
    let finalContract = null;


    // Process each call in sequence
    for (let i = 0; i < userSequence.length; i++) {
      const call = userSequence[i];
      const callText = call.call;


      // Normalize call format
      let normalizedCall = callText;
      if (normalizedCall === 'P') normalizedCall = 'Pass';
      if (normalizedCall === 'Double') normalizedCall = 'X';
      if (normalizedCall === 'Redouble') normalizedCall = 'XX';


      // Update state based on the call
      if (normalizedCall === 'Pass') {
        consecutivePasses++;
        // Check for auction end conditions
        if (consecutivePasses === 4 && !highestBid) {
          auctionEnded = true; // Passed out
          finalContract = 'Passed Out';
          break;
        }
        if (consecutivePasses === 3 && highestBid) {
          auctionEnded = true; // Three passes after a bid
          finalContract = highestBid.bid;
          if (dblStatus) finalContract += dblStatus;
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
      history: userSequence,
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

  // FIXED: Function to properly parse cards string and handle "10" as literal "10"
  const parseCards = (cardsString) => {
    if (!cardsString) return [];
    
    const cards = [];
    let i = 0;
    
    while (i < cardsString.length) {
      // Check if we have "10" (two characters)
      if (i < cardsString.length - 1 && cardsString[i] === '1' && cardsString[i + 1] === '0') {
        cards.push('10');
        i += 2; // Skip both '1' and '0'
      }
      // Check if we have "T" (representing 10)
      else if (cardsString[i] === 'T') {
        cards.push('10');
        i++;
      }
      // Handle other single character cards
      else {
        cards.push(cardsString[i]);
        i++;
      }
    }
    
    return cards;
  };

  // Function to sort cards in proper order
  const sortCards = (cardsString) => {
    if (!cardsString) return [];
    
    // Define card order for sorting (10 included in proper position)
    const cardOrder = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
    
    // Use the parseCards function to properly handle "10"
    const cards = parseCards(cardsString);
    
    return cards.sort((a, b) => {
      const aIndex = cardOrder.indexOf(a);
      const bIndex = cardOrder.indexOf(b);
      return aIndex - bIndex;
    });
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
        <div className={`position north ${currentBiddingPosition === tablePositions.north ? 'current-bidder' : ''}`}>
          <div className="position-label">
            {tablePositions.north === userPosition ? `${positionNames[tablePositions.north]} (Partner)` : positionNames[tablePositions.north]}
            {currentBiddingPosition === tablePositions.north && <span className="bidding-indicator">🎯</span>}
          </div>
          <div className="cards">
            {(currentBiddingPosition === tablePositions.north || viewMode === 'history') ? (
              currentDeal.hands[tablePositions.north] && Object.entries(currentDeal.hands[tablePositions.north]).map(([suit, cards]) => (
                <div key={suit} className="suit-row">
                  <span className={`suit-symbol suit-${suit.toLowerCase()}`}>
                    {getSuitSymbol(suit)}
                  </span>
                  <div className="cards-list">
                    {sortCards(cards).map((card, index) => {
                      const suitSymbol = getSuitSymbol(suit);
                      const isRed = suit === 'H' || suit === 'D';
                      return (
                        <div key={index} className={`card ${isRed ? 'red' : 'black'} card-animate`} style={{ animationDelay: `${index * 0.1}s` }}>
                          <div className="card-content">
                            <span className="card-value">{card}</span>
                            <span className="card-suit">{suitSymbol}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="card-back-container">
                {[...Array(13)].map((_, i) => (
                  <div key={i} className="card card-back card-animate" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="card-pattern"></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>


        {/* West position (left) */}
        <div className={`position west ${currentBiddingPosition === tablePositions.west ? 'current-bidder' : ''}`}>
          <div className="position-label">
            {positionNames[tablePositions.west]}
            {currentBiddingPosition === tablePositions.west && <span className="bidding-indicator">🎯</span>}
          </div>
          <div className="cards">
            {(currentBiddingPosition === tablePositions.west || viewMode === 'history') ? (
              currentDeal.hands[tablePositions.west] && Object.entries(currentDeal.hands[tablePositions.west]).map(([suit, cards]) => (
                <div key={suit} className="suit-row">
                  <span className={`suit-symbol suit-${suit.toLowerCase()}`}>
                    {getSuitSymbol(suit)}
                  </span>
                  <div className="cards-list">
                    {sortCards(cards).map((card, index) => {
                      const suitSymbol = getSuitSymbol(suit);
                      const isRed = suit === 'H' || suit === 'D';
                      return (
                        <div key={index} className={`card ${isRed ? 'red' : 'black'} card-animate`} style={{ animationDelay: `${index * 0.1}s` }}>
                          <div className="card-content">
                            <span className="card-value">{card}</span>
                            <span className="card-suit">{suitSymbol}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="card-back-container">
                {[...Array(13)].map((_, i) => (
                  <div key={i} className="card card-back card-animate" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="card-pattern"></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>


        {/* East position (right) */}
        <div className={`position east ${currentBiddingPosition === tablePositions.east ? 'current-bidder' : ''}`}>
          <div className="position-label">
            {positionNames[tablePositions.east]}
            {currentBiddingPosition === tablePositions.east && <span className="bidding-indicator">🎯</span>}
          </div>
          <div className="cards">
            {(currentBiddingPosition === tablePositions.east || viewMode === 'history') ? (
              currentDeal.hands[tablePositions.east] && Object.entries(currentDeal.hands[tablePositions.east]).map(([suit, cards]) => (
                <div key={suit} className="suit-row">
                  <span className={`suit-symbol suit-${suit.toLowerCase()}`}>
                    {getSuitSymbol(suit)}
                  </span>
                  <div className="cards-list">
                    {sortCards(cards).map((card, index) => {
                      const suitSymbol = getSuitSymbol(suit);
                      const isRed = suit === 'H' || suit === 'D';
                      return (
                        <div key={index} className={`card ${isRed ? 'red' : 'black'} card-animate`} style={{ animationDelay: `${index * 0.1}s` }}>
                          <div className="card-content">
                            <span className="card-value">{card}</span>
                            <span className="card-suit">{suitSymbol}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="card-back-container">
                {[...Array(13)].map((_, i) => (
                  <div key={i} className="card card-back card-animate" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="card-pattern"></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>


        {/* South position (bottom) - User position but only show cards when it's their turn or in history mode */}
        <div className={`position south ${currentBiddingPosition === userPosition ? 'current-bidder' : ''}`}>
          <div className="position-label">
            {positionNames[userPosition]} (You)
            {currentBiddingPosition === userPosition && <span className="bidding-indicator">🎯</span>}
          </div>
          <div className="cards">
            {(currentBiddingPosition === userPosition || viewMode === 'history') ? (
              currentDeal.hands[userPosition] && Object.entries(currentDeal.hands[userPosition]).map(([suit, cards]) => (
                <div key={suit} className="suit-row">
                  <span className={`suit-symbol suit-${suit.toLowerCase()}`}>
                    {getSuitSymbol(suit)}
                  </span>
                  <div className="cards-list">
                    {sortCards(cards).map((card, index) => {
                      const suitSymbol = getSuitSymbol(suit);
                      const isRed = suit === 'H' || suit === 'D';
                      return (
                        <div key={index} className={`card ${isRed ? 'red' : 'black'} card-animate`} style={{ animationDelay: `${index * 0.1}s` }}>
                          <div className="card-content">
                            <span className="card-value">{card}</span>
                            <span className="card-suit">{suitSymbol}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="card-back-container">
                {[...Array(13)].map((_, i) => (
                  <div key={i} className="card card-back card-animate" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="card-pattern"></div>
                  </div>
                ))}
              </div>
            )}
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
      <div className="auction-container">
        <div className="auction-table">
          <div className="auction-header">West</div>
          <div className="auction-header">North</div>
          <div className="auction-header">East</div>
          <div className="auction-header">South</div>
          {rows.map((row, rowIndex) => (
            row.map((cell, colIndex) => (
              <div key={`${rowIndex}-${colIndex}`} className={`auction-cell ${cell ? 'has-call' : ''}`}>
                {cell ? (
                  <div className="auction-call-container">
                    <span
                      className={`call-text ${cell.call && cell.call.match(/^[1-7]/) ? 'bid' : ''}`}
                      data-call={cell.call}
                    >
                      {formatBid(cell.call)}
                    </span>
                    {cell.alert && <span className="alert-indicator">✱</span>}
                  </div>
                ) : (
                  <span className="empty-cell">-</span>
                )}
              </div>
            ))
          ))}
        </div>
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
                  className={`bid-button suit-${suit === 'NT' ? 'nt' : suit.toLowerCase()} ${isLegal ? 'legal' : 'illegal'}`}
                  onClick={() => makeCall(bid)}
                  disabled={!isLegal || isLoading || getAuctionState().auctionEnded}
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


  if (isLoading && !currentDeal) {
    return <div className="loading">Loading deal...</div>;
  }


  return (
    <div className="game-area">
      <div className="game-header">
        
        <button className="back-btn" onClick={onBackToSessions}>
          ← Back to Sessions
        </button>
        
        <h2>{session.name} {viewMode === 'history' ? '- History Review' : ''}</h2>
        <div className="sync-status">
          {isSyncing && <span>🔄 Syncing...</span>}
          {!isSyncing && lastSyncTime && (
            <span>✓ Synced {Math.floor((new Date() - lastSyncTime) / 1000)}s ago</span>
          )}
        </div>
      </div>

      {currentDealNumber && onShowProgressView && (
        <div className="progress-section">
          <button className="progress-btn" onClick={() => onShowProgressView(currentDealNumber)}>
            My Progress
          </button>
        </div>
      )}


      {error && (
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
                className="special-call pass-btn"
                onClick={() => makeCall('Pass')}
                disabled={isLoading || getAuctionState().auctionEnded}
              >
                Pass
              </button>
              <button
                className="special-call double-btn"
                onClick={() => makeCall('X')}
                disabled={isLoading || !isLegalBid('X')}
              >
                Double (X)
              </button>
              <button
                className="special-call redouble-btn"
                onClick={() => makeCall('XX')}
                disabled={isLoading || !isLegalBid('XX')}
              >
                Redouble (XX)
              </button>
            </div>
          )}
          {viewMode === 'practice' && (
            <div className="special-calls">   
              <button
                className="special-call"
                onClick={handleUndoBid}
                disabled={isLoading || userSequence.length === 0 || getAuctionState().auctionEnded}
                style={{ backgroundColor: '#ff9800' }}
              >
              Undo Last Bid
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