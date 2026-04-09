from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.db import models

from academics.models import SchoolClass, Subject


def syllabus_pdf_upload_to(instance, filename: str) -> str:
    return f"syllabus/{instance.school_class_id}/{instance.subject_id}/{filename}"


class Syllabus(models.Model):
    """
    Syllabus PDF per class/section/subject.
    Day-to-day usage: view in portal with embedded PDF viewer.
    """

    school_class = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, related_name="syllabi")
    section = models.CharField(max_length=20, blank=True, default="")
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="syllabi")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    pdf_file = models.FileField(
        upload_to=syllabus_pdf_upload_to,
        validators=[FileExtensionValidator(["pdf"])],
    )
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_syllabi")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def clean(self):
        super().clean()
        self.section = (self.section or "").strip().upper()
        self.title = (self.title or "").strip()
        if not self.title:
            raise ValidationError({"title": "Title is required."})
        if self.subject_id and self.school_class_id and self.subject.school_class_id != self.school_class_id:
            raise ValidationError({"subject": "Subject must belong to the selected class."})

        # Best-effort PDF signature check.
        f = getattr(self, "pdf_file", None)
        if f and hasattr(f, "file"):
            try:
                pos = f.file.tell()
                f.file.seek(0)
                sig = f.file.read(4)
                f.file.seek(pos)
                if sig != b"%PDF":
                    raise ValidationError({"pdf_file": "Invalid PDF file."})
            except ValidationError:
                raise
            except Exception:
                # Ignore signature failures for storages that don't support seek
                pass

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.school_class.name} {self.section or ''} - {self.subject.name}: {self.title}"

