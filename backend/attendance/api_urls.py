from rest_framework.routers import DefaultRouter

from .api_views import AcademicAttendanceViewSet, AttendanceViewSet

router = DefaultRouter()
router.register(r"attendance", AttendanceViewSet, basename="attendance")
router.register(r"academic-attendance", AcademicAttendanceViewSet, basename="academic_attendance")

urlpatterns = router.urls
