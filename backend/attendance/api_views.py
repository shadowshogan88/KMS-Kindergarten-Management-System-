from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError

from users.permissions import IsAdmin, IsParent, IsTeacher

from .models import AttendanceRecord
from .serializers import AttendanceRecordSerializer
from classes.models import Enrollment


class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = AttendanceRecord.objects.select_related("classroom", "student", "student__parent").all()
    serializer_class = AttendanceRecordSerializer

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin | IsTeacher]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        classroom_id = self.request.query_params.get("classroom")
        student_id = self.request.query_params.get("student")
        if classroom_id:
            qs = qs.filter(classroom_id=classroom_id)
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
            raise ValidationError({"student": "Student not enrolled in this classroom."})
        serializer.save()
