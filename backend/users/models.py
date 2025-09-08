from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    # Table 1: users_user
    reset_code = models.CharField(max_length=64, null=True, blank=True)
    reset_code_expires = models.DateTimeField(null=True, blank=True)

class Profile(models.Model):
    # Table 2: users_profile
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    display_name = models.CharField(max_length=150, blank=True)
    preferred_system = models.CharField(max_length=50, blank=True)  # e.g., Acol/SA/Precision
    timezone = models.CharField(max_length=50, blank=True)
    bio = models.TextField(blank=True)

    def __str__(self):
        return self.display_name or self.user.username
