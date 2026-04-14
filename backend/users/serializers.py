from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator

from students.models import Student

from .models import PortalRole, PortalRolePermission
from .rbac_utils import get_portal_permissions_for_user, portal_permissions_to_dict

User = get_user_model()


class MeSerializer(serializers.ModelSerializer):
    portal_role_id = serializers.IntegerField(source="portal_role.id", read_only=True)
    portal_role_name = serializers.CharField(source="portal_role.name", read_only=True)
    portal_permissions = serializers.SerializerMethodField()
    student_id = serializers.SerializerMethodField()
    student_school_class_id = serializers.SerializerMethodField()
    student_school_class_label = serializers.SerializerMethodField()
    student_section = serializers.SerializerMethodField()
    profile_picture_url = serializers.SerializerMethodField()

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
            "profile_picture_url",
            "must_change_password",
            "portal_role_id",
            "portal_role_name",
            "portal_permissions",
            "student_id",
            "student_school_class_id",
            "student_school_class_label",
            "student_section",
        )

    def get_profile_picture_url(self, obj):
        picture = getattr(obj, "profile_picture", None)
        if not picture:
            return ""
        try:
            url = picture.url
        except Exception:
            return ""

        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url

    def get_portal_permissions(self, obj):
        perms = get_portal_permissions_for_user(obj)
        return portal_permissions_to_dict(perms)

    def get_student_id(self, obj):
        if getattr(obj, "role", None) != "STUDENT":
            return None
        student = Student.objects.filter(user=obj).only("id").first()
        return getattr(student, "id", None) if student else None

    def get_student_school_class_id(self, obj):
        if getattr(obj, "role", None) != "STUDENT":
            return None
        student = Student.objects.filter(user=obj).only("school_class_id").first()
        return getattr(student, "school_class_id", None) if student else None

    def get_student_section(self, obj):
        if getattr(obj, "role", None) != "STUDENT":
            return ""
        student = Student.objects.filter(user=obj).only("section").first()
        return getattr(student, "section", "") if student else ""

    def get_student_school_class_label(self, obj):
        if getattr(obj, "role", None) != "STUDENT":
            return ""
        student = Student.objects.filter(user=obj).select_related("school_class").only("school_class__name").first()
        school_class = getattr(student, "school_class", None) if student else None
        return getattr(school_class, "name", "") if school_class else ""


class PortalRoleSerializer(serializers.ModelSerializer):
    def validate_name(self, value):
        v = (value or "").strip()
        if not v:
            return v

        reserved = {"parents", "students", "teachers"}
        if self.instance is None and v.lower() in reserved:
            raise serializers.ValidationError("This role name is reserved and cannot be created.")
        return v

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
