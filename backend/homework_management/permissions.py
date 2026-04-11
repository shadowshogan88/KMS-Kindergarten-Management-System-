from __future__ import annotations

from rest_framework import permissions

from academics.models import ClassTeacher


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, "role", None) == "ADMIN")


class IsTeacher(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, "role", None) == "TEACHER")


class IsStudent(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, "role", None) == "STUDENT")


class TeacherHasClassroomAccess(permissions.BasePermission):
    """
    For TEACHER: only assigned class/section via academics.ClassTeacher.
    """

    message = "Not your assigned class."

    def has_object_permission(self, request, view, obj):
        role = getattr(request.user, "role", None)
        if role == "ADMIN":
            return True
        if role != "TEACHER":
            return False

        homework = getattr(obj, "homework", None) or getattr(obj, "submission", None) or obj
        homework_obj = getattr(homework, "homework", None) or homework

        class_id = getattr(homework_obj, "class_name_id", None)
        section = (getattr(homework_obj, "section", "") or "").strip().upper()
        return ClassTeacher.objects.filter(
            school_class_id=class_id,
            section=section,
            teacher__user_id=request.user.id,
        ).exists()

