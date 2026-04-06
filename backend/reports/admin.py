from django.contrib import admin

from .models import DailyActivityReport, MediaItem, ProgressNote


class MediaInline(admin.TabularInline):
    model = MediaItem
    extra = 0


@admin.register(DailyActivityReport)
class DailyActivityReportAdmin(admin.ModelAdmin):
    list_display = ("date", "classroom", "student", "mood", "created_by", "created_at")
    list_filter = ("classroom", "mood", "date")
    search_fields = ("student__first_name", "student__last_name", "teacher_notes")
    inlines = [MediaInline]


@admin.register(ProgressNote)
class ProgressNoteAdmin(admin.ModelAdmin):
    list_display = ("student", "classroom", "title", "created_by", "created_at")
    search_fields = ("student__first_name", "student__last_name", "title", "note")

