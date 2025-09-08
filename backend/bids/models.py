from django.db import models
from django.conf import settings
from partnerships.models import Partnership
from deals.models import Deal

class Auction(models.Model):
    # Table 5: bids_auction
    partnership = models.ForeignKey(Partnership, on_delete=models.CASCADE)
    deal = models.ForeignKey(Deal, on_delete=models.SET_NULL, null=True, blank=True)
    position = models.CharField(max_length=5)                 # N/S/E/W
    status = models.CharField(max_length=20, default='active')# active/closed/archived
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='auctions_updated'
    )
    version = models.IntegerField(default=0)

class Node(models.Model):
    # Table 8: bids_node
    auction = models.ForeignKey(Auction, on_delete=models.CASCADE)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE)
    position = models.CharField(max_length=5)                 # who makes this call
    bid = models.CharField(max_length=16)                     # PASS/X/XX/1C/1D/1H/1S/1NT/…
    explanation = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    version = models.IntegerField(default=0)

    class Meta:
        unique_together = ('auction', 'parent', 'bid')        # prevent duplicate branch

class Annotation(models.Model):
    # Table 9: bids_annotation
    node = models.ForeignKey(Node, on_delete=models.CASCADE)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    note_type = models.CharField(max_length=24, default='system')  # system/note/disagreement/example
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

class Cursor(models.Model):
    # Table 10: bids_cursor
    auction = models.ForeignKey(Auction, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    node = models.ForeignKey(Node, null=True, blank=True, on_delete=models.SET_NULL)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('auction', 'user')                 # one cursor per user per auction

class Event(models.Model):
    # Table 11: bids_event
    auction = models.ForeignKey(Auction, on_delete=models.CASCADE)
    node = models.ForeignKey(Node, null=True, blank=True, on_delete=models.SET_NULL)
    actor_user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=24)                  # create_node/edit_node/delete_node/close_…
    payload = models.TextField(blank=True)                    # JSON diff / client version, etc.
    created_at = models.DateTimeField(auto_now_add=True)
