from django.db.models import Q
from rest_framework import permissions, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from users.permissions import IsAdmin, IsTeacher
from users.rbac_permissions import HasPortalPermission

from .models import Syllabus
from .serializers import SyllabusSerializer


class SyllabusViewSet(viewsets.ModelViewSet):
    queryset = Syllabus.objects.select_related("school_class", "subject", "created_by").all()
    serializer_class = SyllabusSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    rbac_path = "/portal/syllabus"

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin | IsTeacher]
        else:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()

        q = (self.request.query_params.get("q") or "").strip()
        subject_id = self.request.query_params.get("subject")
        class_id = self.request.query_params.get("class") or self.request.query_params.get("school_class")
        section = (self.request.query_params.get("section") or "").strip().upper()

        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(description__icontains=q))
        if subject_id:
            qs = qs.filter(subject_id=subject_id)
        if class_id:
            qs = qs.filter(school_class_id=class_id)
        if section:
            qs = qs.filter(section=section)

        role = getattr(self.request.user, "role", None)
        if role in {"TEACHER", "PARENT", "STUDENT"}:
            qs = qs.filter(is_active=True)

        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

