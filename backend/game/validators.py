# It's a file about bid validator
# validators.py

position_order = ["C", "D", "H", "S", "NT"]
VALID_SPECIAL_BIDS = ["Pass", "X", "XX"]

def is_valid_bid_format(bid):
    if bid in VALID_SPECIAL_BIDS:
        return True
    if len(bid) >= 2:
        level, suit = bid[0], bid[1:]
        return level.isdigit() and 1 <= int(level) <= 7 and suit in position_order
    return False

def compare_bids(new_bid, last_bid):
    n_level, n_suit = int(new_bid[0]), new_bid[1:]
    l_level, l_suit = int(last_bid[0]), last_bid[1:]

    if n_level > l_level:
        return True
    if n_level == l_level:
        return position_order.index(n_suit) > position_order.index(l_suit)
    return False

def is_bid_valid(new_bid, bidding_history):

    if not is_valid_bid_format(new_bid):
        return False

    last_valid = None 
    last_special = None  

    
    for h in reversed(bidding_history):
        if h in ["X", "XX"]:
            if last_special is None:
                last_special = h
        elif h not in VALID_SPECIAL_BIDS or h == "Pass":
            if last_valid is None:
                last_valid = h
        if last_valid and last_special:
            break


    if new_bid == "Pass":
        return True
    if new_bid == "X":
        if not last_valid or last_special in ["X", "XX"]:
            return False
    if new_bid == "XX":
        if last_special != "X":
            return False

    if new_bid not in VALID_SPECIAL_BIDS:
        if last_valid:
            if not compare_bids(new_bid, last_valid):
                return False

    return True
