"""
Sequence-related actions for SessionViewSet
"""
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from ..models import Session, Deal, UserBiddingSequence
from ..serializers import DealSerializer
from ..utils import is_auction_complete


class SequenceActionsMixin:
    """Mixin for user sequence-related actions"""

    @action(detail=True, methods=['get'])
    def get_user_sequences(self, request, pk=None):
        """Get all users' bidding sequences for a specific deal"""
        session = self.get_object()
        deal_number = request.query_params.get('deal_number')

        if not deal_number:
            return Response(
                {'error': 'deal_number is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            deal = session.deals.get(deal_number=int(deal_number))
        except Deal.DoesNotExist:
            return Response(
                {'error': f'Deal {deal_number} not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get all user sequences for this deal
        sequences = UserBiddingSequence.objects.filter(deal=deal)

        result = {
            'deal': DealSerializer(deal).data,
            'user_sequences': []
        }

        for seq in sequences:
            result['user_sequences'].append({
                'user': seq.user.username,
                'user_id': seq.user.id,
                'sequence': seq.sequence,
                'notes': seq.notes,
                'updated_at': seq.updated_at
            })

        # Also check if current user has a sequence
        current_user_sequence = sequences.filter(user=request.user).first()
        result['has_user_sequence'] = current_user_sequence is not None

        return Response(result)

    @action(detail=False, methods=['post'])
    def reset_user_sequence(self, request):
        """Reset user's bidding sequence for a deal"""
        session_id = request.data.get('session_id')
        deal_id = request.data.get('deal_id')

        if not all([session_id, deal_id]):
            return Response(
                {'error': 'session_id and deal_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            session = Session.objects.get(id=session_id)
            deal = Deal.objects.get(id=deal_id, session=session)
        except (Session.DoesNotExist, Deal.DoesNotExist):
            return Response(
                {'error': 'Session or deal not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if user is part of this session
        if request.user not in [session.creator, session.partner]:
            return Response(
                {'error': 'You are not part of this session'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Delete or reset user's sequence
        UserBiddingSequence.objects.filter(
            deal=deal,
            user=request.user
        ).delete()

        return Response({
            'message': 'Bidding sequence reset successfully'
        })

    @action(detail=True, methods=['get'])
    def get_deal_history(self, request, pk=None):
        """Get all completed deals history for the user"""
        session = self.get_object()

        # Check if user is part of this session
        if request.user not in [session.creator, session.partner]:
            return Response(
                {'error': 'You are not part of this session'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get all deals with user sequences
        all_deals = Deal.objects.filter(session=session).order_by('deal_number')
        history = []

        for deal in all_deals:
            user_sequence = UserBiddingSequence.objects.filter(
                deal=deal,
                user=request.user
            ).first()

            if user_sequence and user_sequence.sequence:
                # Check if this deal's auction is complete
                if is_auction_complete(user_sequence.sequence):
                    history.append({
                        'deal_id': deal.id,
                        'deal_number': deal.deal_number,
                        'hands': deal.hands,
                        'dealer': deal.dealer,
                        'vulnerability': deal.vulnerability,
                        'sequence': user_sequence.sequence,
                        'completed_at': user_sequence.updated_at
                    })

        return Response({
            'history': history,
            'total_completed': len(history)
        })
