from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from rest_framework.response import Response

from users.permissions import IsAdmin, IsTeacher
from users.rbac_permissions import HasPortalPermission

from .models import Announcement, Notice
from .serializers import AnnouncementSerializer, NoticeSerializer


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


class NoticeViewSet(viewsets.ModelViewSet):
    queryset = Notice.objects.select_related("created_by").all()
    serializer_class = NoticeSerializer
    rbac_path = "/portal/notices"

    def get_permissions(self):
        # Base audience is anyone authenticated; CRUD controlled by RBAC and role (admin/teacher).
        if self.action in {"create", "update", "partial_update", "destroy", "pin"}:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin | IsTeacher]
        else:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        # Only active notices for non-admin
        if getattr(self.request.user, "role", None) != "ADMIN":
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="pin")
    def pin(self, request, pk=None):
        obj = self.get_object()
        next_val = bool(request.data.get("is_pinned"))
        obj.is_pinned = next_val
        obj.pinned_at = timezone.now() if next_val else None
        obj.save(update_fields=["is_pinned", "pinned_at", "updated_at"])
        return Response(NoticeSerializer(obj).data)
