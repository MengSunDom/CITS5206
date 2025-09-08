import React, { useState } from 'react';
import './GameArea.css';

function GameArea({ session, onBackToSessions, onShowTreeView, onUpdateSession }) {
  const [currentDeal, setCurrentDeal] = useState(1);
  const [currentPosition, setCurrentPosition] = useState('South');
  const [auctionHistory, setAuctionHistory] = useState([]);
  const [hands, setHands] = useState({});
  const [dealer, setDealer] = useState('North');
  const [vulnerability, setVulnerability] = useState('None');
  const [alertText, setAlertText] = useState('');

  // Initialize game when component loads
  React.useEffect(() => {
    if (session.deals.length === 0) {
      createInitialDeal();
    }
  }, []);

  // Simple function to create initial deal
  const createInitialDeal = () => {
    const newHands = dealCards();
    setHands(newHands);
    setDealer(getDealerForDeal(currentDeal));
    setVulnerability(getVulnerabilityForDeal(currentDeal));
    
    // Save deal to session
    const dealData = {
      dealNumber: currentDeal,
      hands: newHands,
      dealer: getDealerForDeal(currentDeal),
      vulnerability: getVulnerabilityForDeal(currentDeal),
      players: {}
    };
    
    const updatedSession = {
      ...session,
      deals: [...session.deals, dealData]
    };
    onUpdateSession(updatedSession);
  };

  // Simple function to deal cards
  const dealCards = () => {
    const deck = shuffleDeck();
    const newHands = {
      North: deck.slice(0, 13),
      East: deck.slice(13, 26),
      South: deck.slice(26, 39),
      West: deck.slice(39, 52)
    };
    return newHands;
  };

  // Simple function to shuffle deck
  const shuffleDeck = () => {
    const deck = [];
    const suits = ['S', 'H', 'D', 'C'];
    const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
    
    // Create deck
    for (let i = 0; i < suits.length; i++) {
      for (let j = 0; j < ranks.length; j++) {
        deck.push({suit: suits[i], rank: ranks[j]});
      }
    }
    
    // Simple shuffle
    for (let i = 0; i < deck.length; i++) {
      const randomIndex = Math.floor(Math.random() * deck.length);
      const temp = deck[i];
      deck[i] = deck[randomIndex];
      deck[randomIndex] = temp;
    }
    
    return deck;
  };

  // Simple function to get dealer for deal
  const getDealerForDeal = (dealNum) => {
    const dealIndex = (dealNum - 1) % 16;
    const dealerIndex = dealIndex % 4;
    const positions = ['North', 'East', 'South', 'West'];
    return positions[dealerIndex];
  };

  // Simple function to get vulnerability for deal
  const getVulnerabilityForDeal = (dealNum) => {
    const dealIndex = (dealNum - 1) % 16;
    const vulnIndex = Math.floor(dealIndex / 4);
    const vulnerabilities = ['None', 'N-S', 'E-W', 'Both'];
    return vulnerabilities[vulnIndex];
  };

  // Simple function to make a call
  const makeCall = (call) => {
    const callObj = {
      position: currentPosition,
      call: call,
      alert: alertText,
      type: call.match(/^[1-7]/) ? 'bid' : 'action'
    };
    
    const newAuctionHistory = [...auctionHistory, callObj];
    setAuctionHistory(newAuctionHistory);
    setAlertText('');
    
    // Move to next position
    const positions = ['West', 'North', 'East', 'South'];
    let currentIndex = -1;
    for (let i = 0; i < positions.length; i++) {
      if (positions[i] === currentPosition) {
        currentIndex = i;
        break;
      }
    }
    
    const nextIndex = (currentIndex + 1) % 4;
    const nextPosition = positions[nextIndex];
    setCurrentPosition(nextPosition);
    
    // Check if auction is complete
    let totalPasses = 0;
    for (let i = 0; i < newAuctionHistory.length; i++) {
      if (newAuctionHistory[i].call === 'Pass') {
        totalPasses = totalPasses + 1;
      }
    }
    
    if (totalPasses >= 3) {
      handleAuctionComplete();
    }
  };

  // Simple function to handle auction completion
  const handleAuctionComplete = () => {
    alert('Auction complete! 3 passes have been used.');
  };

  // Simple function to start new deal
  const newDeal = () => {
    setCurrentDeal(currentDeal + 1);
    setAuctionHistory([]);
    const newDealer = getDealerForDeal(currentDeal + 1);
    setCurrentPosition(newDealer);
    setDealer(newDealer);
    setVulnerability(getVulnerabilityForDeal(currentDeal + 1));
    createInitialDeal();
  };

  // Simple function to generate bid buttons
  const generateBidButtons = () => {
    const levels = ['1', '2', '3', '4', '5', '6', '7'];
    const suits = ['C', 'D', 'H', 'S', 'NT'];
    const buttons = [];
    
    for (let i = 0; i < levels.length; i++) {
      for (let j = 0; j < suits.length; j++) {
        const level = levels[i];
        const suit = suits[j];
        const bid = level + suit;
        const isLegal = isLegalBid(bid);
        
        const button = (
          <button
            key={bid}
            className={`bid-button suit-${suit === 'NT' ? 'nt' : suit.toLowerCase()}`}
            onClick={() => makeCall(bid)}
            disabled={!isLegal}
          >
            <div className="bid-content">
              {level}<br/>{getSuitSymbol(suit)}
            </div>
          </button>
        );
        
        buttons.push(button);
      }
    }
    
    return buttons;
  };

  // Simple function to check if bid is legal
  const isLegalBid = (bid) => {
    if (auctionHistory.length === 0) return true;
    
    let lastBid = null;
    for (let i = auctionHistory.length - 1; i >= 0; i--) {
      if (auctionHistory[i].type === 'bid') {
        lastBid = auctionHistory[i];
        break;
      }
    }
    
    if (!lastBid) return true;
    
    const bidValue = getBidValue(bid);
    const lastBidValue = getBidValue(lastBid.call);
    
    return bidValue > lastBidValue;
  };

  // Simple function to get bid value
  const getBidValue = (bid) => {
    if (!bid.match(/^[1-7][CDHSNT]+$/)) return -1;
    
    const level = parseInt(bid[0]);
    const suit = bid.substring(1);
    const suitValues = {'C': 0, 'D': 1, 'H': 2, 'S': 3, 'NT': 4};
    
    return level * 5 + suitValues[suit];
  };

  // Simple function to get suit symbol
  const getSuitSymbol = (suit) => {
    if (suit === 'S') return '♠';
    if (suit === 'H') return '♥';
    if (suit === 'D') return '♦';
    if (suit === 'C') return '♣';
    if (suit === 'NT') return 'NT';
    return suit;
  };

  return (
    <div className="game-area">
      <div className="game-header">
        <button className="back-btn" onClick={onBackToSessions}>
          ← Back to Sessions
        </button>
        <h2>{session.name} - Deal {currentDeal}</h2>
      </div>

      <div className="game-info">
        <div className="info-card">
          <h3>Current Deal</h3>
          <div className="value">{currentDeal}</div>
        </div>
        <div className="info-card">
          <h3>Dealer</h3>
          <div className="value">{dealer}</div>
        </div>
        <div className="info-card">
          <h3>Vulnerability</h3>
          <div className="value">{vulnerability}</div>
        </div>
        <div className="info-card">
          <h3>Current Position</h3>
          <div className="value">{currentPosition}</div>
        </div>
      </div>

      <div className="bridge-table">
        <div className="position north">
          <div className="position-label">North</div>
          <div className="cards" id="northCards">
            {/* Cards will be displayed here */}
          </div>
        </div>
        <div className="position west">
          <div className="position-label">West</div>
          <div className="cards" id="westCards">
            {/* Cards will be displayed here */}
          </div>
        </div>
        <div className="position east">
          <div className="position-label">East</div>
          <div className="cards" id="eastCards">
            {/* Cards will be displayed here */}
          </div>
        </div>
        <div className="position south">
          <div className="position-label">South (You)</div>
          <div className="cards" id="southCards">
            {/* Cards will be displayed here */}
          </div>
        </div>
      </div>

      <div className="bidding-area">
        <div className="auction-history">
          <h3>Auction History</h3>
          <div className="auction-table">
            <div className="auction-header">West</div>
            <div className="auction-header">North</div>
            <div className="auction-header">East</div>
            <div className="auction-header">South</div>
            {/* Auction history rows will be generated here */}
          </div>
        </div>

        <div className="bid-controls">
          <h3>Make Your Call</h3>
          <div className="bid-buttons">
            {generateBidButtons()}
          </div>
          <div className="special-calls">
            <button className="special-call" onClick={() => makeCall('Pass')}>
              Pass
            </button>
            <button className="special-call" onClick={() => makeCall('X')}>
              Double (X)
            </button>
            <button className="special-call" onClick={() => makeCall('XX')}>
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
            />
          </div>
        </div>
      </div>

      <div className="game-controls">
        <button className="create-session tree-btn" onClick={onShowTreeView}>
          View Auction Tree
        </button>
        <button className="create-session pause-btn">
          Pause Game
        </button>
        <button className="create-session next-btn" onClick={newDeal}>
          Next Deal
        </button>
      </div>
    </div>
  );
}

export default GameArea;
