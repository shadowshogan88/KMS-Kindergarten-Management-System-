from django.contrib import admin

from .models import Announcement


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ("title", "audience", "classroom", "created_by", "publish_at", "created_at")
    list_filter = ("audience", "classroom")
    search_fields = ("title", "message")

