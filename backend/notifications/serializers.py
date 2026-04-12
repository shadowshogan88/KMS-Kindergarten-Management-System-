from rest_framework import serializers

from classes.models import Classroom, Enrollment
from students.models import Student
from users.models import User

from academics.models import SchoolClass

from .models import Announcement, Notice, Notification, NotificationRecipient


class AnnouncementSerializer(serializers.ModelSerializer):
    classroom_name = serializers.CharField(source="classroom.name", read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = Announcement
        fields = (
            "id",
            "title",
            "message",
            "audience",
            "classroom",
            "classroom_name",
            "created_by",
            "created_by_username",
            "publish_at",
            "created_at",
        )
        read_only_fields = ("created_by", "created_at")


class NoticeSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    school_classes = serializers.PrimaryKeyRelatedField(queryset=SchoolClass.objects.all(), many=True, required=False)
    school_classes_detail = serializers.SerializerMethodField()
    pdf_file = serializers.FileField(required=False, allow_null=True)

    class Meta:
        model = Notice
        fields = (
            "id",
            "title",
            "description",
            "content_html",
            "audience",
            "school_classes",
            "school_classes_detail",
            "pdf_file",
            "is_pinned",
            "pinned_at",
            "is_active",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_by", "pinned_at", "created_at", "updated_at")

    def get_school_classes_detail(self, obj):
        classes = getattr(obj, "school_classes", None)
        if not classes:
            return []
        return [{"id": c.id, "name": c.name} for c in classes.all()]


class InboxNotificationSerializer(serializers.ModelSerializer):
    notification_id = serializers.IntegerField(source="notification.id", read_only=True)
    type = serializers.CharField(source="notification.type", read_only=True)
    priority = serializers.CharField(source="notification.priority", read_only=True)
    title = serializers.CharField(source="notification.title", read_only=True)
    message = serializers.CharField(source="notification.message", read_only=True)
    action_url = serializers.CharField(source="notification.action_url", read_only=True)
    data = serializers.JSONField(source="notification.data", read_only=True)
    publish_at = serializers.DateTimeField(source="notification.publish_at", read_only=True)
    expires_at = serializers.DateTimeField(source="notification.expires_at", read_only=True)
    created_at = serializers.DateTimeField(source="notification.created_at", read_only=True)
    created_by_username = serializers.CharField(source="notification.created_by.username", read_only=True)

    class Meta:
        model = NotificationRecipient
        fields = (
            "id",
            "notification_id",
            "type",
            "priority",
            "title",
            "message",
            "action_url",
            "data",
            "publish_at",
            "expires_at",
            "created_at",
            "created_by_username",
            "is_read",
            "read_at",
        )
        read_only_fields = fields


class SendNotificationSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=Notification.TYPE_CHOICES, default=Notification.TYPE_CUSTOM)
    priority = serializers.ChoiceField(choices=Notification.PRIORITY_CHOICES, default=Notification.PRIORITY_NORMAL)
    title = serializers.CharField(max_length=200)
    message = serializers.CharField(required=False, allow_blank=True, default="")
    action_url = serializers.CharField(required=False, allow_blank=True, default="")
    data = serializers.JSONField(required=False, default=dict)
    publish_at = serializers.DateTimeField(required=False, allow_null=True)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)

    target_roles = serializers.ListField(
        child=serializers.ChoiceField(choices=User.ROLE_CHOICES),
        required=False,
        default=list,
        help_text="Target roles (ADMIN/USER/TEACHER/STUDENT/PARENT).",
    )
    target_user_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
        help_text="Optional explicit user ids.",
    )

    classroom = serializers.PrimaryKeyRelatedField(queryset=Classroom.objects.all(), required=False, allow_null=True)
    school_class_ids = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)

    def validate(self, attrs):
        target_roles = attrs.get("target_roles") or []
        target_user_ids = attrs.get("target_user_ids") or []
        classroom = attrs.get("classroom")
        school_class_ids = attrs.get("school_class_ids") or []

        if not target_roles and not target_user_ids and not classroom and not school_class_ids:
            raise serializers.ValidationError("Provide at least one target (roles/users/classroom/school_class_ids).")
        return attrs

    def get_recipient_user_ids(self, sender):
        data = self.validated_data
        role = getattr(sender, "role", None)

        target_roles = set(data.get("target_roles") or [])
        explicit_user_ids = set(data.get("target_user_ids") or [])
        classroom = data.get("classroom")
        school_class_ids = set(data.get("school_class_ids") or [])

        recipient_user_ids = set(explicit_user_ids)

        if classroom:
            if role == "TEACHER" and classroom.teacher_id != sender.id:
                raise serializers.ValidationError({"classroom": "Not your classroom."})

            # Default: students + parents when roles not specified.
            if not target_roles:
                target_roles = {"STUDENT", "PARENT"}

            enrollment_qs = Enrollment.objects.filter(classroom=classroom).select_related("student")
            student_ids = [e.student_id for e in enrollment_qs]
            students = Student.objects.filter(id__in=student_ids).select_related("user")

            if "STUDENT" in target_roles:
                recipient_user_ids |= {s.user_id for s in students if s.user_id}
            if "PARENT" in target_roles:
                recipient_user_ids |= {s.parent_id for s in students if s.parent_id}
            if "TEACHER" in target_roles:
                recipient_user_ids.add(classroom.teacher_id)

        if school_class_ids:
            if not target_roles:
                target_roles = {"STUDENT", "PARENT"}

            students = Student.objects.filter(school_class_id__in=list(school_class_ids)).select_related("user")
            if "STUDENT" in target_roles:
                recipient_user_ids |= {s.user_id for s in students if s.user_id}
            if "PARENT" in target_roles:
                recipient_user_ids |= {s.parent_id for s in students if s.parent_id}

        # Role-only targeting.
        if target_roles and not classroom and not school_class_ids:
            if role == "TEACHER":
                raise serializers.ValidationError("Teachers must target a classroom or class.")
            recipient_user_ids |= set(User.objects.filter(role__in=list(target_roles)).values_list("id", flat=True))

        # Enforce teacher limitations (no admin/teacher broadcast).
        if role == "TEACHER":
            if any(r in {"ADMIN"} for r in target_roles):
                raise serializers.ValidationError("Teachers cannot target admins.")

        return sorted(uid for uid in recipient_user_ids if uid)
