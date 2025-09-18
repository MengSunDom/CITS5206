from django.db import models

class ThrottleLog(models.Model):
    ip_address = models.CharField(max_length=45)     # IPv4/IPv6
    username = models.CharField(max_length=150, blank=True)
    fail_count = models.IntegerField(default=0)
    last_attempt = models.DateTimeField(auto_now=True)
