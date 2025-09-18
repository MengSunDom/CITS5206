from django.db import models
from django.conf import settings

class Partnership(models.Model):
    name = models.CharField(max_length=100)
    system_card_url = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Membership(models.Model):
    partnership = models.ForeignKey(Partnership, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    role = models.CharField(max_length=50, blank=True)  # N/S/E/W
    joined_at = models.DateTimeField(auto_now_add=True)
