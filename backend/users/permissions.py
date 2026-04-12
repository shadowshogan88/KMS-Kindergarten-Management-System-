from rest_framework import permissions


class IsRole(permissions.BasePermission):
    allowed_roles: set[str] = set()

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "role", None) in self.allowed_roles)


class IsAdmin(IsRole):
    allowed_roles = {"ADMIN"}


class IsUser(IsRole):
    allowed_roles = {"USER"}


class IsTeacher(IsRole):
    allowed_roles = {"TEACHER"}


class IsStudent(IsRole):
    allowed_roles = {"STUDENT"}


class IsParent(IsRole):
    allowed_roles = {"PARENT"}
