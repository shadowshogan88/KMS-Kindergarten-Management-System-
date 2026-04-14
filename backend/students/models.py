from django.conf import settings
from django.db import models, transaction
from django.core.exceptions import ValidationError
from django.db.models import Max, Q

from academics.models import SchoolClass

class ParentProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="parent_profile")
    address = models.TextField(blank=True, default="")
    emergency_contact_name = models.CharField(max_length=120, blank=True, default="")
    emergency_contact_phone = models.CharField(max_length=30, blank=True, default="")

    def __str__(self) -> str:
        return f"ParentProfile({self.user_id})"


class Student(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="student_profile",
        null=True,
        blank=True,
    )
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=30, blank=True, default="")

    school_class = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, related_name="students", null=True, blank=True)
    section = models.CharField(max_length=1, blank=True, default="")
    roll_no = models.PositiveIntegerField(null=True, blank=True)

    date_of_birth = models.DateField(null=True, blank=True)
    photo = models.ImageField(upload_to="students/photos/", blank=True, null=True)

    parent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="children",
        help_text="Parent user account",
        null=True,
        blank=True,
    )

    medical_info = models.TextField(blank=True, default="", help_text="Allergies, medications, conditions")
    pickup_authorized_people = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["first_name", "last_name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["school_class", "section", "roll_no"],
                condition=Q(roll_no__isnull=False),
                name="uniq_student_roll_per_class_section",
            ),
            models.CheckConstraint(
                condition=Q(roll_no__isnull=True) | Q(roll_no__gte=1),
                name="student_roll_positive_or_null",
            ),
        ]

    @classmethod
    def get_next_roll_no(cls, school_class_id, section):
        if not school_class_id:
            return None
        with transaction.atomic():
            max_roll = (
                cls.objects.select_for_update()
                .filter(school_class_id=school_class_id, section=(section or "").strip().upper(), roll_no__isnull=False)
                .aggregate(max_roll=Max("roll_no"))
                .get("max_roll")
            ) or 0
            return int(max_roll) + 1

    def clean(self):
        super().clean()
        section = (self.section or "").strip().upper()
        if self.school_class_id:
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

        if self.roll_no is not None and not self.school_class_id:
            raise ValidationError({"roll_no": "Roll number requires a class."})

        if self.roll_no is not None and self.roll_no < 1:
            raise ValidationError({"roll_no": "Roll number must be 1 or greater."})

        if self.school_class_id and self.roll_no is not None:
            duplicate = (
                Student.objects.filter(
                    school_class_id=self.school_class_id,
                    section=self.section or "",
                    roll_no=self.roll_no,
                )
                .exclude(pk=self.pk)
                .exists()
            )
            if duplicate:
                raise ValidationError({"roll_no": "This roll number is already used in the selected class/section."})

        if self.user_id:
            role = getattr(self.user, "role", None)
            if role != "STUDENT":
                raise ValidationError({"user": "Selected user must have role STUDENT."})
            self.email = (getattr(self.user, "email", "") or self.email).strip()
            self.phone = getattr(self.user, "phone", "") or self.phone

    def save(self, *args, **kwargs):
        update_fields = kwargs.get("update_fields")
        # If class/section changed and caller did not explicitly provide a roll, reassign from new scope.
        if self.pk and self.school_class_id and update_fields and ("school_class" in update_fields or "section" in update_fields) and "roll_no" not in update_fields:
            self.roll_no = None
            kwargs["update_fields"] = set(update_fields) | {"roll_no"}

        if self.school_class_id and self.roll_no is None:
            self.roll_no = self.get_next_roll_no(self.school_class_id, self.section)
            if kwargs.get("update_fields") is not None:
                kwargs["update_fields"] = set(kwargs["update_fields"]) | {"roll_no"}

        self.clean()
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        full = f"{self.first_name} {self.last_name}".strip()
        return full or f"Student({self.id})"
