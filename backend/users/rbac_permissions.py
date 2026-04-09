from rest_framework import permissions

from .rbac_utils import user_has_portal_permission


class HasPortalPermission(permissions.BasePermission):
    """
    DRF permission that checks `view.rbac_path` against the user's PortalRolePermission.
    If the user has no `portal_role` assigned, it allows (keeps existing behavior).
    """

    def has_permission(self, request, view):
        required_paths = getattr(view, "rbac_paths", None)
        required = getattr(view, "rbac_path", None)
        paths = []
        if isinstance(required_paths, (list, tuple, set)):
            paths = [p for p in required_paths if p]
        elif required:
            paths = [required]

        if not paths:
            return True

        action = getattr(view, "action", "") or ""
        action = action.lower()

        action_map = getattr(view, "rbac_action_map", None)
        if isinstance(action_map, dict) and action in action_map:
            needed = str(action_map.get(action) or "view").strip().lower()
            return any(user_has_portal_permission(request.user, p, needed) for p in paths)

        if action in {"list", "retrieve"}:
            needed = "view"
        elif action in {"create"}:
            needed = "create"
        elif action in {"update", "partial_update"}:
            needed = "edit"
        elif action in {"destroy"}:
            needed = "delete"
        else:
            # Custom actions: default to view unless configured.
            needed = getattr(view, "rbac_action", "view")

        return any(user_has_portal_permission(request.user, p, needed) for p in paths)
