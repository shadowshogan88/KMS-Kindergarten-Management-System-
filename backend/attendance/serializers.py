from rest_framework import serializers

from .models import AcademicAttendanceRecord, AttendanceRecord


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceRecord
        fields = ("id", "classroom", "student", "student_name", "date", "status", "note", "marked_at")
        read_only_fields = ("marked_at",)

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}".strip()


class AcademicAttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    school_class_label = serializers.CharField(source="school_class.name", read_only=True)

    class Meta:
        model = AcademicAttendanceRecord
        fields = (
            "id",
            "school_class",
            "school_class_label",
            "section",
            "student",
            "student_name",
            "date",
            "status",
            "note",
            "marked_at",
        )
        read_only_fields = ("marked_at",)

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}".strip()
