import random
from typing import Dict, List

def create_deck():
    """Create a standard 52-card deck"""
    suits = ['S', 'H', 'D', 'C']  # Spades, Hearts, Diamonds, Clubs
    ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']
    deck = []

    for suit in suits:
        for rank in ranks:
            deck.append({'suit': suit, 'rank': rank})

    return deck

def shuffle_and_deal():
    """Shuffle deck and deal 13 cards to each of 4 positions.

    Uses Python's random.shuffle() which implements the Fisher-Yates/Knuth shuffle algorithm.
    This ensures a uniformly random distribution of cards as required by bridge standards.

    Returns:
        dict: Hands for each position (N, E, S, W) with 13 cards each
    """
    deck = create_deck()

    # Fisher-Yates/Knuth shuffle via Python's random.shuffle()
    # This provides O(n) time complexity and uniform randomness
    random.shuffle(deck)

    hands = {
        'N': deck[0:13],
        'E': deck[13:26],
        'S': deck[26:39],
        'W': deck[39:52]
    }

    # Sort each hand by suit and rank
    for position in hands:
        hands[position] = sort_hand(hands[position])

    return hands

def sort_hand(cards: List[Dict]) -> Dict[str, List[str]]:
    """Sort a hand of cards by suit and rank"""
    suits_order = {'S': 0, 'H': 1, 'D': 2, 'C': 3}
    rank_order = {'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10,
                  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5,
                  '4': 4, '3': 3, '2': 2}

    # Group cards by suit
    hand_by_suit = {'S': [], 'H': [], 'D': [], 'C': []}

    for card in cards:
        suit = card['suit']
        rank = card['rank']
        hand_by_suit[suit].append(rank)

    # Sort ranks within each suit
    for suit in hand_by_suit:
        hand_by_suit[suit].sort(key=lambda x: rank_order[x], reverse=True)
        # Convert to string format
        hand_by_suit[suit] = ''.join(hand_by_suit[suit])

    return hand_by_suit

def get_next_position(current_position: str) -> str:
    """Get the next position in clockwise order"""
    positions = ['W', 'N', 'E', 'S']
    current_index = positions.index(current_position)
    next_index = (current_index + 1) % 4
    return positions[next_index]

def is_auction_complete(auction_history: List[Dict]) -> bool:
    """Check if auction is complete (3 consecutive passes or 4 passes at start)"""
    if not auction_history:
        return False

    # Check for 4 passes (all pass)
    if len(auction_history) == 4:
        if all(call.get('call') == 'Pass' for call in auction_history):
            return True

    # Check for 3 consecutive passes after a bid
    if len(auction_history) >= 4:
        last_three = auction_history[-3:]
        if all(call.get('call') == 'Pass' for call in last_three):
            # Ensure there was at least one bid
            for call in auction_history[:-3]:
                if call.get('type') == 'bid':
                    return True

    return False

def calculate_bid_value(bid: str) -> int:
    """Calculate numeric value of a bid for comparison"""
    if not bid or not bid[0].isdigit():
        return -1

    level = int(bid[0])
    suit = bid[1:]
    suit_values = {'C': 0, 'D': 1, 'H': 2, 'S': 3, 'NT': 4}

    if suit not in suit_values:
        return -1

    return level * 5 + suit_values[suit]

def generate_random_hands():
    """Generate random hands for a bridge deal
    This is an alias for shuffle_and_deal() for backward compatibility"""
    return shuffle_and_deal()