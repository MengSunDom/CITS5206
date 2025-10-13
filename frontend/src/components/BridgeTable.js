import React from 'react';
import { getSuitSymbol, sortCards, getPositionNames, getDisplayPositions } from '../utils/bridgeUtils';

/**
 * Component to render a single hand at a position
 */
const HandDisplay = ({ position, hands, isVisible, currentBiddingPosition, positionLabel }) => {
  const getSuitClass = (suit) => `suit-${suit.toLowerCase()}`;
  const isCardRed = (suit) => suit === 'H' || suit === 'D';

  return (
    <div className={`position ${position.toLowerCase()} ${currentBiddingPosition === position ? 'current-bidder' : ''}`}>
      <div className="position-label">
        {positionLabel}
        {currentBiddingPosition === position && <span className="bidding-indicator">🎯</span>}
      </div>
      <div className="cards">
        {isVisible ? (
          hands[position] && Object.entries(hands[position]).map(([suit, cards]) => (
            <div key={suit} className="suit-row">
              <span className={`suit-symbol ${getSuitClass(suit)}`}>
                {getSuitSymbol(suit)}
              </span>
              <div className="cards-list">
                {sortCards(cards).map((card, index) => {
                  const suitSymbol = getSuitSymbol(suit);
                  const isRed = isCardRed(suit);
                  return (
                    <div
                      key={index}
                      className={`card ${isRed ? 'red' : 'black'} card-animate`}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
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
              <div
                key={i}
                className="card card-back card-animate"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="card-pattern"></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * BridgeTable component - displays the bridge table with all hands
 * Separates table rendering from game logic
 */
const BridgeTable = ({ currentDeal, currentBiddingPosition, userPosition, viewMode }) => {
  if (!currentDeal || !currentDeal.hands) {
    return <p>No hands dealt yet.</p>;
  }

  const displayPositions = getDisplayPositions(userPosition);
  const positionNames = getPositionNames();

  // Create rotated display with user always at South
  const tablePositions = {
    north: displayPositions['N'],
    east: displayPositions['E'],
    south: userPosition,
    west: displayPositions['W']
  };

  // Determine if a position's cards should be visible
  // Only show cards for the current bidding position
  const isPositionVisible = (position) => {
    return currentBiddingPosition === position;
  };

  // Get position label
  const getPositionLabel = (position, isUserPosition = false) => {
    if (isUserPosition) {
      return `${positionNames[position]} (You)`;
    }
    if (position === userPosition) {
      return `${positionNames[position]} (Partner)`;
    }
    return positionNames[position];
  };

  // Only render the hand for the current bidding position
  const getBiddingPositionLabel = () => {
    if (currentBiddingPosition === userPosition) {
      return `${positionNames[currentBiddingPosition]} (You)`;
    }
    if (currentBiddingPosition === displayPositions['N'] && tablePositions.north === userPosition) {
      return `${positionNames[currentBiddingPosition]} (Partner)`;
    }
    return positionNames[currentBiddingPosition];
  };

  return (
    <div className="bridge-table">
      {/* Only show current bidding position */}
      <HandDisplay
        position={currentBiddingPosition}
        hands={currentDeal.hands}
        isVisible={true}
        currentBiddingPosition={currentBiddingPosition}
        positionLabel={getBiddingPositionLabel()}
      />
    </div>
  );
};

export default BridgeTable;
