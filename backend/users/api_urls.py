from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .api_views import PortalRolePermissionViewSet, PortalRoleViewSet, UserViewSet, me, teachers

router = DefaultRouter()
router.register(r"portal-roles", PortalRoleViewSet, basename="portal_role")
router.register(r"portal-role-permissions", PortalRolePermissionViewSet, basename="portal_role_permission")
router.register(r"users", UserViewSet, basename="user_admin")

urlpatterns = [
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", me, name="me"),
    path("users/teachers/", teachers, name="teachers"),
]

urlpatterns += router.urls
