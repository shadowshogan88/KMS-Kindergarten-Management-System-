from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_ADMIN = "ADMIN"
    ROLE_TEACHER = "TEACHER"
    ROLE_PARENT = "PARENT"

    ROLE_CHOICES = [
        (ROLE_ADMIN, "Admin"),
        (ROLE_TEACHER, "Teacher"),
        (ROLE_PARENT, "Parent"),
    ]

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_PARENT)
    phone = models.CharField(max_length=30, blank=True, default="")

    def __str__(self) -> str:
        return f"{self.username} ({self.role})"

