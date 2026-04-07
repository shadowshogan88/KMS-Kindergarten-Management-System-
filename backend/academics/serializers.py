from django.utils.crypto import get_random_string
from rest_framework import serializers

from .models import Department, Designation, Room, SchoolClass, Section, Subject, SubjectTeacher


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ("id", "name", "head", "phone", "email", "employees", "created_at", "updated_at")


class SchoolClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolClass
        fields = ("id", "name", "sections", "created_at", "updated_at")


class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ("id", "name", "created_at", "updated_at")


class SubjectSerializer(serializers.ModelSerializer):
    classroom = serializers.CharField(write_only=True, required=False, allow_blank=True)
    classroom_key = serializers.CharField(read_only=True)
    classroom_label = serializers.CharField(read_only=True)
    subject_teacher_label = serializers.CharField(read_only=True)

    class Meta:
        model = Subject
        fields = (
            "id",
            "name",
            "code",
            "subject_teacher",
            "subject_teacher_label",
            "school_class",
            "section",
            "classroom",
            "classroom_key",
            "classroom_label",
            "subject_type",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        attrs = super().validate(attrs)

        classroom = (attrs.pop("classroom", "") or "").strip()
        if classroom:
            if ":" in classroom:
                class_id, section = classroom.split(":", 1)
            else:
                class_id, section = classroom, ""

            try:
                class_id = int(class_id)
            except (TypeError, ValueError):
                raise serializers.ValidationError({"classroom": "Invalid class selection."})

            try:
                school_class = SchoolClass.objects.get(id=class_id)
            except SchoolClass.DoesNotExist:
                raise serializers.ValidationError({"classroom": "Selected class does not exist."})

            attrs["school_class"] = school_class
            attrs["section"] = (section or "").strip().upper()

        is_creating = self.instance is None
        school_class = attrs.get("school_class", getattr(self.instance, "school_class", None))
        if is_creating and not school_class:
            raise serializers.ValidationError({"classroom": "Class is required."})

        subject_teacher = attrs.get("subject_teacher", getattr(self.instance, "subject_teacher", None))
        if is_creating and not subject_teacher:
            raise serializers.ValidationError({"subject_teacher": "Subject teacher is required."})

        section = attrs.get("section", getattr(self.instance, "section", "")) or ""
        section = section.strip().upper()

        if school_class:
            class_sections = list(school_class.sections or [])
            if class_sections:
                if not section:
                    raise serializers.ValidationError({"section": "Section is required for this class."})
                if section not in class_sections:
                    raise serializers.ValidationError({"section": f"Section must be one of: {', '.join(class_sections)}."})
            else:
                if section:
                    raise serializers.ValidationError({"section": "This class has no sections; leave section empty."})

        if "section" in attrs:
            attrs["section"] = section

        return attrs


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ("id", "room_no", "capacity", "created_at", "updated_at")


class DesignationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Designation
        fields = ("id", "title", "created_at", "updated_at")


class SubjectTeacherSerializer(serializers.ModelSerializer):
    user_label = serializers.SerializerMethodField(read_only=True)
    create_user = serializers.BooleanField(write_only=True, required=False, default=False)
    username = serializers.CharField(write_only=True, required=False, allow_blank=True, default="")
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, default="", style={"input_type": "password"})
    generated_username = serializers.CharField(read_only=True, default="")
    generated_password = serializers.CharField(read_only=True, default="")

    class Meta:
        model = SubjectTeacher
        fields = (
            "id",
            "user",
            "user_label",
            "name",
            "phone",
            "teacher_code",
            "create_user",
            "username",
            "password",
            "generated_username",
            "generated_password",
            "created_at",
            "updated_at",
        )

    def get_user_label(self, obj):
        user = getattr(obj, "user", None)
        if not user:
            return ""
        full_name = (user.get_full_name() or "").strip()
        return full_name or user.username

    def validate(self, attrs):
        attrs = super().validate(attrs)
        create_user = bool(attrs.get("create_user"))
        if create_user and attrs.get("user"):
            raise serializers.ValidationError({"user": "Do not pass user when create_user=true."})
        return attrs

    def create(self, validated_data):
        create_user = bool(validated_data.pop("create_user", False))
        desired_username = (validated_data.pop("username", "") or "").strip()
        desired_password = (validated_data.pop("password", "") or "").strip()

        teacher = super().create(validated_data)

        if not create_user:
            return teacher

        User = self.context["request"].user.__class__ if self.context.get("request") else None
        if not User:
            raise serializers.ValidationError({"create_user": "Request context is required."})

        base_username = desired_username or f"t{teacher.teacher_code}".lower()
        base_username = "".join(ch for ch in base_username if ch.isalnum() or ch in {"_", "."}).strip(".") or f"t{teacher.teacher_code}".lower()

        username = base_username
        for _ in range(50):
            if not User.objects.filter(username=username).exists():
                break
            username = f"{base_username}{get_random_string(2, allowed_chars='0123456789')}"
        else:
            raise serializers.ValidationError({"username": "Unable to generate a unique username. Try again."})

        password = desired_password or get_random_string(10)

        # Create teacher user account.
        user = User.objects.create_user(
            username=username,
            password=password,
            role="TEACHER",
            phone=teacher.phone,
        )

        teacher.user = user
        teacher.save(update_fields=["user", "name", "phone", "updated_at"])

        # Expose generated credentials ONLY in the create response.
        self._generated_username = username
        self._generated_password = password
        return teacher

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["generated_username"] = getattr(self, "_generated_username", "") or ""
        data["generated_password"] = getattr(self, "_generated_password", "") or ""
        return data
