from __future__ import annotations

from io import BytesIO

from django.http import HttpResponse
from django.utils import timezone

from exam_management.models import Exam, Result


def export_results_excel(*, exam: Exam) -> tuple[bytes, str]:
    """
    Returns (bytes, filename).
    Requires openpyxl installed.
    """
    try:
        import openpyxl
    except Exception as e:  # pragma: no cover
        raise RuntimeError("openpyxl is required for Excel export. Install openpyxl.") from e

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Results"

    ws.append(["Rank", "Student ID", "Student Name", "Class", "Section", "Total", "Average", "GPA", "Grade", "Passed"])

    results = (
        Result.objects.select_related("student", "exam", "exam__class_name")
        .filter(exam=exam)
        .order_by("rank", "-total_marks", "student_id")
    )
    for r in results:
        st = r.student
        ws.append(
            [
                r.rank or "",
                st.id,
                f"{st.first_name} {st.last_name}".strip(),
                exam.class_name.name if exam.class_name_id else "",
                exam.section or "",
                float(r.total_marks),
                float(r.average_marks),
                float(r.gpa),
                r.final_grade,
                "YES" if r.is_passed else "NO",
            ]
        )

    buff = BytesIO()
    wb.save(buff)
    stamp = timezone.now().strftime("%Y%m%d_%H%M%S")
    filename = f"exam_{exam.id}_results_{stamp}.xlsx"
    return buff.getvalue(), filename


def excel_response(*, content: bytes, filename: str) -> HttpResponse:
    resp = HttpResponse(content, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp

