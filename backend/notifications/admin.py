from django.contrib import admin

from .models import Announcement, Notice, Notification, NotificationRecipient


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ("title", "audience", "classroom", "created_by", "publish_at", "created_at")
    list_filter = ("audience", "classroom")
    search_fields = ("title", "message")


@admin.register(Notice)
class NoticeAdmin(admin.ModelAdmin):
    list_display = ("title", "audience", "is_pinned", "is_active", "created_by", "created_at", "updated_at")
    list_filter = ("audience", "school_classes", "is_pinned", "is_active")
    search_fields = ("title", "content_html")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("type", "priority", "title", "publish_at", "expires_at", "created_by", "created_at")
    list_filter = ("type", "priority")
    search_fields = ("title", "message")


@admin.register(NotificationRecipient)
class NotificationRecipientAdmin(admin.ModelAdmin):
    list_display = ("notification", "user", "is_read", "read_at", "created_at")
    list_filter = ("is_read",)
    search_fields = ("notification__title", "user__username")
