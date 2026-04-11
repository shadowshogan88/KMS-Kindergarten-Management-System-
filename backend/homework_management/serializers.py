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
    homework_title = serializers.CharField(source="homework.title", read_only=True)
    homework_due_date = serializers.DateTimeField(source="homework.due_date", read_only=True)
    images = SubmissionImageSerializer(many=True, read_only=True)

    class Meta:
        model = HomeworkSubmission
        fields = (
            "id",
            "homework",
            "homework_title",
            "homework_due_date",
            "student",
            "student_name",
            "content_html",
            "submitted_at",
            "status",
            "is_late_submission",
            "teacher_marks",
            "teacher_feedback",
            "images",
            "created_at",
            "updated_at",
        )
        extra_kwargs = {
            "student": {"required": False},
            "submitted_at": {"required": False, "allow_null": True},
        }

    def get_student_name(self, obj):
        s = obj.student
        return f"{s.first_name} {s.last_name}".strip()


class HomeworkGradeLogSerializer(serializers.ModelSerializer):
    graded_by_label = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = HomeworkGradeLog
        fields = ("id", "submission", "marks", "graded_by", "graded_by_label", "graded_at")
        read_only_fields = ("graded_by", "graded_at")

    def get_graded_by_label(self, obj):
        u = obj.graded_by
        return (u.get_full_name() or "").strip() or u.username
