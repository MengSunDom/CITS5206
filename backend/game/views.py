from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db import models, transaction
from django.utils import timezone
from .models import Session, PlayerGame, Deal, UserBiddingSequence
from .serializers import SessionSerializer, PlayerGameSerializer, DealSerializer
from .utils import shuffle_and_deal, get_next_position, is_auction_complete, calculate_bid_value
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

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = serializer.save(creator=request.user, partner=partner)

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

        # Validate the call
        call_type = 'bid' if call[0].isdigit() else 'action'

        if call_type == 'bid':
            # Check if bid is legal based on user's own sequence
            last_bid_value = -1
            for bid_entry in user_sequence.sequence:
                if bid_entry.get('call', '')[0:1].isdigit():  # It's a bid
                    last_bid_value = calculate_bid_value(bid_entry.get('call'))

            new_bid_value = calculate_bid_value(call)
            if new_bid_value <= last_bid_value:
                return Response(
                    {'error': 'Bid must be higher than the last bid'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Add the call to user's sequence
        sequence = user_sequence.sequence or []
        call_entry = {
            'position': position,
            'call': call,
            'alert': alert_text,
            'type': call_type,
            'timestamp': timezone.now().isoformat(),
            'call_index': len(sequence)
        }

        sequence.append(call_entry)
        user_sequence.sequence = sequence

        # Check if auction is complete for this user
        deal_just_completed = False
        if is_auction_complete(sequence):
            # Check if this is the first time this deal is being completed
            if not call_entry.get('auction_complete'):
                deal_just_completed = True
            call_entry['auction_complete'] = True

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
        """Get next deal and position for practice following bridge rules"""
        import random
        import time
        from django.db import transaction, IntegrityError, OperationalError

        session = self.get_object()
        MAX_DEALS = 8  # Development: 8, Production: 64 or 128

        # Check if user is part of this session
        if request.user not in [session.creator, session.partner]:
            return Response(
                {'error': 'You are not part of this session'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Try to handle database lock with retries
        max_retries = 3
        retry_count = 0

        while retry_count < max_retries:
            try:
                # Get all deals for this session (use select_for_update to lock properly)
                all_deals = list(Deal.objects.filter(session=session).order_by('deal_number'))

                # Create deals if needed (up to MAX_DEALS)
                current_deal_count = len(all_deals)

                if current_deal_count < MAX_DEALS:
                    from .utils import generate_random_hands

                    # Calculate next deal number outside transaction
                    deal_numbers = [d.deal_number for d in all_deals]
                    max_deal_number = max(deal_numbers) if deal_numbers else 0
                    new_deal_number = max_deal_number + 1

                    if new_deal_number <= MAX_DEALS:
                        # Prepare deal data
                        dealers = ['N', 'E', 'S', 'W']
                        dealer_index = (new_deal_number - 1) % 4
                        new_dealer = dealers[dealer_index]

                        vulnerability_pattern = ['None', 'N-S', 'E-W', 'Both']
                        vulnerability = vulnerability_pattern[(new_deal_number - 1) % 4]

                        new_hands = generate_random_hands()

                        # Try to create the deal
                        try:
                            with transaction.atomic():
                                # Quick check and create
                                if not Deal.objects.filter(session=session, deal_number=new_deal_number).exists():
                                    new_deal = Deal.objects.create(
                                        session=session,
                                        deal_number=new_deal_number,
                                        hands=new_hands,
                                        dealer=new_dealer,
                                        vulnerability=vulnerability
                                    )
                                    all_deals.append(new_deal)
                        except IntegrityError:
                            # Deal already exists, just continue
                            pass
                        except OperationalError as e:
                            if 'database is locked' in str(e) and retry_count < max_retries - 1:
                                time.sleep(0.1 * (retry_count + 1))  # Wait before retry
                                retry_count += 1
                                continue
                            raise

                # If we get here, break out of retry loop
                break

            except OperationalError as e:
                if 'database is locked' in str(e) and retry_count < max_retries - 1:
                    time.sleep(0.1 * (retry_count + 1))  # Wait before retry
                    retry_count += 1
                    continue
                raise

        # Refresh the deals list
        all_deals = list(Deal.objects.filter(session=session).order_by('deal_number'))

        # Find deals that are not complete for this user
        available_deals = []
        available_positions = {}

        for deal in all_deals:
            # Get user's sequence for this deal
            user_sequence = UserBiddingSequence.objects.filter(
                deal=deal,
                user=request.user
            ).first()

            if user_sequence and user_sequence.sequence:
                # Check if auction is complete for this user
                if is_auction_complete(user_sequence.sequence):
                    continue  # Skip completed deals

                # Find which positions are still available based on sequence
                sequence = user_sequence.sequence
                last_position = sequence[-1]['position'] if sequence else None

                # Bridge rules: After a position bids, specific positions can follow
                # N -> E, E -> S, S -> W, W -> N (clockwise)
                position_order = {
                    'N': 'E',
                    'E': 'S',
                    'S': 'W',
                    'W': 'N'
                }

                # Determine next valid position
                if last_position:
                    next_position = position_order.get(last_position, 'N')
                    available_positions[deal.id] = [next_position]
                else:
                    # If no sequence yet, can start from any position
                    available_positions[deal.id] = ['N', 'E', 'S', 'W']

                available_deals.append(deal)
            else:
                # No sequence yet for this deal, all positions available
                available_positions[deal.id] = ['N', 'E', 'S', 'W']
                available_deals.append(deal)

        if not available_deals:
            # All deals complete
            return Response({
                'message': 'All deals completed!',
                'completed': True
            })

        # Pick a random available deal
        selected_deal = random.choice(available_deals)

        # Pick a random position from available positions for this deal
        positions = available_positions[selected_deal.id]
        selected_position = random.choice(positions)

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
            'max_deals': MAX_DEALS
        })


class PlayerGameViewSet(viewsets.ModelViewSet):
    serializer_class = PlayerGameSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PlayerGame.objects.filter(
            player=self.request.user,
            is_active=True
        ).order_by('-updated_at')