from rest_framework import permissions, viewsets

from users.permissions import IsAdmin

from .models import ClassRoutine
from .serializers import ClassRoutineSerializer


class ClassRoutineViewSet(viewsets.ModelViewSet):
    queryset = ClassRoutine.objects.select_related("classroom", "teacher", "classroom__teacher").all()
    serializer_class = ClassRoutineSerializer

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()

        classroom_id = self.request.query_params.get("classroom")
        if classroom_id:
            qs = qs.filter(classroom_id=classroom_id)

        role = getattr(user, "role", None)
        if role == "TEACHER":
            return qs.filter(classroom__teacher=user)
        if role == "PARENT":
            return qs.filter(classroom__enrollments__student__parent=user).distinct()
        return qs

