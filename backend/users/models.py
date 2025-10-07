from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    email = models.EmailField(unique=True, max_length=254)
    reset_code = models.CharField(max_length=64, null=True, blank=True)
    reset_code_expires = models.DateTimeField(null=True, blank=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    class Meta:
        db_table = 'users_user'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
    
    def __str__(self):
        return self.email
    
    def set_reset_code(self, code):
        self.reset_code = code
        self.reset_code_expires = timezone.now() + timezone.timedelta(hours=1)
        self.save()
    
    def is_reset_code_valid(self, code):
        if not self.reset_code or not self.reset_code_expires:
            return False
        if self.reset_code != code:
            return False
        if timezone.now() > self.reset_code_expires:
            return False
        return True
    
    def clear_reset_code(self):
        self.reset_code = None
        self.reset_code_expires = None
        self.save()


class Profile(models.Model):
    BIDDING_SYSTEMS = [
        ('acol', 'Acol'),
        ('standard_american', 'Standard American'),
        ('precision', 'Precision'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    display_name = models.CharField(max_length=150, blank=True)
    preferred_system = models.CharField(max_length=50, choices=BIDDING_SYSTEMS, blank=True)
    timezone = models.CharField(max_length=50, blank=True, default='UTC')
    bio = models.TextField(blank=True)
    
    class Meta:
        db_table = 'users_profile'
        verbose_name = 'Profile'
        verbose_name_plural = 'Profiles'
    
    def __str__(self):
        return f"{self.user.email}'s profile"
