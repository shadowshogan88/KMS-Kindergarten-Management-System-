from django.contrib import admin

from .models import Syllabus


@admin.register(Syllabus)
class SyllabusAdmin(admin.ModelAdmin):
    list_display = ("title", "school_class", "section", "subject", "is_active", "created_by", "created_at")
    list_filter = ("school_class", "subject", "is_active")
    search_fields = ("title", "description")

