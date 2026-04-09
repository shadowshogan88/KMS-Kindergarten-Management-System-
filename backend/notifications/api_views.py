from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from users.permissions import IsAdmin, IsTeacher
from users.rbac_permissions import HasPortalPermission
from students.models import Student

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
    queryset = Notice.objects.select_related("created_by").prefetch_related("school_classes").all()
    serializer_class = NoticeSerializer
    rbac_path = "/portal/notices"
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_permissions(self):
        # Base audience is anyone authenticated; CRUD controlled by RBAC and role (admin/teacher).
        if self.action in {"create", "update", "partial_update", "destroy", "pin"}:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin | IsTeacher]
        else:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, "role", None)

        qs = super().get_queryset()

        q = (self.request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(description__icontains=q) | Q(content_html__icontains=q))

        audience = (self.request.query_params.get("audience") or "").strip().upper()
        if audience:
            qs = qs.filter(audience=audience)

        class_id = (self.request.query_params.get("class") or "").strip()
        if class_id:
            qs = qs.filter(school_classes__id=class_id)

        # Only active notices for non-admin.
        if role != "ADMIN":
            qs = qs.filter(is_active=True)

        # Role-based audience filtering.
        if role == "TEACHER":
            qs = qs.filter(audience__in=[Notice.AUDIENCE_ALL_SCHOOL, Notice.AUDIENCE_TEACHERS])
            return qs.distinct()

        if role == "PARENT":
            qs = qs.filter(audience__in=[Notice.AUDIENCE_ALL_SCHOOL, Notice.AUDIENCE_PARENTS])
            child_class_ids = list(
                Student.objects.filter(parent=user)
                .exclude(school_class__isnull=True)
                .values_list("school_class_id", flat=True)
                .distinct()
            )
            if child_class_ids:
                qs = qs.filter(Q(school_classes__isnull=True) | Q(school_classes__in=child_class_ids))
            else:
                qs = qs.filter(school_classes__isnull=True)
            return qs.distinct()

        if role == "STUDENT":
            qs = qs.filter(audience=Notice.AUDIENCE_ALL_SCHOOL)
            student_class_id = (
                Student.objects.filter(user=user)
                .exclude(school_class__isnull=True)
                .values_list("school_class_id", flat=True)
                .first()
            )
            if student_class_id:
                qs = qs.filter(Q(school_classes__isnull=True) | Q(school_classes__in=[student_class_id]))
            else:
                qs = qs.filter(school_classes__isnull=True)
            return qs.distinct()

        return qs.distinct()

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
