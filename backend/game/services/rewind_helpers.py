"""
Helper functions for rewind operations
Implements the backend-centric rewind logic from prompt.md
"""
from typing import List, Set, Tuple, Optional
from django.db.models import Q
from ..models import Node, Response, Deal, Edge
from django.contrib.auth import get_user_model
from .auction_tree import is_auction_closed, update_node_who_needs, update_descendants_who_needs, get_next_seat

User = get_user_model()


def collect_downstream_nodes(target_node: Node, user) -> List[Node]:
    """
    Collect all nodes downstream from target_node where user has active responses.
    Uses prefix-based search: any node whose history starts with target_node.history.

    Args:
        target_node: The node to rewind to
        user: The user performing the rewind

    Returns:
        List of Node objects that are downstream and have user's active responses
    """
    deal = target_node.deal

    # Build the prefix for searching
    # Nodes downstream have history that starts with target's history
    if target_node.history:
        prefix = target_node.history + ' '
    else:
        # Target is root, so all non-empty histories are downstream
        prefix = ''

    # Find all nodes downstream from target
    if prefix:
        downstream_nodes = Node.objects.filter(
            deal=deal,
            history__startswith=prefix
        ).order_by('depth')
    else:
        # Root node - all nodes with non-empty history
        downstream_nodes = Node.objects.filter(
            deal=deal
        ).exclude(history='').order_by('depth')

    # Filter to nodes where user has active responses
    nodes_with_user_responses = []
    for node in downstream_nodes:
        has_response = Response.objects.filter(
            node=node,
            user=user,
            is_active=True
        ).exists()
        if has_response:
            nodes_with_user_responses.append(node)

    return nodes_with_user_responses


def recompute_divergence_for_node(node: Node) -> bool:
    """
    Recompute divergence flag for a node based on active responses.
    Divergence occurs when 2+ distinct calls exist at this node.

    Args:
        node: The node to recompute

    Returns:
        True if divergence status changed, False otherwise
    """
    # Count distinct active calls at this node
    active_responses = Response.objects.filter(
        node=node,
        is_active=True
    )

    distinct_calls = active_responses.values('call').distinct().count()

    # Node is divergent if 2+ distinct calls
    new_divergence_state = distinct_calls >= 2

    # Check if state changed
    changed = (node.divergence != new_divergence_state)

    if changed:
        node.divergence = new_divergence_state
        node.save(update_fields=['divergence'])

    return changed


def recompute_depth_for_deal(deal: Deal) -> None:
    """
    Recompute depth values for all nodes in a deal using BFS from root.
    Depth = number of calls in history.

    Args:
        deal: The deal to recompute depths for
    """
    # Get all nodes for this deal
    all_nodes = Node.objects.filter(deal=deal)

    # Update depth based on history length
    for node in all_nodes:
        if node.history:
            new_depth = len(node.history.split())
        else:
            new_depth = 0

        if node.depth != new_depth:
            node.depth = new_depth
            node.save(update_fields=['depth'])


def recompute_open_closed_status(node: Node) -> bool:
    """
    Recompute open/closed status for a node based on auction termination rules.

    Auction is closed if:
    - Four passes at start (P P P P)
    - Three consecutive passes after a non-pass bid

    Args:
        node: The node to recompute

    Returns:
        True if status changed, False otherwise
    """
    auction_closed = is_auction_closed(node.history)
    new_status = 'closed' if auction_closed else 'open'

    changed = (node.status != new_status)

    if changed:
        node.status = new_status
        # If auction closed, who_needs should be 'none'
        if auction_closed:
            node.who_needs = 'none'
            node.save(update_fields=['status', 'who_needs'])
        else:
            node.save(update_fields=['status'])

    return changed


def cleanup_orphaned_edges(deal: Deal) -> int:
    """
    Remove edges that point to nodes with no active responses from either user.
    These edges represent paths that no longer exist after rewind.

    Args:
        deal: The deal to cleanup edges for

    Returns:
        Number of edges deleted
    """
    # Get all edges for this deal
    edges = Edge.objects.filter(deal=deal)

    deleted_count = 0
    for edge in edges:
        # Check if target node has any active responses
        has_active_responses = Response.objects.filter(
            node=edge.to_node,
            is_active=True
        ).exists()

        # Delete edge if target has no active responses
        # (unless it's a root-level edge, which we keep for structure)
        if not has_active_responses and edge.from_node.history:
            edge.delete()
            deleted_count += 1

    return deleted_count


def collect_affected_nodes(target_node: Node, user) -> Set[Node]:
    """
    Collect all nodes that need recomputation after rewind.

    Includes:
    - Target node itself
    - All downstream nodes (prefix-based)
    - Parent nodes up to divergence points

    Args:
        target_node: The node being rewound to
        user: The user performing rewind

    Returns:
        Set of nodes that need recomputation
    """
    affected = set()
    deal = target_node.deal

    # Add target node
    affected.add(target_node)

    # Add all downstream nodes
    if target_node.history:
        prefix = target_node.history + ' '
        downstream = Node.objects.filter(
            deal=deal,
            history__startswith=prefix
        )
    else:
        downstream = Node.objects.filter(deal=deal).exclude(history='')

    affected.update(downstream)

    # Add ancestors up the tree (for divergence recomputation)
    current = target_node
    while current.history:
        # Find parent node
        history_parts = current.history.split()
        if len(history_parts) > 1:
            parent_history = ' '.join(history_parts[:-1])
        else:
            parent_history = ''

        # Calculate parent seat
        if parent_history:
            parent_calls = parent_history.split()
            dealer_seats = ['N', 'E', 'S', 'W']
            dealer_idx = dealer_seats.index(deal.dealer)
            parent_seat_idx = (dealer_idx + len(parent_calls)) % 4
            parent_seat = dealer_seats[parent_seat_idx]
        else:
            parent_seat = deal.dealer

        parent = Node.objects.filter(
            deal=deal,
            history=parent_history,
            seat_to_act=parent_seat
        ).first()

        if parent:
            affected.add(parent)
            current = parent
        else:
            break

    return affected


def recompute_all_for_nodes(nodes: Set[Node]) -> dict:
    """
    Run all recomputation steps for a set of nodes in correct order.

    Order:
    1. Divergence (affects who_needs logic)
    2. Open/closed status (affects who_needs)
    3. who_needs and descendants

    Args:
        nodes: Set of nodes to recompute

    Returns:
        Dictionary with counts of changes made
    """
    stats = {
        'divergences_changed': 0,
        'status_changed': 0,
        'who_needs_updated': 0,
        'nodes_reopened': 0,
        'nodes_closed': 0
    }

    # Step 1: Recompute divergence
    for node in nodes:
        if recompute_divergence_for_node(node):
            stats['divergences_changed'] += 1

    # Step 2: Recompute open/closed status
    for node in nodes:
        old_status = node.status
        if recompute_open_closed_status(node):
            stats['status_changed'] += 1
            # Refresh to get updated status
            node.refresh_from_db()
            if old_status == 'closed' and node.status == 'open':
                stats['nodes_reopened'] += 1
            elif old_status == 'open' and node.status == 'closed':
                stats['nodes_closed'] += 1

    # Step 3: Update who_needs for all affected nodes
    for node in nodes:
        node.refresh_from_db()  # Get latest state
        update_node_who_needs(node)
        stats['who_needs_updated'] += 1

        # If this node just became divergent, update descendants
        if node.divergence:
            update_descendants_who_needs(node)

    return stats
