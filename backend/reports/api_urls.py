from rest_framework.routers import DefaultRouter

from .api_views import DailyReportViewSet, ProgressNoteViewSet

router = DefaultRouter()
router.register(r"daily-reports", DailyReportViewSet, basename="daily_report")
router.register(r"progress-notes", ProgressNoteViewSet, basename="progress_note")

urlpatterns = router.urls

