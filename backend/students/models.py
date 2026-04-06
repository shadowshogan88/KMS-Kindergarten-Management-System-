from django.conf import settings
from django.db import models


class ParentProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="parent_profile")
    address = models.TextField(blank=True, default="")
    emergency_contact_name = models.CharField(max_length=120, blank=True, default="")
    emergency_contact_phone = models.CharField(max_length=30, blank=True, default="")

    def __str__(self) -> str:
        return f"ParentProfile({self.user_id})"


class Student(models.Model):
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80, blank=True, default="")
    date_of_birth = models.DateField(null=True, blank=True)
    photo = models.ImageField(upload_to="students/photos/", blank=True, null=True)

    parent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="children",
        help_text="Parent user account",
    )

    medical_info = models.TextField(blank=True, default="", help_text="Allergies, medications, conditions")
    pickup_authorized_people = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        full = f"{self.first_name} {self.last_name}".strip()
        return full or f"Student({self.id})"

