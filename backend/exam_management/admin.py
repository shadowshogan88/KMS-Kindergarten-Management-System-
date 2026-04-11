from django.contrib import admin

from .models import AuditLog, Exam, Promotion, Result, ResultPublishLog, StudentExamMark


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ("exam_name", "class_name", "section", "exam_type", "start_date", "end_date", "status")
    list_filter = ("exam_type", "status", "class_name")
    search_fields = ("exam_name",)


@admin.register(StudentExamMark)
class StudentExamMarkAdmin(admin.ModelAdmin):
    list_display = ("exam", "student", "subject", "marks_obtained", "grade")
    list_filter = ("exam", "subject")
    search_fields = ("student__first_name", "student__last_name", "subject__name", "exam__exam_name")


@admin.register(Result)
class ResultAdmin(admin.ModelAdmin):
    list_display = ("exam", "student", "total_marks", "gpa", "final_grade", "rank", "is_passed", "published_status")
    list_filter = ("exam", "published_status", "is_passed")
    search_fields = ("student__first_name", "student__last_name", "exam__exam_name")


@admin.register(Promotion)
class PromotionAdmin(admin.ModelAdmin):
    list_display = ("student", "from_class", "from_section", "to_class", "to_section", "academic_year", "promoted_by", "promoted_at")
    list_filter = ("academic_year", "from_class", "to_class")
    search_fields = ("student__first_name", "student__last_name")


@admin.register(ResultPublishLog)
class ResultPublishLogAdmin(admin.ModelAdmin):
    list_display = ("exam", "published_by", "published_at", "note")
    list_filter = ("exam",)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("action_type", "user", "timestamp")
    list_filter = ("action_type",)
    search_fields = ("details", "user__username")

