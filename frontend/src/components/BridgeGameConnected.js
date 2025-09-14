import React, { useState, useEffect } from 'react';
import { sessionService } from '../utils/gameService';
import './BridgeGame.css';

function BridgeGameConnected({ session, onBack }) {
  const [biddingHistory, setBiddingHistory] = useState([]);
  const [currentBid, setCurrentBid] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session) {
      loadBiddingHistory();
    }
  }, [session]);

  const loadBiddingHistory = async () => {
    try {
      const data = await sessionService.getBiddingHistory(session.id);
      setBiddingHistory(data.bidding_history || []);
    } catch (err) {
      console.error('Failed to load bidding history:', err);
    }
  };

  const handleBidSubmit = async (bidAction) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await sessionService.makeBid(session.id, bidAction);

      if (response.error) {
        setError(response.error);
      } else {
        // Reload bidding history after successful bid
        await loadBiddingHistory();
        setCurrentBid('');
      }
    } catch (err) {
      setError('Failed to submit bid. Please try again.');
      console.error('Bid submission error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const renderBidButtons = () => {
    const levels = ['1', '2', '3', '4', '5', '6', '7'];
    const suits = ['C', 'D', 'H', 'S', 'NT'];
    const suitSymbols = {
      'C': '♣',
      'D': '♦',
      'H': '♥',
      'S': '♠',
      'NT': 'NT'
    };
    const suitColors = {
      'C': 'black',
      'D': 'red',
      'H': 'red',
      'S': 'black',
      'NT': 'green'
    };

    return (
      <div className="bid-controls">
        <div className="bid-grid">
          {levels.map(level => (
            <div key={level} className="bid-row">
              <span className="level-label">{level}</span>
              {suits.map(suit => (
                <button
                  key={`${level}${suit}`}
                  className="bid-button"
                  style={{ color: suitColors[suit] }}
                  onClick={() => handleBidSubmit(`${level}${suit}`)}
                  disabled={isLoading}
                >
                  {level}{suitSymbols[suit]}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="special-bids">
          <button
            className="special-bid-button pass"
            onClick={() => handleBidSubmit('Pass')}
            disabled={isLoading}
          >
            Pass
          </button>
          <button
            className="special-bid-button double"
            onClick={() => handleBidSubmit('X')}
            disabled={isLoading}
          >
            Double (X)
          </button>
          <button
            className="special-bid-button redouble"
            onClick={() => handleBidSubmit('XX')}
            disabled={isLoading}
          >
            Redouble (XX)
          </button>
        </div>
      </div>
    );
  };

  const renderBiddingHistory = () => {
    if (biddingHistory.length === 0) {
      return <p>No bids yet. Start bidding!</p>;
    }

    return (
      <div className="bidding-history">
        <h3>Bidding History</h3>
        <div className="bid-list">
          {biddingHistory.map((item, index) => (
            <div key={index} className="bid-item">
              <span className="bid-position">{item.position}</span>
              <span className="bid-player">({item.player})</span>
              <span className="bid-value">{item.bid}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderHands = () => {
    if (!session.hands || Object.keys(session.hands).length === 0) {
      return <p>No hands dealt yet.</p>;
    }

    const positions = ['N', 'E', 'S', 'W'];
    const positionNames = {
      'N': 'North',
      'E': 'East',
      'S': 'South',
      'W': 'West'
    };

    return (
      <div className="hands-display">
        <h3>Hands</h3>
        <div className="hands-grid">
          {positions.map(position => (
            <div key={position} className="hand">
              <h4>{positionNames[position]}</h4>
              {session.hands[position] ? (
                <div className="cards">
                  {Object.entries(session.hands[position]).map(([suit, cards]) => (
                    <div key={suit} className="suit-row">
                      <span className="suit-symbol">
                        {suit === 'S' ? '♠' : suit === 'H' ? '♥' : suit === 'D' ? '♦' : '♣'}
                      </span>
                      <span className="cards-list">{cards}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No cards</p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bridge-game">
      <div className="game-header">
        <button onClick={onBack} className="back-button">
          ← Back to Sessions
        </button>
        <h2>{session.name}</h2>
        <div className="session-info">
          <span>Dealer: {session.dealer}</span>
          <span>Vulnerability: {session.vulnerability}</span>
        </div>
      </div>

      {error && (
        <div className="error-message" style={{ color: 'red', margin: '10px 0' }}>
          {error}
        </div>
      )}

      <div className="game-content">
        <div className="left-panel">
          {renderHands()}
          {renderBiddingHistory()}
        </div>

        <div className="right-panel">
          <h3>Make Your Bid</h3>
          {renderBidButtons()}
        </div>
      </div>
    </div>
  );
}

export default BridgeGameConnected;