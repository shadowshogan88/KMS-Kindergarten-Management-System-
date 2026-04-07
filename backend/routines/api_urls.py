from rest_framework.routers import DefaultRouter

from django.urls import path

from .api_views import (
    AcademicClassRoutineViewSet,
    ClassRoutineViewSet,
    HolidayCalendarView,
    HolidayViewSet,
    LiveCalendarView,
    WeeklyHolidayViewSet,
)

router = DefaultRouter()
router.register(r"routines", ClassRoutineViewSet, basename="routine")
router.register(r"academic-routines", AcademicClassRoutineViewSet, basename="academic_routine")
router.register(r"holidays", HolidayViewSet, basename="holiday")
router.register(r"weekly-holidays", WeeklyHolidayViewSet, basename="weekly_holiday")

urlpatterns = router.urls

urlpatterns += [
    path("live-calendar/", LiveCalendarView.as_view()),
    path("holiday-calendar/", HolidayCalendarView.as_view()),
]
