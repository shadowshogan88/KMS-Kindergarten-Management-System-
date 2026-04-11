from __future__ import annotations

from django.db.models import Avg, Count, F

from exam_management.models import Exam, Result, StudentExamMark


def exam_analytics(*, exam: Exam) -> dict:
    results_qs = Result.objects.filter(exam=exam, published_status__in=[Result.STATUS_GENERATED, Result.STATUS_PUBLISHED])
    total = results_qs.count()
    passed = results_qs.filter(is_passed=True).count()
    failed = results_qs.filter(is_passed=False).count()
    pass_pct = (passed / total) * 100 if total else 0

    toppers = list(
        results_qs.select_related("student")
        .order_by("rank", "-total_marks")[:10]
        .values(
            "rank",
            "total_marks",
            "gpa",
            "final_grade",
            student_id=F("student__id"),
            first_name=F("student__first_name"),
            last_name=F("student__last_name"),
        )
    )

    subject_perf = (
        StudentExamMark.objects.filter(exam=exam, marks_obtained__isnull=False)
        .values("subject_id", "subject__code", "subject__name")
        .annotate(avg_marks=Avg("marks_obtained"), count=Count("id"))
        .order_by("subject__code")
    )
    subject_perf = [
        {
            "subject_id": row["subject_id"],
            "subject_code": row["subject__code"],
            "subject_name": row["subject__name"],
            "avg_marks": float(row["avg_marks"] or 0),
            "count": row["count"],
        }
        for row in subject_perf
    ]

    return {
        "exam": exam.id,
        "class": exam.class_name_id,
        "section": exam.section,
        "students_total": total,
        "passed": passed,
        "failed": failed,
        "pass_percentage": round(pass_pct, 2),
        "toppers": toppers,
        "subject_performance": subject_perf,
    }

