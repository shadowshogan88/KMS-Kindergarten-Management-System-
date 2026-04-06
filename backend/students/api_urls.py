from rest_framework.routers import DefaultRouter

from .api_views import ParentProfileViewSet, StudentViewSet

router = DefaultRouter()
router.register(r"students", StudentViewSet, basename="student")
router.register(r"parents", ParentProfileViewSet, basename="parent_profile")

urlpatterns = router.urls

