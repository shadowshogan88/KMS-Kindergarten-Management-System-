from django.db import models
from django.core.exceptions import ValidationError

from academics.models import SchoolClass
from classes.models import Classroom
from students.models import Student


class AttendanceRecord(models.Model):
    STATUS_PRESENT = "PRESENT"
    STATUS_ABSENT = "ABSENT"
    STATUS_LATE = "LATE"

    STATUS_CHOICES = [
        (STATUS_PRESENT, "Present"),
        (STATUS_ABSENT, "Absent"),
        (STATUS_LATE, "Late"),
    ]

    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name="attendance_records")
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="attendance_records")
    date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PRESENT)
    note = models.CharField(max_length=300, blank=True, default="")
    marked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["classroom", "student", "date"], name="uniq_attendance_per_day"),
        ]
        ordering = ["-date", "student_id"]

    def __str__(self) -> str:
        return f"{self.date} {self.student_id} {self.status}"


class AcademicAttendanceRecord(models.Model):
    STATUS_PRESENT = AttendanceRecord.STATUS_PRESENT
    STATUS_ABSENT = AttendanceRecord.STATUS_ABSENT
    STATUS_LATE = AttendanceRecord.STATUS_LATE

    STATUS_CHOICES = AttendanceRecord.STATUS_CHOICES

    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="academic_attendance_records")
    section = models.CharField(max_length=1, blank=True, default="")
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="academic_attendance_records")
    date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PRESENT)
    note = models.CharField(max_length=300, blank=True, default="")
    marked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["school_class", "section", "student", "date"], name="uniq_academic_attendance_per_day"),
        ]
        ordering = ["-date", "student_id"]
        indexes = [
            models.Index(fields=["school_class", "section", "date"]),
            models.Index(fields=["student", "date"]),
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

        # Ensure student matches selected class/section (if student has those fields).
        if getattr(self.student, "school_class_id", None) and self.student.school_class_id != self.school_class_id:
            raise ValidationError({"student": "Student is not in the selected class."})
        if (getattr(self.student, "section", "") or "").strip().upper() != (self.section or ""):
            # Only enforce section if class has sections; if class has none, student.section must be empty as well.
            if class_sections or (self.section or "").strip():
                raise ValidationError({"student": "Student is not in the selected section."})

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.date} {self.school_class_id}:{self.section} {self.student_id} {self.status}"
