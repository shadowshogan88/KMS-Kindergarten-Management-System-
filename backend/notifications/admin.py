from django.contrib import admin

from .models import Announcement, Notice


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
