from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.utils import timezone

from academics.models import Subject
from students.models import Student

from exam_management.models import AuditLog, Exam, Result, StudentExamMark
from exam_management.services.audit import create_audit_log
from exam_management.services.grade_engine import quantize_2, subject_grade_and_gpa


@dataclass(frozen=True)
class GenerationSummary:
    exam_id: int
    students_processed: int
    results_generated: int
    missing_marks: dict[int, list[int]]  # student_id -> subject_ids


def _subjects_for_exam(exam: Exam):
    qs = Subject.objects.filter(school_class_id=exam.class_name_id)
    if getattr(exam, "subject_id", None):
        qs = qs.filter(id=exam.subject_id)
    if exam.class_name.sections:
        qs = qs.filter(section=(exam.section or ""))
    else:
        qs = qs.filter(section="")
    return qs.order_by("code", "id")


def _students_for_exam(exam: Exam):
    qs = Student.objects.filter(school_class_id=exam.class_name_id)
    if exam.class_name.sections:
        qs = qs.filter(section=(exam.section or ""))
    else:
        qs = qs.filter(section="")
    return qs.order_by("first_name", "last_name", "id")


def _validate_not_published(exam: Exam):
    if exam.status == Exam.STATUS_PUBLISHED:
        raise ValueError("Results already published; exam is locked.")


@transaction.atomic
def generate_results_for_exam(*, exam: Exam, actor, require_all_marks: bool = True) -> GenerationSummary:
    _validate_not_published(exam)

    subjects = list(_subjects_for_exam(exam))
    if not subjects:
        raise ValueError("No subjects found for this class/section.")

    students = list(_students_for_exam(exam))
    if not students:
        raise ValueError("No students found for this class/section.")

    subject_ids = [s.id for s in subjects]
    full_marks_map: dict[int, Decimal] = {}
    pass_marks_map: dict[int, Decimal] = {}
    for s in subjects:
        full_marks_map[s.id] = Decimal(str(getattr(s, "full_marks", 100) or 0))
        pass_marks_map[s.id] = Decimal(str(getattr(s, "pass_marks", 40) or 0))

    marks_qs = StudentExamMark.objects.select_related("subject").filter(exam=exam, student__in=students, subject_id__in=subject_ids)
    marks_map: dict[tuple[int, int], StudentExamMark] = {(m.student_id, m.subject_id): m for m in marks_qs}

    missing: dict[int, list[int]] = defaultdict(list)
    for st in students:
        for sid in subject_ids:
            if (st.id, sid) not in marks_map or marks_map[(st.id, sid)].marks_obtained is None:
                missing[st.id].append(sid)

    if require_all_marks and missing:
        raise ValueError("Missing marks for some students/subjects.")

    results_created_or_updated = 0
    now = timezone.now()

    for st in students:
        total_obtained = Decimal("0")
        total_full = Decimal("0")
        per_subject: list[dict[str, Any]] = []
        is_passed = True
        gpa_points: list[Decimal] = []

        for subj in subjects:
            mk = marks_map.get((st.id, subj.id))
            obtained = Decimal("0") if not mk or mk.marks_obtained is None else Decimal(str(mk.marks_obtained))
            full = full_marks_map[subj.id]
            pass_mark = pass_marks_map[subj.id]
            total_obtained += obtained
            total_full += full

            grade, grade_gpa, percent = subject_grade_and_gpa(obtained, full if full > 0 else Decimal("100"))
            if obtained < pass_mark:
                is_passed = False
                grade = "F"
                grade_gpa = Decimal("0.00")

            if mk and mk.grade != grade:
                mk.grade = grade
                mk.save(update_fields=["grade", "updated_at"])

            gpa_points.append(grade_gpa)
            per_subject.append(
                {
                    "subject_id": subj.id,
                    "subject_code": subj.code,
                    "subject_name": subj.name,
                    "full_marks": str(full),
                    "pass_marks": str(pass_mark),
                    "marks_obtained": str(obtained),
                    "percent": str(percent),
                    "grade": grade,
                    "gpa": str(grade_gpa),
                }
            )

        avg_marks = total_obtained / Decimal(len(subjects)) if subjects else Decimal("0")
        gpa = (sum(gpa_points) / Decimal(len(gpa_points))) if gpa_points else Decimal("0")
        gpa = quantize_2(gpa)

        if not is_passed:
            final_grade = "F"
            gpa = Decimal("0.00")
        else:
            # Final grade by overall percentage (total/full)
            grade, _, _ = subject_grade_and_gpa(total_obtained, total_full if total_full > 0 else Decimal("100"))
            final_grade = grade

        overall_percent = (total_obtained / total_full) * Decimal("100") if total_full > 0 else Decimal("0")
        details = {
            "subjects": per_subject,
            "overall_percent": str(quantize_2(overall_percent)),
            "missing_subject_ids": missing.get(st.id, []),
        }

        Result.objects.update_or_create(
            student=st,
            exam=exam,
            defaults={
                "total_marks": quantize_2(total_obtained),
                "average_marks": quantize_2(avg_marks),
                "gpa": gpa,
                "final_grade": final_grade,
                "is_passed": is_passed,
                "published_status": Result.STATUS_GENERATED,
                "generated_at": now,
                "details": details,
            },
        )
        results_created_or_updated += 1

    # Rank (dense ranking)
    results = list(Result.objects.filter(exam=exam).order_by("-total_marks", "student_id"))
    current_rank = 0
    last_total = None
    for idx, r in enumerate(results):
        if last_total is None or r.total_marks != last_total:
            current_rank = idx + 1
            last_total = r.total_marks
        if r.rank != current_rank:
            r.rank = current_rank
            r.save(update_fields=["rank", "updated_at"])

    exam.status = Exam.STATUS_FINALIZED
    exam.save(update_fields=["status", "updated_at"])

    create_audit_log(
        action_type=AuditLog.ACTION_RESULT_GENERATE,
        user=actor,
        details={"exam": exam.id, "students": len(students), "require_all_marks": require_all_marks},
    )

    return GenerationSummary(
        exam_id=exam.id,
        students_processed=len(students),
        results_generated=results_created_or_updated,
        missing_marks=dict(missing),
    )


@transaction.atomic
def publish_results_for_exam(*, exam: Exam, actor, note: str = "") -> int:
    if exam.status == Exam.STATUS_PUBLISHED:
        return 0
    if exam.status != Exam.STATUS_FINALIZED:
        raise ValueError("Generate/finalize results before publishing.")

    now = timezone.now()
    updated = Result.objects.filter(exam=exam).exclude(published_status=Result.STATUS_PUBLISHED).update(
        published_status=Result.STATUS_PUBLISHED,
        published_at=now,
        updated_at=now,
    )
    exam.status = Exam.STATUS_PUBLISHED
    exam.save(update_fields=["status", "updated_at"])

    from exam_management.models import ResultPublishLog

    ResultPublishLog.objects.create(exam=exam, published_by=actor, note=(note or "").strip()[:255])
    create_audit_log(
        action_type=AuditLog.ACTION_RESULT_PUBLISH,
        user=actor,
        details={"exam": exam.id, "updated_results": updated},
    )
    return updated
