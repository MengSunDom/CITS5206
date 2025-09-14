from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from game.models import Session, PlayerGame, Deal
from game.utils import shuffle_and_deal

User = get_user_model()


class Command(BaseCommand):
    help = 'Creates mock users and optionally a demo session for testing purposes'

    def add_arguments(self, parser):
        parser.add_argument(
            '--with-session',
            action='store_true',
            help='Create a demo Bridge session with the mock users',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing mock users before creating new ones',
        )

    def handle(self, *args, **options):
        # Define mock users data
        mock_users = [
            {
                'username': 'alice',
                'email': 'alice@example.com',
                'password': 'TestPass123!',
                'first_name': 'Alice',
                'last_name': 'Johnson',
            },
            {
                'username': 'bob',
                'email': 'bob@example.com',
                'password': 'TestPass123!',
                'first_name': 'Bob',
                'last_name': 'Smith',
            },
            {
                'username': 'charlie',
                'email': 'charlie@example.com',
                'password': 'TestPass123!',
                'first_name': 'Charlie',
                'last_name': 'Brown',
            },
            {
                'username': 'diana',
                'email': 'diana@example.com',
                'password': 'TestPass123!',
                'first_name': 'Diana',
                'last_name': 'Wilson',
            }
        ]

        # Clear existing mock users if requested
        if options['clear']:
            self.stdout.write('Clearing existing mock users...')
            for user_data in mock_users:
                try:
                    user = User.objects.get(username=user_data['username'])
                    user.delete()
                    self.stdout.write(
                        self.style.SUCCESS(f'Deleted user: {user_data["username"]}')
                    )
                except User.DoesNotExist:
                    pass

        # Create mock users
        created_users = []
        self.stdout.write('Creating mock users...')

        for user_data in mock_users:
            try:
                user = User.objects.create_user(
                    username=user_data['username'],
                    email=user_data['email'],
                    password=user_data['password'],
                    first_name=user_data['first_name'],
                    last_name=user_data['last_name']
                )
                created_users.append(user)
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Created user: {user_data["username"]} '
                        f'(email: {user_data["email"]}, password: {user_data["password"]})'
                    )
                )
            except IntegrityError:
                user = User.objects.get(username=user_data['username'])
                created_users.append(user)
                self.stdout.write(
                    self.style.WARNING(
                        f'User already exists: {user_data["username"]} '
                        f'(email: {user_data["email"]})'
                    )
                )

        # Create a demo session if requested
        if options['with_session'] and len(created_users) >= 2:
            self.stdout.write('\nCreating demo Bridge session...')

            alice = created_users[0]
            bob = created_users[1]

            try:
                # Create session
                session = Session.objects.create(
                    name='Demo Bridge Session',
                    creator=alice,
                    partner=bob,
                    dealer='N',
                    vulnerability='None'
                )

                # Create PlayerGame entries
                PlayerGame.objects.create(
                    session=session,
                    player=alice,
                    position='N'
                )
                PlayerGame.objects.create(
                    session=session,
                    player=bob,
                    position='S'
                )

                # Create an initial deal
                deal = Deal.objects.create(
                    session=session,
                    deal_number=1,
                    dealer='N',
                    vulnerability='None',
                    hands=shuffle_and_deal()
                )

                # Add some sample bidding
                sample_bids = [
                    {'position': 'N', 'player': alice.username, 'call': '1C', 'alert': '', 'type': 'bid'},
                    {'position': 'E', 'player': 'East', 'call': 'Pass', 'alert': '', 'type': 'action'},
                    {'position': 'S', 'player': bob.username, 'call': '1H', 'alert': '', 'type': 'bid'},
                    {'position': 'W', 'player': 'West', 'call': 'Pass', 'alert': '', 'type': 'action'},
                ]
                deal.auction_history = sample_bids
                deal.save()

                self.stdout.write(
                    self.style.SUCCESS(
                        f'Created demo session: "{session.name}" with ID: {session.id}'
                    )
                )
                self.stdout.write(
                    self.style.SUCCESS(
                        f'  - Creator: {alice.username} (North)'
                    )
                )
                self.stdout.write(
                    self.style.SUCCESS(
                        f'  - Partner: {bob.username} (South)'
                    )
                )
                self.stdout.write(
                    self.style.SUCCESS(
                        f'  - Deal #1 created with shuffled hands'
                    )
                )

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'Failed to create demo session: {str(e)}')
                )

        # Print summary
        self.stdout.write('\n' + '='*50)
        self.stdout.write(self.style.SUCCESS('Mock users ready for testing!'))
        self.stdout.write('='*50)
        self.stdout.write('\nYou can now login with any of these users:')
        for user_data in mock_users[:2]:  # Show first two users prominently
            self.stdout.write(
                f'\n  Username: {self.style.WARNING(user_data["username"])}'
            )
            self.stdout.write(
                f'  Email: {user_data["email"]}'
            )
            self.stdout.write(
                f'  Password: {self.style.WARNING(user_data["password"])}'
            )

        self.stdout.write('\n' + '-'*50)
        self.stdout.write('Additional test users: charlie, diana (same password)')
        self.stdout.write('-'*50)