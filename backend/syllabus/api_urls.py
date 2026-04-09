from rest_framework.routers import DefaultRouter

from .api_views import SyllabusViewSet

router = DefaultRouter()
router.register(r"syllabus", SyllabusViewSet, basename="syllabus")

urlpatterns = router.urls

