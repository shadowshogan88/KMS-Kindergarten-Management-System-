from rest_framework.routers import DefaultRouter

from .api_views import AnnouncementViewSet, NoticeViewSet, NotificationInboxViewSet

router = DefaultRouter()
router.register(r"announcements", AnnouncementViewSet, basename="announcement")
router.register(r"notices", NoticeViewSet, basename="notice")
router.register(r"inbox-notifications", NotificationInboxViewSet, basename="inbox-notification")

urlpatterns = router.urls
