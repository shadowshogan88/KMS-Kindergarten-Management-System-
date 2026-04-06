from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .serializers import MeSerializer
from .permissions import IsAdmin


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(MeSerializer(request.user).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdmin])
def teachers(request):
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
