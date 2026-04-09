import datetime

from django.db.models import Count, Q
from django.utils.dateparse import parse_date
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.decorators import action
from rest_framework.response import Response

from users.permissions import IsAdmin, IsParent, IsTeacher
from users.rbac_permissions import HasPortalPermission

from academics.models import SchoolClass
from classes.models import Classroom
from students.models import Student

from .models import AcademicAttendanceRecord, AttendanceRecord
from .serializers import AcademicAttendanceRecordSerializer, AttendanceRecordSerializer
from classes.models import Enrollment
from routines.holiday_utils import get_holiday_for_date


class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = AttendanceRecord.objects.select_related("classroom", "student", "student__parent").all()
    serializer_class = AttendanceRecordSerializer
    rbac_path = "/portal/attendance"

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin | IsTeacher]
        else:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        classroom_id = self.request.query_params.get("classroom")
        student_id = self.request.query_params.get("student")
        if classroom_id:
            qs = qs.filter(classroom_id=classroom_id)
        if student_id:
            qs = qs.filter(student_id=student_id)
        if getattr(user, "role", None) == "TEACHER":
            return qs.filter(classroom__teacher=user)
        if getattr(user, "role", None) == "PARENT":
            return qs.filter(student__parent=user)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        classroom = serializer.validated_data["classroom"]
        student = serializer.validated_data["student"]

        if getattr(user, "role", None) == "TEACHER" and classroom.teacher_id != user.id:
            raise PermissionDenied("Not your classroom.")
        if not Enrollment.objects.filter(classroom=classroom, student=student).exists():
            raise ValidationError({"student": "Student not enrolled in this classroom."})
        serializer.save()


class AcademicAttendanceViewSet(viewsets.ModelViewSet):
    queryset = AcademicAttendanceRecord.objects.select_related("school_class", "student", "student__parent", "student__user").all()
    serializer_class = AcademicAttendanceRecordSerializer
    rbac_path = "/portal/attendance"
    rbac_action_map = {"bulk": "create", "sheet": "view"}

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy", "bulk"}:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission, IsAdmin | IsTeacher]
        else:
            self.permission_classes = [permissions.IsAuthenticated, HasPortalPermission]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()

        school_class_id = self.request.query_params.get("class") or self.request.query_params.get("school_class")
        section = (self.request.query_params.get("section") or "").strip().upper()
        date_raw = self.request.query_params.get("date")
        start_raw = self.request.query_params.get("start")
        end_raw = self.request.query_params.get("end")

        if school_class_id:
            qs = qs.filter(school_class_id=school_class_id)
        if section:
            qs = qs.filter(section=section)
        if date_raw:
            dt = parse_date(date_raw) if isinstance(date_raw, str) else None
            if dt:
                qs = qs.filter(date=dt)
        if start_raw and end_raw:
            start = parse_date(start_raw) if isinstance(start_raw, str) else None
            end = parse_date(end_raw) if isinstance(end_raw, str) else None
            if start and end:
                qs = qs.filter(date__gte=start, date__lte=end)

        if getattr(user, "role", None) == "PARENT":
            return qs.filter(student__parent=user)
        if getattr(user, "role", None) == "STUDENT":
            return qs.filter(student__user=user)
        return qs

    def perform_create(self, serializer):
        # Validation handled by model clean.
        serializer.save()

    @action(detail=False, methods=["get"], url_path="sheet")
    def sheet(self, request):
        school_class_id = request.query_params.get("class") or request.query_params.get("school_class")
        section = (request.query_params.get("section") or "").strip().upper()
        date_raw = request.query_params.get("date")
        dt = parse_date(date_raw) if isinstance(date_raw, str) else None
        if not school_class_id or not dt:
            return Response({"detail": "class and date are required."}, status=status.HTTP_400_BAD_REQUEST)

        holiday = get_holiday_for_date(dt)

        try:
            school_class = SchoolClass.objects.get(id=school_class_id)
        except SchoolClass.DoesNotExist:
            return Response({"detail": "Class not found."}, status=status.HTTP_404_NOT_FOUND)

        students_qs = Student.objects.filter(school_class_id=school_class_id)
        if school_class.sections:
            if not section:
                return Response({"detail": "section is required for this class."}, status=status.HTTP_400_BAD_REQUEST)
            students_qs = students_qs.filter(section=section)
        else:
            section = ""

        students_qs = students_qs.order_by("first_name", "last_name")

        existing = AcademicAttendanceRecord.objects.filter(school_class=school_class, section=section, date=dt, student__in=students_qs)
        existing_map = {r.student_id: r for r in existing}

        # Best-effort classroom teacher (optional): find classroom by name (e.g. "KG") for current year.
        today_year = datetime.date.today().year
        classroom = Classroom.objects.select_related("teacher").filter(name__iexact=school_class.name, year=today_year).first()
        teacher = classroom.teacher if classroom else None

        out_students = []
        for s in students_qs:
            rec = existing_map.get(s.id)
            out_students.append(
                {
                    "id": s.id,
                    "name": f"{s.first_name} {s.last_name}".strip(),
                    "status": rec.status if rec else "",
                    "note": rec.note if rec else "",
                    "record_id": rec.id if rec else None,
                }
            )

        return Response(
            {
                "school_class": school_class.id,
                "school_class_label": school_class.name,
                "section": section,
                "date": str(dt),
                "is_holiday": bool(holiday),
                "holiday": holiday,
                "attendance_disabled": bool(holiday),
                "teacher": {
                    "id": teacher.id,
                    "username": teacher.username,
                    "name": (teacher.get_full_name() or "").strip() or teacher.username,
                }
                if teacher
                else None,
                "students": out_students,
            }
        )

    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk(self, request):
        school_class_id = request.data.get("class") or request.data.get("school_class")
        section = (request.data.get("section") or "").strip().upper()
        date_raw = request.data.get("date")
        items = request.data.get("items") or []

        dt = parse_date(date_raw) if isinstance(date_raw, str) else None
        if not school_class_id or not dt:
            return Response({"detail": "class and date are required."}, status=status.HTTP_400_BAD_REQUEST)

        holiday = get_holiday_for_date(dt)
        if holiday:
            return Response(
                {"detail": f"Attendance is disabled for holiday: {holiday.get('title') or 'Holiday'}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not isinstance(items, list):
            return Response({"detail": "items must be a list."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            school_class = SchoolClass.objects.get(id=school_class_id)
        except SchoolClass.DoesNotExist:
            return Response({"detail": "Class not found."}, status=status.HTTP_404_NOT_FOUND)

        if not school_class.sections:
            section = ""

        student_ids = [it.get("student") for it in items if it.get("student")]
        valid_students = set(Student.objects.filter(id__in=student_ids, school_class_id=school_class.id).values_list("id", flat=True))

        results = []
        for it in items:
            sid = it.get("student")
            if not sid or sid not in valid_students:
                continue
            status_val = (it.get("status") or "").strip().upper()
            note = (it.get("note") or "").strip()
            if status_val not in {AcademicAttendanceRecord.STATUS_PRESENT, AcademicAttendanceRecord.STATUS_ABSENT, AcademicAttendanceRecord.STATUS_LATE}:
                continue
            obj, _ = AcademicAttendanceRecord.objects.update_or_create(
                school_class=school_class,
                section=section,
                student_id=sid,
                date=dt,
                defaults={"status": status_val, "note": note},
            )
            results.append(obj)

        return Response(AcademicAttendanceRecordSerializer(results, many=True).data)

    @action(detail=False, methods=["get"], url_path="calendar")
    def calendar(self, request):
        school_class_id = request.query_params.get("class") or request.query_params.get("school_class")
        section = (request.query_params.get("section") or "").strip().upper()
        start_raw = request.query_params.get("start")
        end_raw = request.query_params.get("end")

        start = parse_date(start_raw) if isinstance(start_raw, str) else None
        end = parse_date(end_raw) if isinstance(end_raw, str) else None
        if not school_class_id or not start or not end:
            return Response({"detail": "class, start, end are required."}, status=status.HTTP_400_BAD_REQUEST)

        qs = AcademicAttendanceRecord.objects.filter(school_class_id=school_class_id, date__gte=start, date__lte=end)
        if section:
            qs = qs.filter(section=section)

        grouped = (
            qs.values("date")
            .annotate(count=Count("id"), present=Count("id", filter=Q(status=AcademicAttendanceRecord.STATUS_PRESENT)), absent=Count("id", filter=Q(status=AcademicAttendanceRecord.STATUS_ABSENT)), late=Count("id", filter=Q(status=AcademicAttendanceRecord.STATUS_LATE)))
            .order_by("date")
        )

        out = [{"date": str(r["date"]), "count": r["count"], "present": r["present"], "absent": r["absent"], "late": r["late"]} for r in grouped]
        existing_dates = {r["date"] for r in out if r.get("date")}

        cur = start
        one_day = datetime.timedelta(days=1)
        while cur <= end:
            if str(cur) not in existing_dates:
                hol = get_holiday_for_date(cur)
                if hol:
                    out.append(
                        {
                            "date": str(cur),
                            "count": 1,
                            "present": 0,
                            "absent": 0,
                            "late": 0,
                            "is_holiday": True,
                            "holiday": hol,
                        }
                    )
            cur = cur + one_day

        return Response(sorted(out, key=lambda x: x.get("date") or ""))

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        school_class_id = request.query_params.get("class") or request.query_params.get("school_class")
        section = (request.query_params.get("section") or "").strip().upper()
        month = (request.query_params.get("month") or "").strip()  # YYYY-MM
        if not school_class_id or not month or len(month) != 7:
            return Response({"detail": "class and month (YYYY-MM) are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            year = int(month[:4])
            mon = int(month[5:7])
            start = datetime.date(year, mon, 1)
            end = datetime.date(year, mon + 1, 1) - datetime.timedelta(days=1) if mon < 12 else datetime.date(year, 12, 31)
        except Exception:
            return Response({"detail": "Invalid month."}, status=status.HTTP_400_BAD_REQUEST)

        students_qs = Student.objects.filter(school_class_id=school_class_id)
        if section:
            students_qs = students_qs.filter(section=section)

        records = AcademicAttendanceRecord.objects.filter(school_class_id=school_class_id, date__gte=start, date__lte=end)
        if section:
            records = records.filter(section=section)

        agg = (
            records.values("student_id")
            .annotate(
                present=Count("id", filter=Q(status=AcademicAttendanceRecord.STATUS_PRESENT)),
                absent=Count("id", filter=Q(status=AcademicAttendanceRecord.STATUS_ABSENT)),
                late=Count("id", filter=Q(status=AcademicAttendanceRecord.STATUS_LATE)),
            )
        )
        agg_map = {r["student_id"]: r for r in agg}

        out = []
        for s in students_qs.order_by("first_name", "last_name"):
            a = agg_map.get(s.id, {})
            out.append(
                {
                    "id": s.id,
                    "name": f"{s.first_name} {s.last_name}".strip(),
                    "present": a.get("present", 0),
                    "absent": a.get("absent", 0),
                    "late": a.get("late", 0),
                }
            )

        return Response({"class": int(school_class_id), "section": section, "month": month, "students": out})

    @action(detail=False, methods=["get"], url_path="month-grid")
    def month_grid(self, request):
        school_class_id = request.query_params.get("class") or request.query_params.get("school_class")
        section = (request.query_params.get("section") or "").strip().upper()
        month = (request.query_params.get("month") or "").strip()  # YYYY-MM
        if not school_class_id or not month or len(month) != 7:
            return Response({"detail": "class and month (YYYY-MM) are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            year = int(month[:4])
            mon = int(month[5:7])
            start = datetime.date(year, mon, 1)
            end = datetime.date(year, mon + 1, 1) - datetime.timedelta(days=1) if mon < 12 else datetime.date(year, 12, 31)
        except Exception:
            return Response({"detail": "Invalid month."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            school_class = SchoolClass.objects.get(id=school_class_id)
        except SchoolClass.DoesNotExist:
            return Response({"detail": "Class not found."}, status=status.HTTP_404_NOT_FOUND)

        if school_class.sections:
            if not section:
                return Response({"detail": "section is required for this class."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            section = ""

        students_qs = Student.objects.filter(school_class_id=school_class_id)
        if section:
            students_qs = students_qs.filter(section=section)
        students_qs = students_qs.order_by("first_name", "last_name")

        records = AcademicAttendanceRecord.objects.filter(school_class_id=school_class_id, section=section, date__gte=start, date__lte=end).values(
            "student_id", "date", "status"
        )
        by_student_day: dict[int, dict[str, str]] = {}
        for r in records:
            sid = r["student_id"]
            day = f"{int(r['date'].day):02d}"
            by_student_day.setdefault(sid, {})[day] = r["status"]

        days = [f"{d:02d}" for d in range(1, end.day + 1)]
        out = []
        for s in students_qs:
            out.append(
                {
                    "id": s.id,
                    "name": f"{s.first_name} {s.last_name}".strip(),
                    "days": by_student_day.get(s.id, {}),
                }
            )

        return Response(
            {
                "class": int(school_class_id),
                "school_class_label": school_class.name,
                "section": section,
                "month": month,
                "days": days,
                "students": out,
            }
        )
