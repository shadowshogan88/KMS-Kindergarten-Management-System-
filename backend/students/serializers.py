import datetime

from django.utils.crypto import get_random_string
from rest_framework import serializers

from .models import ParentProfile, Student


class StudentSerializer(serializers.ModelSerializer):
    parent_username = serializers.CharField(source="parent.username", read_only=True)
    school_class_label = serializers.CharField(source="school_class.name", read_only=True)
    user_label = serializers.SerializerMethodField(read_only=True)
    user_email = serializers.SerializerMethodField(read_only=True)
    user_username = serializers.CharField(source="user.username", read_only=True)

    create_user = serializers.BooleanField(write_only=True, required=False, default=False)
    username = serializers.CharField(write_only=True, required=False, allow_blank=True, default="")
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, default="", style={"input_type": "password"})
    email = serializers.EmailField(write_only=True, required=False, allow_blank=True, default="")
    generated_username = serializers.CharField(read_only=True, default="")
    generated_password = serializers.CharField(read_only=True, default="")

    class Meta:
        model = Student
        fields = (
            "id",
            "user",
            "user_label",
            "user_email",
            "user_username",
            "first_name",
            "last_name",
            "email",
            "phone",
            "school_class",
            "school_class_label",
            "section",
            "date_of_birth",
            "photo",
            "parent",
            "parent_username",
            "medical_info",
            "pickup_authorized_people",
            "create_user",
            "username",
            "password",
            "generated_username",
            "generated_password",
            "created_at",
        )
        read_only_fields = ("created_at",)

    def get_user_label(self, obj):
        user = getattr(obj, "user", None)
        if not user:
            return ""
        full_name = (user.get_full_name() or "").strip()
        return full_name or user.username

    def get_user_email(self, obj):
        user = getattr(obj, "user", None)
        return getattr(user, "email", "") or ""

    def validate(self, attrs):
        attrs = super().validate(attrs)
        create_user = bool(attrs.get("create_user"))
        if create_user and attrs.get("user"):
            raise serializers.ValidationError({"user": "Do not pass user when create_user=true."})

        user = attrs.get("user")
        if user and not (getattr(user, "email", "") or "").strip():
            raise serializers.ValidationError({"user": "Selected Student user must have an email address."})

        email = (attrs.get("email", "") or "").strip()
        if create_user and not email:
            raise serializers.ValidationError({"email": "Email is required when creating a student login."})
        return attrs

    def _generate_student_username(self, UserModel):
        yy = str(datetime.date.today().year)[-2:]
        for _ in range(80):
            digits = get_random_string(5, allowed_chars="0123456789")
            username = f"sid{yy}{digits}"
            if not UserModel.objects.filter(username=username).exists():
                return username
        raise serializers.ValidationError({"username": "Unable to generate a unique student username. Try again."})

    def create(self, validated_data):
        create_user = bool(validated_data.pop("create_user", False))
        desired_username = (validated_data.pop("username", "") or "").strip()
        desired_password = (validated_data.pop("password", "") or "").strip()
        desired_email = (validated_data.get("email", "") or "").strip()

        student = super().create(validated_data)

        if not create_user:
            return student

        User = self.context["request"].user.__class__ if self.context.get("request") else None
        if not User:
            raise serializers.ValidationError({"create_user": "Request context is required."})

        if not desired_email:
            raise serializers.ValidationError({"email": "Email is required when creating a student login."})
        if User.objects.filter(email__iexact=desired_email).exists():
            raise serializers.ValidationError({"email": "A user with this email already exists."})

        if desired_username:
            username = desired_username
            if User.objects.filter(username=username).exists():
                raise serializers.ValidationError({"username": "This username is already taken."})
        else:
            username = self._generate_student_username(User)

        password = desired_password or get_random_string(10)

        user = User.objects.create_user(
            username=username,
            password=password,
            email=desired_email,
            role="STUDENT",
            phone=student.phone,
            first_name=student.first_name,
            last_name=student.last_name,
        )

        student.user = user
        student.save(update_fields=["user", "email", "phone"])

        self._generated_username = username
        self._generated_password = password
        return student

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["generated_username"] = getattr(self, "_generated_username", "") or ""
        data["generated_password"] = getattr(self, "_generated_password", "") or ""
        return data


class ParentProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParentProfile
        fields = ("id", "user", "address", "emergency_contact_name", "emergency_contact_phone")
