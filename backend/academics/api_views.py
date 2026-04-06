from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

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
