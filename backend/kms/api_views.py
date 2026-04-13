from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from attendance.models import AttendanceRecord
from classes.models import Classroom, LiveClass
from reports.models import DailyActivityReport, ProgressNote


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def server_time(request):
    now_utc = timezone.now()
    now_local = timezone.localtime(now_utc)
    offset = now_local.utcoffset()
    offset_minutes = int(offset.total_seconds() // 60) if offset else 0

    return Response(
        {
            "time_zone": settings.TIME_ZONE,
            "now": now_local.isoformat(),
            "epoch_ms": int(now_utc.timestamp() * 1000),
            "offset_minutes": offset_minutes,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard(request):
    user = request.user
    role = getattr(user, "role", None)

    now = timezone.now()
    upcoming_live = LiveClass.objects.filter(ends_at__gte=now).order_by("starts_at")

    data = {"role": role, "counts": {}, "upcoming_live_classes": []}

    if role == "TEACHER":
        classrooms = Classroom.objects.filter(teacher=user)
        upcoming_live = upcoming_live.filter(classroom__teacher=user)
        data["counts"] = {
            "classrooms": classrooms.count(),
            "attendance_records_7_days": AttendanceRecord.objects.filter(
                classroom__teacher=user, date__gte=timezone.localdate() - timedelta(days=7)
            ).count(),
            "daily_reports_7_days": DailyActivityReport.objects.filter(
                classroom__teacher=user, date__gte=timezone.localdate() - timedelta(days=7)
            ).count(),
        }
    elif role == "PARENT":
        children = user.children.all()
        upcoming_live = upcoming_live.filter(classroom__enrollments__student__parent=user).distinct()
        data["counts"] = {
            "children": children.count(),
            "attendance_records_7_days": AttendanceRecord.objects.filter(
                student__parent=user, date__gte=timezone.localdate() - timedelta(days=7)
            ).count(),
            "daily_reports_7_days": DailyActivityReport.objects.filter(
                student__parent=user, date__gte=timezone.localdate() - timedelta(days=7)
            ).count(),
            "progress_notes": ProgressNote.objects.filter(student__parent=user).count(),
        }
    else:  # ADMIN
        data["counts"] = {
            "classrooms": Classroom.objects.count(),
            "attendance_records_7_days": AttendanceRecord.objects.filter(
                date__gte=timezone.localdate() - timedelta(days=7)
            ).count(),
            "daily_reports_7_days": DailyActivityReport.objects.filter(
                date__gte=timezone.localdate() - timedelta(days=7)
            ).count(),
        }

    data["upcoming_live_classes"] = list(
        upcoming_live.values("id", "title", "starts_at", "ends_at", "meet_link", "classroom__name")[:6]
    )
    return Response(data)
