from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.db.models import QuerySet

from .models import PortalRolePermission


@dataclass(frozen=True)
class PortalPermission:
    can_view: bool = False
    can_create: bool = False
    can_edit: bool = False
    can_delete: bool = False


def _normalize_path(path: str | None) -> str:
    if not path:
        return ""
    path = str(path).strip()
    if not path.startswith("/"):
        path = "/" + path
    return path


def get_portal_permissions_for_user(user) -> dict[str, PortalPermission]:
    role = getattr(user, "portal_role", None)
    if not role or not getattr(role, "is_active", False):
        return {}

    qs: QuerySet[PortalRolePermission] = PortalRolePermission.objects.filter(role=role)
    out: dict[str, PortalPermission] = {}
    for p in qs:
        out[_normalize_path(p.path)] = PortalPermission(
            can_view=bool(p.can_view),
            can_create=bool(p.can_create),
            can_edit=bool(p.can_edit),
            can_delete=bool(p.can_delete),
        )
    return out


def user_has_portal_permission(user, path: str | None, action: str) -> bool:
    """
    action: view|create|edit|delete
    If user has no portal_role assigned, we keep existing behavior (allow).
    """

    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True

    role_obj = getattr(user, "portal_role", None)
    if not role_obj or not getattr(role_obj, "is_active", False):
        return True

    action = (action or "").strip().lower()
    path = _normalize_path(path)
    if not path:
        return True

    perm_map = get_portal_permissions_for_user(user)
    perm = perm_map.get(path)
    if not perm:
        return False

    if action == "create":
        return perm.can_create
    if action == "edit":
        return perm.can_edit
    if action == "delete":
        return perm.can_delete
    return perm.can_view


def portal_permissions_to_dict(perms: dict[str, PortalPermission]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for path, p in perms.items():
        out[path] = {
            "view": bool(p.can_view),
            "create": bool(p.can_create),
            "edit": bool(p.can_edit),
            "delete": bool(p.can_delete),
        }
    return out
