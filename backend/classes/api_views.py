from django.utils.dateparse import parse_date
from django.db.models import Q
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from rest_framework.response import Response

from users.permissions import IsAdmin, IsParent, IsTeacher
from users.rbac_permissions import HasPortalPermission
from students.models import Student

from .models import Classroom, Enrollment, LiveClass, SpecialLiveClass
from .serializers import ClassroomSerializer, EnrollmentSerializer, LiveClassSerializer, SpecialLiveClassSerializer


class ClassroomViewSet(viewsets.ModelViewSet):
    queryset = Classroom.objects.select_related("teacher").all().order_by("name")
    serializer_class = ClassroomSerializer
    rbac_path = "/portal/classroom"

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin | IsTeacher]
        else:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if getattr(user, "role", None) == "TEACHER":
            return qs.filter(teacher=user)
        if getattr(user, "role", None) == "PARENT":
            return qs.filter(enrollments__student__parent=user).distinct()
        return qs

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, HasPortalPermission, IsAdmin | IsTeacher])
    def enroll(self, request, pk=None):
        classroom = self.get_object()
        student_id = request.data.get("student")
        if not student_id:
            return Response({"detail": "student is required"}, status=status.HTTP_400_BAD_REQUEST)
        if getattr(request.user, "role", None) == "TEACHER" and classroom.teacher_id != request.user.id:
            return Response({"detail": "Not your classroom"}, status=status.HTTP_403_FORBIDDEN)
        Enrollment.objects.get_or_create(classroom=classroom, student_id=student_id)
        return Response({"detail": "enrolled"})


class LiveClassViewSet(viewsets.ModelViewSet):
    queryset = LiveClass.objects.select_related("classroom", "created_by").all().order_by("-starts_at")
    serializer_class = LiveClassSerializer
    rbac_path = "/portal/live-class"

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin | IsTeacher]
        else:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        classroom_id = self.request.query_params.get("classroom")
        if classroom_id:
            qs = qs.filter(classroom_id=classroom_id)
        if getattr(user, "role", None) == "TEACHER":
            return qs.filter(classroom__teacher=user)
        if getattr(user, "role", None) == "PARENT":
            return qs.filter(classroom__enrollments__student__parent=user).distinct()
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        classroom = serializer.validated_data["classroom"]
        if getattr(user, "role", None) == "TEACHER" and classroom.teacher_id != user.id:
            raise PermissionDenied("Not your classroom.")
        serializer.save(created_by=user)


class SpecialLiveClassViewSet(viewsets.ModelViewSet):
    queryset = SpecialLiveClass.objects.select_related("school_class", "created_by").all()
    serializer_class = SpecialLiveClassSerializer
    rbac_path = "/portal/special-classes"
    pagination_class = None

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin | IsTeacher]
        else:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, "role", None)

        qs = super().get_queryset()

        date_str = (self.request.query_params.get("date") or "").strip()
        from_str = (self.request.query_params.get("from") or "").strip()
        to_str = (self.request.query_params.get("to") or "").strip()
        class_id = (self.request.query_params.get("class") or "").strip()
        section = (self.request.query_params.get("section") or "").strip().upper()
        q = (self.request.query_params.get("q") or "").strip()

        if date_str:
            d = parse_date(date_str)
            if d:
                qs = qs.filter(date=d)
        else:
            d1 = parse_date(from_str) if from_str else None
            d2 = parse_date(to_str) if to_str else None
            if d1:
                qs = qs.filter(date__gte=d1)
            if d2:
                qs = qs.filter(date__lte=d2)

        if class_id:
            qs = qs.filter(school_class_id=class_id)
        if section:
            qs = qs.filter(section=section)
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(description__icontains=q))

        if role != "ADMIN":
            qs = qs.filter(is_active=True)

        if role == "PARENT":
            class_ids = list(
                Student.objects.filter(parent=user)
                .exclude(school_class__isnull=True)
                .values_list("school_class_id", flat=True)
                .distinct()
            )
            if class_ids:
                qs = qs.filter(school_class_id__in=class_ids)
            else:
                qs = qs.none()

        if role == "STUDENT":
            student_class_id = (
                Student.objects.filter(user=user)
                .exclude(school_class__isnull=True)
                .values_list("school_class_id", flat=True)
                .first()
            )
            if student_class_id:
                qs = qs.filter(school_class_id=student_class_id)
            else:
                qs = qs.none()

        return qs.order_by("date", "start_time", "id")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
