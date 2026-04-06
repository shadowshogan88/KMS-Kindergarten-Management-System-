from django.contrib import admin

from .models import ClassRoutine


@admin.register(ClassRoutine)
class ClassRoutineAdmin(admin.ModelAdmin):
    list_display = ("classroom", "day_of_week", "start_time", "end_time", "teacher", "title")
    list_filter = ("day_of_week", "classroom")
    search_fields = ("classroom__name", "teacher__username", "teacher__email", "title", "room")

