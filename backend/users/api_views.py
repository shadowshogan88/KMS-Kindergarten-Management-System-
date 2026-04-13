from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db.models import Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import PortalRole, PortalRolePermission
from .rbac_permissions import HasPortalPermission
from .rbac_utils import user_has_portal_permission
from .serializers import MeSerializer, PortalRolePermissionSerializer, PortalRoleSerializer, UserAdminSerializer
from .permissions import IsAdmin


SYSTEM_PORTAL_ROLE_NAMES = {"parents", "students", "teachers"}


def _is_system_portal_role_name(name: str | None) -> bool:
    return bool(name and str(name).strip().lower() in SYSTEM_PORTAL_ROLE_NAMES)


def _is_system_portal_role(role: PortalRole | None) -> bool:
    return _is_system_portal_role_name(getattr(role, "name", None))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(MeSerializer(request.user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    user = request.user

    new_password = (request.data.get("new_password") or "").strip()
    confirm_password = (request.data.get("confirm_password") or "").strip()

    if not new_password:
        return Response({"detail": "new_password is required."}, status=status.HTTP_400_BAD_REQUEST)
    if confirm_password and confirm_password != new_password:
        return Response({"detail": "Passwords do not match."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_password(new_password, user=user)
    except Exception as e:
        # Django can return a list of messages; keep response simple + friendly.
        msgs = getattr(e, "messages", None)
        if msgs:
            return Response({"detail": " ".join(str(m) for m in msgs)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": str(e) or "Invalid password."}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.must_change_password = False
    user.save(update_fields=["password", "must_change_password"])
    return Response({"detail": "Password updated successfully."})


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

    def create(self, request, *args, **kwargs):
        name = (request.data.get("name") or "").strip()
        if _is_system_portal_role_name(name):
            return Response({"detail": "This role name is reserved and cannot be created."}, status=status.HTTP_400_BAD_REQUEST)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if _is_system_portal_role(self.get_object()):
            return Response({"detail": "This role is managed by the system and cannot be edited."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if _is_system_portal_role(self.get_object()):
            return Response({"detail": "This role is managed by the system and cannot be edited."}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if _is_system_portal_role(self.get_object()):
            return Response({"detail": "This role is managed by the system and cannot be deleted."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

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

    def create(self, request, *args, **kwargs):
        """
        Idempotent create for (role, path).
        If a permission already exists for the same role+path, treat POST as update
        instead of returning a 400 unique-together error.
        """

        def normalize_path(v):
            s = (v or "").strip()
            if not s:
                return s
            if not s.startswith("/"):
                s = f"/{s}"
            if len(s) > 1:
                s = s.rstrip("/")
            return s

        data = request.data.copy()
        role_id = data.get("role")
        path = normalize_path(data.get("path"))
        if path is not None:
            data["path"] = path

        existing = None
        if role_id and path:
            existing = PortalRolePermission.objects.filter(role_id=role_id, path=path).first()

        if existing:
            serializer = self.get_serializer(existing, data=data, partial=True)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

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
