from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied

from users.permissions import IsAdmin, IsTeacher

from .models import Announcement
from .serializers import AnnouncementSerializer


class AnnouncementViewSet(viewsets.ModelViewSet):
    queryset = Announcement.objects.select_related("classroom", "created_by").all()
    serializer_class = AnnouncementSerializer

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin | IsTeacher]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        now = timezone.now()
        qs = qs.filter(publish_at__isnull=True) | qs.filter(publish_at__lte=now)
        qs = qs.distinct()

        role = getattr(user, "role", None)
        if role == "TEACHER":
            return qs.filter(audience__in=["ALL", "TEACHERS"])
        if role == "PARENT":
            return qs.filter(audience__in=["ALL", "PARENTS"])
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        classroom = serializer.validated_data.get("classroom")
        if getattr(user, "role", None) == "TEACHER" and classroom and classroom.teacher_id != user.id:
            raise PermissionDenied("Not your classroom.")
        serializer.save(created_by=user)
