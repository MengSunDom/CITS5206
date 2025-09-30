"""
Auction Tree Service for building tree representations of bidding sequences
"""
from typing import Dict, List, Optional, Set
from django.db import models
from django.contrib.auth import get_user_model
from ..models import Session, Deal, Node, Response
from ..utils import get_next_position

User = get_user_model()


def get_or_create_node(deal: Deal, history: str, seat_to_act: str) -> Node:
    """Get or create a node for the given state"""
    node, created = Node.objects.get_or_create(
        deal=deal,
        history=history,
        seat_to_act=seat_to_act,
        defaults={
            'session': deal.session,
            'divergence': False,
            'status': 'closed' if is_auction_closed(history) else 'open'
        }
    )
    return node


def is_auction_closed(history: str) -> bool:
    """Check if an auction is closed based on the history string"""
    if not history:
        return False

    calls = history.strip().split()
    if len(calls) >= 4:
        # Check for four passes at the start
        if calls[:4] == ['P', 'P', 'P', 'P']:
            return True

        # Check for three consecutive passes after a non-pass bid
        last_three = calls[-3:]
        if last_three == ['P', 'P', 'P']:
            # Find the last non-pass bid before the three passes
            for call in reversed(calls[:-3]):
                if call != 'P':
                    return True
    return False


def get_next_seat(current_seat: str) -> str:
    """Get the next seat in clockwise order"""
    seats = ['W', 'N', 'E', 'S']
    current_index = seats.index(current_seat)
    return seats[(current_index + 1) % 4]


def build_auction_tree(session_id: int, deal_index: int) -> dict:
    """
    Build the auction tree for a specific deal.
    Returns a tree JSON structure with nodes and edges.
    """
    try:
        session = Session.objects.get(id=session_id)
        deal = Deal.objects.get(session=session, deal_number=deal_index)
    except (Session.DoesNotExist, Deal.DoesNotExist):
        return {'error': 'Session or deal not found'}

    # Get users involved
    creator = session.creator
    partner = session.partner

    # Get display names
    creator_name = creator.username or creator.email.split('@')[0]
    partner_name = partner.username or partner.email.split('@')[0]

    # Initialize tree structure
    tree = {
        'session_id': session_id,
        'deal_index': deal_index,
        'dealer': deal.dealer,
        'vul': deal.vulnerability,
        'root': None,
        'nodes': {},
        'edges': []
    }

    # Process nodes - start with root
    root_history = ""
    root_seat = deal.dealer
    root_node = get_or_create_node(deal, root_history, root_seat)

    # Use a deterministic node ID based on the state
    node_id_map = {}
    node_counter = [0]  # Use a list to avoid nonlocal issues

    def get_node_id(node: Node) -> str:
        key = f"{node.history}_{node.seat_to_act}"
        if key not in node_id_map:
            node_id_map[key] = f"n_{node_counter[0]}"
            node_counter[0] += 1
        return node_id_map[key]

    # Set root
    root_id = get_node_id(root_node)
    tree['root'] = root_id

    # Queue for BFS traversal
    nodes_to_process = [(root_node, root_id)]
    processed_nodes = set()

    while nodes_to_process:
        current_node, current_id = nodes_to_process.pop(0)

        # Skip if already processed
        if current_id in processed_nodes:
            continue
        processed_nodes.add(current_id)

        # Add node to tree
        tree['nodes'][current_id] = {
            'history': current_node.history,
            'seat': current_node.seat_to_act,
            'divergence': False,  # Will be set based on responses
            'status': current_node.status
        }

        # Get responses at this node
        responses = Response.objects.filter(node=current_node).select_related('user')

        # Group responses by call
        call_groups = {}
        for response in responses:
            if response.call not in call_groups:
                call_groups[response.call] = []

            # Map user to display name
            if response.user == creator:
                display_name = creator_name
            elif response.user == partner:
                display_name = partner_name
            else:
                display_name = response.user.username

            call_groups[response.call].append(display_name)

        # Check for divergence (more than one distinct call)
        if len(call_groups) > 1:
            tree['nodes'][current_id]['divergence'] = True
            current_node.divergence = True
            current_node.save(update_fields=['divergence'])

        # Create edges for each call
        for call, users in call_groups.items():
            # Compute child state
            child_history = (current_node.history + ' ' + call).strip()
            child_seat = get_next_seat(current_node.seat_to_act)

            # Get or create child node
            child_node = get_or_create_node(deal, child_history, child_seat)
            child_id = get_node_id(child_node)

            # Add edge
            edge = {
                'from': current_id,
                'call': call,
                'by': sorted(users),  # Sort for consistency
                'to': child_id
            }
            tree['edges'].append(edge)

            # Add child to processing queue
            if child_id not in processed_nodes:
                nodes_to_process.append((child_node, child_id))

    # Also check for nodes that exist but have no responses yet
    all_nodes = Node.objects.filter(deal=deal)
    for node in all_nodes:
        node_id = get_node_id(node)
        if node_id not in tree['nodes']:
            tree['nodes'][node_id] = {
                'history': node.history,
                'seat': node.seat_to_act,
                'divergence': node.divergence,
                'status': node.status
            }

    return tree


def record_user_response(session_id: int, deal_index: int, user_id: int,
                         history: str, seat_to_act: str, call: str) -> Response:
    """
    Record a user's response at a specific node.
    This is called when a user makes a bid in their sequence.
    """
    try:
        session = Session.objects.get(id=session_id)
        deal = Deal.objects.get(session=session, deal_number=deal_index)
        user = User.objects.get(id=user_id)
    except (Session.DoesNotExist, Deal.DoesNotExist, User.DoesNotExist):
        return None

    # Get or create the node
    node = get_or_create_node(deal, history, seat_to_act)

    # Record the response (update if exists)
    response, created = Response.objects.update_or_create(
        node=node,
        user=user,
        defaults={'call': call}
    )

    # Check if we need to update divergence
    all_responses = Response.objects.filter(node=node)
    distinct_calls = all_responses.values('call').distinct().count()

    if distinct_calls > 1 and not node.divergence:
        node.divergence = True
        node.save(update_fields=['divergence'])

    return response