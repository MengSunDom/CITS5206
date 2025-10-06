import React from 'react';
import { formatBid, createAuctionGrid } from '../utils/bridgeUtils';

/**
 * AuctionHistory component - displays the bidding sequence
 * Separates auction display from game logic
 */
const AuctionHistory = ({ userSequence, dealer }) => {
  if (!userSequence || userSequence.length === 0) {
    return <p>No bids yet. Dealer: {dealer || 'N'} starts.</p>;
  }

  const rows = createAuctionGrid(dealer || 'N', userSequence);

  return (
    <div className="auction-container">
      <div className="auction-table">
        <div className="auction-header">West</div>
        <div className="auction-header">North</div>
        <div className="auction-header">East</div>
        <div className="auction-header">South</div>
        {rows.map((row, rowIndex) =>
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
        )}
      </div>
    </div>
  );
};

export default AuctionHistory;
