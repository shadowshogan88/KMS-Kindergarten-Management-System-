import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

from academics.models import ClassTeacher
from classes.models import Enrollment

logger = logging.getLogger(__name__)


def _latest_enrollment(student):
    return (
        Enrollment.objects.filter(student=student)
        .select_related("classroom", "classroom__teacher")
        .order_by("-created_at", "-id")
        .first()
    )


def _class_teacher_for(student):
    if not getattr(student, "school_class_id", None):
        return None
    section = (getattr(student, "section", "") or "").strip().upper()
    if not section:
        return None
    return (
        ClassTeacher.objects.filter(school_class_id=student.school_class_id, section=section)
        .select_related("teacher")
        .first()
    )


def send_student_credentials_email(*, student, username: str, password: str) -> None:
    """
    Sends portal login credentials + enrollment summary to the student's email.
    """
    to_email = (getattr(student, "email", "") or "").strip()
    if not to_email:
        raise ValueError("Student has no email address.")

    enrollment = _latest_enrollment(student)
    classroom = getattr(enrollment, "classroom", None)
    session_year = getattr(classroom, "year", None) or timezone.now().year
    classroom_name = getattr(classroom, "name", "") or ""

    classroom_teacher_name = ""
    classroom_teacher_phone = ""
    classroom_teacher = getattr(classroom, "teacher", None)
    if classroom_teacher:
        classroom_teacher_name = (getattr(classroom_teacher, "get_full_name", lambda: "")() or "").strip() or getattr(
            classroom_teacher, "username", ""
        )
        classroom_teacher_phone = getattr(classroom_teacher, "phone", "") or ""

    ct = _class_teacher_for(student)
    teacher_name = ""
    teacher_phone = ""
    if ct and getattr(ct, "teacher", None):
        teacher_name = getattr(ct.teacher, "name", "") or ""
        teacher_phone = getattr(ct.teacher, "phone", "") or ""

    full_name = f"{getattr(student, 'first_name', '')} {getattr(student, 'last_name', '')}".strip()
    class_name = getattr(getattr(student, "school_class", None), "name", "") or ""
    section = (getattr(student, "section", "") or "").strip().upper()

    portal_login_url = f"{settings.FRONTEND_URL}{settings.FRONTEND_PORTAL_LOGIN_PATH}"

    context = {
        "school_name": getattr(settings, "SCHOOL_NAME", "KMS"),
        "portal_login_url": portal_login_url,
        "username": username,
        "password": password,
        "full_name": full_name,
        "class_name": class_name,
        "session_year": session_year,
        "section": section,
        "classroom_name": classroom_name,
        "class_teacher_name": teacher_name,
        "class_teacher_phone": teacher_phone,
        "classroom_teacher_name": classroom_teacher_name,
        "classroom_teacher_phone": classroom_teacher_phone,
    }

    subject = f"{context['school_name']}: Student Portal Login Details"
    text_body = render_to_string("students/email/student_credentials.txt", context)
    html_body = render_to_string("students/email/student_credentials.html", context)

    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        to=[to_email],
    )
    msg.attach_alternative(html_body, "text/html")

    msg.send(fail_silently=getattr(settings, "EMAIL_FAIL_SILENTLY", False))
    logger.info("Sent student credentials email to %s (student_id=%s)", to_email, getattr(student, "id", None))
