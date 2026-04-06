from django.conf import settings
from django.db import models

from classes.models import Classroom


class Announcement(models.Model):
    AUDIENCE_ALL = "ALL"
    AUDIENCE_TEACHERS = "TEACHERS"
    AUDIENCE_PARENTS = "PARENTS"

    AUDIENCE_CHOICES = [
        (AUDIENCE_ALL, "All"),
        (AUDIENCE_TEACHERS, "Teachers"),
        (AUDIENCE_PARENTS, "Parents"),
    ]

    title = models.CharField(max_length=200)
    message = models.TextField()
    audience = models.CharField(max_length=20, choices=AUDIENCE_CHOICES, default=AUDIENCE_ALL)
    classroom = models.ForeignKey(Classroom, on_delete=models.SET_NULL, null=True, blank=True, related_name="announcements")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_announcements")
    publish_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title

