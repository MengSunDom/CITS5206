from django.db import models
from django.contrib.auth.models import User
from django.conf import settings
from .validators import is_bid_valid


# Create your models here.
position_choice = [('N', 'North'), ('S', 'South'),
    ('E', 'East'),('W', 'West')]
class Session(models.Model):
    VULNERABILITY_CHOICES = [('None','None'), ('NS','NS'),
        ('EW','EW'), ('Both','Both'),]
    name = models.CharField(max_length=50, unique=True)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_sessions'
    )
    partner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='partner_sessions'
    )
    create_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    dealer = models.CharField(max_length=1, choices= position_choice, default='N')
    hands = models.JSONField(default=dict)
    vulnerability = models.CharField(max_length=20, choices=VULNERABILITY_CHOICES, default='None')
    seed = models.CharField(max_length=100, blank=True, null=True)  # Store RNG seed for reproducible deals
    max_deals = models.PositiveIntegerField(default=4)  # Maximum number of deals in this session

    def __str__(self):
        return f"{self.name} (Created by {self.creator.email})"

class Deal(models.Model):
    session = models.ForeignKey(
        Session,
        on_delete=models.CASCADE,
        related_name='deals'
    )
    deal_number = models.PositiveIntegerField()
    dealer = models.CharField(max_length=1, choices=position_choice)
    vulnerability = models.CharField(max_length=20, choices=Session.VULNERABILITY_CHOICES)
    hands = models.JSONField(default=dict)  # Store dealt cards for each position
    auction_history = models.JSONField(default=list)  # Store bidding sequence
    is_complete = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('session', 'deal_number')
        ordering = ['deal_number']

    def __str__(self):
        return f"Deal {self.deal_number} in {self.session.name}"

    def get_dealer_for_deal(self):
        """Calculate dealer based on deal number"""
        deal_index = (self.deal_number - 1) % 16
        dealer_index = deal_index % 4
        positions = ['N', 'E', 'S', 'W']
        return positions[dealer_index]

    def get_vulnerability_for_deal(self):
        """Calculate vulnerability based on deal number"""
        deal_index = (self.deal_number - 1) % 16
        vuln_index = deal_index // 4
        vulnerabilities = ['None', 'NS', 'EW', 'Both']
        return vulnerabilities[vuln_index]

class PlayerGame(models.Model):
    session = models.ForeignKey(
    Session,
    on_delete=models.CASCADE,
    related_name='player_games'
)
    player = models.ForeignKey(
    settings.AUTH_USER_MODEL,
    on_delete=models.CASCADE,
    related_name='player_games'
    )
    bid_number = models.PositiveIntegerField(default=0)
    position = models.CharField(max_length=1, choices=position_choice)
    bidding_history = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        unique_together = ('session', 'player')
    def __str__(self):
        return f"PlayerGame: {self.player.username} in session {self.session.name}"
    def make_bid(self, bid_action):
        if not is_bid_valid(bid_action, self.bidding_history):
            raise ValueError(f"Invalid bid: {bid_action}")

        history = self.bidding_history or []
        history.append(bid_action)
        self.bidding_history = history

        self.bid_number += 1

        self.save()


class UserBiddingSequence(models.Model):
    """Tracks each user's independent bidding sequence for a deal.

    This allows users to work asynchronously, maintaining their own
    bidding sequences while viewing a shared space.
    """
    deal = models.ForeignKey(
        Deal,
        on_delete=models.CASCADE,
        related_name='user_sequences'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='bidding_sequences'
    )
    position = models.CharField(max_length=1, choices=position_choice)
    sequence = models.JSONField(default=list)  # User's independent bid sequence
    notes = models.TextField(blank=True, help_text="User's notes on their bidding")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('deal', 'user')
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.user.username}'s sequence for Deal {self.deal.deal_number}"

    def add_bid(self, bid_action, alert_text=''):
        """Add a bid to the user's sequence."""
        sequence = self.sequence or []
        bid_entry = {
            'position': self.position,
            'call': bid_action,
            'alert': alert_text,
            'timestamp': str(models.DateTimeField(auto_now_add=True))
        }
        sequence.append(bid_entry)
        self.sequence = sequence
        self.save()
        return bid_entry


class BidComment(models.Model):
    """Comments on specific bids in a sequence."""
    deal = models.ForeignKey(
        Deal,
        on_delete=models.CASCADE,
        related_name='bid_comments'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='bid_comments'
    )
    bid_index = models.IntegerField(help_text="Index of bid in sequence")
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['bid_index', 'created_at']

    def __str__(self):
        return f"Comment by {self.user.username} on bid {self.bid_index}"

class ForkDeal(models.Model):
    """Create a new deal when there is difference between player's auction_history"""
    original_deal = models.ForeignKey(
        Deal, 
        on_delete=models.CASCADE,
        related_name='forks'
    )
    dealer = models.CharField(max_length=1, choices=position_choice)
    vulnerability = models.CharField(max_length=20, choices=Session.VULNERABILITY_CHOICES)
    hands = models.JSONField(default=dict) 
    auction_history = models.JSONField(default=list) 
    is_complete = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"ForkDeal {self.id} from Deal {self.original_deal.deal_number}"
    
    @classmethod
    def create_from_deal(cls, deal, fork_index, new_bid):

        return cls.objects.create(
            original_deal=deal,
            dealer=deal.dealer,
            vulnerability=deal.vulnerability,
            hands=deal.hands,
            auction_history=deal.auction_history[:fork_index] + [new_bid],
        )


class Node(models.Model):
    """Represents a public state in the auction tree"""
    session = models.ForeignKey(
        Session,
        on_delete=models.CASCADE,
        related_name='nodes'
    )
    deal = models.ForeignKey(
        Deal,
        on_delete=models.CASCADE,
        related_name='nodes'
    )
    history = models.TextField(blank=True, help_text="Space-separated bidding history")
    seat_to_act = models.CharField(max_length=1, choices=position_choice)
    divergence = models.BooleanField(default=False, help_text="True if partners diverge at this node")
    status = models.CharField(
        max_length=10,
        choices=[('open', 'Open'), ('closed', 'Closed')],
        default='open'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('deal', 'history', 'seat_to_act')
        indexes = [
            models.Index(fields=['deal', 'history']),
            models.Index(fields=['session', 'deal']),
        ]

    def __str__(self):
        return f"Node: Deal {self.deal.deal_number} - History: {self.history or 'root'} - Seat: {self.seat_to_act}"

    def get_state_key(self):
        """Generate a unique key for this public state"""
        return f"{self.session.id}_{self.deal.deal_number}_{self.seat_to_act}_{self.history}"

    def is_auction_complete(self):
        """Check if the auction is complete at this node"""
        if not self.history:
            return False

        calls = self.history.strip().split()
        if len(calls) >= 4:
            # Check for four passes at the start
            if calls[:4] == ['P', 'P', 'P', 'P']:
                return True

            # Check for three consecutive passes after a non-pass bid
            if len(calls) >= 4:
                last_three = calls[-3:]
                if last_three == ['P', 'P', 'P']:
                    # Find the last non-pass bid
                    for call in reversed(calls[:-3]):
                        if call != 'P':
                            return True
        return False


class Response(models.Model):
    """Tracks each partner's response at a node"""
    node = models.ForeignKey(
        Node,
        on_delete=models.CASCADE,
        related_name='responses'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='auction_responses'
    )
    call = models.CharField(max_length=10, help_text="The call made (e.g., '1H', 'P', 'X')")
    timestamp = models.DateTimeField(auto_now_add=True)

    # Soft-versioning fields for rewind functionality
    is_active = models.BooleanField(default=True, help_text="False when rewound past this response")
    superseded_at = models.DateTimeField(null=True, blank=True, help_text="When this response was superseded")
    superseded_by_action = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        choices=[
            ('REWIND', 'Rewind'),
            ('ADMIN', 'Admin Action'),
            ('MERGE', 'Merge'),
        ],
        help_text="Why this response was superseded"
    )

    class Meta:
        indexes = [
            models.Index(fields=['node', 'call']),
            models.Index(fields=['user', 'node']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.user.username}'s response at {self.node}: {self.call}"


class ResponseAudit(models.Model):
    """Audit trail for response changes (rewinds, etc.)"""
    response = models.ForeignKey(
        Response,
        on_delete=models.CASCADE,
        related_name='audit_entries',
        null=True,
        blank=True
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='response_audits'
    )
    node = models.ForeignKey(
        Node,
        on_delete=models.CASCADE,
        related_name='audit_entries',
        null=True,
        blank=True
    )
    session = models.ForeignKey(
        Session,
        on_delete=models.CASCADE,
        related_name='response_audits'
    )
    deal = models.ForeignKey(
        Deal,
        on_delete=models.CASCADE,
        related_name='response_audits'
    )
    old_call = models.CharField(max_length=10, help_text="The call that was superseded")
    action = models.CharField(
        max_length=20,
        choices=[
            ('REWIND', 'Rewind'),
            ('ADMIN', 'Admin Action'),
            ('MERGE', 'Merge'),
        ],
        help_text="Type of action performed"
    )
    action_timestamp = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(default=dict, blank=True, help_text="Additional context about the action")

    class Meta:
        ordering = ['-action_timestamp']
        indexes = [
            models.Index(fields=['user', 'session', 'deal']),
            models.Index(fields=['action_timestamp']),
        ]


class NodeComment(models.Model):
    """Comments on divergence nodes for partner discussion"""
    node = models.ForeignKey(
        Node,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='node_comments'
    )
    session = models.ForeignKey(
        Session,
        on_delete=models.CASCADE,
        related_name='node_comments'
    )
    deal = models.ForeignKey(
        Deal,
        on_delete=models.CASCADE,
        related_name='node_comments'
    )
    comment_text = models.TextField(help_text="User's comment on this divergence node")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['node', 'user']),
            models.Index(fields=['session', 'deal']),
        ]
        # Each user can only have one comment per node
        unique_together = ['node', 'user']

    def __str__(self):
        return f"{self.user.username}'s comment on node {self.node.id}"
