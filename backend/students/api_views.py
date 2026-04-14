from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import F
from django.db import IntegrityError
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from academics.models import ClassTeacher
from users.permissions import IsAdmin, IsParent, IsTeacher
from users.rbac_permissions import HasPortalPermission

from .models import ParentProfile, Student
from .pagination import StudentPagination
from .serializers import ParentProfileSerializer, StudentSerializer


class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.select_related("parent").all()
    serializer_class = StudentSerializer
    pagination_class = StudentPagination
    rbac_path = "/portal/students"

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy", "change_roll"}:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin | IsTeacher]
        else:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        class_id = (self.request.query_params.get("class") or "").strip()
        section = (self.request.query_params.get("section") or "").strip().upper()
        year = (self.request.query_params.get("year") or "").strip()

        if getattr(user, "role", None) == "PARENT":
            qs = qs.filter(parent=user)
        elif getattr(user, "role", None) == "STUDENT":
            qs = qs.filter(user=user)

        if class_id:
            qs = qs.filter(school_class_id=class_id)
        if section:
            qs = qs.filter(section=section)
        if year.isdigit():
            qs = qs.filter(created_at__year=int(year))

        return qs.order_by("school_class_id", "section", F("roll_no").asc(nulls_last=True), "first_name", "last_name")

    @action(detail=True, methods=["post"], url_path="change-roll")
    def change_roll(self, request, pk=None):
        student = self.get_object()
        role = getattr(request.user, "role", None)

        if role == "TEACHER":
            teacher_profile = getattr(request.user, "subject_teacher_profile", None)
            if not teacher_profile:
                raise PermissionDenied("Teacher profile not found.")
            allowed = ClassTeacher.objects.filter(
                teacher_id=teacher_profile.id,
                school_class_id=student.school_class_id,
                section=(student.section or ""),
            ).exists()
            if not allowed:
                raise PermissionDenied("You can only change roll for your assigned class/section.")

        if not student.school_class_id:
            raise ValidationError({"roll_no": "Student must be assigned to a class first."})

        raw = request.data.get("roll_no", None)
        try:
            roll_no = int(raw)
        except (TypeError, ValueError):
            raise ValidationError({"roll_no": "roll_no must be an integer."})
        if roll_no < 1:
            raise ValidationError({"roll_no": "roll_no must be 1 or greater."})

        try:
            student.roll_no = roll_no
            student.save(update_fields=["roll_no"])
        except DjangoValidationError as e:
            detail = getattr(e, "message_dict", None) or {"detail": e.messages}
            raise ValidationError(detail)
        except IntegrityError:
            raise ValidationError({"roll_no": "This roll number is already used in the selected class/section."})

        return Response(self.get_serializer(student).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="filter-options")
    def filter_options(self, request):
        year_dates = Student.objects.exclude(created_at__isnull=True).dates("created_at", "year", order="DESC")
        years = [int(d.year) for d in year_dates if d]
        return Response({"years": years})


class ParentProfileViewSet(viewsets.ModelViewSet):
    queryset = ParentProfile.objects.select_related("user").all()
    serializer_class = ParentProfileSerializer

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin | IsTeacher]
        else:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsParent | IsAdmin]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if getattr(user, "role", None) == "PARENT":
            return qs.filter(user=user)
        return qs

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated, IsParent])
    def mine(self, request):
        obj, _ = ParentProfile.objects.get_or_create(user=request.user)
        return Response(ParentProfileSerializer(obj).data)
