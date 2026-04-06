from rest_framework import serializers

from .models import Classroom, Enrollment, LiveClass


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

