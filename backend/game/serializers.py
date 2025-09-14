from rest_framework import serializers
from .models import Session, PlayerGame, Deal
from django.contrib.auth import get_user_model

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email"]


class PlayerGameSerializer(serializers.ModelSerializer):
    player = UserSerializer(read_only=True)
    bid_action = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = PlayerGame
        fields = ['id', 'player', 'session', 'position', 'bidding_history', 'bid_number', 'bid_action', 'is_active', 'updated_at']
        read_only_fields = ["bid_number", "bidding_history", "updated_at", "is_active"]

    def update(self, instance, validated_data):
        bid_action = validated_data.pop('bid_action', None)
        if bid_action:
            try:
                instance.make_bid(bid_action)
            except ValueError as e:
                raise serializers.ValidationError({'bid_action': str(e)})
        return super().update(instance, validated_data)


class DealSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deal
        fields = [
            'id', 'deal_number', 'dealer', 'vulnerability',
            'hands', 'auction_history', 'is_complete', 'created_at'
        ]
        read_only_fields = ['created_at']

class SessionSerializer(serializers.ModelSerializer):
    creator = UserSerializer(read_only=True)
    partner = UserSerializer(read_only=True)
    player_games = PlayerGameSerializer(many=True, read_only=True)
    deals = DealSerializer(many=True, read_only=True)

    class Meta:
        model = Session
        fields = [
            "id", "name", "creator", "partner", "create_at", "updated_at",
            "is_active", "dealer", "hands", "vulnerability", "player_games", "deals"
        ]
