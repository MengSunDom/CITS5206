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
    """Get or create a node for the given state (UPSERT with depth)"""
    # Calculate depth from history
    depth = len(history.strip().split()) if history.strip() else 0
    # Determine if auction is closed
    auction_closed = is_auction_closed(history)

    node, created = Node.objects.get_or_create(
        deal=deal,
        history=history,
        seat_to_act=seat_to_act,
        defaults={
            'session': deal.session,
            'divergence': False,
            'status': 'closed' if auction_closed else 'open',
            'depth': depth,
            'who_needs': 'none' if auction_closed else 'both'  # Closed auctions need no one
        }
    )

    # Update depth and status if node already exists
    if not created:
        fields_to_update = []
        if node.depth != depth:
            node.depth = depth
            fields_to_update.append('depth')

        # CRITICAL: Update status to reflect current auction state
        correct_status = 'closed' if auction_closed else 'open'
        if node.status != correct_status:
            node.status = correct_status
            fields_to_update.append('status')

        # If auction is closed, no one needs to answer anymore
        if auction_closed and node.who_needs != 'none':
            node.who_needs = 'none'
            fields_to_update.append('who_needs')

        if fields_to_update:
            node.save(update_fields=fields_to_update)

    return node


def is_auction_closed(history: str) -> bool:
    """Check if an auction is closed based on the history string"""
    if not history:
        return False

    calls = history.strip().split()

    # Normalize Pass/P to handle both formats
    normalized_calls = [c if c not in ['Pass', 'pass'] else 'P' for c in calls]

    if len(normalized_calls) >= 4:
        # Check for four passes at the start
        if normalized_calls[:4] == ['P', 'P', 'P', 'P']:
            return True

        # Check for three consecutive passes after a non-pass bid
        last_three = normalized_calls[-3:]
        if last_three == ['P', 'P', 'P']:
            # Find the last non-pass bid before the three passes
            for call in reversed(normalized_calls[:-3]):
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

    # CRITICAL: Update all existing nodes' status and who_needs FIRST
    # This ensures the tree reflects the current auction state correctly
    all_nodes = Node.objects.filter(deal=deal)
    for node in all_nodes:
        auction_closed = is_auction_closed(node.history)
        correct_status = 'closed' if auction_closed else 'open'
        fields_to_update = []

        if node.status != correct_status:
            node.status = correct_status
            fields_to_update.append('status')

        if auction_closed and node.who_needs != 'none':
            node.who_needs = 'none'
            fields_to_update.append('who_needs')

        if fields_to_update:
            node.save(update_fields=fields_to_update)

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

        # Refresh node from database to get updated status
        current_node.refresh_from_db()

        # Add node to tree
        tree['nodes'][current_id] = {
            'db_id': current_node.id,  # Add database ID for backend operations
            'history': current_node.history,
            'seat': current_node.seat_to_act,
            'divergence': False,  # Will be set based on responses
            'status': current_node.status,
            'who_needs': current_node.who_needs  # Add who_needs for coloring
        }

        # CRITICAL: If auction is closed at this node, don't process responses or create child nodes
        if current_node.status == 'closed':
            continue

        # Get responses at this node (only active responses)
        responses = Response.objects.filter(node=current_node, is_active=True).select_related('user')

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

            # Determine by_set based on who made this call
            by_set = []
            if creator_name in users:
                by_set.append('creator')
            if partner_name in users:
                by_set.append('partner')

            # Create/update Edge record in database
            from ..models import Edge
            Edge.objects.update_or_create(
                session=deal.session,
                deal=deal,
                from_node=current_node,
                to_node=child_node,
                call=call,
                defaults={'by_set': by_set}
            )

            # Add edge to tree JSON
            edge = {
                'from': current_id,
                'call': call,
                'by': sorted(users),  # Sort for consistency
                'by_set': by_set,  # Add by_set to JSON response
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
                'db_id': node.id,  # Add database ID for backend operations
                'history': node.history,
                'seat': node.seat_to_act,
                'divergence': node.divergence,
                'status': node.status,
                'who_needs': node.who_needs  # Add who_needs for coloring
            }

    # Update status and who_needs for all nodes to ensure consistency
    for node in all_nodes:
        # First update status based on auction state
        auction_closed = is_auction_closed(node.history)
        correct_status = 'closed' if auction_closed else 'open'
        fields_to_update = []

        if node.status != correct_status:
            node.status = correct_status
            fields_to_update.append('status')

        # If auction closed, who_needs should be 'none'
        if auction_closed and node.who_needs != 'none':
            node.who_needs = 'none'
            fields_to_update.append('who_needs')

        if fields_to_update:
            node.save(update_fields=fields_to_update)

        # Then update who_needs for same-seat no-follow (if auction not closed)
        if not auction_closed:
            update_node_who_needs(node)

    # Refresh tree nodes with updated status and who_needs values
    for node in all_nodes:
        node_id = get_node_id(node)
        if node_id in tree['nodes']:
            tree['nodes'][node_id]['status'] = node.status
            tree['nodes'][node_id]['who_needs'] = node.who_needs

    return tree


def find_divergence_ancestry(node: Node) -> Optional[Node]:
    """
    Find the closest ancestor divergence node with the same seat as this node.
    Returns the divergence node if found, None otherwise.
    """
    if not node.history:
        return None

    # Walk back through history to find divergence nodes at same seat
    calls = node.history.strip().split()

    # Calculate seats for each position in history
    seats_at_depth = [node.deal.dealer]
    current_seat = node.deal.dealer
    for _ in range(len(calls)):
        current_seat = get_next_seat(current_seat)
        seats_at_depth.append(current_seat)

    # Walk backward from current position to find closest same-seat divergence
    for i in range(len(calls) - 1, -1, -1):
        partial_history = ' '.join(calls[:i])
        seat_at_i = seats_at_depth[i]

        # Only check nodes at the same seat
        if seat_at_i == node.seat_to_act:
            ancestor = Node.objects.filter(
                deal=node.deal,
                history=partial_history,
                seat_to_act=seat_at_i,
                divergence=True
            ).first()

            if ancestor:
                return ancestor

    return None


def get_branch_owner_for_same_seat_no_follow(node: Node, divergence_node: Node) -> Optional[str]:
    """
    Given a node and its ancestor divergence node with the same seat,
    determine which user 'owns' the branch (i.e., made the choice at divergence
    that leads to this node) and should be exempted from answering.

    Returns: 'creator', 'partner', or None
    """
    session = node.deal.session

    # Find the call that was made from divergence_node to lead to this node's branch
    # The branch is determined by the first call after divergence_node

    div_history_calls = divergence_node.history.strip().split() if divergence_node.history else []
    node_history_calls = node.history.strip().split()

    if len(node_history_calls) <= len(div_history_calls):
        return None

    # The call that creates the branch is the one immediately after divergence
    branch_call = node_history_calls[len(div_history_calls)]

    # Find which user(s) made this call at the divergence node
    # Check responses at divergence_node
    responses_at_div = Response.objects.filter(
        node=divergence_node,
        call=branch_call,
        is_active=True
    ).select_related('user')

    # If exactly one user made this call, they own this branch
    users_who_chose = [r.user for r in responses_at_div]

    if len(users_who_chose) == 1:
        user = users_who_chose[0]
        if user == session.creator:
            return 'creator'
        elif user == session.partner:
            return 'partner'

    return None


def update_node_who_needs(node: Node) -> None:
    """
    Update who_needs field based on active responses and same-seat no-follow rule.

    Same-seat no-follow: After a divergence at seat S, if a user chose a branch,
    the OTHER user is exempted from answering future S-seat nodes on that branch.
    Rationale: Don't force a player to continue along a line they did not endorse.

    IMPORTANT: Exemption only applies if the user has NOT made any responses on this branch.
    If they have participated in the branch, they should continue answering.
    """
    # CRITICAL: If auction is closed at this node, no one needs to answer
    if is_auction_closed(node.history):
        if node.who_needs != 'none':
            node.who_needs = 'none'
            node.save(update_fields=['who_needs'])
        return

    session = node.session
    active_responses = Response.objects.filter(node=node, is_active=True)

    creator_answered = active_responses.filter(user=session.creator).exists()
    partner_answered = active_responses.filter(user=session.partner).exists()

    # Start with basic logic
    needs_creator = not creator_answered
    needs_partner = not partner_answered

    # Apply same-seat no-follow rule
    divergence_ancestor = find_divergence_ancestry(node)

    if divergence_ancestor and divergence_ancestor.seat_to_act == node.seat_to_act:
        # Same seat as divergence - check if exemption applies
        branch_owner = get_branch_owner_for_same_seat_no_follow(node, divergence_ancestor)

        # CRITICAL: Only exempt if the user hasn't participated in this branch
        # Check if the non-owner has made any responses on this branch path
        if branch_owner == 'creator':
            # Creator owns branch - check if partner has participated
            partner_participated = Response.objects.filter(
                node__deal=node.deal,
                node__history__startswith=divergence_ancestor.history if divergence_ancestor.history else '',
                user=session.partner,
                is_active=True
            ).exists()
            if not partner_participated:
                needs_partner = False  # Exempt partner only if they haven't participated
        elif branch_owner == 'partner':
            # Partner owns branch - check if creator has participated
            creator_participated = Response.objects.filter(
                node__deal=node.deal,
                node__history__startswith=divergence_ancestor.history if divergence_ancestor.history else '',
                user=session.creator,
                is_active=True
            ).exists()
            if not creator_participated:
                needs_creator = False  # Exempt creator only if they haven't participated

    # Set who_needs based on final determination
    if not needs_creator and not needs_partner:
        node.who_needs = 'none'
    elif needs_creator and needs_partner:
        node.who_needs = 'both'
    elif needs_creator:
        node.who_needs = 'creator'
    else:  # needs_partner
        node.who_needs = 'partner'

    node.save(update_fields=['who_needs'])


def update_descendants_who_needs(node: Node) -> None:
    """
    Update who_needs for all descendant nodes at the same seat as the given node.
    This is needed when a node becomes a divergence node, as it affects
    same-seat no-follow rules for descendants.
    """
    # Find all nodes in this deal that are descendants of this node
    # (i.e., their history starts with this node's history) and have same seat
    descendants = Node.objects.filter(
        deal=node.deal,
        seat_to_act=node.seat_to_act,
        depth__gt=node.depth
    )

    # Filter to only actual descendants (history must contain this node's history as prefix)
    node_history_prefix = node.history + ' ' if node.history else ''

    for desc in descendants:
        # Check if desc is actually a descendant of node
        if not node.history or desc.history.startswith(node_history_prefix) or desc.history == node.history:
            update_node_who_needs(desc)


def record_user_response(session_id: int, deal_index: int, user_id: int,
                         history: str, seat_to_act: str, call: str) -> Response:
    """
    Record a user's response at a specific node.
    This is called when a user makes a bid in their sequence.
    Supports concurrency via UPSERT and who_needs update.
    Also creates child node to ensure it's available for scheduling.
    """
    try:
        session = Session.objects.get(id=session_id)
        deal = Deal.objects.get(session=session, deal_number=deal_index)
        user = User.objects.get(id=user_id)
    except (Session.DoesNotExist, Deal.DoesNotExist, User.DoesNotExist):
        return None

    # Get or create the node (UPSERT)
    node = get_or_create_node(deal, history, seat_to_act)

    # Record the response (update if exists)
    response, created = Response.objects.update_or_create(
        node=node,
        user=user,
        defaults={'call': call, 'is_active': True}
    )

    # Check if we need to update divergence
    all_responses = Response.objects.filter(node=node, is_active=True)
    distinct_calls = all_responses.values('call').distinct().count()

    divergence_just_created = False
    if distinct_calls > 1 and not node.divergence:
        node.divergence = True
        node.save(update_fields=['divergence'])
        divergence_just_created = True

    # Update who_needs for this node
    update_node_who_needs(node)

    # If this node just became a divergence, update descendants at same seat
    if divergence_just_created:
        update_descendants_who_needs(node)

    # CRITICAL: Always create child node after a response
    # Even if the child node closes the auction, we need it in the tree
    # Closed nodes will be properly marked and won't have their own children
    child_history = (node.history + ' ' + call).strip()
    child_seat = get_next_seat(node.seat_to_act)
    child_node = get_or_create_node(deal, child_history, child_seat)
    # Update child's who_needs to reflect current state
    # If child is closed, update_node_who_needs will set who_needs='none'
    update_node_who_needs(child_node)

    return response