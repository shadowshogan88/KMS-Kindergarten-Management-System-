from rest_framework.routers import DefaultRouter

from .api_views import AuditLogViewSet, ExamViewSet, PromotionViewSet, RankingViewSet, ResultViewSet, StudentExamMarkViewSet

router = DefaultRouter()
router.register(r"exams", ExamViewSet, basename="exam")
router.register(r"marks", StudentExamMarkViewSet, basename="exam_mark")
router.register(r"results", ResultViewSet, basename="exam_result")
router.register(r"rankings", RankingViewSet, basename="exam_ranking")
router.register(r"promotions", PromotionViewSet, basename="promotion")
router.register(r"audit-logs", AuditLogViewSet, basename="exam_audit_log")

urlpatterns = router.urls
