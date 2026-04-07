from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from users.permissions import IsAdmin, IsParent, IsTeacher

from .models import ParentProfile, Student
from .serializers import ParentProfileSerializer, StudentSerializer


class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.select_related("parent").all().order_by("first_name", "last_name")
    serializer_class = StudentSerializer

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin | IsTeacher]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if getattr(user, "role", None) == "PARENT":
            return qs.filter(parent=user)
        if getattr(user, "role", None) == "STUDENT":
            return qs.filter(user=user)
        return qs


class ParentProfileViewSet(viewsets.ModelViewSet):
    queryset = ParentProfile.objects.select_related("user").all()
    serializer_class = ParentProfileSerializer

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin | IsTeacher]
        else:
            self.permission_classes = [permissions.IsAuthenticated, IsParent | IsAdmin]
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
