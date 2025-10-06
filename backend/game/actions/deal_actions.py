"""
Deal-related actions for SessionViewSet
"""
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from ..models import Deal, Node
from ..serializers import DealSerializer
from ..utils import shuffle_and_deal


class DealActionsMixin:
    """Mixin for deal-related actions"""

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

        # Add has_tree_data flag for each deal
        deals_data = serializer.data
        for deal_data in deals_data:
            # Check if this deal has any nodes (which means it has auction tree data)
            has_nodes = Node.objects.filter(deal_id=deal_data['id']).exists()
            deal_data['has_tree_data'] = has_nodes

        return Response({
            'deals': deals_data,
            'total': deals.count(),
            'latest_deal_number': deals.last().deal_number if deals.exists() else 0
        })
