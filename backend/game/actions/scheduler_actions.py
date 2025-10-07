"""
Scheduler-related actions for SessionViewSet
"""
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from ..models import UserBiddingSequence
from ..utils import get_next_position
from ..services.scheduler import next_node


class SchedulerActionsMixin:
    """Mixin for scheduler-related actions"""

    @action(detail=True, methods=['get'])
    def get_next_task(self, request, pk=None):
        """Get next task using simplified scheduler (PLUS4 then RANDOM_DEAL)"""
        session = self.get_object()

        # Check if user is part of this session
        if request.user not in [session.creator, session.partner]:
            return Response(
                {'error': 'You are not part of this session'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Use new scheduler
        node, reason = next_node(request.user.id, session.id)

        if not node:
            return Response({
                'node_id': None,
                'deal_index': None,
                'depth': None,
                'seat': None,
                'history': '',
                'reason': reason,
                'all_completed': reason == 'ALL_CAUGHT_UP'
            })

        # Get user's existing sequence for this deal
        user_sequence = UserBiddingSequence.objects.filter(
            deal=node.deal,
            user=request.user
        ).first()

        # CRITICAL: Build display sequence for frontend
        # requires_user() has already ensured node.seat_to_act is correct for this user
        if user_sequence and user_sequence.sequence:
            # Build user's history from their sequence
            user_history_calls = [call.get('call') for call in user_sequence.sequence]
            user_history = ' '.join(user_history_calls) if user_history_calls else ''

            # Check if on same branch as user's sequence
            if user_history.startswith(node.history) or node.history.startswith(user_history):
                # Same branch - use user's sequence for display
                display_sequence = user_sequence.sequence
            else:
                # Different branch - build display sequence from node's history
                history_calls = node.history.split() if node.history else []
                display_sequence = []
                pos = node.deal.dealer
                for call in history_calls:
                    display_sequence.append({
                        'position': pos,
                        'call': call,
                        'type': 'bid' if call[0].isdigit() else 'action',
                        'call_index': len(display_sequence)
                    })
                    pos = get_next_position(pos)
        else:
            # No sequence yet - empty display
            display_sequence = []

        return Response({
            'node_id': node.id,
            'deal_index': node.deal.deal_number,
            'depth': node.depth,
            'seat': node.seat_to_act,  # Use node's seat (verified by requires_user)
            'history': node.history or '',
            'reason': reason,
            'deal': {
                'id': node.deal.id,
                'deal_number': node.deal.deal_number,
                'hands': node.deal.hands,
                'dealer': node.deal.dealer,
                'vulnerability': node.deal.vulnerability
            },
            'user_sequence': display_sequence
        })
