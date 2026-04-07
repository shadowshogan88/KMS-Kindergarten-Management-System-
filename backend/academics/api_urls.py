from rest_framework.routers import DefaultRouter

from .api_views import (
    ClassTeacherViewSet,
    DepartmentViewSet,
    DesignationViewSet,
    RoomViewSet,
    SchoolClassViewSet,
    SectionViewSet,
    SubjectViewSet,
    SubjectTeacherViewSet,
)

router = DefaultRouter()
router.register(r"departments", DepartmentViewSet, basename="department")
router.register(r"academic-classes", SchoolClassViewSet, basename="academic_class")
router.register(r"sections", SectionViewSet, basename="section")
router.register(r"subjects", SubjectViewSet, basename="subject")
router.register(r"subject-teachers", SubjectTeacherViewSet, basename="subject_teacher")
router.register(r"class-teachers", ClassTeacherViewSet, basename="class_teacher")
router.register(r"rooms", RoomViewSet, basename="room")
router.register(r"designations", DesignationViewSet, basename="designation")

urlpatterns = router.urls
