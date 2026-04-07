from django.contrib import admin

from .models import AcademicClassRoutine, ClassRoutine


@admin.register(ClassRoutine)
class ClassRoutineAdmin(admin.ModelAdmin):
    list_display = ("classroom", "day_of_week", "start_time", "end_time", "teacher", "title")
    list_filter = ("day_of_week", "classroom")
    search_fields = ("classroom__name", "teacher__username", "teacher__email", "title", "room")


@admin.register(AcademicClassRoutine)
class AcademicClassRoutineAdmin(admin.ModelAdmin):
    list_display = ("school_class", "section", "day_of_week", "start_time", "end_time", "subject", "room")
    list_filter = ("day_of_week", "school_class", "section")
    search_fields = ("school_class__name", "section", "subject__name", "subject__code", "room")
