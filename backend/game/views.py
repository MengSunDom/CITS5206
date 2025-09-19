from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db import models, transaction
from django.utils import timezone
from django.conf import settings
import random
import hashlib
import time
from .models import Session, PlayerGame, Deal, UserBiddingSequence
from .serializers import SessionSerializer, PlayerGameSerializer, DealSerializer
from .utils import shuffle_and_deal, get_next_position, is_auction_complete, calculate_bid_value
from .bridge_auction_validator import (
    AuctionState,
    validate_call,
    update_auction_state,
    get_auction_state_from_history
)
from django.contrib.auth import get_user_model

User = get_user_model()


class SessionViewSet(viewsets.ModelViewSet):
    serializer_class = SessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Session.objects.filter(
            models.Q(creator=self.request.user) | models.Q(partner=self.request.user),
            is_active=True
        ).order_by('-updated_at')

    def create(self, request):
        partner_email = request.data.get('partner_email')
        if not partner_email:
            return Response(
                {'error': 'Partner email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            partner = User.objects.get(email=partner_email)
        except User.DoesNotExist:
            return Response(
                {'error': 'Partner not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if partner == request.user:
            return Response(
                {'error': 'Cannot create session with yourself'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get max deals based on environment
        max_deals = settings.MAX_DEALS_PER_SESSION

        # Generate a seed for reproducible deal generation
        seed_string = f"{request.user.id}_{partner.id}_{time.time()}"
        seed = hashlib.md5(seed_string.encode()).hexdigest()

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = serializer.save(
            creator=request.user,
            partner=partner,
            seed=seed,
            max_deals=max_deals
        )

        # Create PlayerGame entries for both players
        PlayerGame.objects.create(
            session=session,
            player=request.user,
            position=request.data.get('creator_position', 'N')
        )
        PlayerGame.objects.create(
            session=session,
            player=partner,
            position=request.data.get('partner_position', 'S')
        )

        # Generate all deals for the session at creation time
        with transaction.atomic():
            # Use the seed for reproducible random generation
            random.seed(seed)

            for deal_num in range(1, max_deals + 1):
                # Generate hands for this deal
                hands = shuffle_and_deal()

                # Calculate dealer and vulnerability based on deal number
                positions = ['N', 'E', 'S', 'W']
                dealer = positions[(deal_num - 1) % 4]

                # Vulnerability pattern (standard rotation)
                vul_patterns = ['None', 'NS', 'EW', 'Both']
                vulnerability = vul_patterns[(deal_num - 1) % 4]

                # Create the deal
                deal = Deal.objects.create(
                    session=session,
                    deal_number=deal_num,
                    dealer=dealer,
                    vulnerability=vulnerability,
                    hands=hands
                )

                # Pre-seed initial bidding sequence for the dealer
                UserBiddingSequence.objects.create(
                    deal=deal,
                    user=request.user,
                    position=dealer,
                    sequence=[]
                )
                UserBiddingSequence.objects.create(
                    deal=deal,
                    user=partner,
                    position=dealer,
                    sequence=[]
                )

        return Response(serializer.data, status=status.HTTP_201_CREATED)

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
    def update_hands(self, request, pk=None):
        session = self.get_object()

        if session.creator != request.user:
            return Response(
                {'error': 'Only session creator can update hands'},
                status=status.HTTP_403_FORBIDDEN
            )

        hands = request.data.get('hands')
        if not hands:
            return Response(
                {'error': 'Hands data is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        session.hands = hands
        session.save()

        serializer = self.get_serializer(session)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def create_deal(self, request, pk=None):
        """Create a new deal with shuffled cards"""
        session = self.get_object()

        # Get the next deal number
        last_deal = session.deals.order_by('-deal_number').first()
        deal_number = (last_deal.deal_number + 1) if last_deal else 1

        # Create the deal
        deal = Deal(session=session, deal_number=deal_number)
        deal.dealer = deal.get_dealer_for_deal()
        deal.vulnerability = deal.get_vulnerability_for_deal()
        deal.hands = shuffle_and_deal()
        deal.save()

        serializer = DealSerializer(deal)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def current_deal(self, request, pk=None):
        """Get the current (latest) deal"""
        session = self.get_object()
        deal = session.deals.order_by('-deal_number').first()

        if not deal:
            return Response(
                {'error': 'No deals found. Please create a deal first.'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = DealSerializer(deal)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def get_deal(self, request, pk=None):
        """Get a specific deal by deal number"""
        session = self.get_object()
        deal_number = request.query_params.get('deal_number')

        if not deal_number:
            # Return the latest deal
            deal = session.deals.order_by('-deal_number').first()
        else:
            try:
                deal_number = int(deal_number)
                deal = session.deals.filter(deal_number=deal_number).first()
            except ValueError:
                return Response(
                    {'error': 'Invalid deal number'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if not deal:
            return Response(
                {'error': f'Deal {deal_number} not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = DealSerializer(deal)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def all_deals(self, request, pk=None):
        """Get all deals for a session"""
        session = self.get_object()
        deals = session.deals.order_by('deal_number')
        serializer = DealSerializer(deals, many=True)
        return Response({
            'deals': serializer.data,
            'total': deals.count(),
            'latest_deal_number': deals.last().deal_number if deals.exists() else 0
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

        # Get current auction state from user's sequence
        dealer = deal.dealer
        current_sequence = user_sequence.sequence or []
        auction_state = get_auction_state_from_history(dealer, current_sequence)

        # Validate the call using comprehensive bridge rules
        validation = validate_call(auction_state, call, position)
        if not validation['ok']:
            return Response(
                {'error': validation['error']},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update auction state
        update_auction_state(auction_state, call, position)

        # Add the call to user's sequence
        call_type = 'bid' if call[0].isdigit() else 'action'
        call_entry = {
            'position': position,
            'call': call,
            'alert': alert_text,
            'type': call_type,
            'timestamp': timezone.now().isoformat(),
            'call_index': len(current_sequence)
        }

        current_sequence.append(call_entry)
        user_sequence.sequence = current_sequence

        # Check if auction is complete
        deal_just_completed = auction_state.auction_ended

        user_sequence.save()

        return Response({
            'user_sequence': {
                'sequence': user_sequence.sequence,
                'user': user_sequence.user.username,
                'updated_at': user_sequence.updated_at
            },
            'auction_complete': deal_just_completed
        })

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

    @action(detail=True, methods=['get'])
    def get_next_practice(self, request, pk=None):
        """Get next deal and position for practice following sequence-first navigation"""
        from django.db import transaction

        session = self.get_object()

        # Check if user is part of this session
        if request.user not in [session.creator, session.partner]:
            return Response(
                {'error': 'You are not part of this session'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get all pre-generated deals for this session
        all_deals = list(Deal.objects.filter(session=session).order_by('deal_number'))

        # Get current deal number from query params (for sequence tracking)
        current_deal_number = int(request.query_params.get('current_deal', 0))

        # Sequence-first navigation: Try to find next actionable deal starting from current+1
        selected_deal = None
        selected_position = None

        # Start from the next deal in sequence
        start_index = current_deal_number  # current_deal_number is 0-based index

        for i in range(len(all_deals)):
            # Wrap around within the deal set
            deal_index = (start_index + i) % len(all_deals)
            deal = all_deals[deal_index]

            # Get or create user's sequence for this deal
            user_sequence, created = UserBiddingSequence.objects.get_or_create(
                deal=deal,
                user=request.user,
                defaults={'position': deal.dealer, 'sequence': []}
            )

            # Check if auction is complete for this user
            if user_sequence.sequence and is_auction_complete(user_sequence.sequence):
                continue  # Skip completed deals

            # Determine the next position to act
            if user_sequence.sequence:
                # Get the last position that acted
                last_call = user_sequence.sequence[-1]
                last_position = last_call.get('position', deal.dealer)

                # Calculate next position (clockwise: W->N->E->S->W)
                next_position = get_next_position(last_position)
            else:
                # No sequence yet, start from dealer
                next_position = deal.dealer

            # Found an actionable deal
            selected_deal = deal
            selected_position = next_position
            break

        if not selected_deal:
            # All deals complete
            return Response({
                'message': 'All deals completed! Great job!',
                'completed': True
            })

        # Get user's existing sequence for this deal (if any)
        user_sequence = UserBiddingSequence.objects.filter(
            deal=selected_deal,
            user=request.user
        ).first()

        return Response({
            'deal': {
                'id': selected_deal.id,
                'deal_number': selected_deal.deal_number,
                'hands': selected_deal.hands,
                'dealer': selected_deal.dealer,
                'vulnerability': selected_deal.vulnerability
            },
            'position': selected_position,
            'user_sequence': user_sequence.sequence if user_sequence else [],
            'total_deals': len(all_deals),
            'max_deals': session.max_deals
        })


class PlayerGameViewSet(viewsets.ModelViewSet):
    serializer_class = PlayerGameSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PlayerGame.objects.filter(
            player=self.request.user,
            is_active=True
        ).order_by('-updated_at')