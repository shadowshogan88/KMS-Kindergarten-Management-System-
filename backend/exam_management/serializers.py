from __future__ import annotations

from rest_framework import serializers

from exam_management.models import AuditLog, Exam, Promotion, Result, ResultPublishLog, StudentExamMark


class ExamSerializer(serializers.ModelSerializer):
    class_label = serializers.CharField(source="class_name.name", read_only=True)
    classroom_label = serializers.CharField(read_only=True)
    subject_label = serializers.CharField(source="subject.name", read_only=True)
    subject_code = serializers.CharField(source="subject.code", read_only=True)

    class Meta:
        model = Exam
        fields = (
            "id",
            "exam_name",
            "class_name",
            "class_label",
            "section",
            "classroom_label",
            "subject",
            "subject_code",
            "subject_label",
            "exam_type",
            "start_date",
            "end_date",
            "status",
            "created_at",
            "updated_at",
        )


class StudentExamMarkSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField(read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    full_marks = serializers.IntegerField(source="subject.full_marks", read_only=True)
    pass_marks = serializers.IntegerField(source="subject.pass_marks", read_only=True)

    class Meta:
        model = StudentExamMark
        fields = (
            "id",
            "student",
            "student_name",
            "exam",
            "subject",
            "subject_code",
            "subject_name",
            "full_marks",
            "pass_marks",
            "marks_obtained",
            "grade",
            "remarks",
            "created_at",
            "updated_at",
        )

    def get_student_name(self, obj):
        s = obj.student
        return f"{s.first_name} {s.last_name}".strip()


class ResultSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField(read_only=True)
    class_label = serializers.CharField(source="exam.class_name.name", read_only=True)
    exam_name = serializers.CharField(source="exam.exam_name", read_only=True)

    class Meta:
        model = Result
        fields = (
            "id",
            "student",
            "student_name",
            "exam",
            "exam_name",
            "class_label",
            "total_marks",
            "average_marks",
            "gpa",
            "final_grade",
            "rank",
            "is_passed",
            "published_status",
            "details",
            "generated_at",
            "published_at",
            "created_at",
            "updated_at",
        )

    def get_student_name(self, obj):
        s = obj.student
        return f"{s.first_name} {s.last_name}".strip()


class PromotionSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField(read_only=True)
    from_class_label = serializers.CharField(source="from_class.name", read_only=True)
    to_class_label = serializers.CharField(source="to_class.name", read_only=True)
    promoted_by_label = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Promotion
        fields = (
            "id",
            "student",
            "student_name",
            "from_class",
            "from_class_label",
            "from_section",
            "to_class",
            "to_class_label",
            "to_section",
            "promoted_by",
            "promoted_by_label",
            "promoted_at",
            "academic_year",
            "exam",
            "created_at",
            "updated_at",
        )

    def get_student_name(self, obj):
        s = obj.student
        return f"{s.first_name} {s.last_name}".strip()

    def get_promoted_by_label(self, obj):
        u = obj.promoted_by
        if not u:
            return ""
        return (u.get_full_name() or "").strip() or u.username


class ResultPublishLogSerializer(serializers.ModelSerializer):
    published_by_label = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ResultPublishLog
        fields = ("id", "exam", "published_by", "published_by_label", "published_at", "note")

    def get_published_by_label(self, obj):
        u = obj.published_by
        return (u.get_full_name() or "").strip() or u.username


class AuditLogSerializer(serializers.ModelSerializer):
    user_label = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = AuditLog
        fields = ("id", "action_type", "user", "user_label", "timestamp", "details")

    def get_user_label(self, obj):
        u = obj.user
        if not u:
            return ""
        return (u.get_full_name() or "").strip() or u.username
