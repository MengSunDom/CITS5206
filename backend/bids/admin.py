from django.contrib import admin
from .models import Auction, Node, Annotation, Cursor, Event

admin.site.register(Auction)
admin.site.register(Node)
admin.site.register(Annotation)
admin.site.register(Cursor)
admin.site.register(Event)
