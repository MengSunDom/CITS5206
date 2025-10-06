"""
Bidding-related actions for SessionViewSet
"""
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from ..models import Session, PlayerGame, Deal, UserBiddingSequence
from ..serializers import PlayerGameSerializer, DealSerializer
from ..utils import calculate_bid_value, is_auction_complete, get_next_position
from ..bridge_auction_validator import (
    validate_call,
    update_auction_state,
    get_auction_state_from_history
)
from ..services.auction_tree import record_user_response


class BiddingActionsMixin:
    """Mixin for bidding-related actions"""

    @action(detail=True, methods=['post'])
    def make_bid(self, request, pk=None):
        session = self.get_object()
        player_game = get_object_or_404(
            PlayerGame,
            session=session,
            player=request.user
        )

        bid_action = request.data.get('bid_action')
        if not bid_action:
            return Response(
                {'error': 'Bid action is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            player_game.make_bid(bid_action)
            serializer = PlayerGameSerializer(player_game)
            return Response(serializer.data)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['get'])
    def bidding_history(self, request, pk=None):
        session = self.get_object()
        player_games = PlayerGame.objects.filter(session=session)

        history = []
        for pg in player_games:
            for bid in pg.bidding_history:
                history.append({
                    'player': pg.player.username,
                    'position': pg.position,
                    'bid': bid
                })

        return Response({'bidding_history': history})

    @action(detail=True, methods=['post'])
    def undo_previous_bid(self, request, pk=None):
        """
        Undo last bid - separate from My Progress rewind functionality.
        This only modifies UserBiddingSequence and does not touch Response.is_active.
        """
        session = self.get_object()

        if request.user not in [session.creator, session.partner]:
            return Response({'error': 'User not part of this session'}, status=403)

        all_deals = list(session.deals.order_by('deal_number'))
        if not all_deals:
            return Response({'error': 'No deals in this session'}, status=400)

        # Get the undo deal number from frontend
        try:
            current_deal_number = int(request.query_params.get('current_deal', all_deals[-1].deal_number))
        except Exception:
            current_deal_number = all_deals[-1].deal_number

        current_index = next((i for i, d in enumerate(all_deals) if d.deal_number == current_deal_number), None)
        if current_index is None:
            return Response({'error': f'Deal {current_deal_number} not found'}, status=404)

        deal = all_deals[current_index]

        user_sequence = UserBiddingSequence.objects.filter(deal=deal, user=request.user).first()
        if not user_sequence or not user_sequence.sequence:
            return Response({'error': "No calls to undo"}, status=400)

        # Remove last call from sequence (does NOT touch Response model)
        last_call = user_sequence.sequence.pop()
        user_sequence.save()

        # Set next position as what we removed from the user sequence
        next_position = last_call['position']

        return Response({
            'button_deal_number': current_deal_number,
            'message': 'Last bid undone',
            'undone_call': last_call,
            'deal': {
                'id': deal.id,
                'deal_number': deal.deal_number,
                'hands': deal.hands,
                'dealer': deal.dealer,
                'vulnerability': deal.vulnerability
            },
            'position': next_position,
            'user_sequence': user_sequence.sequence,
            'deal_number_after_undo': deal.deal_number
        })

    @action(detail=False, methods=['post'])
    def make_call(self, request):
        """Make a call (bid, pass, double, redouble) in the current deal"""
        session_id = request.data.get('session_id')
        deal_id = request.data.get('deal_id')
        call = request.data.get('call')
        alert_text = request.data.get('alert', '')

        if not all([session_id, deal_id, call]):
            return Response(
                {'error': 'session_id, deal_id, and call are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            session = Session.objects.get(id=session_id)
        except Session.DoesNotExist:
            return Response(
                {'error': 'Session not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if user is part of this session
        if request.user not in [session.creator, session.partner]:
            return Response(
                {'error': 'You are not part of this session'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get player's position
        player_game = PlayerGame.objects.filter(
            session=session,
            player=request.user
        ).first()

        if not player_game:
            return Response(
                {'error': 'Player game not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Use atomic transaction to prevent race conditions
        with transaction.atomic():
            # Lock the deal row for update to prevent concurrent modifications
            try:
                deal = Deal.objects.select_for_update().get(id=deal_id, session=session)
            except Deal.DoesNotExist:
                return Response(
                    {'error': 'Deal not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Get the current auction history (fresh from DB due to lock)
            auction_history = deal.auction_history or []

            # Validate the call
            call_type = 'bid' if call[0].isdigit() else 'action'

            if call_type == 'bid':
                # Check if bid is legal
                last_bid_value = -1
                for historical_call in auction_history:
                    if historical_call.get('type') == 'bid':
                        last_bid_value = calculate_bid_value(historical_call['call'])

                new_bid_value = calculate_bid_value(call)
                if new_bid_value <= last_bid_value:
                    return Response(
                        {'error': 'Bid must be higher than the last bid'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # Add the call to auction history with timestamp for ordering
            call_obj = {
                'position': player_game.position,
                'player': request.user.username,
                'call': call,
                'alert': alert_text,
                'type': call_type,
                'timestamp': timezone.now().isoformat(),
                'call_index': len(auction_history)  # Add index for proper ordering
            }

            auction_history.append(call_obj)
            deal.auction_history = auction_history

            # Check if auction is complete
            if is_auction_complete(auction_history):
                deal.is_complete = True

            deal.save()

        # Return the updated deal (outside the transaction)
        return Response({
            'deal': DealSerializer(deal).data,
            'auction_complete': deal.is_complete
        })

    @action(detail=False, methods=['post'])
    def make_user_call(self, request):
        """Make a call in user's independent bidding sequence"""
        session_id = request.data.get('session_id')
        deal_id = request.data.get('deal_id')
        call = request.data.get('call')
        position = request.data.get('position')  # Which position is making the call
        alert_text = request.data.get('alert', '')
        current_history = request.data.get('history', '')  # Current branch history (optional)

        if not all([session_id, deal_id, call, position]):
            return Response(
                {'error': 'session_id, deal_id, call, and position are required'},
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

        # Get or create user's bidding sequence for this deal
        user_sequence, created = UserBiddingSequence.objects.get_or_create(
            deal=deal,
            user=request.user,
            defaults={'position': 'S'}  # Default starting position
        )

        # Check if this is a different branch from user's sequence
        current_sequence = user_sequence.sequence or []
        user_history_calls = [entry['call'] for entry in current_sequence]
        user_history = ' '.join(user_history_calls) if user_history_calls else ''

        # Determine if on same branch
        is_same_branch = False
        if current_history is not None:
            # Check if histories match
            is_same_branch = (user_history.startswith(current_history) or
                            current_history.startswith(user_history) or
                            current_history == user_history)
            history_str = current_history

            # Build sequence from history for validation
            history_calls = current_history.split() if current_history else []
            temp_sequence = []
            pos = deal.dealer
            for c in history_calls:
                temp_sequence.append({'position': pos, 'call': c})
                pos = get_next_position(pos)
            auction_state = get_auction_state_from_history(deal.dealer, temp_sequence)
        else:
            # No history provided, assume same branch (use user's sequence)
            is_same_branch = True
            auction_state = get_auction_state_from_history(deal.dealer, current_sequence)
            history_str = user_history

        # Validate the call using comprehensive bridge rules
        validation = validate_call(auction_state, call, position)
        if not validation['ok']:
            return Response(
                {'error': validation['error']},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update auction state
        update_auction_state(auction_state, call, position)

        # Only add to user's sequence if on the same branch
        if is_same_branch:
            call_type = 'bid' if call[0].isdigit() else 'action'
            call_entry = {
                'position': position,
                'call': call,
                'alert': alert_text,
                'type': call_type,
                'timestamp': timezone.now().isoformat(),
                'call_index': len(current_sequence)
            }

            if not user_sequence.sequence:
                user_sequence.sequence = []
            user_sequence.sequence.append(call_entry)
            user_sequence.save()

        # Check if auction is complete
        deal_just_completed = auction_state.auction_ended

        # Record the response in the auction tree using correct history
        record_user_response(
            session_id=session.id,
            deal_index=deal.deal_number,
            user_id=request.user.id,
            history=history_str,
            seat_to_act=position,
            call=call
        )

        # Prepare response sequence for display
        if is_same_branch:
            # Same branch - return user's updated sequence
            display_sequence = user_sequence.sequence
        else:
            # Different branch - build display sequence from history + new call
            history_calls = history_str.split() if history_str else []
            display_sequence = []
            pos = deal.dealer
            for c in history_calls:
                display_sequence.append({
                    'position': pos,
                    'call': c,
                    'type': 'bid' if c[0].isdigit() else 'action',
                    'call_index': len(display_sequence)
                })
                pos = get_next_position(pos)

            # Add the new call
            display_sequence.append({
                'position': position,
                'call': call,
                'alert': alert_text,
                'type': 'bid' if call[0].isdigit() else 'action',
                'call_index': len(display_sequence)
            })

        return Response({
            'user_sequence': {
                'sequence': display_sequence,
                'user': user_sequence.user.username,
                'updated_at': timezone.now().isoformat()
            },
            'auction_complete': deal_just_completed
        })
