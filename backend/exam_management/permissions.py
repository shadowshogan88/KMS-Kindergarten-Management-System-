from __future__ import annotations

from rest_framework import permissions

from academics.models import ClassTeacher


class IsAdminOrTeacherWithClass(permissions.BasePermission):
    """
    Allows:
    - ADMIN: always
    - TEACHER: only if assigned as ClassTeacher for the exam's class/section
    """

    message = "You do not have permission for this class/section."

    def has_object_permission(self, request, view, obj):
        user = request.user
        role = getattr(user, "role", None)
        if role == "ADMIN":
            return True
        if role != "TEACHER":
            return False

        exam = getattr(obj, "exam", None) or obj
        class_id = getattr(exam, "class_name_id", None)
        section = (getattr(exam, "section", "") or "").strip().upper()

        return ClassTeacher.objects.filter(
            school_class_id=class_id,
            section=section,
            teacher__user_id=user.id,
        ).exists()

