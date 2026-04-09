from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import permissions, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import PortalRole, PortalRolePermission
from .rbac_permissions import HasPortalPermission
from .rbac_utils import user_has_portal_permission
from .serializers import MeSerializer, PortalRolePermissionSerializer, PortalRoleSerializer, UserAdminSerializer
from .permissions import IsAdmin


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(MeSerializer(request.user).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdmin])
def teachers(request):
    if not user_has_portal_permission(request.user, "/portal/teachers", "view"):
        return Response({"detail": "Permission denied."}, status=403)
    User = request.user.__class__
    qs = User.objects.filter(role="TEACHER").order_by("username").values("id", "username", "first_name", "last_name")
    data = [
        {
            "id": row["id"],
            "username": row["username"],
            "name": (f'{row["first_name"]} {row["last_name"]}'.strip() or row["username"]),
        }
        for row in qs
    ]
    return Response(data)


class PortalRoleViewSet(viewsets.ModelViewSet):
    queryset = PortalRole.objects.all()
    serializer_class = PortalRoleSerializer
    rbac_path = "/portal/roles"

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin]
        else:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin]
        return super().get_permissions()


class PortalRolePermissionViewSet(viewsets.ModelViewSet):
    queryset = PortalRolePermission.objects.select_related("role").all()
    serializer_class = PortalRolePermissionSerializer
    rbac_path = "/portal/roles"

    def get_queryset(self):
        qs = super().get_queryset()
        role_id = self.request.query_params.get("role")
        if role_id:
            qs = qs.filter(role_id=role_id)
        return qs

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin]
        else:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin]
        return super().get_permissions()


class UserViewSet(viewsets.ModelViewSet):
    """
    Admin-only users list/update for portal role assignment.
    """

    queryset = get_user_model().objects.all().order_by("username")
    serializer_class = UserAdminSerializer
    rbac_path = "/portal/roles"

    def get_queryset(self):
        qs = super().get_queryset()
        q = (self.request.query_params.get("q") or "").strip()
        role = (self.request.query_params.get("role") or "").strip().upper()
        portal_role_id = self.request.query_params.get("portal_role")
        unassigned = (self.request.query_params.get("unassigned") or "").strip().lower()

        if q:
            qs = qs.filter(
                Q(username__icontains=q)
                | Q(email__icontains=q)
                | Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
            )
        if role:
            qs = qs.filter(role=role)
        if portal_role_id:
            qs = qs.filter(portal_role_id=portal_role_id)
        if unassigned in {"1", "true", "yes"}:
            qs = qs.filter(portal_role__isnull=True)
        return qs

    def get_permissions(self):
        # RBAC decides view/edit; IsAdmin keeps it admin-only.
        self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin]
        return super().get_permissions()
