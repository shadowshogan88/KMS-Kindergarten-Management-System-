from rest_framework.routers import DefaultRouter

from .api_views import AnnouncementViewSet

router = DefaultRouter()
router.register(r"announcements", AnnouncementViewSet, basename="announcement")

urlpatterns = router.urls

