from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from academics.models import SchoolClass
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


class Notice(models.Model):
    """
    Rich-text notice (HTML) for portal.
    Supports pin/unpin.
    """

    AUDIENCE_ALL_SCHOOL = "ALL_SCHOOL"
    AUDIENCE_TEACHERS = "TEACHERS"
    AUDIENCE_PARENTS = "PARENTS"

    AUDIENCE_CHOICES = [
        (AUDIENCE_ALL_SCHOOL, "All School"),
        (AUDIENCE_TEACHERS, "All Teachers"),
        (AUDIENCE_PARENTS, "All Parents"),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    content_html = models.TextField(blank=True, default="")
    audience = models.CharField(max_length=20, choices=AUDIENCE_CHOICES, default=AUDIENCE_ALL_SCHOOL)
    school_classes = models.ManyToManyField(SchoolClass, blank=True, related_name="notices")
    pdf_file = models.FileField(upload_to="notices/pdfs/", null=True, blank=True)
    is_pinned = models.BooleanField(default=False)
    pinned_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_notices")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_pinned", "-pinned_at", "-created_at"]

    def __str__(self) -> str:
        return self.title


class Notification(models.Model):
    """
    User-targeted notification with per-recipient read/unread state.

    This is separate from `Notice` (rich portal notice) and `Announcement` (simple broadcast),
    and is intended for real-time-ish alerts like attendance absent, fee due, homework assigned, etc.
    """

    TYPE_ADMIN_BROADCAST = "ADMIN_BROADCAST"
    TYPE_SCHOOL_ANNOUNCEMENT = "SCHOOL_ANNOUNCEMENT"
    TYPE_HOLIDAY_NOTICE = "HOLIDAY_NOTICE"
    TYPE_HOMEWORK_ASSIGNED = "HOMEWORK_ASSIGNED"
    TYPE_EXAM_SCHEDULE_PUBLISHED = "EXAM_SCHEDULE_PUBLISHED"
    TYPE_EXAM_REMINDER = "EXAM_REMINDER"
    TYPE_RESULT_PUBLISHED = "RESULT_PUBLISHED"
    TYPE_FEE_DUE_REMINDER = "FEE_DUE_REMINDER"
    TYPE_ATTENDANCE_ABSENT_ALERT = "ATTENDANCE_ABSENT_ALERT"
    TYPE_LIVE_CLASS_REMINDER = "LIVE_CLASS_REMINDER"
    TYPE_MESSAGE = "MESSAGE"
    TYPE_CUSTOM = "CUSTOM"

    TYPE_CHOICES = [
        (TYPE_ADMIN_BROADCAST, "Admin Broadcast"),
        (TYPE_SCHOOL_ANNOUNCEMENT, "School Announcement"),
        (TYPE_HOLIDAY_NOTICE, "Holiday Notice"),
        (TYPE_HOMEWORK_ASSIGNED, "Homework Assigned"),
        (TYPE_EXAM_SCHEDULE_PUBLISHED, "Exam Schedule Published"),
        (TYPE_EXAM_REMINDER, "Exam Reminder"),
        (TYPE_RESULT_PUBLISHED, "Result Published"),
        (TYPE_FEE_DUE_REMINDER, "Fee Due Reminder"),
        (TYPE_ATTENDANCE_ABSENT_ALERT, "Attendance Absent Alert"),
        (TYPE_LIVE_CLASS_REMINDER, "Live Class Reminder"),
        (TYPE_MESSAGE, "Message"),
        (TYPE_CUSTOM, "Custom"),
    ]

    PRIORITY_LOW = "LOW"
    PRIORITY_NORMAL = "NORMAL"
    PRIORITY_HIGH = "HIGH"
    PRIORITY_URGENT = "URGENT"

    PRIORITY_CHOICES = [
        (PRIORITY_LOW, "Low"),
        (PRIORITY_NORMAL, "Normal"),
        (PRIORITY_HIGH, "High"),
        (PRIORITY_URGENT, "Urgent"),
    ]

    type = models.CharField(max_length=40, choices=TYPE_CHOICES, default=TYPE_CUSTOM)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default=PRIORITY_NORMAL)

    title = models.CharField(max_length=200)
    message = models.TextField(blank=True, default="")

    # Optional portal route ("/portal/....") or external URL
    action_url = models.CharField(max_length=500, blank=True, default="")
    data = models.JSONField(blank=True, default=dict)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_notifications",
    )
    publish_at = models.DateTimeField(null=True, blank=True, help_text="Optional schedule time; null = immediately visible")
    expires_at = models.DateTimeField(null=True, blank=True, help_text="Optional expiry; after this time notifications hide")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["type", "created_at"]),
            models.Index(fields=["publish_at"]),
            models.Index(fields=["expires_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.type}: {self.title}".strip()

    def clean(self):
        super().clean()
        if self.publish_at and self.expires_at and self.expires_at <= self.publish_at:
            raise ValidationError({"expires_at": "Expiry time must be after publish time."})

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)

    def is_published(self, at=None) -> bool:
        now = at or timezone.now()
        return self.publish_at is None or self.publish_at <= now

    def is_expired(self, at=None) -> bool:
        now = at or timezone.now()
        return self.expires_at is not None and self.expires_at < now

    def is_visible(self, at=None) -> bool:
        return self.is_published(at=at) and not self.is_expired(at=at)

    @classmethod
    def create_for_users(
        cls,
        *,
        user_ids,
        title,
        created_by=None,
        type=TYPE_CUSTOM,
        priority=PRIORITY_NORMAL,
        message="",
        action_url="",
        data=None,
        publish_at=None,
        expires_at=None,
    ):
        notification = cls.objects.create(
            type=type,
            priority=priority,
            title=title,
            message=message or "",
            action_url=action_url or "",
            data=data or {},
            created_by=created_by,
            publish_at=publish_at,
            expires_at=expires_at,
        )
        recipient_ids = sorted({int(uid) for uid in (user_ids or []) if uid})
        NotificationRecipient.objects.bulk_create(
            [NotificationRecipient(notification=notification, user_id=uid) for uid in recipient_ids],
            ignore_conflicts=True,
        )
        return notification, len(recipient_ids)


class NotificationRecipient(models.Model):
    notification = models.ForeignKey(Notification, on_delete=models.CASCADE, related_name="recipient_rows")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_inbox")
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["notification", "user"], name="uniq_notification_user"),
        ]
        indexes = [
            models.Index(fields=["user", "is_read", "created_at"]),
            models.Index(fields=["user", "created_at"]),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"NotificationRecipient({self.notification_id}, {self.user_id})"

    def mark_read(self, when=None, save=True):
        self.is_read = True
        self.read_at = when or timezone.now()
        if save:
            self.save(update_fields=["is_read", "read_at"])
        return self

    def mark_unread(self, save=True):
        self.is_read = False
        self.read_at = None
        if save:
            self.save(update_fields=["is_read", "read_at"])
        return self
