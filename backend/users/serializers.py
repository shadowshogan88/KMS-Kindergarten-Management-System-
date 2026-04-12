from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator

from .models import PortalRole, PortalRolePermission
from .rbac_utils import get_portal_permissions_for_user, portal_permissions_to_dict

User = get_user_model()


class MeSerializer(serializers.ModelSerializer):
    portal_role_id = serializers.IntegerField(source="portal_role.id", read_only=True)
    portal_role_name = serializers.CharField(source="portal_role.name", read_only=True)
    portal_permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "phone",
            "must_change_password",
            "portal_role_id",
            "portal_role_name",
            "portal_permissions",
        )

    def get_portal_permissions(self, obj):
        perms = get_portal_permissions_for_user(obj)
        return portal_permissions_to_dict(perms)


class PortalRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PortalRole
        fields = ("id", "name", "is_active", "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")


class PortalRolePermissionSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = PortalRolePermission
        fields = (
            "id",
            "role",
            "role_name",
            "path",
            "can_view",
            "can_create",
            "can_edit",
            "can_delete",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")
        validators = [
            UniqueTogetherValidator(
                queryset=PortalRolePermission.objects.all(),
                fields=["role", "path"],
                message="The fields role, path must make a unique set.",
            )
        ]

    def validate_path(self, value):
        v = (value or "").strip()
        if not v:
            return v
        if not v.startswith("/"):
            v = f"/{v}"
        if len(v) > 1:
            v = v.rstrip("/")
        return v


class UserAdminSerializer(serializers.ModelSerializer):
    portal_role_id = serializers.IntegerField(source="portal_role.id", read_only=True)
    portal_role_name = serializers.CharField(source="portal_role.name", read_only=True)
    portal_role = serializers.PrimaryKeyRelatedField(queryset=PortalRole.objects.all(), allow_null=True, required=False)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "portal_role",
            "portal_role_id",
            "portal_role_name",
            "is_active",
        )
