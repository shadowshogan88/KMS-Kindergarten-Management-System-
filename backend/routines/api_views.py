import uuid
import datetime

from django.conf import settings
from django.utils.dateparse import parse_date
from django.utils.dateparse import parse_time
from django.utils import timezone
from rest_framework import permissions, status, views, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from users.permissions import IsAdmin

from .models import AcademicClassRoutine, AcademicClassRoutineOverride, ClassRoutine
from .serializers import (
    AcademicClassRoutineOverrideSerializer,
    AcademicClassRoutineSerializer,
    ClassRoutineSerializer,
    HolidaySerializer,
    WeeklyHolidaySerializer,
)
from .holiday_utils import get_holiday_for_date
from .models import Holiday, WeeklyHoliday
from integrations.google import create_calendar_event_with_meet, delete_calendar_event, patch_calendar_event


class ClassRoutineViewSet(viewsets.ModelViewSet):
    queryset = ClassRoutine.objects.select_related("classroom", "teacher", "classroom__teacher").all()
    serializer_class = ClassRoutineSerializer

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()

        classroom_id = self.request.query_params.get("classroom")
        if classroom_id:
            qs = qs.filter(classroom_id=classroom_id)

        role = getattr(user, "role", None)
        if role == "TEACHER":
            return qs.filter(classroom__teacher=user)
        if role == "PARENT":
            return qs.filter(classroom__enrollments__student__parent=user).distinct()
        return qs


class AcademicClassRoutineViewSet(viewsets.ModelViewSet):
    queryset = AcademicClassRoutine.objects.select_related(
        "school_class",
        "subject",
        "subject_teacher",
        "subject__subject_teacher",
    ).all()
    serializer_class = AcademicClassRoutineSerializer

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()

        # Support both `school_class` and `class` query params to mimic common UI patterns.
        school_class_id = self.request.query_params.get("school_class") or self.request.query_params.get("class")
        if school_class_id:
            qs = qs.filter(school_class_id=school_class_id)

        section = (self.request.query_params.get("section") or "").strip().upper()
        if section:
            qs = qs.filter(section=section)

        return qs

    @action(detail=True, methods=["post"], url_path="generate-meet")
    def generate_meet(self, request, pk=None):
        routine: AcademicClassRoutine = self.get_object()

        if routine.routine_type == AcademicClassRoutine.TYPE_BREAK:
            return Response({"detail": "Cannot generate Meet link for break routine."}, status=status.HTTP_400_BAD_REQUEST)

        if not routine.subject_id:
            return Response({"detail": "Subject is required to generate Meet link."}, status=status.HTTP_400_BAD_REQUEST)

        tz = timezone.get_current_timezone()
        today = timezone.localdate()
        now = timezone.localtime()

        routine_to_py_weekday = (routine.day_of_week - 2) % 7
        today_py = today.weekday()
        delta = (routine_to_py_weekday - today_py) % 7
        start_date = today + datetime.timedelta(days=delta)
        if delta == 0 and routine.start_time and now.time() >= routine.start_time:
            start_date = start_date + datetime.timedelta(days=7)

        start_dt = timezone.make_aware(datetime.datetime.combine(start_date, routine.start_time), tz)
        end_dt = timezone.make_aware(datetime.datetime.combine(start_date, routine.end_time), tz)

        byday_map = {
            AcademicClassRoutine.DAY_SAT: "SA",
            AcademicClassRoutine.DAY_SUN: "SU",
            AcademicClassRoutine.DAY_MON: "MO",
            AcademicClassRoutine.DAY_TUE: "TU",
            AcademicClassRoutine.DAY_WED: "WE",
            AcademicClassRoutine.DAY_THU: "TH",
            AcademicClassRoutine.DAY_FRI: "FR",
        }

        payload = {
            "summary": routine.subject_label or "Class",
            "description": f"Class: {routine.school_class_label}",
            "start": {"dateTime": start_dt.isoformat(), "timeZone": settings.TIME_ZONE},
            "end": {"dateTime": end_dt.isoformat(), "timeZone": settings.TIME_ZONE},
            "recurrence": [f"RRULE:FREQ=WEEKLY;BYDAY={byday_map.get(routine.day_of_week, 'MO')}"],
            "conferenceData": {
                "createRequest": {
                    "requestId": uuid.uuid4().hex,
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            },
        }

        try:
            created = create_calendar_event_with_meet(payload)
        except Exception as e:
            return Response({"detail": str(e) or "Failed to generate Meet link."}, status=status.HTTP_400_BAD_REQUEST)

        routine.meet_event_id = created.event_id or routine.meet_event_id
        routine.meet_link = created.meet_link or routine.meet_link
        routine.live_enabled = True
        routine.save(update_fields=["meet_event_id", "meet_link", "live_enabled"])

        return Response(
            {
                "id": routine.id,
                "meet_link": routine.meet_link,
                "meet_event_id": routine.meet_event_id,
                "live_enabled": routine.live_enabled,
            }
        )

    @action(detail=True, methods=["post"], url_path="regenerate-meet")
    def regenerate_meet(self, request, pk=None):
        routine: AcademicClassRoutine = self.get_object()
        if routine.meet_event_id:
            try:
                delete_calendar_event(routine.meet_event_id)
            except Exception:
                # Ignore delete failures; regenerate anyway.
                pass
            routine.meet_event_id = ""
            routine.meet_link = ""
            routine.save(update_fields=["meet_event_id", "meet_link"])
        return self.generate_meet(request, pk=pk)

    @action(detail=True, methods=["post"], url_path="update-meet")
    def update_meet(self, request, pk=None):
        routine: AcademicClassRoutine = self.get_object()

        if routine.routine_type == AcademicClassRoutine.TYPE_BREAK:
            return Response({"detail": "Break routine cannot be a live class."}, status=status.HTTP_400_BAD_REQUEST)
        if routine.subject_id and routine.subject.subject_type == "PRACTICAL":
            return Response({"detail": "Practical subject cannot be a live class."}, status=status.HTTP_400_BAD_REQUEST)

        day_of_week = request.data.get("day_of_week", routine.day_of_week)
        start_time_raw = request.data.get("start_time", routine.start_time)
        end_time_raw = request.data.get("end_time", routine.end_time)

        try:
            day_of_week = int(day_of_week)
        except Exception:
            return Response({"detail": "Invalid day_of_week."}, status=status.HTTP_400_BAD_REQUEST)

        start_time = parse_time(start_time_raw) if isinstance(start_time_raw, str) else start_time_raw
        end_time = parse_time(end_time_raw) if isinstance(end_time_raw, str) else end_time_raw
        if not start_time or not end_time:
            return Response({"detail": "Invalid start_time/end_time."}, status=status.HTTP_400_BAD_REQUEST)

        routine.day_of_week = day_of_week
        routine.start_time = start_time
        routine.end_time = end_time
        try:
            routine.full_clean()
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        routine.save(update_fields=["day_of_week", "start_time", "end_time"])

        # If Meet already generated, patch Calendar event.
        if routine.meet_event_id:
            tz = timezone.get_current_timezone()
            today = timezone.localdate()
            now = timezone.localtime()

            routine_to_py_weekday = (routine.day_of_week - 2) % 7
            today_py = today.weekday()
            delta = (routine_to_py_weekday - today_py) % 7
            start_date = today + timezone.timedelta(days=delta)
            if delta == 0 and routine.start_time and now.time() >= routine.start_time:
                start_date = start_date + datetime.timedelta(days=7)

            start_dt = timezone.make_aware(datetime.datetime.combine(start_date, routine.start_time), tz)
            end_dt = timezone.make_aware(datetime.datetime.combine(start_date, routine.end_time), tz)

            byday_map = {
                AcademicClassRoutine.DAY_SAT: "SA",
                AcademicClassRoutine.DAY_SUN: "SU",
                AcademicClassRoutine.DAY_MON: "MO",
                AcademicClassRoutine.DAY_TUE: "TU",
                AcademicClassRoutine.DAY_WED: "WE",
                AcademicClassRoutine.DAY_THU: "TH",
                AcademicClassRoutine.DAY_FRI: "FR",
            }

            patch_payload = {
                "start": {"dateTime": start_dt.isoformat(), "timeZone": settings.TIME_ZONE},
                "end": {"dateTime": end_dt.isoformat(), "timeZone": settings.TIME_ZONE},
                "recurrence": [f"RRULE:FREQ=WEEKLY;BYDAY={byday_map.get(routine.day_of_week, 'MO')}"],
            }
            try:
                patch_calendar_event(routine.meet_event_id, patch_payload)
            except Exception as e:
                return Response({"detail": str(e) or "Failed to update calendar event."}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "id": routine.id,
                "day_of_week": routine.day_of_week,
                "start_time": routine.start_time,
                "end_time": routine.end_time,
                "meet_link": routine.meet_link,
                "meet_event_id": routine.meet_event_id,
            }
        )

    @action(detail=True, methods=["post"], url_path="override")
    def upsert_override(self, request, pk=None):
        routine: AcademicClassRoutine = self.get_object()
        date_raw = request.data.get("date")
        start_time_raw = request.data.get("start_time")
        end_time_raw = request.data.get("end_time")

        date = parse_date(date_raw) if isinstance(date_raw, str) else date_raw
        start_time = parse_time(start_time_raw) if isinstance(start_time_raw, str) else start_time_raw
        end_time = parse_time(end_time_raw) if isinstance(end_time_raw, str) else end_time_raw

        if not date:
            return Response({"detail": "date is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not start_time or not end_time:
            return Response({"detail": "start_time and end_time are required."}, status=status.HTTP_400_BAD_REQUEST)

        obj, _ = AcademicClassRoutineOverride.objects.get_or_create(
            routine=routine,
            date=date,
            defaults={"start_time": start_time, "end_time": end_time},
        )
        obj.start_time = start_time
        obj.end_time = end_time
        try:
            obj.full_clean()
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        obj.save()

        return Response(AcademicClassRoutineOverrideSerializer(obj).data)

    @action(detail=True, methods=["post"], url_path="override-generate-meet")
    def override_generate_meet(self, request, pk=None):
        routine: AcademicClassRoutine = self.get_object()
        date_raw = request.data.get("date")
        date = parse_date(date_raw) if isinstance(date_raw, str) else date_raw
        if not date:
            return Response({"detail": "date is required."}, status=status.HTTP_400_BAD_REQUEST)

        override = AcademicClassRoutineOverride.objects.filter(routine=routine, date=date).first()
        if not override:
            return Response({"detail": "Override not found. Save override time first."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            return self._generate_override_meet_for_date(routine, override, date)
        except Exception as e:
            return Response({"detail": str(e) or "Failed to generate Meet link."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="override-reset-regenerate")
    def override_reset_regenerate(self, request, pk=None):
        routine: AcademicClassRoutine = self.get_object()
        date_raw = request.data.get("date")
        date = parse_date(date_raw) if isinstance(date_raw, str) else date_raw
        if not date:
            return Response({"detail": "date is required."}, status=status.HTTP_400_BAD_REQUEST)

        override, _ = AcademicClassRoutineOverride.objects.get_or_create(
            routine=routine,
            date=date,
            defaults={"start_time": routine.start_time, "end_time": routine.end_time},
        )
        override.start_time = routine.start_time
        override.end_time = routine.end_time
        if override.meet_event_id:
            try:
                delete_calendar_event(override.meet_event_id)
            except Exception:
                pass
            override.meet_event_id = ""
            override.meet_link = ""
        override.save()

        return self._generate_override_meet_for_date(routine, override, date)

    def _generate_override_meet_for_date(self, routine: AcademicClassRoutine, override: AcademicClassRoutineOverride, date):
        tz = timezone.get_current_timezone()
        start_dt = timezone.make_aware(datetime.datetime.combine(date, override.start_time), tz)
        end_dt = timezone.make_aware(datetime.datetime.combine(date, override.end_time), tz)

        payload = {
            "summary": routine.subject_label or "Class",
            "description": f"Class: {routine.school_class_label} (One-off)",
            "start": {"dateTime": start_dt.isoformat(), "timeZone": settings.TIME_ZONE},
            "end": {"dateTime": end_dt.isoformat(), "timeZone": settings.TIME_ZONE},
            "conferenceData": {
                "createRequest": {
                    "requestId": uuid.uuid4().hex,
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            },
        }

        if override.meet_event_id:
            try:
                delete_calendar_event(override.meet_event_id)
            except Exception:
                pass
            override.meet_event_id = ""
            override.meet_link = ""

        created = create_calendar_event_with_meet(payload)
        override.meet_event_id = created.event_id or override.meet_event_id
        override.meet_link = created.meet_link or override.meet_link
        override.save(update_fields=["meet_event_id", "meet_link", "updated_at"])

        return Response(AcademicClassRoutineOverrideSerializer(override).data)


class LiveCalendarView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        school_class_id = request.query_params.get("class") or request.query_params.get("school_class")
        section = (request.query_params.get("section") or "").strip().upper()
        start_raw = request.query_params.get("start")
        end_raw = request.query_params.get("end")

        start = parse_date(start_raw) if isinstance(start_raw, str) else None
        end = parse_date(end_raw) if isinstance(end_raw, str) else None
        if not school_class_id or not start or not end:
            return Response({"detail": "class, start, end are required."}, status=status.HTTP_400_BAD_REQUEST)

        routines = AcademicClassRoutine.objects.select_related("school_class", "subject", "subject_teacher", "subject__subject_teacher").filter(
            school_class_id=school_class_id
        )
        if section:
            routines = routines.filter(section=section)

        # Load overrides in range.
        overrides = AcademicClassRoutineOverride.objects.select_related("routine", "routine__subject", "routine__subject_teacher").filter(
            routine__in=routines, date__gte=start, date__lte=end
        )
        override_map = {(o.routine_id, o.date): o for o in overrides}

        out = []
        cur = start
        one_day = datetime.timedelta(days=1)
        while cur <= end:
            hol = get_holiday_for_date(cur)
            if hol:
                out.append(
                    {
                        "date": str(cur),
                        "routine_id": f"holiday-{hol.get('kind','DATE')}",
                        "override_id": None,
                        "is_override": False,
                        "day_of_week": None,
                        "start_time": None,
                        "end_time": None,
                        "subject_label": hol.get("title") or "Holiday",
                        "subject_teacher_label": "",
                        "routine_type": "HOLIDAY",
                        "subject_type": "",
                        "live_enabled": False,
                        "meet_link": "",
                        "is_holiday": True,
                        "holiday": hol,
                    }
                )
                cur = cur + one_day
                continue

            for rt in routines:
                # Match routine day_of_week (0 Sat..6 Fri) to python weekday (Mon=0..Sun=6)
                rt_py = (rt.day_of_week - 2) % 7
                if cur.weekday() != rt_py:
                    continue
                ov = override_map.get((rt.id, cur))
                start_time = ov.start_time if ov else rt.start_time
                end_time = ov.end_time if ov else rt.end_time
                meet_link = ov.meet_link if ov and ov.meet_link else rt.meet_link
                out.append(
                    {
                        "date": str(cur),
                        "routine_id": rt.id,
                        "override_id": ov.id if ov else None,
                        "is_override": bool(ov),
                        "day_of_week": rt.day_of_week,
                        "start_time": start_time,
                        "end_time": end_time,
                        "subject_label": rt.subject_label,
                        "subject_teacher_label": rt.subject_teacher_label,
                        "routine_type": rt.routine_type,
                        "subject_type": getattr(rt.subject, "subject_type", "") if rt.subject_id else "",
                        "live_enabled": rt.live_enabled,
                        "meet_link": meet_link or "",
                        "is_holiday": False,
                        "holiday": None,
                    }
                )
            cur = cur + one_day

        return Response(out)


class HolidayCalendarView(views.APIView):
    """
    Month/range view for holidays (date + weekly) independent of class selection.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        start_raw = request.query_params.get("start")
        end_raw = request.query_params.get("end")

        start = parse_date(start_raw) if isinstance(start_raw, str) else None
        end = parse_date(end_raw) if isinstance(end_raw, str) else None
        if not start or not end:
            return Response({"detail": "start and end are required."}, status=status.HTTP_400_BAD_REQUEST)

        out = []
        cur = start
        one_day = datetime.timedelta(days=1)
        while cur <= end:
            hol = get_holiday_for_date(cur)
            if hol:
                out.append(
                    {
                        "date": str(cur),
                        "is_holiday": True,
                        "holiday": hol,
                    }
                )
            cur = cur + one_day

        return Response(out)


class HolidayViewSet(viewsets.ModelViewSet):
    queryset = Holiday.objects.all()
    serializer_class = HolidaySerializer

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()


class WeeklyHolidayViewSet(viewsets.ModelViewSet):
    queryset = WeeklyHoliday.objects.filter(singleton_key=1)
    serializer_class = WeeklyHolidaySerializer

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy", "current"}:
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()

    @action(detail=False, methods=["get", "post"], url_path="current")
    def current(self, request):
        obj, _ = WeeklyHoliday.objects.get_or_create(singleton_key=1, defaults={"days": [], "title": "Weekly Holiday"})
        if request.method == "GET":
            return Response(WeeklyHolidaySerializer(obj).data)

        serializer = WeeklyHolidaySerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
