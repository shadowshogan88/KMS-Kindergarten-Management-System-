from django.db.models.deletion import ProtectedError
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q

from users.permissions import IsAdmin

from .pagination import AcademicsPagination
from .models import Department, Designation, Room, SchoolClass, Section, Subject, SubjectTeacher
from .serializers import (
    DepartmentSerializer,
    RoomSerializer,
    SchoolClassSerializer,
    SectionSerializer,
    SubjectSerializer,
    DesignationSerializer,
    SubjectTeacherSerializer,
)


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    pagination_class = AcademicsPagination

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()


class SchoolClassViewSet(viewsets.ModelViewSet):
    queryset = SchoolClass.objects.all()
    serializer_class = SchoolClassSerializer
    pagination_class = AcademicsPagination

    @action(detail=False, methods=["get"], url_path="simple")
    def simple(self, request, *args, **kwargs):
        classes = SchoolClass.objects.all().order_by("name")
        data = [{"id": c.id, "name": c.name, "sections": c.sections or []} for c in classes]
        return Response(data)

    @action(detail=False, methods=["get"], url_path="options")
    def options(self, request, *args, **kwargs):
        classes = SchoolClass.objects.all().order_by("name")
        options = []
        for school_class in classes:
            sections = school_class.sections or []
            if sections:
                for section in sections:
                    options.append(
                        {
                            "value": f"{school_class.id}:{section}",
                            "label": f"{school_class.name} ({section})",
                            "school_class": school_class.id,
                            "section": section,
                        }
                    )
            else:
                options.append(
                    {
                        "value": f"{school_class.id}:",
                        "label": school_class.name,
                        "school_class": school_class.id,
                        "section": "",
                    }
                )
        return Response(options)

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "detail": "Cannot delete this class because it has related data (e.g. Subjects). Delete those first.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )


class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.all()
    serializer_class = SectionSerializer
    pagination_class = AcademicsPagination

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()


class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    pagination_class = AcademicsPagination

    @action(detail=False, methods=["get"], url_path="options")
    def options(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset()).select_related("subject_teacher", "school_class")
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(code__icontains=q))
        qs = qs.order_by("code")[:50]
        data = []
        for s in qs:
            data.append(
                {
                    "value": s.id,
                    "label": f"{s.code} - {s.name}" if s.code else s.name,
                    "subject_teacher": s.subject_teacher_id,
                    "subject_teacher_label": s.subject_teacher_label,
                }
            )
        return Response(data)

    def get_queryset(self):
        qs = super().get_queryset().select_related("school_class", "subject_teacher")
        school_class_id = self.request.query_params.get("school_class") or self.request.query_params.get("class")
        if school_class_id:
            qs = qs.filter(school_class_id=school_class_id)
        section = (self.request.query_params.get("section") or "").strip().upper()
        if section:
            qs = qs.filter(section=section)
        return qs

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()


class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    pagination_class = AcademicsPagination

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()


class DesignationViewSet(viewsets.ModelViewSet):
    queryset = Designation.objects.all()
    serializer_class = DesignationSerializer
    pagination_class = AcademicsPagination

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()


class SubjectTeacherViewSet(viewsets.ModelViewSet):
    queryset = SubjectTeacher.objects.all()
    serializer_class = SubjectTeacherSerializer
    pagination_class = AcademicsPagination

    @action(detail=False, methods=["get"], url_path="options")
    def options(self, request, *args, **kwargs):
        teachers = SubjectTeacher.objects.all().order_by("teacher_code", "name")
        options = []
        for t in teachers:
            options.append(
                {
                    "value": t.id,
                    "label": f"{t.teacher_code} - {t.name}",
                }
            )
        return Response(options)

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()
