from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from academics.models import SchoolClass, Subject
from students.models import Student


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Exam(TimeStampedModel):
    TYPE_CLASS_TEST = "CLASS_TEST"
    TYPE_MIDTERM = "MIDTERM"
    TYPE_FINAL = "FINAL"
    TYPE_MODEL_TEST = "MODEL_TEST"

    TYPE_CHOICES = [
        (TYPE_CLASS_TEST, "Class Test"),
        (TYPE_MIDTERM, "Midterm"),
        (TYPE_FINAL, "Final"),
        (TYPE_MODEL_TEST, "Model Test"),
    ]

    STATUS_DRAFT = "DRAFT"
    STATUS_OPEN = "OPEN"
    STATUS_FINALIZED = "FINALIZED"
    STATUS_PUBLISHED = "PUBLISHED"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_OPEN, "Open"),
        (STATUS_FINALIZED, "Finalized"),
        (STATUS_PUBLISHED, "Published"),
    ]

    exam_name = models.CharField(max_length=200)
    class_name = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, related_name="exams")
    section = models.CharField(max_length=1, blank=True, default="")
    subject = models.ForeignKey(
        Subject,
        on_delete=models.PROTECT,
        related_name="exams",
        null=True,
        blank=True,
        help_text="Optional: make this exam subject-wise (e.g., class test for a single subject).",
    )
    exam_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_FINAL)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)

    class Meta:
        ordering = ["-start_date", "-id"]
        indexes = [
            models.Index(fields=["class_name", "section", "start_date"]),
            models.Index(fields=["status", "start_date"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["exam_name", "class_name", "section", "subject"],
                name="uniq_exam_name_per_class_section_subject",
            ),
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

        if self.subject_id:
            if not self.class_name_id:
                raise ValidationError({"subject": "Select class before selecting subject."})
            if getattr(self.subject, "school_class_id", None) != self.class_name_id:
                raise ValidationError({"subject": "Selected subject is not in the selected class."})
            subj_section = (getattr(self.subject, "section", "") or "").strip().upper()
            if class_sections and subj_section != (self.section or ""):
                raise ValidationError({"subject": "Selected subject is not in the selected section."})
            if not class_sections and subj_section:
                raise ValidationError({"subject": "Selected subject section must be empty for this class."})

        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError({"end_date": "End date must be on/after start date."})

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
        return f"{self.exam_name} - {self.classroom_label}".strip()


class StudentExamMark(TimeStampedModel):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="exam_marks")
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="marks")
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="exam_marks")
    marks_obtained = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    grade = models.CharField(max_length=2, blank=True, default="")
    remarks = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["exam_id", "student_id", "subject_id"]
        constraints = [
            models.UniqueConstraint(fields=["student", "exam", "subject"], name="uniq_student_exam_subject"),
        ]
        indexes = [
            models.Index(fields=["exam", "student"]),
            models.Index(fields=["exam", "subject"]),
        ]

    def clean(self):
        super().clean()
        if self.exam_id and self.student_id:
            if getattr(self.student, "school_class_id", None) and self.student.school_class_id != self.exam.class_name_id:
                raise ValidationError({"student": "Student is not in the selected class."})
            if (getattr(self.student, "section", "") or "").strip().upper() != (self.exam.section or ""):
                if self.exam.class_name and (self.exam.class_name.sections or []):
                    raise ValidationError({"student": "Student is not in the selected section."})
        if self.subject_id and self.exam_id:
            if getattr(self.subject, "school_class_id", None) and self.subject.school_class_id != self.exam.class_name_id:
                raise ValidationError({"subject": "Subject is not for the selected class."})
            if (getattr(self.subject, "section", "") or "").strip().upper() != (self.exam.section or ""):
                if self.exam.class_name and (self.exam.class_name.sections or []):
                    raise ValidationError({"subject": "Subject is not for the selected section."})

        if self.marks_obtained is not None:
            if self.marks_obtained < 0:
                raise ValidationError({"marks_obtained": "Marks cannot be negative."})
            full_marks = getattr(self.subject, "full_marks", None)
            if full_marks is not None:
                try:
                    full_marks_decimal = Decimal(str(full_marks))
                except Exception:
                    full_marks_decimal = None
                if full_marks_decimal is not None and self.marks_obtained > full_marks_decimal:
                    raise ValidationError({"marks_obtained": "Marks cannot exceed full marks."})

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.exam_id} {self.student_id} {self.subject_id}: {self.marks_obtained}"


class Result(TimeStampedModel):
    STATUS_DRAFT = "DRAFT"
    STATUS_GENERATED = "GENERATED"
    STATUS_PUBLISHED = "PUBLISHED"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_GENERATED, "Generated"),
        (STATUS_PUBLISHED, "Published"),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="results")
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="results")

    total_marks = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    average_marks = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    gpa = models.DecimalField(max_digits=4, decimal_places=2, default=Decimal("0.00"))
    final_grade = models.CharField(max_length=2, blank=True, default="")
    rank = models.PositiveIntegerField(null=True, blank=True)
    is_passed = models.BooleanField(default=False)
    published_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    details = models.JSONField(default=dict, blank=True)

    generated_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["exam_id", "rank", "-total_marks", "student_id"]
        constraints = [
            models.UniqueConstraint(fields=["student", "exam"], name="uniq_result_student_exam"),
        ]
        indexes = [
            models.Index(fields=["exam", "published_status"]),
            models.Index(fields=["exam", "rank"]),
        ]

    def __str__(self) -> str:
        return f"Result({self.exam_id}, {self.student_id})"


class Promotion(TimeStampedModel):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="promotions")
    from_class = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, related_name="promotions_from")
    to_class = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, related_name="promotions_to")
    from_section = models.CharField(max_length=1, blank=True, default="")
    to_section = models.CharField(max_length=1, blank=True, default="")

    promoted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="promotions_made")
    promoted_at = models.DateTimeField(auto_now_add=True)
    academic_year = models.CharField(max_length=20)
    exam = models.ForeignKey("exam_management.Exam", on_delete=models.PROTECT, related_name="promotions", null=True, blank=True)

    class Meta:
        ordering = ["-promoted_at", "-id"]
        indexes = [
            models.Index(fields=["academic_year", "from_class", "to_class"]),
            models.Index(fields=["student", "academic_year"]),
        ]

    def clean(self):
        super().clean()
        self.from_section = (self.from_section or "").strip().upper()
        self.to_section = (self.to_section or "").strip().upper()
        if not (self.academic_year or "").strip():
            raise ValidationError({"academic_year": "Academic year is required."})

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.student_id}: {self.from_class_id}->{self.to_class_id} ({self.academic_year})"


class ResultPublishLog(models.Model):
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="publish_logs")
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="result_publish_logs")
    published_at = models.DateTimeField(auto_now_add=True)
    note = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["-published_at", "-id"]
        indexes = [models.Index(fields=["exam", "published_at"])]

    def __str__(self) -> str:
        return f"Publish({self.exam_id} @ {self.published_at})"


class AuditLog(models.Model):
    ACTION_CREATE = "CREATE"
    ACTION_UPDATE = "UPDATE"
    ACTION_DELETE = "DELETE"
    ACTION_MARKS_BULK_UPLOAD = "MARKS_BULK_UPLOAD"
    ACTION_RESULT_GENERATE = "RESULT_GENERATE"
    ACTION_RESULT_PUBLISH = "RESULT_PUBLISH"
    ACTION_PROMOTION_BULK = "PROMOTION_BULK"

    ACTION_CHOICES = [
        (ACTION_CREATE, "Create"),
        (ACTION_UPDATE, "Update"),
        (ACTION_DELETE, "Delete"),
        (ACTION_MARKS_BULK_UPLOAD, "Marks Bulk Upload"),
        (ACTION_RESULT_GENERATE, "Result Generate"),
        (ACTION_RESULT_PUBLISH, "Result Publish"),
        (ACTION_PROMOTION_BULK, "Promotion Bulk"),
    ]

    action_type = models.CharField(max_length=40, choices=ACTION_CHOICES)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs")
    timestamp = models.DateTimeField(auto_now_add=True)
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-timestamp", "-id"]
        indexes = [
            models.Index(fields=["action_type", "timestamp"]),
        ]

    def __str__(self) -> str:
        return f"{self.action_type} @ {self.timestamp}"
