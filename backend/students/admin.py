from django.contrib import admin

from .models import ParentProfile, Student


@admin.register(ParentProfile)
class ParentProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "emergency_contact_name", "emergency_contact_phone")
    search_fields = ("user__username", "user__email", "emergency_contact_name")


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("first_name", "last_name", "school_class", "section", "email", "phone", "parent", "user", "date_of_birth", "created_at")
    search_fields = ("first_name", "last_name", "email", "phone", "parent__username", "parent__email", "user__username", "user__email")
    autocomplete_fields = ("parent", "user", "school_class")
