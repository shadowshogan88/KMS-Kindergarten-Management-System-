from django.conf import settings
from django.db import models

from classes.models import Classroom
from students.models import Student


class DailyActivityReport(models.Model):
    MOOD_HAPPY = "HAPPY"
    MOOD_OKAY = "OKAY"
    MOOD_SAD = "SAD"
    MOOD_SICK = "SICK"

    MOOD_CHOICES = [
        (MOOD_HAPPY, "Happy"),
        (MOOD_OKAY, "Okay"),
        (MOOD_SAD, "Sad"),
        (MOOD_SICK, "Sick"),
    ]

    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name="daily_reports")
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="daily_reports")
    date = models.DateField()

    food = models.TextField(blank=True, default="", help_text="Meals, appetite, snacks")
    sleep = models.TextField(blank=True, default="", help_text="Nap time, duration")
    mood = models.CharField(max_length=20, choices=MOOD_CHOICES, default=MOOD_OKAY)
    learning = models.TextField(blank=True, default="", help_text="What the child learned")
    teacher_notes = models.TextField(blank=True, default="")

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_daily_reports")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["classroom", "student", "date"], name="uniq_daily_report_per_day"),
        ]
        ordering = ["-date", "student_id"]

    def __str__(self) -> str:
        return f"{self.date} {self.student_id}"


class MediaItem(models.Model):
    TYPE_PHOTO = "PHOTO"
    TYPE_VIDEO = "VIDEO"

    TYPE_CHOICES = [
        (TYPE_PHOTO, "Photo"),
        (TYPE_VIDEO, "Video"),
    ]

    report = models.ForeignKey(DailyActivityReport, on_delete=models.CASCADE, related_name="media")
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_PHOTO)
    file = models.FileField(upload_to="reports/media/")
    caption = models.CharField(max_length=200, blank=True, default="")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.type} {self.report_id}"


class ProgressNote(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="progress_notes")
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name="progress_notes")
    title = models.CharField(max_length=200)
    note = models.TextField()
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_progress_notes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title

