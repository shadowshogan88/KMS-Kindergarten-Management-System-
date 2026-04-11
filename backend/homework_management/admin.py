from django.contrib import admin

from .models import Homework, HomeworkGradeLog, HomeworkSubmission, SubmissionAnnotation, SubmissionImage


@admin.register(Homework)
class HomeworkAdmin(admin.ModelAdmin):
    list_display = ("title", "short_description", "homework_type", "class_name", "section", "subject", "due_date", "status", "created_by")
    list_filter = ("homework_type", "status", "class_name", "subject")
    search_fields = ("title", "short_description", "description")


@admin.register(HomeworkSubmission)
class HomeworkSubmissionAdmin(admin.ModelAdmin):
    list_display = ("homework", "student", "status", "submitted_at", "is_late_submission", "teacher_marks")
    list_filter = ("status", "is_late_submission")
    search_fields = ("student__first_name", "student__last_name", "homework__title")


@admin.register(SubmissionImage)
class SubmissionImageAdmin(admin.ModelAdmin):
    list_display = ("submission", "page_number", "created_at")
    list_filter = ("submission",)


@admin.register(SubmissionAnnotation)
class SubmissionAnnotationAdmin(admin.ModelAdmin):
    list_display = ("submission_image", "created_by", "created_at")
    list_filter = ("created_by",)


@admin.register(HomeworkGradeLog)
class HomeworkGradeLogAdmin(admin.ModelAdmin):
    list_display = ("submission", "marks", "graded_by", "graded_at")
    list_filter = ("graded_by",)
