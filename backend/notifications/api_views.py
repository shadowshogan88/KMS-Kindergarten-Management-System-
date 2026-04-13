from django.db.models import Q, Count
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework import status

from users.permissions import IsAdmin, IsTeacher
from users.rbac_permissions import HasPortalPermission
from students.models import Student

from .models import Announcement, Notice, Notification, NotificationRecipient
from .serializers import (
    AnnouncementSerializer,
    NoticeSerializer,
    InboxNotificationSerializer,
    SendNotificationSerializer,
)
from .services import notify_announcement, notify_notice


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
        obj = serializer.save(created_by=user)
        notify_announcement(obj)


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
        obj = serializer.save(created_by=self.request.user)
        notify_notice(obj)

    @action(detail=True, methods=["post"], url_path="pin")
    def pin(self, request, pk=None):
        obj = self.get_object()
        next_val = bool(request.data.get("is_pinned"))
        obj.is_pinned = next_val
        obj.pinned_at = timezone.now() if next_val else None
        obj.save(update_fields=["is_pinned", "pinned_at", "updated_at"])
        return Response(NoticeSerializer(obj).data)


class NotificationInboxViewSet(viewsets.GenericViewSet):
    """
    Per-user notification inbox:
    - list (all/unread, type filters)
    - mark read/unread
    - read-all
    - summary (unread count)
    - send (admin/teacher)
    """

    serializer_class = InboxNotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    rbac_path = "/portal/notifications"

    def get_queryset(self):
        user = self.request.user
        qs = (
            NotificationRecipient.objects.filter(user=user)
            .select_related("notification", "notification__created_by")
        )

        # Only published + not expired.
        now = timezone.now()
        qs = qs.filter(Q(notification__publish_at__isnull=True) | Q(notification__publish_at__lte=now))
        qs = qs.exclude(notification__expires_at__lt=now)

        tab = (self.request.query_params.get("tab") or "").strip().lower()
        if tab == "unread":
            qs = qs.filter(is_read=False)

        n_type = (self.request.query_params.get("type") or "").strip().upper()
        if n_type:
            qs = qs.filter(notification__type=n_type)

        priority = (self.request.query_params.get("priority") or "").strip().upper()
        if priority:
            qs = qs.filter(notification__priority=priority)

        return qs.order_by("-notification__created_at", "-id")

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            return self.get_paginated_response(ser.data)
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        now = timezone.now()
        base = NotificationRecipient.objects.filter(user=request.user)
        base = base.filter(Q(notification__publish_at__isnull=True) | Q(notification__publish_at__lte=now))
        base = base.exclude(notification__expires_at__lt=now)

        counts = base.aggregate(
            total=Count("id"),
            unread=Count("id", filter=Q(is_read=False)),
        )
        return Response({"total": counts["total"], "unread": counts["unread"]})

    @action(detail=True, methods=["post"], url_path="read")
    def mark_read(self, request, pk=None):
        obj = self.get_object()
        if not obj.is_read:
            obj.mark_read()
        return Response(InboxNotificationSerializer(obj).data)

    @action(detail=True, methods=["post"], url_path="unread")
    def mark_unread(self, request, pk=None):
        obj = self.get_object()
        if obj.is_read:
            obj.mark_unread()
        return Response(InboxNotificationSerializer(obj).data)

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        now = timezone.now()
        qs = NotificationRecipient.objects.filter(user=request.user, is_read=False)
        qs = qs.filter(Q(notification__publish_at__isnull=True) | Q(notification__publish_at__lte=now))
        qs = qs.exclude(notification__expires_at__lt=now)
        updated = qs.update(is_read=True, read_at=timezone.now())
        return Response({"updated": updated})

    @action(
        detail=False,
        methods=["post"],
        url_path="send",
        permission_classes=[permissions.IsAuthenticated, IsAdmin | IsTeacher],
    )
    def send(self, request):
        ser = SendNotificationSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        user = request.user
        recipient_user_ids = ser.get_recipient_user_ids(user)
        if not recipient_user_ids:
            return Response({"detail": "No recipients found."}, status=status.HTTP_400_BAD_REQUEST)

        n, recipient_count = Notification.create_for_users(
            user_ids=recipient_user_ids,
            type=ser.validated_data["type"],
            priority=ser.validated_data["priority"],
            title=ser.validated_data["title"],
            message=ser.validated_data.get("message") or "",
            action_url=ser.validated_data.get("action_url") or "",
            data=ser.validated_data.get("data") or {},
            publish_at=ser.validated_data.get("publish_at"),
            expires_at=ser.validated_data.get("expires_at"),
            created_by=user,
        )

        return Response({"notification_id": n.id, "recipients": recipient_count}, status=status.HTTP_201_CREATED)
