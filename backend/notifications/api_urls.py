from rest_framework.routers import DefaultRouter

from .api_views import AnnouncementViewSet, NoticeViewSet

router = DefaultRouter()
router.register(r"announcements", AnnouncementViewSet, basename="announcement")
router.register(r"notices", NoticeViewSet, basename="notice")

urlpatterns = router.urls
