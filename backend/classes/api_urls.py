from rest_framework.routers import DefaultRouter

from .api_views import ClassroomViewSet, LiveClassViewSet, SpecialLiveClassViewSet

router = DefaultRouter()
router.register(r"classrooms", ClassroomViewSet, basename="classroom")
router.register(r"live-classes", LiveClassViewSet, basename="live_class")
router.register(r"special-live-classes", SpecialLiveClassViewSet, basename="special_live_class")

urlpatterns = router.urls
