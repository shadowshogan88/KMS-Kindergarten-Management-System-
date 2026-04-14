import os
import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


def user_profile_picture_upload_to(instance, filename: str) -> str:
    ext = os.path.splitext(filename or "")[1].lower() or ".jpg"
    return f"users/profile_pictures/{instance.pk or 'new'}/{uuid.uuid4().hex}{ext}"


class User(AbstractUser):
    ROLE_ADMIN = "ADMIN"
    ROLE_USER = "USER"
    ROLE_TEACHER = "TEACHER"
    ROLE_STUDENT = "STUDENT"
    ROLE_PARENT = "PARENT"

    ROLE_CHOICES = [
        (ROLE_ADMIN, "Admin"),
        (ROLE_USER, "User"),
        (ROLE_TEACHER, "Teacher"),
        (ROLE_STUDENT, "Student"),
        (ROLE_PARENT, "Parent"),
    ]

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_PARENT)
    phone = models.CharField(max_length=30, blank=True, default="")
    profile_picture = models.ImageField(upload_to=user_profile_picture_upload_to, blank=True, null=True)
    must_change_password = models.BooleanField(
        default=False,
        help_text="If true, user should be prompted to change password after login (no current password required).",
    )
    portal_role = models.ForeignKey(
        "users.PortalRole",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
        help_text="Optional RBAC role for portal sidebar + CRUD permissions.",
    )

    def __str__(self) -> str:
        return f"{self.username} ({self.role})"


class PortalRole(models.Model):
    name = models.CharField(max_length=120, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class PortalRolePermission(models.Model):
    """
    Permissions for a single sidebar link/path.
    `path` should match the frontend route href (example: "/portal/class-routine").
    """

    role = models.ForeignKey(PortalRole, on_delete=models.CASCADE, related_name="permissions")
    path = models.CharField(max_length=200)
    can_view = models.BooleanField(default=False)
    can_create = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["path"]
        constraints = [
            models.UniqueConstraint(fields=["role", "path"], name="uniq_portal_role_path"),
        ]

    def __str__(self) -> str:
        return f"{self.role}: {self.path}"
