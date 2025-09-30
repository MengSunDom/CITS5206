"""
Management command to create mock auction tree data for testing
Usage: python manage.py create_mock_tree_data
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from game.models import Session, Deal, Node, Response, PlayerGame, UserBiddingSequence
from game.services.auction_tree import get_or_create_node, record_user_response
from django.utils import timezone
import json

User = get_user_model()


class Command(BaseCommand):
    help = 'Creates a mock session with auction tree data for testing'

    def handle(self, *args, **options):
        self.stdout.write('Creating mock auction tree data...')

        # Use existing alice and bob users, or create them if they don't exist
        user1, created1 = User.objects.get_or_create(
            username='alice',
            defaults={
                'email': 'alice@example.com',
                'first_name': 'Alice',
                'last_name': 'User'
            }
        )
        if created1:
            user1.set_password('TestPass123!')
            user1.save()
            self.stdout.write(f'Created user: alice')

        user2, created2 = User.objects.get_or_create(
            username='bob',
            defaults={
                'email': 'bob@example.com',
                'first_name': 'Bob',
                'last_name': 'User'
            }
        )
        if created2:
            user2.set_password('TestPass123!')
            user2.save()
            self.stdout.write(f'Created user: bob')

        # Create a mock session
        session = Session.objects.create(
            name='Mock Tree Demo Session',
            creator=user1,
            partner=user2,
            dealer='W',
            vulnerability='None',
            max_deals=4
        )

        # Create PlayerGame entries
        PlayerGame.objects.create(
            session=session,
            player=user1,
            position='N'
        )
        PlayerGame.objects.create(
            session=session,
            player=user2,
            position='S'
        )

        # Create a deal with sample hands
        hands = {
            'N': {'S': ['A', 'K', 'Q', '5', '2'], 'H': ['K', 'Q', '10'], 'D': ['A', 'J', '9'], 'C': ['Q', '10', '8']},
            'E': {'S': ['J', '10', '9', '3'], 'H': ['A', '5', '2'], 'D': ['K', 'Q', '10', '4'], 'C': ['K', '9', '3']},
            'S': {'S': ['8', '7', '6'], 'H': ['J', '9', '8', '7'], 'D': ['8', '7', '3'], 'C': ['A', 'J', '7', '6', '2']},
            'W': {'S': ['4'], 'H': ['6', '4', '3'], 'D': ['6', '5', '2'], 'C': ['5', '4']}
        }

        deal = Deal.objects.create(
            session=session,
            deal_number=1,
            dealer='W',
            vulnerability='None',
            hands=hands
        )

        # Create UserBiddingSequence for both users to show actual gameplay
        alice_sequence = UserBiddingSequence.objects.create(
            deal=deal,
            user=user1,
            position='N',
            sequence=[]
        )

        bob_sequence = UserBiddingSequence.objects.create(
            deal=deal,
            user=user2,
            position='S',
            sequence=[]
        )

        # Helper function to add a bid to user's sequence
        def add_to_sequence(user_seq, position, call, alert=''):
            user_seq.sequence.append({
                'position': position,
                'call': call,
                'alert': alert,
                'type': 'bid' if call[0].isdigit() else 'action',
                'timestamp': timezone.now().isoformat(),
                'call_index': len(user_seq.sequence)
            })
            user_seq.save()

        # Create a complex auction tree with divergences
        # Scenario: Partners disagree at certain points

        # Root node (West to bid)
        root = get_or_create_node(deal, '', 'W')

        # West passes - both users agree
        add_to_sequence(alice_sequence, 'W', 'Pass')
        add_to_sequence(bob_sequence, 'W', 'Pass')
        record_user_response(session.id, 1, user1.id, '', 'W', 'P')
        record_user_response(session.id, 1, user2.id, '', 'W', 'P')

        # North opens 1C - both users agree
        node1 = get_or_create_node(deal, 'P', 'N')
        add_to_sequence(alice_sequence, 'N', '1C', 'Standard opening')
        add_to_sequence(bob_sequence, 'N', '1C', 'Standard opening')
        record_user_response(session.id, 1, user1.id, 'P', 'N', '1C')
        record_user_response(session.id, 1, user2.id, 'P', 'N', '1C')

        # East passes - both users agree
        node2 = get_or_create_node(deal, 'P 1C', 'E')
        add_to_sequence(alice_sequence, 'E', 'Pass')
        add_to_sequence(bob_sequence, 'E', 'Pass')
        record_user_response(session.id, 1, user1.id, 'P 1C', 'E', 'P')
        record_user_response(session.id, 1, user2.id, 'P 1C', 'E', 'P')

        # South bids - DIVERGENCE POINT
        node3 = get_or_create_node(deal, 'P 1C P', 'S')
        # Alice chooses 1H
        add_to_sequence(alice_sequence, 'S', '1H', '4+ hearts')
        record_user_response(session.id, 1, user1.id, 'P 1C P', 'S', '1H')
        # Bob chooses 1D
        add_to_sequence(bob_sequence, 'S', '1D', '4+ diamonds')
        record_user_response(session.id, 1, user2.id, 'P 1C P', 'S', '1D')

        # Branch 1: After 1H (Alice's path continues)
        node4a = get_or_create_node(deal, 'P 1C P 1H', 'W')
        add_to_sequence(alice_sequence, 'W', 'Pass')
        record_user_response(session.id, 1, user1.id, 'P 1C P 1H', 'W', 'P')

        node5a = get_or_create_node(deal, 'P 1C P 1H P', 'N')
        add_to_sequence(alice_sequence, 'N', '2H', 'Heart support')
        record_user_response(session.id, 1, user1.id, 'P 1C P 1H P', 'N', '2H')

        node6a = get_or_create_node(deal, 'P 1C P 1H P 2H', 'E')
        add_to_sequence(alice_sequence, 'E', 'Pass')
        record_user_response(session.id, 1, user1.id, 'P 1C P 1H P 2H', 'E', 'P')

        node7a = get_or_create_node(deal, 'P 1C P 1H P 2H P', 'S')
        add_to_sequence(alice_sequence, 'S', 'Pass')
        record_user_response(session.id, 1, user1.id, 'P 1C P 1H P 2H P', 'S', 'P')

        node8a = get_or_create_node(deal, 'P 1C P 1H P 2H P P', 'W')
        add_to_sequence(alice_sequence, 'W', 'Pass')
        record_user_response(session.id, 1, user1.id, 'P 1C P 1H P 2H P P', 'W', 'P')

        # Branch 2: After 1D (Bob's path continues)
        node4b = get_or_create_node(deal, 'P 1C P 1D', 'W')
        add_to_sequence(bob_sequence, 'W', 'Pass')
        record_user_response(session.id, 1, user2.id, 'P 1C P 1D', 'W', 'P')

        node5b = get_or_create_node(deal, 'P 1C P 1D P', 'N')
        # Bob chooses 1NT
        add_to_sequence(bob_sequence, 'N', '1NT', 'Balanced 15-17')
        record_user_response(session.id, 1, user2.id, 'P 1C P 1D P', 'N', '1NT')

        # Continue Bob's path after 1NT
        node6b1 = get_or_create_node(deal, 'P 1C P 1D P 1NT', 'E')
        add_to_sequence(bob_sequence, 'E', 'Pass')
        record_user_response(session.id, 1, user2.id, 'P 1C P 1D P 1NT', 'E', 'P')

        node7b1 = get_or_create_node(deal, 'P 1C P 1D P 1NT P', 'S')
        add_to_sequence(bob_sequence, 'S', 'Pass')
        record_user_response(session.id, 1, user2.id, 'P 1C P 1D P 1NT P', 'S', 'P')

        node8b1 = get_or_create_node(deal, 'P 1C P 1D P 1NT P P', 'W')
        add_to_sequence(bob_sequence, 'W', 'Pass')
        record_user_response(session.id, 1, user2.id, 'P 1C P 1D P 1NT P P', 'W', 'P')

        # Mark both sequences as complete since auctions are finished
        alice_sequence.save()
        bob_sequence.save()

        # Create additional deals for more practice
        for deal_num in range(2, 5):  # Create deals 2-4
            Deal.objects.create(
                session=session,
                deal_number=deal_num,
                dealer=['E', 'S', 'W'][deal_num - 2],  # Rotate dealer
                vulnerability=['NS', 'EW', 'Both'][deal_num - 2],  # Rotate vulnerability
                hands=hands  # Use same hands for simplicity
            )

        self.stdout.write(self.style.SUCCESS(f'Successfully created mock session: {session.name}'))
        self.stdout.write(self.style.SUCCESS(f'Session ID: {session.id}'))
        self.stdout.write(self.style.SUCCESS(f'Users: alice and bob'))
        if created1 or created2:
            self.stdout.write(self.style.SUCCESS(f'Password for new users: TestPass123!'))
        self.stdout.write(self.style.SUCCESS('Created complete bidding sequences:'))
        self.stdout.write(self.style.SUCCESS(f'  - Alice\'s sequence: Pass-1C-Pass-1H-Pass-2H-Pass-Pass-Pass (9 calls)'))
        self.stdout.write(self.style.SUCCESS(f'  - Bob\'s sequence: Pass-1C-Pass-1D-Pass-1NT-Pass-Pass-Pass (9 calls)'))
        self.stdout.write(self.style.SUCCESS('The auction tree shows:'))
        self.stdout.write(self.style.SUCCESS('  - Divergence at South\'s first response (Alice: 1H, Bob: 1D)'))
        self.stdout.write(self.style.SUCCESS('  - Complete auction histories for both players'))
        self.stdout.write(self.style.SUCCESS('  - Both auctions properly terminated with three passes'))
        self.stdout.write(self.style.SUCCESS('Session features:'))
        self.stdout.write(self.style.SUCCESS('  - Deal 1: Complete with bidding history (viewable and can undo)'))
        self.stdout.write(self.style.SUCCESS('  - Deals 2-4: Fresh deals ready for practice'))
        self.stdout.write(self.style.SUCCESS('  - Tree visualization shows divergence points'))