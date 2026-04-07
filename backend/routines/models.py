from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from academics.models import SchoolClass, Subject
from academics.models import SubjectTeacher
from classes.models import Classroom


class ClassRoutine(models.Model):
    DAY_SAT = 0
    DAY_SUN = 1
    DAY_MON = 2
    DAY_TUE = 3
    DAY_WED = 4
    DAY_THU = 5
    DAY_FRI = 6

    DAY_CHOICES = [
        (DAY_SAT, "Saturday"),
        (DAY_SUN, "Sunday"),
        (DAY_MON, "Monday"),
        (DAY_TUE, "Tuesday"),
        (DAY_WED, "Wednesday"),
        (DAY_THU, "Thursday"),
        (DAY_FRI, "Friday"),
    ]

    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name="routines")
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="routines")
    day_of_week = models.PositiveSmallIntegerField(choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    title = models.CharField(max_length=200, blank=True, default="")
    room = models.CharField(max_length=100, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["day_of_week", "start_time"]
        indexes = [
            models.Index(fields=["classroom", "day_of_week", "start_time"]),
        ]

    def __str__(self) -> str:
        return f"{self.classroom_id} {self.get_day_of_week_display()} {self.start_time}-{self.end_time}"


class AcademicClassRoutine(models.Model):
    DAY_SAT = ClassRoutine.DAY_SAT
    DAY_SUN = ClassRoutine.DAY_SUN
    DAY_MON = ClassRoutine.DAY_MON
    DAY_TUE = ClassRoutine.DAY_TUE
    DAY_WED = ClassRoutine.DAY_WED
    DAY_THU = ClassRoutine.DAY_THU
    DAY_FRI = ClassRoutine.DAY_FRI

    DAY_CHOICES = ClassRoutine.DAY_CHOICES

    TYPE_PERIOD = "PERIOD"
    TYPE_BREAK = "BREAK"
    TYPE_CHOICES = [
        (TYPE_PERIOD, "Period"),
        (TYPE_BREAK, "Break"),
    ]

    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="routines")
    section = models.CharField(max_length=1, blank=True, default="")
    routine_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default=TYPE_PERIOD)
    title = models.CharField(max_length=200, blank=True, default="")
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="academic_routines", null=True, blank=True)
    subject_teacher = models.ForeignKey(
        SubjectTeacher,
        on_delete=models.PROTECT,
        related_name="academic_routines",
        null=True,
        blank=True,
    )
    live_enabled = models.BooleanField(default=False)
    meet_link = models.URLField(blank=True, default="")
    meet_event_id = models.CharField(max_length=200, blank=True, default="")
    day_of_week = models.PositiveSmallIntegerField(choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    room = models.CharField(max_length=100, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["day_of_week", "start_time"]
        indexes = [
            models.Index(fields=["school_class", "section", "day_of_week", "start_time"]),
        ]

    def clean(self):
        super().clean()
        section = (self.section or "").strip().upper()
        class_sections = self.school_class.sections or []
        if class_sections:
            if not section:
                raise ValidationError({"section": "Section is required for this class."})
            if section not in class_sections:
                raise ValidationError({"section": f"Section must be one of: {', '.join(class_sections)}."})
        else:
            if section:
                raise ValidationError({"section": "This class has no sections; leave section empty."})
        self.section = section

        routine_type = (self.routine_type or self.TYPE_PERIOD).strip().upper()
        if routine_type not in {self.TYPE_PERIOD, self.TYPE_BREAK}:
            raise ValidationError({"routine_type": "Invalid routine type."})
        self.routine_type = routine_type

        if self.routine_type == self.TYPE_BREAK:
            if self.subject_id:
                raise ValidationError({"subject": "Break routine cannot have a subject."})
            if self.subject_teacher_id:
                raise ValidationError({"subject_teacher": "Break routine cannot have a subject teacher."})
            if self.live_enabled:
                raise ValidationError({"live_enabled": "Break routine cannot be a live class."})
            if self.meet_link:
                raise ValidationError({"meet_link": "Break routine cannot have a meet link."})
            if not (self.title or "").strip():
                raise ValidationError({"title": "Title is required for break routine (e.g. Tiffin)."})
        else:
            # Period
            if not self.subject_id:
                raise ValidationError({"subject": "Subject is required for period routine."})
            if not self.subject_teacher_id and self.subject and self.subject.subject_teacher_id:
                # Auto-select teacher from subject; user can override later.
                self.subject_teacher = self.subject.subject_teacher

    def save(self, *args, **kwargs):
        # Keep validation consistent with Subject's Class+Section rules.
        self.clean()
        return super().save(*args, **kwargs)

    @property
    def school_class_label(self) -> str:
        if self.section:
            return f"{self.school_class.name} ({self.section})"
        return self.school_class.name

    @property
    def subject_label(self) -> str:
        if self.routine_type == self.TYPE_BREAK:
            return (self.title or "").strip()
        if not self.subject_id:
            return ""
        if self.subject.code:
            return f"{self.subject.code} - {self.subject.name}"
        return self.subject.name

    @property
    def subject_teacher_label(self) -> str:
        if self.subject_teacher_id:
            return f"{self.subject_teacher.teacher_code} - {self.subject_teacher.name}"
        if self.subject_id and self.subject and self.subject.subject_teacher_id:
            return self.subject.subject_teacher_label
        return ""

    def __str__(self) -> str:
        return f"{self.school_class_id}:{self.section} {self.get_day_of_week_display()} {self.start_time}-{self.end_time}"


class AcademicClassRoutineOverride(models.Model):
    routine = models.ForeignKey(AcademicClassRoutine, on_delete=models.CASCADE, related_name="overrides")
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    meet_link = models.URLField(blank=True, default="")
    meet_event_id = models.CharField(max_length=200, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "start_time"]
        constraints = [
            models.UniqueConstraint(fields=["routine", "date"], name="uniq_routine_override_per_date"),
        ]

    def clean(self):
        super().clean()
        if self.start_time and self.end_time and self.start_time >= self.end_time:
            raise ValidationError({"end_time": "end_time must be after start_time."})
        if self.routine_id:
            if self.routine.routine_type == AcademicClassRoutine.TYPE_BREAK:
                raise ValidationError({"routine": "Break routine cannot have overrides."})
            if self.routine.subject_id and getattr(self.routine.subject, "subject_type", "") == "PRACTICAL":
                raise ValidationError({"routine": "Practical subject routine cannot have overrides."})

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)


class Holiday(models.Model):
    date = models.DateField(unique=True)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date"]

    def clean(self):
        super().clean()
        self.title = (self.title or "").strip()
        if not self.title:
            raise ValidationError({"title": "Title is required."})

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.date} - {self.title}"


class WeeklyHoliday(models.Model):
    """
    A single global weekly holiday configuration (e.g. Friday).
    Store day indices as the same convention used by routines:
    0=Sat ... 6=Fri.
    """

    singleton_key = models.PositiveSmallIntegerField(default=1, unique=True, editable=False)
    days = models.JSONField(default=list, blank=True)
    title = models.CharField(max_length=200, blank=True, default="Weekly Holiday")
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def clean(self):
        super().clean()
        normalized = []
        for d in self.days or []:
            try:
                d = int(d)
            except Exception:
                continue
            if 0 <= d <= 6 and d not in normalized:
                normalized.append(d)
        self.days = normalized
        self.title = (self.title or "").strip() or "Weekly Holiday"

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"Weekly Holiday ({', '.join(str(d) for d in (self.days or []))})"
