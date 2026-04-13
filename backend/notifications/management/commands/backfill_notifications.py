from django.core.management.base import BaseCommand

from attendance.models import AcademicAttendanceRecord, AttendanceRecord
from classes.models import LiveClass, SpecialLiveClass
from homework_management.models import Homework
from notifications.models import Notification
from notifications.services import (
    notify_absent_student,
    notify_announcement,
    notify_homework,
    notify_live_class,
    notify_notice,
    notify_special_live_class,
)
from notifications.models import Announcement, Notice


class Command(BaseCommand):
    help = "Backfill inbox notifications from existing announcements, notices, homework, live classes, and absent attendance records."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Only report what would be created.")

    def handle(self, *args, **options):
        dry_run = bool(options.get("dry_run"))
        created = {
            "announcements": 0,
            "notices": 0,
            "homeworks": 0,
            "live_classes": 0,
            "special_live_classes": 0,
            "attendance_absent": 0,
            "academic_attendance_absent": 0,
        }
        skipped = {k: 0 for k in created}

        def already_backfilled(source_key, source_id):
            return Notification.objects.filter(data__backfill_source=source_key, data__backfill_source_id=source_id).exists()

        def run_or_report(source_key, obj, fn, data=None):
            if already_backfilled(source_key, obj.id):
                skipped[source_key] += 1
                return
            payload = {"backfill_source": source_key, "backfill_source_id": obj.id, **(data or {})}
            if dry_run:
                created[source_key] += 1
                return
            notification, recipient_count = fn(payload)
            if notification and recipient_count:
                created[source_key] += 1
            else:
                skipped[source_key] += 1

        for obj in Announcement.objects.all():
            run_or_report(
                "announcements",
                obj,
                lambda payload, obj=obj: notify_announcement_with_data(obj, payload),
            )

        for obj in Notice.objects.all():
            run_or_report(
                "notices",
                obj,
                lambda payload, obj=obj: notify_notice_with_data(obj, payload),
            )

        for obj in Homework.objects.filter(status=Homework.STATUS_PUBLISHED):
            run_or_report(
                "homeworks",
                obj,
                lambda payload, obj=obj: notify_homework_with_data(obj, payload),
            )

        for obj in LiveClass.objects.all():
            run_or_report(
                "live_classes",
                obj,
                lambda payload, obj=obj: notify_live_class_with_data(obj, payload),
            )

        for obj in SpecialLiveClass.objects.filter(is_active=True):
            run_or_report(
                "special_live_classes",
                obj,
                lambda payload, obj=obj: notify_special_live_class_with_data(obj, payload),
            )

        for obj in AttendanceRecord.objects.filter(status=AttendanceRecord.STATUS_ABSENT).select_related("student"):
            run_or_report(
                "attendance_absent",
                obj,
                lambda payload, obj=obj: notify_absent_student(
                    student=obj.student,
                    title="Attendance alert",
                    message=f"{obj.student} was marked absent on {obj.date}.",
                    created_by=None,
                    data={"attendance_record_id": obj.id, "date": str(obj.date), **payload},
                ),
            )

        for obj in AcademicAttendanceRecord.objects.filter(status=AcademicAttendanceRecord.STATUS_ABSENT).select_related("student"):
            run_or_report(
                "academic_attendance_absent",
                obj,
                lambda payload, obj=obj: notify_absent_student(
                    student=obj.student,
                    title="Attendance alert",
                    message=f"{obj.student} was marked absent on {obj.date}.",
                    created_by=None,
                    data={
                        "academic_attendance_record_id": obj.id,
                        "date": str(obj.date),
                        "class_id": obj.school_class_id,
                        "section": obj.section,
                        **payload,
                    },
                ),
            )

        for key, val in created.items():
            self.stdout.write(f"{key}: created {val}, skipped {skipped[key]}")


def notify_announcement_with_data(obj, extra_data):
    user_notification = notify_announcement(obj)
    return _merge_extra_data(user_notification, extra_data)


def notify_notice_with_data(obj, extra_data):
    user_notification = notify_notice(obj)
    return _merge_extra_data(user_notification, extra_data)


def notify_homework_with_data(obj, extra_data):
    user_notification = notify_homework(obj)
    return _merge_extra_data(user_notification, extra_data)


def notify_live_class_with_data(obj, extra_data):
    user_notification = notify_live_class(obj)
    return _merge_extra_data(user_notification, extra_data)


def notify_special_live_class_with_data(obj, extra_data):
    user_notification = notify_special_live_class(obj)
    return _merge_extra_data(user_notification, extra_data)


def _merge_extra_data(result, extra_data):
    notification, recipient_count = result
    if notification:
        notification.data = {**(notification.data or {}), **(extra_data or {})}
        notification.save(update_fields=["data"])
    return notification, recipient_count
