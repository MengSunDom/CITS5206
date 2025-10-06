"""
Auction tree and progress-related actions for SessionViewSet
"""
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from ..models import Deal, Node, NodeComment, ResponseAudit
from ..models import Response as ResponseModel
from ..models import UserBiddingSequence
from ..services.auction_tree import build_auction_tree
from ..services.scheduler import next_node
from ..services.rewind_helpers import (
    collect_downstream_nodes,
    collect_affected_nodes,
    recompute_depth_for_deal,
    recompute_all_for_nodes,
    cleanup_orphaned_edges
)


class TreeActionsMixin:
    """Mixin for auction tree and progress-related actions"""

    @action(detail=True, methods=['get'])
    def auction_tree(self, request, pk=None):
        """Get the auction tree for a specific deal"""
        session = self.get_object()
        deal_index = request.query_params.get('deal_index')

        # Check if user is part of this session
        if request.user not in [session.creator, session.partner]:
            return Response(
                {'error': 'You are not part of this session'},
                status=status.HTTP_403_FORBIDDEN
            )

        if not deal_index:
            return Response(
                {'error': 'deal_index is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            deal_index = int(deal_index)
        except ValueError:
            return Response(
                {'error': 'Invalid deal_index'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Build the tree
        tree = build_auction_tree(session.id, deal_index)

        if 'error' in tree:
            return Response(tree, status=status.HTTP_404_NOT_FOUND)

        return Response(tree)

    @action(detail=True, methods=['get'])
    def my_progress(self, request, pk=None):
        """Get user's bidding progress for a specific deal"""
        session = self.get_object()
        deal_index = request.query_params.get('deal_index')

        # Check if user is part of this session
        if request.user not in [session.creator, session.partner]:
            return Response(
                {'error': 'You are not part of this session'},
                status=status.HTTP_403_FORBIDDEN
            )

        if not deal_index:
            return Response(
                {'error': 'deal_index is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            deal_index = int(deal_index)
            deal = session.deals.get(deal_number=deal_index)
        except (ValueError, Deal.DoesNotExist):
            return Response(
                {'error': 'Invalid deal_index or deal not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get all nodes for this deal where user has active responses
        user_responses = ResponseModel.objects.filter(
            node__deal=deal,
            user=request.user,
            is_active=True
        ).select_related('node').order_by('node__history')

        # Build the progress timeline
        nodes = []
        current_node_id = None

        # Add root node
        root_node = {
            'node_id': f'n_0',
            'seat': deal.dealer,
            'history': '',
            'your_call': None,
            'created_at': None,
            'is_terminal': False
        }
        nodes.append(root_node)

        # Build nodes from responses
        for idx, response in enumerate(user_responses):
            node = response.node
            node_data = {
                'node_id': f'n_{idx + 1}',
                'seat': node.seat_to_act,
                'history': node.history,
                'your_call': response.call,
                'created_at': response.timestamp.isoformat(),
                'is_terminal': node.is_auction_complete(),
                'who_needs': node.who_needs  # Add who_needs for coloring
            }
            nodes.append(node_data)
            current_node_id = f'n_{idx + 1}'

        # Default theme colors
        theme = {
            'primary': '#2D3A8C',
            'muted': '#6B7280',
            'bg': '#0B1023'
        }

        return Response({
            'session_id': session.id,
            'deal_index': deal_index,
            'dealer': deal.dealer,
            'vul': deal.vulnerability,
            'theme': theme,
            'nodes': nodes,
            'current_node_id': current_node_id or 'n_0'
        })

    @action(detail=True, methods=['post'])
    def rewind(self, request, pk=None):
        """
        Rewind user's progress to a specific node.
        Implements backend-centric rewind logic from prompt.md:
        - Soft-delete downstream responses
        - Recompute divergence, depth, open/closed, who_needs
        - Return next node from scheduler
        """
        session = self.get_object()
        deal_index = request.data.get('deal_index')
        node_id = request.data.get('node_id')
        confirm = request.data.get('confirm', False)
        preview = request.query_params.get('preview', '0') == '1'

        # Check if user is part of this session
        if request.user not in [session.creator, session.partner]:
            return Response(
                {'error': 'You are not part of this session'},
                status=status.HTTP_403_FORBIDDEN
            )

        if not all([deal_index, node_id]):
            return Response(
                {'error': 'deal_index and node_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            deal_index = int(deal_index)
            deal = session.deals.get(deal_number=deal_index)
        except (ValueError, Deal.DoesNotExist):
            return Response(
                {'error': 'Invalid deal_index or deal not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Parse node_id to get target node
        try:
            target_idx = int(node_id.split('_')[1])
        except (ValueError, IndexError):
            return Response(
                {'error': 'Invalid node_id format'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get user's responses in order
        user_responses = list(ResponseModel.objects.filter(
            node__deal=deal,
            user=request.user,
            is_active=True
        ).select_related('node').order_by('node__depth', 'timestamp'))

        # Identify target node
        if target_idx == 0:
            # Rewind to root
            target_node = Node.objects.filter(
                deal=deal,
                history='',
                seat_to_act=deal.dealer
            ).first()
            if not target_node:
                return Response(
                    {'error': 'Root node not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        elif target_idx <= len(user_responses):
            target_node = user_responses[target_idx - 1].node
        else:
            return Response(
                {'error': 'Invalid node_id index'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Collect downstream nodes using prefix-based search
        downstream_nodes = collect_downstream_nodes(target_node, request.user)

        # Preview mode - return what would be affected without committing
        if preview:
            downstream_count = len(downstream_nodes)
            affected_nodes = collect_affected_nodes(target_node, request.user)

            return Response({
                'preview': True,
                'responses_to_delete': downstream_count,
                'nodes_affected': len(affected_nodes),
                'target_node': {
                    'history': target_node.history,
                    'seat': target_node.seat_to_act,
                    'depth': target_node.depth
                }
            })

        # Require confirmation if not preview
        if not confirm:
            return Response(
                {'error': 'confirm must be true to perform rewind'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Execute rewind in atomic transaction
        with transaction.atomic():
            # Step 1: Lock target node to prevent concurrent modifications
            target_node = Node.objects.select_for_update().get(id=target_node.id)

            # Step 2: Collect all downstream responses to invalidate
            responses_to_rewind = ResponseModel.objects.filter(
                node__in=downstream_nodes,
                user=request.user,
                is_active=True
            )

            deleted_response_ids = []

            # Step 3: Soft-delete downstream responses with audit trail
            for response in responses_to_rewind:
                # Create audit entry
                ResponseAudit.objects.create(
                    response=response,
                    user=request.user,
                    node=response.node,
                    session=session,
                    deal=deal,
                    old_call=response.call,
                    action='REWIND',
                    metadata={
                        'rewind_to_node': node_id,
                        'target_node_history': target_node.history,
                        'deleted_node_history': response.node.history
                    }
                )

                # Soft-delete
                response.is_active = False
                response.superseded_at = timezone.now()
                response.superseded_by_action = 'REWIND'
                response.save()

                deleted_response_ids.append(response.id)

            # Step 4: Update UserBiddingSequence
            user_sequence = UserBiddingSequence.objects.filter(
                deal=deal,
                user=request.user
            ).first()

            if user_sequence and user_sequence.sequence:
                # Truncate to target_idx
                user_sequence.sequence = user_sequence.sequence[:target_idx]
                user_sequence.save()

            # Step 5: Recompute depth for entire deal
            recompute_depth_for_deal(deal)

            # Step 6: Collect all affected nodes and recompute properties
            affected_nodes = collect_affected_nodes(target_node, request.user)
            recompute_stats = recompute_all_for_nodes(affected_nodes)

            # Step 7: Cleanup orphaned edges
            edges_deleted = cleanup_orphaned_edges(deal)

            # Step 8: Get next node from scheduler
            next_node_obj, reason = next_node(request.user.id, session.id)

            if next_node_obj:
                next_action = {
                    'node_id': next_node_obj.id,
                    'seat': next_node_obj.seat_to_act,
                    'history': next_node_obj.history,
                    'deal_number': next_node_obj.deal.deal_number,
                    'scheduler_reason': reason,
                    'message': f'Rewind complete. Next task: {reason}'
                }
            else:
                next_action = {
                    'node_id': None,
                    'scheduler_reason': reason,
                    'message': 'All caught up! No more tasks at the moment.'
                }

        # Return summary
        return Response({
            'ok': True,
            'rewound_to_node': node_id,
            'deleted_response_count': len(deleted_response_ids),
            'deleted_response_ids': deleted_response_ids,
            'recompute_stats': {
                **recompute_stats,
                'edges_deleted': edges_deleted,
                'affected_nodes': len(affected_nodes)
            },
            'next_action': next_action,
            'deal_id': deal.id,
            'deal_number': deal.deal_number
        })

    @action(detail=True, methods=['post'])
    def undo(self, request, pk=None):
        """
        Global Undo: Remove the most recent active response by this player
        across the entire session, regardless of deal.
        Implements undo logic from prompt.md
        """
        session = self.get_object()

        # Check if user is part of this session
        if request.user not in [session.creator, session.partner]:
            return Response(
                {'error': 'You are not part of this session'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Find user's most recent active response in this session
        last_response = ResponseModel.objects.filter(
            node__session=session,
            user=request.user,
            is_active=True
        ).select_related('node', 'node__deal').order_by('-timestamp').first()

        if not last_response:
            return Response(
                {'error': 'No active responses to undo'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get the deal and node where the response was made
        affected_deal = last_response.node.deal
        response_node = last_response.node

        # Find parent node (node before this response)
        # Parent has history without the last call
        if response_node.history:
            history_parts = response_node.history.split()
            if len(history_parts) > 1:
                parent_history = ' '.join(history_parts[:-1])
            else:
                parent_history = ''
        else:
            # Response was at root, can't undo further
            return Response(
                {'error': 'Cannot undo root response'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find parent node by calculating its seat
        if parent_history:
            parent_calls = parent_history.split()
            dealer_seats = ['N', 'E', 'S', 'W']
            dealer_idx = dealer_seats.index(affected_deal.dealer)
            parent_seat_idx = (dealer_idx + len(parent_calls)) % 4
            parent_seat = dealer_seats[parent_seat_idx]
        else:
            parent_seat = affected_deal.dealer

        parent_node = Node.objects.filter(
            deal=affected_deal,
            history=parent_history,
            seat_to_act=parent_seat
        ).first()

        if not parent_node:
            return Response(
                {'error': 'Parent node not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Execute undo using rewind logic in atomic transaction
        with transaction.atomic():
            # Step 1: Lock parent node
            parent_node = Node.objects.select_for_update().get(id=parent_node.id)

            # Step 2: Collect downstream nodes (everything after parent)
            downstream_nodes = collect_downstream_nodes(parent_node, request.user)

            # Step 3: Soft-delete downstream responses with audit trail
            deleted_response_ids = []
            responses_to_undo = ResponseModel.objects.filter(
                node__in=downstream_nodes,
                user=request.user,
                is_active=True
            )

            for response in responses_to_undo:
                # Create audit entry
                ResponseAudit.objects.create(
                    response=response,
                    user=request.user,
                    node=response.node,
                    session=session,
                    deal=affected_deal,
                    old_call=response.call,
                    action='UNDO',
                    metadata={
                        'undo_from_node': response_node.id,
                        'parent_node': parent_node.id,
                        'parent_history': parent_node.history
                    }
                )

                # Soft-delete
                response.is_active = False
                response.superseded_at = timezone.now()
                response.superseded_by_action = 'UNDO'
                response.save()

                deleted_response_ids.append(response.id)

            # Step 4: Find target index in user's sequence
            # Count how many responses the user had before the parent node
            responses_before_parent = ResponseModel.objects.filter(
                node__deal=affected_deal,
                user=request.user,
                is_active=True,
                node__depth__lte=parent_node.depth
            ).count()

            # Step 5: Update UserBiddingSequence
            user_sequence = UserBiddingSequence.objects.filter(
                deal=affected_deal,
                user=request.user
            ).first()

            if user_sequence and user_sequence.sequence:
                # Truncate to parent position
                user_sequence.sequence = user_sequence.sequence[:responses_before_parent]
                user_sequence.save()

            # Step 6: Recompute depth for affected deal
            recompute_depth_for_deal(affected_deal)

            # Step 7: Collect affected nodes and recompute properties
            affected_nodes = collect_affected_nodes(parent_node, request.user)
            recompute_stats = recompute_all_for_nodes(affected_nodes)

            # Step 8: Cleanup orphaned edges
            edges_deleted = cleanup_orphaned_edges(affected_deal)

            # Step 9: Get next node from scheduler
            next_node_obj, reason = next_node(request.user.id, session.id)

            if next_node_obj:
                next_action = {
                    'node_id': next_node_obj.id,
                    'seat': next_node_obj.seat_to_act,
                    'history': next_node_obj.history,
                    'deal_number': next_node_obj.deal.deal_number,
                    'scheduler_reason': reason,
                    'message': f'Undo complete. Next task: {reason}'
                }
            else:
                next_action = {
                    'node_id': None,
                    'scheduler_reason': reason,
                    'message': 'All caught up! No more tasks at the moment.'
                }

        # Return summary
        return Response({
            'ok': True,
            'undone_response': {
                'id': last_response.id,
                'call': last_response.call,
                'node_history': response_node.history,
                'deal_number': affected_deal.deal_number
            },
            'deleted_response_count': len(deleted_response_ids),
            'deleted_response_ids': deleted_response_ids,
            'recompute_stats': {
                **recompute_stats,
                'edges_deleted': edges_deleted,
                'affected_nodes': len(affected_nodes)
            },
            'next_action': next_action,
            'deal_id': affected_deal.id,
            'deal_number': affected_deal.deal_number,
            'affected_deal': affected_deal.deal_number
        })

    @action(detail=True, methods=['get'])
    def node_comments(self, request, pk=None):
        """Get all comments for a specific deal's nodes"""
        session = self.get_object()
        deal_index = request.query_params.get('deal_index')

        # Check if user is part of this session
        if request.user not in [session.creator, session.partner]:
            return Response(
                {'error': 'You are not part of this session'},
                status=status.HTTP_403_FORBIDDEN
            )

        if not deal_index:
            return Response(
                {'error': 'deal_index is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            deal_index = int(deal_index)
            deal = session.deals.get(deal_number=deal_index)
        except (ValueError, Deal.DoesNotExist):
            return Response(
                {'error': 'Invalid deal_index or deal not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get all comments for this deal
        comments = NodeComment.objects.filter(
            deal=deal,
            session=session
        ).select_related('user', 'node')

        # Format comments by node
        comments_data = []
        for comment in comments:
            comments_data.append({
                'id': comment.id,
                'node_id': comment.node.id,
                'node_history': comment.node.history,
                'user': {
                    'id': comment.user.id,
                    'username': comment.user.username,
                    'email': comment.user.email
                },
                'comment_text': comment.comment_text,
                'created_at': comment.created_at.isoformat(),
                'updated_at': comment.updated_at.isoformat()
            })

        return Response({
            'comments': comments_data,
            'deal_index': deal_index
        })

    @action(detail=True, methods=['post'])
    def save_node_comment(self, request, pk=None):
        """Save or update a comment on a node"""
        session = self.get_object()
        deal_index = request.data.get('deal_index')
        node_id = request.data.get('node_id')
        comment_text = request.data.get('comment_text', '').strip()

        # Check if user is part of this session
        if request.user not in [session.creator, session.partner]:
            return Response(
                {'error': 'You are not part of this session'},
                status=status.HTTP_403_FORBIDDEN
            )

        if not all([deal_index, node_id]):
            return Response(
                {'error': 'deal_index and node_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            deal_index = int(deal_index)
            deal = session.deals.get(deal_number=deal_index)
            node = Node.objects.get(id=node_id, deal=deal)
        except (ValueError, Deal.DoesNotExist, Node.DoesNotExist):
            return Response(
                {'error': 'Invalid deal_index or node_id'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Create or update comment
        comment, created = NodeComment.objects.update_or_create(
            node=node,
            user=request.user,
            session=session,
            deal=deal,
            defaults={'comment_text': comment_text}
        )

        return Response({
            'ok': True,
            'created': created,
            'comment': {
                'id': comment.id,
                'node_id': comment.node.id,
                'comment_text': comment.comment_text,
                'created_at': comment.created_at.isoformat(),
                'updated_at': comment.updated_at.isoformat()
            }
        })
