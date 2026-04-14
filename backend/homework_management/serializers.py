from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from homework_management.models import (
    Homework,
    HomeworkGradeLog,
    HomeworkSubmission,
    SubmissionAnnotation,
    SubmissionImage,
)


class HomeworkSerializer(serializers.ModelSerializer):
    class_label = serializers.CharField(source="class_name.name", read_only=True)
    classroom_label = serializers.CharField(read_only=True)
    subject_label = serializers.CharField(source="subject.name", read_only=True)
    created_by_label = serializers.SerializerMethodField(read_only=True)
    special_live_class_title = serializers.CharField(source="special_live_class.title", read_only=True)

    class Meta:
        model = Homework
        fields = (
            "id",
            "title",
            "short_description",
            "homework_type",
            "class_name",
            "class_label",
            "section",
            "classroom_label",
            "subject",
            "subject_label",
            "special_live_class",
            "special_live_class_title",
            "class_date",
            "description",
            "pdf_file",
            "created_by",
            "created_by_label",
            "due_date",
            "allow_late_submission",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_by",)

    def get_created_by_label(self, obj):
        u = obj.created_by
        return (u.get_full_name() or "").strip() or u.username

    def validate_due_date(self, value):
        if value and timezone.is_naive(value):
            return timezone.make_aware(value, timezone.get_current_timezone())
        return value


class SubmissionImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubmissionImage
        fields = ("id", "submission", "image", "page_number", "created_at", "updated_at")
        validators = []
        extra_kwargs = {
            "page_number": {"required": False},
        }


class SubmissionAnnotationSerializer(serializers.ModelSerializer):
    created_by_label = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = SubmissionAnnotation
        fields = ("id", "submission_image", "annotation_data", "created_by", "created_by_label", "created_at", "updated_at")
        read_only_fields = ("created_by",)

    def get_created_by_label(self, obj):
        u = obj.created_by
        return (u.get_full_name() or "").strip() or u.username


class HomeworkSubmissionSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField(read_only=True)
    student_roll_no = serializers.IntegerField(source="student.roll_no", read_only=True)
    student_username = serializers.CharField(source="student.user.username", read_only=True)
    student_email = serializers.SerializerMethodField(read_only=True)
    student_phone = serializers.SerializerMethodField(read_only=True)
    parent_name = serializers.SerializerMethodField(read_only=True)
    parent_email = serializers.CharField(source="student.parent.email", read_only=True)
    parent_phone = serializers.CharField(source="student.parent.phone", read_only=True)
    homework_title = serializers.CharField(source="homework.title", read_only=True)
    homework_subject_label = serializers.CharField(source="homework.subject.name", read_only=True)
    homework_class_date = serializers.DateField(source="homework.class_date", read_only=True)
    homework_due_date = serializers.DateTimeField(source="homework.due_date", read_only=True)
    latest_graded_by = serializers.SerializerMethodField(read_only=True)
    latest_graded_at = serializers.SerializerMethodField(read_only=True)
    marks_display = serializers.SerializerMethodField(read_only=True)
    images = SubmissionImageSerializer(many=True, read_only=True)

    class Meta:
        model = HomeworkSubmission
        fields = (
            "id",
            "homework",
            "homework_title",
            "homework_subject_label",
            "homework_class_date",
            "homework_due_date",
            "student",
            "student_name",
            "student_roll_no",
            "student_username",
            "student_email",
            "student_phone",
            "parent_name",
            "parent_email",
            "parent_phone",
            "content_html",
            "submission_pdf",
            "submitted_at",
            "status",
            "is_late_submission",
            "teacher_marks",
            "teacher_total_marks",
            "marks_display",
            "teacher_feedback",
            "latest_graded_by",
            "latest_graded_at",
            "images",
            "created_at",
            "updated_at",
        )
        validators = []
        extra_kwargs = {
            "student": {"required": False},
            "submitted_at": {"required": False, "allow_null": True},
        }

    def get_student_name(self, obj):
        s = obj.student
        return f"{s.first_name} {s.last_name}".strip()

    def get_student_email(self, obj):
        return (getattr(obj.student, "email", "") or getattr(getattr(obj.student, "user", None), "email", "") or "").strip()

    def get_student_phone(self, obj):
        return (getattr(obj.student, "phone", "") or getattr(getattr(obj.student, "user", None), "phone", "") or "").strip()

    def get_parent_name(self, obj):
        parent = getattr(obj.student, "parent", None)
        if not parent:
            return ""
        return (parent.get_full_name() or "").strip() or parent.username

    def get_latest_graded_by(self, obj):
        latest = obj.grade_logs.order_by("-graded_at", "-id").first()
        if not latest or not latest.graded_by:
            return ""
        u = latest.graded_by
        return (u.get_full_name() or "").strip() or u.username

    def get_latest_graded_at(self, obj):
        latest = obj.grade_logs.order_by("-graded_at", "-id").first()
        return latest.graded_at if latest else None

    def get_marks_display(self, obj):
        if obj.teacher_marks is None:
            return ""
        if obj.teacher_total_marks is None:
            return f"{obj.teacher_marks}"
        return f"{obj.teacher_marks}/{obj.teacher_total_marks}"


class HomeworkGradeLogSerializer(serializers.ModelSerializer):
    graded_by_label = serializers.SerializerMethodField(read_only=True)
    marks_display = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = HomeworkGradeLog
        fields = ("id", "submission", "marks", "total_marks", "marks_display", "graded_by", "graded_by_label", "graded_at")
        read_only_fields = ("graded_by", "graded_at")

    def get_graded_by_label(self, obj):
        u = obj.graded_by
        return (u.get_full_name() or "").strip() or u.username

    def get_marks_display(self, obj):
        if obj.total_marks is None:
            return f"{obj.marks}"
        return f"{obj.marks}/{obj.total_marks}"
