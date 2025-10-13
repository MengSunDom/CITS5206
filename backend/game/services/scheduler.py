"""
Simplified Scheduler - PLUS4 then RANDOM_DEAL_SMALLEST_DEPTH
"""
from typing import Optional, Dict, Any, Tuple, List
import random
from django.db.models import Q
from ..models import Session, Node, Response
from django.contrib.auth import get_user_model
from ..bridge_auction_validator import get_auction_state_from_history

User = get_user_model()


def requires_user(node: Node, user_id: int) -> bool:
    """Check if node requires response from this user based on who_needs AND seat matching (for independent bidding)"""
    from ..models import PlayerGame, UserBiddingSequence
    from ..utils import get_next_position

    session = node.session

    # First check who_needs
    if node.who_needs == 'none':
        return False

    user_needs_based_on_field = False
    if node.who_needs == 'both':
        user_needs_based_on_field = True
    elif node.who_needs == 'creator':
        user_needs_based_on_field = (user_id == session.creator.id)
    elif node.who_needs == 'partner':
        user_needs_based_on_field = (user_id == session.partner.id)

    if not user_needs_based_on_field:
        return False

    # For independent bidding: check if this node matches user's current position in their sequence
    user = User.objects.get(id=user_id)
    user_sequence = UserBiddingSequence.objects.filter(
        deal=node.deal,
        user=user
    ).first()

    # Check if this node is on the same branch as user's sequence
    # If user has a sequence, check if node's history matches the sequence
    if user_sequence and user_sequence.sequence:
        # Build user's history from their sequence
        user_history_calls = [call.get('call') for call in user_sequence.sequence]
        user_history = ' '.join(user_history_calls) if user_history_calls else ''

        # If node's history is a prefix of user's history, calculate next position from user sequence
        if user_history.startswith(node.history) or node.history.startswith(user_history):
            # Same branch - use user's sequence
            last_call = user_sequence.sequence[-1]
            last_position = last_call.get('position', node.deal.dealer)
            next_position = get_next_position(last_position)
        else:
            # Different branch - find user's last response on this branch path
            # to determine correct position
            branch_responses = Response.objects.filter(
                node__deal=node.deal,
                user=user,
                is_active=True
            ).select_related('node').order_by('-node__depth', '-timestamp')

            # Find the deepest response where response.node.history is a prefix of node.history
            last_branch_response = None
            for resp in branch_responses:
                resp_history = resp.node.history if resp.node.history else ''
                # Check if this response is on the path to the target node
                if node.history.startswith(resp_history):
                    last_branch_response = resp
                    break

            if last_branch_response:
                # User has answered nodes on this branch - next position from last answer
                next_position = get_next_position(last_branch_response.node.seat_to_act)
            else:
                # User hasn't answered any node on this branch yet
                # Calculate position from node's history
                if node.history:
                    history_calls = node.history.split()
                    current_position = node.deal.dealer
                    for _ in history_calls:
                        current_position = get_next_position(current_position)
                    next_position = current_position
                else:
                    next_position = node.deal.dealer
    else:
        # No sequence yet, start from dealer
        next_position = node.deal.dealer

    # User can only answer if their next position matches the node's seat_to_act
    return next_position == node.seat_to_act


def get_last_answer(user_id: int, session_id: int) -> Optional[Tuple[int, int]]:
    """Get user's last answer as (deal_index, depth) or None"""
    last_response = Response.objects.filter(
        node__session_id=session_id,
        user_id=user_id,
        is_active=True
    ).select_related('node', 'node__deal').order_by('-timestamp').first()

    if not last_response:
        return None

    return (last_response.node.deal.deal_number, last_response.node.depth)


def find_eligible_node(session_id: int, deal_index: int, depth: int, user_id: int) -> Optional[Node]:
    """Find eligible node at specific depth in specific deal"""
    candidates = Node.objects.filter(
        session_id=session_id,
        deal__deal_number=deal_index,
        depth=depth,
        status='open'
    )

    for node in candidates:
        # Check if user needs to answer and hasn't answered yet
        if requires_user(node, user_id):
            has_answered = Response.objects.filter(
                node=node,
                user_id=user_id,
                is_active=True
            ).exists()
            if not has_answered:
                return node

    return None


def list_deals_with_eligible_nodes(session_id: int, user_id: int) -> list:
    """List all deal indices that have eligible nodes for this user"""
    from ..services.auction_tree import build_auction_tree
    from ..models import Deal

    # Get all open nodes in session
    open_nodes = Node.objects.filter(
        session_id=session_id,
        status='open'
    ).select_related('deal')

    # If no nodes exist, build auction trees for all deals
    if not open_nodes.exists():
        session = Session.objects.get(id=session_id)
        all_deals = Deal.objects.filter(session=session).order_by('deal_number')

        # Build auction tree for each deal (creates root nodes)
        for deal in all_deals:
            build_auction_tree(session_id, deal.deal_number)

        # Re-query for open nodes after building trees
        open_nodes = Node.objects.filter(
            session_id=session_id,
            status='open'
        ).select_related('deal')

    eligible_deals = set()

    for node in open_nodes:
        if requires_user(node, user_id):
            # Check if user hasn't answered
            has_answered = Response.objects.filter(
                node=node,
                user_id=user_id,
                is_active=True
            ).exists()
            if not has_answered:
                eligible_deals.add(node.deal.deal_number)

    return list(eligible_deals)


def find_smallest_depth_eligible_node(session_id: int, deal_index: int, user_id: int) -> Optional[Node]:
    """Find the smallest depth eligible node in the specified deal"""
    candidates = Node.objects.filter(
        session_id=session_id,
        deal__deal_number=deal_index,
        status='open'
    ).order_by('depth')

    for node in candidates:
        if requires_user(node, user_id):
            has_answered = Response.objects.filter(
                node=node,
                user_id=user_id,
                is_active=True
            ).exists()
            if not has_answered:
                return node

    return None


def next_node(user_id: int, session_id: int) -> Tuple[Optional[Node], str]:
    """
    Select next node using simplified scheduler:
    1. PLUS4: If last exists and depth=last+4 is eligible in same deal, return it
    2. RANDOM_DEAL_SMALLEST_DEPTH: Random deal (prefer different), then min depth

    Returns: (Node or None, reason_code)
    """
    last = get_last_answer(user_id, session_id)

    # Rule 1: +4 in the same deal
    if last:
        deal_index, depth = last
        n = find_eligible_node(
            session_id=session_id,
            deal_index=deal_index,
            depth=depth + 4,
            user_id=user_id
        )
        if n:
            return (n, "PLUS4")

    # Rule 2: Random deal (prefer different from last), then min depth
    open_deals = list_deals_with_eligible_nodes(session_id, user_id)
    if not open_deals:
        return (None, "ALL_CAUGHT_UP")

    # Prefer a deal different from last if possible
    if last and len(open_deals) > 1:
        last_deal_index = last[0]
        pool = [d for d in open_deals if d != last_deal_index]
        if not pool:  # All deals are the same as last
            pool = open_deals
    else:
        pool = open_deals

    deal_choice = random.choice(pool)
    n = find_smallest_depth_eligible_node(session_id, deal_choice, user_id)

    return (n, "RANDOM_DEAL_SMALLEST_DEPTH") if n else (None, "ALL_CAUGHT_UP")
