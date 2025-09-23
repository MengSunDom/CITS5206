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
    name = models.CharField(max_length=50)
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
    vulnerability = models.CharField(max_length=20, choices=Deal.VULNERABILITY_CHOICES)
    hands = models.JSONField(default=dict) 
    auction_history = models.JSONField(default=list) 
    is_complete = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['deal_number']

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
