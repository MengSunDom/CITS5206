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
        related_name='created_rooms'
    )
    partner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='joined_rooms'
    )
    create_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    dealer = models.CharField(max_length=1, choices= position_choice, default='N')
    hands = models.JSONField(default=dict)
    vulnerability = models.CharField(max_length=20, choices=VULNERABILITY_CHOICES, default='None')
    
    def __str__(self):
        return f"{self.name} (Created by {self.creator.email})"
    
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
