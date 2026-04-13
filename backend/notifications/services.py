from __future__ import annotations

import datetime
from typing import Iterable

from django.contrib.auth import get_user_model
from django.utils import timezone

from academics.models import SchoolClass
from classes.models import Classroom, Enrollment, LiveClass, SpecialLiveClass
from homework_management.models import Homework
from students.models import Student

from .models import Announcement, Notice, Notification


User = get_user_model()


def _clean_user_ids(values: Iterable[int]) -> list[int]:
    return sorted({int(v) for v in (values or []) if v})


def recipients_for_classroom(classroom: Classroom, *, include_students=True, include_parents=True, include_teacher=False) -> list[int]:
    enrollment_qs = Enrollment.objects.filter(classroom=classroom).select_related("student")
    student_ids = [e.student_id for e in enrollment_qs]
    students = Student.objects.filter(id__in=student_ids).only("id", "user_id", "parent_id")

    user_ids: set[int] = set()
    if include_students:
        user_ids |= {s.user_id for s in students if s.user_id}
    if include_parents:
        user_ids |= {s.parent_id for s in students if s.parent_id}
    if include_teacher and classroom.teacher_id:
        user_ids.add(classroom.teacher_id)
    return _clean_user_ids(user_ids)


def recipients_for_school_class(
    school_class: SchoolClass,
    *,
    section="",
    include_students=True,
    include_parents=True,
    include_teachers=False,
) -> list[int]:
    students = Student.objects.filter(school_class=school_class)
    section = (section or "").strip().upper()
    if section:
        students = students.filter(section=section)
    students = students.only("id", "user_id", "parent_id", "school_class_id", "section")

    user_ids: set[int] = set()
    if include_students:
        user_ids |= {s.user_id for s in students if s.user_id}
    if include_parents:
        user_ids |= {s.parent_id for s in students if s.parent_id}
    if include_teachers:
        user_ids |= set(
            User.objects.filter(
                role=User.ROLE_TEACHER,
                classrooms__name__iexact=school_class.name,
            ).values_list("id", flat=True)
        )
    return _clean_user_ids(user_ids)


def recipients_for_roles(*roles: str) -> list[int]:
    return _clean_user_ids(User.objects.filter(role__in=[r for r in roles if r]).values_list("id", flat=True))


def notify_announcement(announcement: Announcement) -> tuple[Notification, int] | tuple[None, int]:
    if announcement.classroom_id:
        if announcement.audience == Announcement.AUDIENCE_TEACHERS:
            user_ids = recipients_for_classroom(announcement.classroom, include_students=False, include_parents=False, include_teacher=True)
        elif announcement.audience == Announcement.AUDIENCE_PARENTS:
            user_ids = recipients_for_classroom(announcement.classroom, include_students=False, include_parents=True, include_teacher=False)
        else:
            user_ids = recipients_for_classroom(announcement.classroom, include_students=True, include_parents=True, include_teacher=True)
    else:
        if announcement.audience == Announcement.AUDIENCE_TEACHERS:
            user_ids = recipients_for_roles(User.ROLE_TEACHER)
        elif announcement.audience == Announcement.AUDIENCE_PARENTS:
            user_ids = recipients_for_roles(User.ROLE_PARENT)
        else:
            user_ids = recipients_for_roles(User.ROLE_ADMIN, User.ROLE_TEACHER, User.ROLE_STUDENT, User.ROLE_PARENT)

    if not user_ids:
        return None, 0

    return Notification.create_for_users(
        user_ids=user_ids,
        title=announcement.title,
        message=announcement.message,
        type=Notification.TYPE_SCHOOL_ANNOUNCEMENT,
        priority=Notification.PRIORITY_NORMAL,
        action_url="/portal/notifications",
        data={"announcement_id": announcement.id, "classroom_id": announcement.classroom_id},
        created_by=announcement.created_by,
        publish_at=announcement.publish_at,
    )


def notify_notice(notice: Notice) -> tuple[Notification, int] | tuple[None, int]:
    if notice.audience == Notice.AUDIENCE_TEACHERS:
        user_ids = recipients_for_roles(User.ROLE_TEACHER)
    elif notice.audience == Notice.AUDIENCE_PARENTS:
        class_ids = list(notice.school_classes.values_list("id", flat=True))
        if class_ids:
            user_ids = _clean_user_ids(
                Student.objects.filter(school_class_id__in=class_ids).exclude(parent_id__isnull=True).values_list("parent_id", flat=True)
            )
        else:
            user_ids = recipients_for_roles(User.ROLE_PARENT)
    else:
        class_ids = list(notice.school_classes.values_list("id", flat=True))
        if class_ids:
            user_ids = _clean_user_ids(
                list(Student.objects.filter(school_class_id__in=class_ids).exclude(user_id__isnull=True).values_list("user_id", flat=True)) +
                list(Student.objects.filter(school_class_id__in=class_ids).exclude(parent_id__isnull=True).values_list("parent_id", flat=True)) +
                list(recipients_for_roles(User.ROLE_TEACHER, User.ROLE_ADMIN))
            )
        else:
            user_ids = recipients_for_roles(User.ROLE_ADMIN, User.ROLE_TEACHER, User.ROLE_STUDENT, User.ROLE_PARENT)

    if not user_ids:
        return None, 0

    return Notification.create_for_users(
        user_ids=user_ids,
        title=notice.title,
        message=notice.description or "",
        type=Notification.TYPE_HOLIDAY_NOTICE if "holiday" in (notice.title or "").lower() else Notification.TYPE_ADMIN_BROADCAST,
        priority=Notification.PRIORITY_HIGH if notice.is_pinned else Notification.PRIORITY_NORMAL,
        action_url="/portal/notices",
        data={"notice_id": notice.id, "audience": notice.audience},
        created_by=notice.created_by,
    )


def notify_homework(homework: Homework) -> tuple[Notification, int] | tuple[None, int]:
    user_ids = recipients_for_school_class(homework.class_name, section=homework.section, include_students=True, include_parents=True)
    if not user_ids:
        return None, 0

    noun = "Assignment" if homework.homework_type == Homework.TYPE_ASSIGNMENT else "Homework"
    return Notification.create_for_users(
        user_ids=user_ids,
        title=f"{noun}: {homework.title}",
        message=homework.short_description or homework.description or "",
        type=Notification.TYPE_HOMEWORK_ASSIGNED,
        priority=Notification.PRIORITY_NORMAL,
        action_url="/portal/homework",
        data={"homework_id": homework.id, "class_id": homework.class_name_id, "section": homework.section},
        created_by=homework.created_by,
    )


def notify_live_class(live_class: LiveClass) -> tuple[Notification, int] | tuple[None, int]:
    user_ids = recipients_for_classroom(live_class.classroom, include_students=True, include_parents=True, include_teacher=False)
    if not user_ids:
        return None, 0
    return Notification.create_for_users(
        user_ids=user_ids,
        title=live_class.title or "Live class reminder",
        message=f"Live class starts at {live_class.starts_at}.",
        type=Notification.TYPE_LIVE_CLASS_REMINDER,
        priority=Notification.PRIORITY_HIGH,
        action_url="/portal/live-class",
        data={"live_class_id": live_class.id, "classroom_id": live_class.classroom_id, "meet_link": live_class.meet_link},
        created_by=live_class.created_by,
    )


def notify_special_live_class(obj: SpecialLiveClass) -> tuple[Notification, int] | tuple[None, int]:
    user_ids = recipients_for_school_class(obj.school_class, section=obj.section, include_students=True, include_parents=True)
    if not user_ids:
        return None, 0
    return Notification.create_for_users(
        user_ids=user_ids,
        title=obj.title or "Special live class",
        message=obj.description or "",
        type=Notification.TYPE_LIVE_CLASS_REMINDER,
        priority=Notification.PRIORITY_HIGH,
        action_url="/portal/live-class",
        data={"special_live_class_id": obj.id, "class_id": obj.school_class_id, "section": obj.section, "meet_link": obj.meet_link},
        created_by=obj.created_by,
    )


def notify_live_class_time_changed(
    live_class: LiveClass,
    *,
    previous_starts_at,
    previous_ends_at,
) -> tuple[Notification, int] | tuple[None, int]:
    user_ids = recipients_for_classroom(live_class.classroom, include_students=True, include_parents=True, include_teacher=False)
    if not user_ids:
        return None, 0
    return Notification.create_for_users(
        user_ids=user_ids,
        title=f"Live class updated: {live_class.title}",
        message=(
            f"Class time changed from {timezone.localtime(previous_starts_at):%I:%M %p} - "
            f"{timezone.localtime(previous_ends_at):%I:%M %p} to "
            f"{timezone.localtime(live_class.starts_at):%I:%M %p} - {timezone.localtime(live_class.ends_at):%I:%M %p}."
        ),
        type=Notification.TYPE_LIVE_CLASS_REMINDER,
        priority=Notification.PRIORITY_URGENT,
        action_url="/portal/live-class",
        data={
            "live_class_id": live_class.id,
            "classroom_id": live_class.classroom_id,
            "kind": "TIME_CHANGED",
            "previous_starts_at": previous_starts_at.isoformat(),
            "previous_ends_at": previous_ends_at.isoformat(),
            "meet_link": live_class.meet_link,
        },
        created_by=live_class.created_by,
    )


def notify_special_live_class_time_changed(
    obj: SpecialLiveClass,
    *,
    previous_date,
    previous_start_time,
    previous_end_time,
) -> tuple[Notification, int] | tuple[None, int]:
    user_ids = recipients_for_school_class(obj.school_class, section=obj.section, include_students=True, include_parents=True)
    if not user_ids:
        return None, 0
    return Notification.create_for_users(
        user_ids=user_ids,
        title=f"Live class updated: {obj.title}",
        message=(
            f"Class time changed from {previous_date} {previous_start_time} - {previous_end_time} "
            f"to {obj.date} {obj.start_time} - {obj.end_time}."
        ),
        type=Notification.TYPE_LIVE_CLASS_REMINDER,
        priority=Notification.PRIORITY_URGENT,
        action_url="/portal/live-class",
        data={
            "special_live_class_id": obj.id,
            "class_id": obj.school_class_id,
            "section": obj.section,
            "kind": "TIME_CHANGED",
            "previous_date": str(previous_date),
            "previous_start_time": str(previous_start_time),
            "previous_end_time": str(previous_end_time),
            "meet_link": obj.meet_link,
        },
        created_by=obj.created_by,
    )


def notify_live_class_starting_soon(live_class: LiveClass) -> tuple[Notification, int] | tuple[None, int]:
    reminder_key = {
        "kind": "STARTS_IN_30_MIN",
        "live_class_id": live_class.id,
        "scheduled_start": live_class.starts_at.isoformat(),
    }
    if Notification.objects.filter(
        type=Notification.TYPE_LIVE_CLASS_REMINDER,
        data__kind=reminder_key["kind"],
        data__live_class_id=live_class.id,
        data__scheduled_start=reminder_key["scheduled_start"],
    ).exists():
        return None, 0

    user_ids = recipients_for_classroom(live_class.classroom, include_students=True, include_parents=True, include_teacher=False)
    if not user_ids:
        return None, 0
    return Notification.create_for_users(
        user_ids=user_ids,
        title=f"Live class starts in 30 minutes: {live_class.title}",
        message=f"Your live class will start at {timezone.localtime(live_class.starts_at):%I:%M %p}.",
        type=Notification.TYPE_LIVE_CLASS_REMINDER,
        priority=Notification.PRIORITY_HIGH,
        action_url="/portal/live-class",
        data={**reminder_key, "classroom_id": live_class.classroom_id, "meet_link": live_class.meet_link},
        created_by=live_class.created_by,
    )


def notify_special_live_class_starting_soon(obj: SpecialLiveClass) -> tuple[Notification, int] | tuple[None, int]:
    tz = timezone.get_current_timezone()
    starts_at = timezone.make_aware(datetime.datetime.combine(obj.date, obj.start_time), tz)
    reminder_key = {
        "kind": "STARTS_IN_30_MIN",
        "special_live_class_id": obj.id,
        "scheduled_start": starts_at.isoformat(),
    }
    if Notification.objects.filter(
        type=Notification.TYPE_LIVE_CLASS_REMINDER,
        data__kind=reminder_key["kind"],
        data__special_live_class_id=obj.id,
        data__scheduled_start=reminder_key["scheduled_start"],
    ).exists():
        return None, 0

    user_ids = recipients_for_school_class(obj.school_class, section=obj.section, include_students=True, include_parents=True)
    if not user_ids:
        return None, 0
    return Notification.create_for_users(
        user_ids=user_ids,
        title=f"Live class starts in 30 minutes: {obj.title}",
        message=f"Your live class will start at {timezone.localtime(starts_at):%I:%M %p}.",
        type=Notification.TYPE_LIVE_CLASS_REMINDER,
        priority=Notification.PRIORITY_HIGH,
        action_url="/portal/live-class",
        data={**reminder_key, "class_id": obj.school_class_id, "section": obj.section, "meet_link": obj.meet_link},
        created_by=obj.created_by,
    )


def notify_absent_student(*, student, title: str, message: str, created_by=None, data=None):
    user_ids = _clean_user_ids([getattr(student, "parent_id", None), getattr(student, "user_id", None)])
    if not user_ids:
        return None, 0
    return Notification.create_for_users(
        user_ids=user_ids,
        title=title,
        message=message,
        type=Notification.TYPE_ATTENDANCE_ABSENT_ALERT,
        priority=Notification.PRIORITY_HIGH,
        action_url="/portal/attendance-report",
        data=data or {},
        created_by=created_by,
    )
