from __future__ import annotations

import os
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from academics.models import SchoolClass, Subject
from students.models import Student


def homework_pdf_upload_to(instance: "Homework", filename: str) -> str:
    base, ext = os.path.splitext(filename or "")
    ext = (ext or ".pdf").lower()
    return f"homework/{instance.class_name_id}/{timezone.now().strftime('%Y/%m')}/{base[:80]}{ext}"


def submission_image_upload_to(instance: "SubmissionImage", filename: str) -> str:
    base, ext = os.path.splitext(filename or "")
    ext = (ext or ".jpg").lower()
    return f"homework_submissions/{instance.submission.homework_id}/{instance.submission.student_id}/{timezone.now().strftime('%Y/%m')}/{base[:80]}{ext}"


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Homework(TimeStampedModel):
    TYPE_HOMEWORK = "HOMEWORK"
    TYPE_ASSIGNMENT = "ASSIGNMENT"
    TYPE_CHOICES = [
        (TYPE_HOMEWORK, "Homework"),
        (TYPE_ASSIGNMENT, "Assignment"),
    ]

    STATUS_DRAFT = "DRAFT"
    STATUS_PUBLISHED = "PUBLISHED"
    STATUS_ARCHIVED = "ARCHIVED"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_PUBLISHED, "Published"),
        (STATUS_ARCHIVED, "Archived"),
    ]

    title = models.CharField(max_length=200)
    short_description = models.CharField(max_length=255, blank=True, default="")
    homework_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_HOMEWORK)

    class_name = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, related_name="homeworks")
    section = models.CharField(max_length=1, blank=True, default="")
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="homeworks")

    description = models.TextField(blank=True, default="", help_text="Rich HTML content from CKEditor 5")
    pdf_file = models.FileField(upload_to=homework_pdf_upload_to, blank=True, null=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="homeworks_created")
    due_date = models.DateTimeField()
    allow_late_submission = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["class_name", "section", "due_date"]),
            models.Index(fields=["homework_type", "status", "due_date"]),
        ]

    def clean(self):
        super().clean()
        self.section = (self.section or "").strip().upper()
        class_sections = list(self.class_name.sections or []) if self.class_name_id else []
        if class_sections:
            if not self.section:
                raise ValidationError({"section": "Section is required for this class."})
            if self.section not in class_sections:
                raise ValidationError({"section": f"Section must be one of: {', '.join(class_sections)}."})
        else:
            if self.section:
                raise ValidationError({"section": "This class has no sections; leave section empty."})

        if self.subject_id and self.class_name_id:
            if getattr(self.subject, "school_class_id", None) != self.class_name_id:
                raise ValidationError({"subject": "Subject must belong to the selected class."})
            subj_section = (getattr(self.subject, "section", "") or "").strip().upper()
            if class_sections and subj_section != self.section:
                raise ValidationError({"subject": "Subject must match selected section."})
            if not class_sections and subj_section:
                raise ValidationError({"subject": "Subject section must be empty for a class without sections."})

        if self.due_date and timezone.is_naive(self.due_date):
            self.due_date = timezone.make_aware(self.due_date, timezone.get_current_timezone())

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)

    @property
    def classroom_label(self) -> str:
        if not self.class_name_id:
            return ""
        if self.section:
            return f"{self.class_name.name} ({self.section})"
        return self.class_name.name

    def __str__(self) -> str:
        return f"{self.title} ({self.classroom_label})"


class HomeworkSubmission(TimeStampedModel):
    STATUS_DRAFT = "DRAFT"
    STATUS_SUBMITTED = "SUBMITTED"
    STATUS_GRADED = "GRADED"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_SUBMITTED, "Submitted"),
        (STATUS_GRADED, "Graded"),
    ]

    homework = models.ForeignKey(Homework, on_delete=models.CASCADE, related_name="submissions")
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="homework_submissions")

    submitted_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    is_late_submission = models.BooleanField(default=False)

    # Rich text submission (CKEditor/Decoupled editor content).
    # Images are stored separately in SubmissionImage.
    content_html = models.TextField(blank=True, default="")

    teacher_marks = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    teacher_feedback = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-updated_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["homework", "student"], name="uniq_homework_student_submission"),
        ]
        indexes = [
            models.Index(fields=["homework", "status"]),
            models.Index(fields=["student", "status"]),
        ]

    def clean(self):
        super().clean()
        if self.submitted_at and timezone.is_naive(self.submitted_at):
            self.submitted_at = timezone.make_aware(self.submitted_at, timezone.get_current_timezone())

        if self.homework_id and self.student_id:
            if getattr(self.student, "school_class_id", None) and self.student.school_class_id != self.homework.class_name_id:
                raise ValidationError({"student": "Student is not in the homework class."})
            if (getattr(self.student, "section", "") or "").strip().upper() != (self.homework.section or ""):
                if self.homework.class_name and (self.homework.class_name.sections or []):
                    raise ValidationError({"student": "Student is not in the homework section."})

        if self.status == self.STATUS_SUBMITTED:
            if not self.submitted_at:
                self.submitted_at = timezone.now()

            if self.homework and self.submitted_at and self.submitted_at > self.homework.due_date:
                self.is_late_submission = True
                if not self.homework.allow_late_submission:
                    raise ValidationError({"submitted_at": "Deadline passed. Late submission is not allowed."})
            else:
                self.is_late_submission = False

        if self.teacher_marks is not None and self.teacher_marks < Decimal("0"):
            raise ValidationError({"teacher_marks": "Marks cannot be negative."})

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"Submission({self.homework_id}, {self.student_id})"


class SubmissionImage(TimeStampedModel):
    submission = models.ForeignKey(HomeworkSubmission, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to=submission_image_upload_to)
    page_number = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["page_number", "id"]
        indexes = [
            models.Index(fields=["submission", "page_number"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["submission", "page_number"], name="uniq_submission_page_number"),
        ]

    def clean(self):
        super().clean()
        if self.page_number < 1:
            raise ValidationError({"page_number": "Page number must be >= 1."})

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"Page {self.page_number} (submission={self.submission_id})"


class SubmissionAnnotation(TimeStampedModel):
    submission_image = models.ForeignKey(SubmissionImage, on_delete=models.CASCADE, related_name="annotations")
    annotation_data = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="submission_annotations_created")

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["submission_image", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"Annotation({self.submission_image_id})"


class HomeworkGradeLog(models.Model):
    submission = models.ForeignKey(HomeworkSubmission, on_delete=models.CASCADE, related_name="grade_logs")
    marks = models.DecimalField(max_digits=6, decimal_places=2)
    graded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="homework_grade_logs")
    graded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-graded_at", "-id"]
        indexes = [
            models.Index(fields=["submission", "graded_at"]),
        ]

    def __str__(self) -> str:
        return f"GradeLog({self.submission_id}, {self.marks})"
