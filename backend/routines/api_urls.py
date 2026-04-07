from rest_framework.routers import DefaultRouter

from django.urls import path

from .api_views import AcademicClassRoutineViewSet, ClassRoutineViewSet, LiveCalendarView

router = DefaultRouter()
router.register(r"routines", ClassRoutineViewSet, basename="routine")
router.register(r"academic-routines", AcademicClassRoutineViewSet, basename="academic_routine")

urlpatterns = router.urls

urlpatterns += [
    path("live-calendar/", LiveCalendarView.as_view()),
]
