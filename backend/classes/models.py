from django.conf import settings
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone

from academics.models import SchoolClass
from students.models import Student


class Classroom(models.Model):
    name = models.CharField(max_length=120)
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="classrooms")
    year = models.IntegerField(default=timezone.now().year)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.name} ({self.year})"


class Enrollment(models.Model):
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name="enrollments")
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="enrollments")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["classroom", "student"], name="uniq_classroom_student"),
        ]


class LiveClass(models.Model):
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name="live_classes")
    title = models.CharField(max_length=200)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    meet_link = models.URLField(help_text="Google Meet link", blank=True, default="")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_live_classes")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.classroom_id}: {self.title}"


class SpecialLiveClass(models.Model):
    school_class = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, related_name="special_live_classes")
    section = models.CharField(max_length=1, blank=True, default="")
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    meet_link = models.URLField(help_text="Google Meet link", blank=True, default="")
    meet_event_id = models.CharField(max_length=200, blank=True, default="")
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_special_live_classes")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "start_time", "-created_at"]

    def clean(self):
        super().clean()
        self.section = (self.section or "").strip().upper()
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValidationError({"end_time": "End time must be after start time."})

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.school_class_id} {self.section} {self.date}: {self.title}".strip()
