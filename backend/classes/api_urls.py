from rest_framework.routers import DefaultRouter

from .api_views import ClassroomViewSet, LiveClassViewSet

router = DefaultRouter()
router.register(r"classrooms", ClassroomViewSet, basename="classroom")
router.register(r"live-classes", LiveClassViewSet, basename="live_class")

urlpatterns = router.urls

