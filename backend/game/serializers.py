from rest_framework import serializers
from .models import Session, PlayerGame
from django.contrib.auth import get_user_model

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email"]


class PlayerGameSerializer(serializers.ModelSerializer):
    player = UserSerializer(read_only=True)

    class Meta:
        model = PlayerGame
        fields = ['id', 'player', 'session', 'position', 'bidding_history', 'bid_number', 'bid_action']
        read_only_fields = ["bid_number", "bidding_history", "updated_at"]

    def update(self, instance, validated_data):
        bid_action = validated_data.pop('bid_action', None)
        if bid_action:
            try:
                instance.make_bid(bid_action)
            except ValueError as e:
                raise serializers.ValidationError({'bid_action': str(e)})
        return super().update(instance, validated_data)


class SessionSerializer(serializers.ModelSerializer):
    creator = UserSerializer(read_only=True)
    partner = UserSerializer(read_only=True)
    player_games = PlayerGameSerializer(many=True, read_only=True)

    class Meta:
        model = Session
        fields = ["id","name","creator","partner","create_at","updated_at","is_active","dealer","hands","vulnerability","player_games",
        ]
