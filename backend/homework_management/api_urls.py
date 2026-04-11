from rest_framework.routers import DefaultRouter

from .api_views import AnnotationViewSet, GradeLogViewSet, HomeworkViewSet, SubmissionImageViewSet, SubmissionViewSet

router = DefaultRouter()
router.register(r"homeworks", HomeworkViewSet, basename="homework")
router.register(r"submissions", SubmissionViewSet, basename="homework_submission")
router.register(r"submission-images", SubmissionImageViewSet, basename="submission_image")
router.register(r"annotations", AnnotationViewSet, basename="submission_annotation")
router.register(r"grades", GradeLogViewSet, basename="homework_grade_log")

urlpatterns = router.urls

