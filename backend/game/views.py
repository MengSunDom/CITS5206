from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db import models
from .models import Session, PlayerGame, Deal
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

        # Allow asynchronous bidding - no turn validation
        # Each user can bid independently
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

        # Add the call to auction history
        call_obj = {
            'position': player_game.position,
            'player': request.user.username,
            'call': call,
            'alert': alert_text,
            'type': call_type
        }

        auction_history.append(call_obj)
        deal.auction_history = auction_history

        # Check if auction is complete
        if is_auction_complete(auction_history):
            deal.is_complete = True

        deal.save()

        return Response({
            'deal': DealSerializer(deal).data,
            'auction_complete': deal.is_complete
        })


class PlayerGameViewSet(viewsets.ModelViewSet):
    serializer_class = PlayerGameSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PlayerGame.objects.filter(
            player=self.request.user,
            is_active=True
        ).order_by('-updated_at')