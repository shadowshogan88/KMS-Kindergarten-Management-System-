from rest_framework.routers import DefaultRouter

from .api_views import ClassRoutineViewSet

router = DefaultRouter()
router.register(r"routines", ClassRoutineViewSet, basename="routine")

urlpatterns = router.urls

