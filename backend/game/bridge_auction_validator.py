# Bridge Auction Validator - Comprehensive Implementation
# Based on standard bridge auction rules as specified in the prompt

from typing import Dict, List, Optional, Tuple

class AuctionState:
    """Maintains the state of a bridge auction"""

    def __init__(self, dealer: str = 'N'):
        self.positions = ['W', 'N', 'E', 'S']
        self.dealer = dealer
        self.to_act_seat = dealer
        self.highest_bid = None  # {'bid': '1NT', 'seat': 'N'}
        self.dbl_status = ''  # '', 'X', or 'XX'
        self.consecutive_passes = 0
        self.history = []
        self.auction_ended = False
        self.final_contract = None

    def get_next_seat(self, current_seat: str) -> str:
        """Get the next seat in clockwise order"""
        idx = self.positions.index(current_seat)
        return self.positions[(idx + 1) % 4]

    def is_same_partnership(self, seat1: str, seat2: str) -> bool:
        """Check if two seats belong to the same partnership"""
        idx1 = self.positions.index(seat1)
        idx2 = self.positions.index(seat2)
        return (idx1 % 2) == (idx2 % 2)

    def is_opponent_partnership(self, seat1: str, seat2: str) -> bool:
        """Check if two seats belong to opposite partnerships"""
        return not self.is_same_partnership(seat1, seat2)


def get_bid_value(bid: str) -> int:
    """Calculate numeric value of a bid for comparison

    Args:
        bid: A bid string like '1NT', '2C', '7S'

    Returns:
        Integer value for comparison, -1 if invalid
    """
    if not bid or len(bid) < 2 or not bid[0].isdigit():
        return -1

    level = int(bid[0])
    suit = bid[1:]

    # Suit hierarchy: C < D < H < S < NT
    suit_values = {'C': 0, 'D': 1, 'H': 2, 'S': 3, 'NT': 4}

    if suit not in suit_values:
        return -1

    return level * 5 + suit_values[suit]


def validate_call(state: AuctionState, call: str, seat: str) -> Dict[str, any]:
    """Validate a bridge auction call according to standard rules

    Args:
        state: Current auction state
        call: The call being made (bid, Pass, X, XX)
        seat: The seat making the call (W, N, E, S)

    Returns:
        Dict with 'ok' (bool) and optional 'error' (str) keys
    """

    # Check if auction has already ended
    if state.auction_ended:
        return {'ok': False, 'error': 'Auction already ended'}

    # Check if it's the correct seat's turn
    if seat != state.to_act_seat:
        return {'ok': False, 'error': f"It's {state.to_act_seat}'s turn to act, not {seat}'s"}

    # Normalize call format
    if call == 'P':
        call = 'Pass'
    elif call == 'Double':
        call = 'X'
    elif call == 'Redouble':
        call = 'XX'

    # Handle Pass - always legal
    if call == 'Pass':
        return {'ok': True}

    # Handle numbered bids (1C through 7NT)
    if len(call) >= 2 and call[0].isdigit():
        level = int(call[0])
        suit = call[1:]

        # Validate bid format
        if level < 1 or level > 7:
            return {'ok': False, 'error': f'Invalid bid level: {level}'}

        valid_suits = ['C', 'D', 'H', 'S', 'NT']
        if suit not in valid_suits:
            return {'ok': False, 'error': f'Invalid bid suit: {suit}'}

        # Check if bid is higher than current highest bid
        if state.highest_bid:
            new_bid_value = get_bid_value(call)
            current_bid_value = get_bid_value(state.highest_bid['bid'])

            if new_bid_value <= current_bid_value:
                return {
                    'ok': False,
                    'error': f'Illegal bid: not higher than current highest bid ({state.highest_bid["bid"]})'
                }

        return {'ok': True}

    # Handle Double (X)
    if call == 'X':
        # Must have a bid to double
        if not state.highest_bid:
            return {'ok': False, 'error': 'Illegal double: no bid to double'}

        # Cannot double if already doubled or redoubled
        if state.dbl_status != '':
            return {'ok': False, 'error': 'Illegal double: current contract is already doubled or redoubled'}

        # Can only double opponent's bid
        if not state.is_opponent_partnership(seat, state.highest_bid['seat']):
            return {'ok': False, 'error': 'Illegal double: opponents do not hold the current contract'}

        return {'ok': True}

    # Handle Redouble (XX)
    if call == 'XX':
        # Must have a bid to redouble
        if not state.highest_bid:
            return {'ok': False, 'error': 'Illegal redouble: no bid to redouble'}

        # Can only redouble a doubled bid
        if state.dbl_status != 'X':
            return {'ok': False, 'error': 'Illegal redouble: current contract is not doubled'}

        # Can only redouble own side's bid
        if not state.is_same_partnership(seat, state.highest_bid['seat']):
            return {'ok': False, 'error': 'Illegal redouble: your side is not currently doubled'}

        return {'ok': True}

    return {'ok': False, 'error': f'Unknown call: {call}'}


def update_auction_state(state: AuctionState, call: str, seat: str) -> None:
    """Update auction state after a valid call

    Args:
        state: Current auction state to update
        call: The validated call
        seat: The seat making the call
    """

    # Normalize call format
    if call == 'P':
        call = 'Pass'
    elif call == 'Double':
        call = 'X'
    elif call == 'Redouble':
        call = 'XX'

    # Add to history
    state.history.append({'position': seat, 'call': call})

    # Handle Pass
    if call == 'Pass':
        state.consecutive_passes += 1

        # Check for auction end conditions
        if state.consecutive_passes == 4 and not state.highest_bid:
            # All pass - auction ends with no contract
            state.auction_ended = True
            state.final_contract = 'Passed Out'
        elif state.consecutive_passes == 3 and state.highest_bid:
            # Three passes after a bid - auction ends
            state.auction_ended = True
            contract = state.highest_bid['bid']
            if state.dbl_status:
                contract += state.dbl_status
            state.final_contract = contract
    else:
        # Non-pass resets consecutive pass counter
        state.consecutive_passes = 0

        # Handle numbered bids
        if call[0].isdigit():
            state.highest_bid = {'bid': call, 'seat': seat}
            state.dbl_status = ''  # Reset double status on new bid

        # Handle Double
        elif call == 'X':
            state.dbl_status = 'X'

        # Handle Redouble
        elif call == 'XX':
            state.dbl_status = 'XX'

    # Move to next seat if auction continues
    if not state.auction_ended:
        state.to_act_seat = state.get_next_seat(state.to_act_seat)


def create_auction_grid(dealer_seat: str, history: List[Dict]) -> List[List[Optional[Dict]]]:
    """Create a properly formatted auction grid with dealer offset

    Args:
        dealer_seat: The dealer position (W, N, E, S)
        history: List of calls in chronological order

    Returns:
        2D grid with rows and columns for W-N-E-S layout
    """
    cols = ['W', 'N', 'E', 'S']
    start_col = cols.index(dealer_seat)

    # Calculate number of rows needed
    total_calls = len(history)
    num_rows = max(1, (start_col + total_calls + 3) // 4)

    # Initialize grid
    grid = []
    for _ in range(num_rows):
        grid.append([None, None, None, None])

    # Place each call in the grid
    for i, call in enumerate(history):
        abs_index = start_col + i
        row = abs_index // 4
        col = abs_index % 4
        if row < len(grid):
            grid[row][col] = call

    return grid


def format_auction_history(dealer_seat: str, history: List[Dict]) -> str:
    """Format auction history as a string table

    Args:
        dealer_seat: The dealer position
        history: List of calls

    Returns:
        Formatted string representation of the auction
    """
    if not history:
        return f"No bids yet. Dealer: {dealer_seat} starts."

    grid = create_auction_grid(dealer_seat, history)

    # Build table string
    lines = []
    lines.append("| W | N | E | S |")
    lines.append("|---|---|---|---|")

    for row in grid:
        row_str = "|"
        for cell in row:
            if cell:
                call_str = cell.get('call', '')
                # Add alert indicator if present
                if cell.get('alert'):
                    call_str += '*'
                row_str += f" {call_str:^3} |"
            else:
                row_str += "     |"
        lines.append(row_str)

    return "\n".join(lines)


def get_auction_state_from_history(dealer: str, history: List[Dict]) -> AuctionState:
    """Reconstruct auction state from a bidding history

    Args:
        dealer: Dealer position
        history: List of call dictionaries

    Returns:
        AuctionState object representing current state
    """
    state = AuctionState(dealer)

    for call_dict in history:
        position = call_dict.get('position')
        call = call_dict.get('call')

        # Validate and update state for each call
        validation = validate_call(state, call, position)
        if validation['ok']:
            update_auction_state(state, call, position)
        else:
            # History contains invalid call - this shouldn't happen
            print(f"Warning: Invalid call in history: {call} by {position} - {validation.get('error')}")
            break

    return state


# Export main functions
__all__ = [
    'AuctionState',
    'validate_call',
    'update_auction_state',
    'create_auction_grid',
    'format_auction_history',
    'get_auction_state_from_history',
    'get_bid_value'
]