from django.db import models

class Deal(models.Model):
    cards = models.TextField()  # JSON string of card distribution
    created_at = models.DateTimeField(auto_now_add=True)
