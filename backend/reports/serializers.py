from rest_framework import serializers

from .models import DailyActivityReport, MediaItem, ProgressNote


class MediaItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaItem
        fields = ("id", "report", "type", "file", "caption", "uploaded_at")
        read_only_fields = ("uploaded_at",)
        extra_kwargs = {
            "report": {"read_only": True},
        }


class DailyActivityReportSerializer(serializers.ModelSerializer):
    media = MediaItemSerializer(many=True, read_only=True)
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = DailyActivityReport
        fields = (
            "id",
            "classroom",
            "student",
            "student_name",
            "date",
            "food",
            "sleep",
            "mood",
            "learning",
            "teacher_notes",
            "created_by",
            "created_at",
            "media",
        )
        read_only_fields = ("created_by", "created_at")

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}".strip()


class ProgressNoteSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = ProgressNote
        fields = ("id", "student", "student_name", "classroom", "title", "note", "created_by", "created_at")
        read_only_fields = ("created_by", "created_at")

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}".strip()
