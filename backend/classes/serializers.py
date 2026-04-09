from rest_framework import serializers

from .models import Classroom, Enrollment, LiveClass, SpecialLiveClass


class ClassroomSerializer(serializers.ModelSerializer):
    teacher_username = serializers.CharField(source="teacher.username", read_only=True)

    class Meta:
        model = Classroom
        fields = ("id", "name", "teacher", "teacher_username", "year", "created_at")
        read_only_fields = ("created_at",)


class EnrollmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Enrollment
        fields = ("id", "classroom", "student", "created_at")
        read_only_fields = ("created_at",)


class LiveClassSerializer(serializers.ModelSerializer):
    classroom_name = serializers.CharField(source="classroom.name", read_only=True)

    class Meta:
        model = LiveClass
        fields = (
            "id",
            "classroom",
            "classroom_name",
            "title",
            "starts_at",
            "ends_at",
            "meet_link",
            "created_by",
            "created_at",
        )
        read_only_fields = ("created_by", "created_at")


class SpecialLiveClassSerializer(serializers.ModelSerializer):
    school_class_name = serializers.CharField(source="school_class.name", read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = SpecialLiveClass
        fields = (
            "id",
            "school_class",
            "school_class_name",
            "section",
            "date",
            "start_time",
            "end_time",
            "title",
            "description",
            "meet_link",
            "meet_event_id",
            "is_active",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_by", "created_at", "updated_at")
