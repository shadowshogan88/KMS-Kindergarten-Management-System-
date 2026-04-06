from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from users.permissions import IsAdmin, IsParent, IsTeacher
from classes.models import Enrollment

from .models import DailyActivityReport, MediaItem, ProgressNote
from .serializers import DailyActivityReportSerializer, MediaItemSerializer, ProgressNoteSerializer


class DailyReportViewSet(viewsets.ModelViewSet):
    queryset = DailyActivityReport.objects.select_related("classroom", "student", "student__parent", "created_by").all()
    serializer_class = DailyActivityReportSerializer

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy", "upload_media"}:
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin | IsTeacher]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        student_id = self.request.query_params.get("student")
        classroom_id = self.request.query_params.get("classroom")
        if student_id:
            qs = qs.filter(student_id=student_id)
        if classroom_id:
            qs = qs.filter(classroom_id=classroom_id)
        if getattr(user, "role", None) == "TEACHER":
            return qs.filter(classroom__teacher=user)
        if getattr(user, "role", None) == "PARENT":
            return qs.filter(student__parent=user)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        classroom = serializer.validated_data["classroom"]
        student = serializer.validated_data["student"]
        if getattr(user, "role", None) == "TEACHER" and classroom.teacher_id != user.id:
            raise PermissionDenied("Not your classroom.")
        if not Enrollment.objects.filter(classroom=classroom, student=student).exists():
            raise PermissionDenied("Student not enrolled in this classroom.")
        serializer.save(created_by=user)

    @action(
        detail=True,
        methods=["post"],
        url_path="upload-media",
        parser_classes=[MultiPartParser, FormParser],
        permission_classes=[permissions.IsAuthenticated, IsAdmin | IsTeacher],
    )
    def upload_media(self, request, pk=None):
        report = self.get_object()
        if getattr(request.user, "role", None) == "TEACHER" and report.classroom.teacher_id != request.user.id:
            return Response({"detail": "Not your classroom"}, status=status.HTTP_403_FORBIDDEN)
        serializer = MediaItemSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(report=report)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ProgressNoteViewSet(viewsets.ModelViewSet):
    queryset = ProgressNote.objects.select_related("student", "student__parent", "classroom", "created_by").all()
    serializer_class = ProgressNoteSerializer

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin | IsTeacher]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        student_id = self.request.query_params.get("student")
        if student_id:
            qs = qs.filter(student_id=student_id)
        if getattr(user, "role", None) == "TEACHER":
            return qs.filter(classroom__teacher=user)
        if getattr(user, "role", None) == "PARENT":
            return qs.filter(student__parent=user)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        classroom = serializer.validated_data["classroom"]
        student = serializer.validated_data["student"]
        if getattr(user, "role", None) == "TEACHER" and classroom.teacher_id != user.id:
            raise PermissionDenied("Not your classroom.")
        if not Enrollment.objects.filter(classroom=classroom, student=student).exists():
            raise PermissionDenied("Student not enrolled in this classroom.")
        serializer.save(created_by=user)
