from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SessionViewSet, PlayerGameViewSet

router = DefaultRouter()
router.register(r'sessions', SessionViewSet, basename='session')
router.register(r'player-games', PlayerGameViewSet, basename='playergame')

urlpatterns = [
    path('', include(router.urls)),
]