from django.contrib import admin

from .models import Classroom, Enrollment, LiveClass


@admin.register(Classroom)
class ClassroomAdmin(admin.ModelAdmin):
    list_display = ("name", "teacher", "year", "created_at")
    search_fields = ("name", "teacher__username", "teacher__email")


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ("classroom", "student", "created_at")
    search_fields = ("classroom__name", "student__first_name", "student__last_name")


@admin.register(LiveClass)
class LiveClassAdmin(admin.ModelAdmin):
    list_display = ("classroom", "title", "starts_at", "ends_at", "created_by")
    search_fields = ("classroom__name", "title", "created_by__username")

