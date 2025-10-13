from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import models
from django.conf import settings
import hashlib
import time
from .models import Session, PlayerGame
from .serializers import SessionSerializer, PlayerGameSerializer
from .actions import (
    DealActionsMixin,
    BiddingActionsMixin,
    SequenceActionsMixin,
    TreeActionsMixin,
    SchedulerActionsMixin,
)
from django.contrib.auth import get_user_model

User = get_user_model()


class SessionViewSet(
    DealActionsMixin,
    BiddingActionsMixin,
    SequenceActionsMixin,
    TreeActionsMixin,
    SchedulerActionsMixin,
    viewsets.ModelViewSet
):
    """
    ViewSet for managing bridge sessions

    Organized using mixins for different functional areas:
    - DealActionsMixin: Deal creation and management
    - BiddingActionsMixin: Bidding and calling
    - SequenceActionsMixin: User bidding sequences
    - TreeActionsMixin: Auction tree and progress
    - SchedulerActionsMixin: Task scheduling
    """
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

        # Get max deals from request or use default
        max_deals = request.data.get('max_deals', settings.MAX_DEALS_PER_SESSION)

        # Validate max_deals
        try:
            max_deals = int(max_deals)
            if max_deals < 1 or max_deals > 100:
                return Response(
                    {'error': 'Number of deals must be between 1 and 100'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except (ValueError, TypeError):
            return Response(
                {'error': 'Invalid number of deals'},
                status=status.HTTP_400_BAD_REQUEST
            )

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

        # Generate initial deals
        from .utils import shuffle_and_deal
        from .models import Deal

        for i in range(max_deals):
            deal = Deal(session=session, deal_number=i + 1)
            deal.dealer = deal.get_dealer_for_deal()
            deal.vulnerability = deal.get_vulnerability_for_deal()
            deal.hands = shuffle_and_deal()
            deal.save()

        serializer = self.get_serializer(session)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PlayerGameViewSet(viewsets.ModelViewSet):
    """ViewSet for managing player games"""
    serializer_class = PlayerGameSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PlayerGame.objects.filter(
            player=self.request.user,
            is_active=True
        ).select_related('session')
