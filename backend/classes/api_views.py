import datetime
import uuid

from django.conf import settings
from django.utils.dateparse import parse_date
from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from rest_framework.response import Response

from users.permissions import IsAdmin, IsParent, IsTeacher
from users.rbac_permissions import HasPortalPermission
from students.models import Student

from .models import Classroom, Enrollment, LiveClass, SpecialLiveClass
from .serializers import ClassroomSerializer, EnrollmentSerializer, LiveClassSerializer, SpecialLiveClassSerializer
from integrations.google import create_calendar_event_with_meet, delete_calendar_event


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
    rbac_action_map = {"generate_meet": "edit", "regenerate_meet": "edit"}

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

    @action(detail=True, methods=["post"], url_path="generate-meet")
    def generate_meet(self, request, pk=None):
        obj: SpecialLiveClass = self.get_object()
        if obj.meet_link:
            return Response({"detail": "Meet link already exists."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            return self._generate_meet_for_obj(obj, regenerate=False)
        except Exception as e:
            return Response({"detail": str(e) or "Failed to generate Meet link."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="regenerate-meet")
    def regenerate_meet(self, request, pk=None):
        obj: SpecialLiveClass = self.get_object()
        try:
            return self._generate_meet_for_obj(obj, regenerate=True)
        except Exception as e:
            return Response({"detail": str(e) or "Failed to regenerate Meet link."}, status=status.HTTP_400_BAD_REQUEST)

    def _generate_meet_for_obj(self, obj: SpecialLiveClass, regenerate: bool):
        tz = timezone.get_current_timezone()
        start_dt = timezone.make_aware(datetime.datetime.combine(obj.date, obj.start_time), tz)
        end_dt = timezone.make_aware(datetime.datetime.combine(obj.date, obj.end_time), tz)

        payload = {
            "summary": obj.title or "Special Class",
            "description": f"Special Class: {obj.school_class.name}{f' ({obj.section})' if obj.section else ''}",
            "start": {"dateTime": start_dt.isoformat(), "timeZone": settings.TIME_ZONE},
            "end": {"dateTime": end_dt.isoformat(), "timeZone": settings.TIME_ZONE},
            "conferenceData": {
                "createRequest": {
                    "requestId": uuid.uuid4().hex,
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            },
        }

        if regenerate and obj.meet_event_id:
            try:
                delete_calendar_event(obj.meet_event_id)
            except Exception:
                pass
            obj.meet_event_id = ""
            obj.meet_link = ""

        created = create_calendar_event_with_meet(payload)
        meet_link = getattr(created, "meet_link", "") or ""
        event_id = getattr(created, "event_id", "") or ""
        if not meet_link:
            raise Exception("Meet link not found in Google response.")

        obj.meet_link = meet_link
        obj.meet_event_id = event_id
        obj.save(update_fields=["meet_link", "meet_event_id", "updated_at"])

        return Response(SpecialLiveClassSerializer(obj).data)
