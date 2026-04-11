from __future__ import annotations

from io import BytesIO

from django.utils import timezone

from exam_management.models import Result


def build_report_card_pdf(*, result: Result) -> tuple[bytes, str]:
    """
    Returns (bytes, filename).
    Requires reportlab installed.
    """
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    except Exception as e:  # pragma: no cover
        raise RuntimeError("reportlab is required for PDF report cards. Install reportlab.") from e

    buff = BytesIO()
    doc = SimpleDocTemplate(buff, pagesize=A4, title="Report Card")
    styles = getSampleStyleSheet()

    st = result.student
    exam = result.exam
    header = f"Report Card - {exam.exam_name} ({exam.classroom_label})"

    story = [
        Paragraph(header, styles["Title"]),
        Spacer(1, 10),
        Paragraph(f"Student: {st.first_name} {st.last_name}".strip(), styles["Normal"]),
        Paragraph(f"Student ID: {st.id}", styles["Normal"]),
        Spacer(1, 10),
    ]

    rows = [["Subject", "Marks", "Full", "Pass", "Grade"]]
    details = result.details or {}
    for s in details.get("subjects", []) or []:
        rows.append(
            [
                f"{s.get('subject_code', '')} - {s.get('subject_name', '')}".strip(" -"),
                s.get("marks_obtained", ""),
                s.get("full_marks", ""),
                s.get("pass_marks", ""),
                s.get("grade", ""),
            ]
        )

    table = Table(rows, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ALIGN", (1, 1), (-1, -1), "CENTER"),
            ]
        )
    )

    story += [
        table,
        Spacer(1, 12),
        Paragraph(f"Total: {result.total_marks} | Avg: {result.average_marks} | GPA: {result.gpa}", styles["Normal"]),
        Paragraph(f"Grade: {result.final_grade} | Rank: {result.rank or '-'} | Passed: {'YES' if result.is_passed else 'NO'}", styles["Normal"]),
        Spacer(1, 8),
        Paragraph(f"Generated: {timezone.localtime(result.generated_at or timezone.now()).strftime('%Y-%m-%d %H:%M')}", styles["Normal"]),
    ]

    doc.build(story)

    stamp = timezone.now().strftime("%Y%m%d_%H%M%S")
    filename = f"report_card_exam_{exam.id}_student_{st.id}_{stamp}.pdf"
    return buff.getvalue(), filename

