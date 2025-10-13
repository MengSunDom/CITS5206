// Bridge game utility functions
// This module contains pure functions for bridge game logic

/**
 * Get suit symbol for display
 */
export const getSuitSymbol = (suit) => {
  const symbols = {
    'S': '♠',
    'H': '♥',
    'D': '♦',
    'C': '♣',
    'NT': 'NT'
  };
  return symbols[suit] || suit;
};

/**
 * Parse cards string and handle "10" as literal "10"
 */
export const parseCards = (cardsString) => {
  if (!cardsString) return [];

  const cards = [];
  let i = 0;

  while (i < cardsString.length) {
    // Check if we have "10" (two characters)
    if (i < cardsString.length - 1 && cardsString[i] === '1' && cardsString[i + 1] === '0') {
      cards.push('10');
      i += 2;
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

/**
 * Sort cards in proper order
 */
export const sortCards = (cardsString) => {
  if (!cardsString) return [];

  const cardOrder = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
  const cards = parseCards(cardsString);

  return cards.sort((a, b) => {
    const aIndex = cardOrder.indexOf(a);
    const bIndex = cardOrder.indexOf(b);
    return aIndex - bIndex;
  });
};

/**
 * Calculate bid value for comparison
 */
export const getBidValue = (bid) => {
  if (!bid.match(/^[1-7][CDHSNT]+$/)) return -1;

  const level = parseInt(bid[0]);
  const suit = bid.substring(1);
  const suitValues = { 'C': 0, 'D': 1, 'H': 2, 'S': 3, 'NT': 4 };

  return level * 5 + suitValues[suit];
};

/**
 * Validate a bridge call (bid, pass, double, redouble)
 */
export const validateCall = (auctionState, call, seat) => {
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
    if (!highestBid) {
      return { ok: false, error: "Illegal double: no bid to double" };
    }
    if (dblStatus !== '') {
      return { ok: false, error: "Illegal double: current contract is already doubled or redoubled" };
    }
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
    if (!highestBid) {
      return { ok: false, error: "Illegal redouble: no bid to redouble" };
    }
    if (dblStatus !== 'X') {
      return { ok: false, error: "Illegal redouble: current contract is not doubled" };
    }
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

/**
 * Get auction state from sequence of calls
 */
export const getAuctionState = (userSequence, dealer) => {
  const positions = ['W', 'N', 'E', 'S'];
  let toActSeat = dealer || 'N';
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
        auctionEnded = true;
        finalContract = 'Passed Out';
        break;
      }
      if (consecutivePasses === 3 && highestBid) {
        auctionEnded = true;
        finalContract = highestBid.bid;
        if (dblStatus) finalContract += dblStatus;
        break;
      }
    } else {
      consecutivePasses = 0;

      if (normalizedCall.match(/^[1-7][CDHSNT]+$/)) {
        highestBid = { bid: normalizedCall, seat: call.position };
        dblStatus = '';
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

/**
 * Rotate position for display (so user always appears at South)
 */
export const rotatePosition = (position, userPosition) => {
  const positions = ['N', 'E', 'S', 'W'];
  const userIdx = positions.indexOf(userPosition);
  const posIdx = positions.indexOf(position);

  // Calculate rotation needed to put user at South (index 2)
  const rotation = (posIdx - userIdx + 2) % 4;
  return positions[rotation];
};

/**
 * Get display positions after rotation
 */
export const getDisplayPositions = (userPosition) => {
  return {
    'N': rotatePosition('N', userPosition),
    'E': rotatePosition('E', userPosition),
    'S': rotatePosition('S', userPosition),
    'W': rotatePosition('W', userPosition)
  };
};

/**
 * Format bid with suit symbols
 */
export const formatBid = (bid) => {
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

/**
 * Create auction grid with proper dealer offset
 */
export const createAuctionGrid = (dealerSeat, sequence) => {
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

/**
 * Get position names
 */
export const getPositionNames = () => ({
  'N': 'North',
  'E': 'East',
  'S': 'South',
  'W': 'West'
});
