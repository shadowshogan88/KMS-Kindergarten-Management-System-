from django.conf import settings
from django.db import models
from django.core.exceptions import ValidationError
from django.utils.crypto import get_random_string


class Department(models.Model):
    name = models.CharField(max_length=120, unique=True)
    head = models.CharField(max_length=120, blank=True, default="")
    phone = models.CharField(max_length=50, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    employees = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class SchoolClass(models.Model):
    SECTION_CHOICES = ("A", "B", "C", "D", "E")

    name = models.CharField(max_length=120, unique=True)
    sections = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Classes"

    def clean(self):
        super().clean()
        if self.sections is None:
            self.sections = []
        if not isinstance(self.sections, list):
            raise ValidationError({"sections": "Sections must be a list."})
        normalized = []
        for s in self.sections:
            if not isinstance(s, str):
                continue
            s = s.strip().upper()
            if s in self.SECTION_CHOICES and s not in normalized:
                normalized.append(s)
        self.sections = normalized

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class Section(models.Model):
    name = models.CharField(max_length=50, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Subject(models.Model):
    TYPE_THEORY = "THEORY"
    TYPE_PRACTICAL = "PRACTICAL"
    TYPE_CHOICES = [
        (TYPE_THEORY, "Theory"),
        (TYPE_PRACTICAL, "Practical"),
    ]

    name = models.CharField(max_length=120)
    code = models.CharField(max_length=30, unique=True)
    subject_teacher = models.ForeignKey(
        "SubjectTeacher",
        on_delete=models.PROTECT,
        related_name="subjects",
        null=True,
        blank=True,
    )
    school_class = models.ForeignKey(
        SchoolClass,
        on_delete=models.PROTECT,
        related_name="subjects",
        null=True,
        blank=True,
    )
    section = models.CharField(max_length=1, blank=True, default="")
    full_marks = models.PositiveIntegerField(default=100)
    pass_marks = models.PositiveIntegerField(default=40)
    subject_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default=TYPE_THEORY)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code"]
        constraints = [
            models.UniqueConstraint(fields=["name"], name="uniq_subject_name"),
        ]

    def clean(self):
        super().clean()
        if self.pass_marks > self.full_marks:
            raise ValidationError({"pass_marks": "Pass marks cannot exceed full marks."})
        if not self.school_class_id:
            self.section = (self.section or "").strip().upper()
            return

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

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)

    @property
    def classroom_key(self) -> str:
        if not self.school_class_id:
            return ""
        return f"{self.school_class_id}:{self.section or ''}"

    @property
    def classroom_label(self) -> str:
        if not self.school_class_id:
            return ""
        if self.section:
            return f"{self.school_class.name} ({self.section})"
        return self.school_class.name

    @property
    def subject_teacher_label(self) -> str:
        if not self.subject_teacher_id:
            return ""
        return f"{self.subject_teacher.teacher_code} - {self.subject_teacher.name}"

    def __str__(self) -> str:
        return f"{self.code} - {self.name}"


class Room(models.Model):
    room_no = models.CharField(max_length=30, unique=True)
    capacity = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["room_no"]

    def __str__(self) -> str:
        return f"Room {self.room_no} ({self.capacity})"


class Designation(models.Model):
    title = models.CharField(max_length=120, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title"]

    def __str__(self) -> str:
        return self.title


class SubjectTeacher(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="subject_teacher_profile",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=120)
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=30, blank=True, default="")
    teacher_code = models.CharField(max_length=4, unique=True, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["teacher_code", "name"]

    def clean(self):
        super().clean()
        if self.user_id:
            role = getattr(self.user, "role", None)
            if role != "TEACHER":
                raise ValidationError({"user": "Selected user must have role TEACHER."})
        self.teacher_code = (self.teacher_code or "").strip().upper()
        if self.teacher_code and len(self.teacher_code) != 4:
            raise ValidationError({"teacher_code": "Teacher code must be exactly 4 characters."})

    def _generate_unique_code(self) -> str:
        for _ in range(50):
            code = get_random_string(4, allowed_chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
            if not SubjectTeacher.objects.filter(teacher_code=code).exists():
                return code
        raise ValidationError({"teacher_code": "Unable to generate a unique teacher code. Try again."})

    def save(self, *args, **kwargs):
        self.clean()
        if self.user_id:
            # Keep teacher display data consistent with the Teacher user account.
            full_name = (getattr(self.user, "get_full_name", lambda: "")() or "").strip()
            self.name = full_name or (getattr(self.user, "username", "") or self.name)
            self.phone = getattr(self.user, "phone", "") or self.phone
            self.email = (getattr(self.user, "email", "") or self.email).strip()
        if not self.teacher_code:
            self.teacher_code = self._generate_unique_code()
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.teacher_code} - {self.name}"


class ClassTeacher(models.Model):
    school_class = models.ForeignKey(
        SchoolClass,
        on_delete=models.PROTECT,
        related_name="class_teachers",
    )
    section = models.CharField(max_length=1, blank=True, default="")
    teacher = models.ForeignKey(
        SubjectTeacher,
        on_delete=models.PROTECT,
        related_name="class_assignments",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["school_class_id", "section", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["school_class", "section"],
                name="uniq_class_teacher_class_section",
            ),
        ]

    def clean(self):
        super().clean()

        section = (self.section or "").strip().upper()
        class_sections = list(self.school_class.sections or []) if self.school_class_id else []

        if class_sections:
            if not section:
                raise ValidationError({"section": "Section is required for this class."})
            if section not in class_sections:
                raise ValidationError({"section": f"Section must be one of: {', '.join(class_sections)}."})
        else:
            if section:
                raise ValidationError({"section": "This class has no sections; leave section empty."})

        self.section = section

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)

    @property
    def classroom_key(self) -> str:
        if not self.school_class_id:
            return ""
        return f"{self.school_class_id}:{self.section or ''}"

    @property
    def classroom_label(self) -> str:
        if not self.school_class_id:
            return ""
        if self.section:
            return f"{self.school_class.name} ({self.section})"
        return self.school_class.name

    @property
    def teacher_label(self) -> str:
        if not self.teacher_id:
            return ""
        return f"{self.teacher.teacher_code} - {self.teacher.name}"

    def __str__(self) -> str:
        return f"{self.classroom_label} -> {self.teacher_label}"
