from django.contrib import admin

from .models import ClassTeacher, Department, Designation, Room, SchoolClass, Section, Subject, SubjectTeacher


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "head", "phone", "email", "employees", "updated_at")
    search_fields = ("name", "head", "email", "phone")


@admin.register(SchoolClass)
class SchoolClassAdmin(admin.ModelAdmin):
    list_display = ("name", "sections", "updated_at")
    search_fields = ("name",)


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ("name", "updated_at")
    search_fields = ("name",)


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "subject_type", "updated_at")
    search_fields = ("code", "name")
    list_filter = ("subject_type",)


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("room_no", "capacity", "updated_at")
    search_fields = ("room_no",)


@admin.register(Designation)
class DesignationAdmin(admin.ModelAdmin):
    list_display = ("title", "updated_at")
    search_fields = ("title",)


@admin.register(SubjectTeacher)
class SubjectTeacherAdmin(admin.ModelAdmin):
    list_display = ("teacher_code", "name", "phone", "user", "updated_at")
    search_fields = ("teacher_code", "name", "phone", "user__username", "user__first_name", "user__last_name")
    autocomplete_fields = ("user",)


@admin.register(ClassTeacher)
class ClassTeacherAdmin(admin.ModelAdmin):
    list_display = ("school_class", "section", "teacher", "updated_at")
    search_fields = ("school_class__name", "section", "teacher__teacher_code", "teacher__name")
    autocomplete_fields = ("teacher",)
