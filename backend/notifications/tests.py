from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APITestCase

from academics.models import SchoolClass, Subject
from attendance.models import AttendanceRecord
from classes.models import Classroom, Enrollment, LiveClass, SpecialLiveClass
from homework_management.models import Homework
from notifications.models import Notification, NotificationRecipient
from students.models import Student


User = get_user_model()


class NotificationInboxTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username="notif_admin", password="x", role="ADMIN", is_staff=True)
        self.teacher = User.objects.create_user(username="notif_teacher", password="x", role="TEACHER")
        self.student_user = User.objects.create_user(username="notif_student", password="x", role="STUDENT")
        self.parent = User.objects.create_user(username="notif_parent", password="x", role="PARENT")
        self.parent2 = User.objects.create_user(username="notif_parent2", password="x", role="PARENT")
        self.school_class = SchoolClass.objects.create(name="N1", sections=["A"])
        self.student = Student.objects.create(
            first_name="Nipa",
            user=self.student_user,
            parent=self.parent,
            school_class=self.school_class,
            section="A",
        )
        self.classroom = Classroom.objects.create(name="N1", teacher=self.teacher, year=timezone.now().year)
        Enrollment.objects.create(classroom=self.classroom, student=self.student)
        self.subject = Subject.objects.create(name="Bangla", code="BAN-1", school_class=self.school_class, section="A")

    def test_notification_create_for_users_creates_recipients(self):
        notification, recipient_count = Notification.create_for_users(
            user_ids=[self.parent.id, self.parent.id, self.parent2.id],
            title="Fee reminder",
            type=Notification.TYPE_FEE_DUE_REMINDER,
            created_by=self.admin,
        )

        self.assertEqual(recipient_count, 2)
        self.assertEqual(notification.recipient_rows.count(), 2)

    def test_inbox_summary_and_read_unread_flow(self):
        notification, _ = Notification.create_for_users(
            user_ids=[self.parent.id],
            title="Homework posted",
            type=Notification.TYPE_HOMEWORK_ASSIGNED,
            created_by=self.admin,
        )
        recipient = NotificationRecipient.objects.get(notification=notification, user=self.parent)

        self.client.force_authenticate(self.parent)

        summary = self.client.get("/api/v1/inbox-notifications/summary/")
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.data["unread"], 1)

        read = self.client.post(f"/api/v1/inbox-notifications/{recipient.id}/read/", {}, format="json")
        self.assertEqual(read.status_code, 200)
        self.assertTrue(read.data["is_read"])

        unread = self.client.post(f"/api/v1/inbox-notifications/{recipient.id}/unread/", {}, format="json")
        self.assertEqual(unread.status_code, 200)
        self.assertFalse(unread.data["is_read"])

    def test_hidden_notifications_are_not_listed_or_counted(self):
        now = timezone.now()
        Notification.create_for_users(
            user_ids=[self.parent.id],
            title="Visible",
            created_by=self.admin,
        )
        Notification.create_for_users(
            user_ids=[self.parent.id],
            title="Future",
            created_by=self.admin,
            publish_at=now + timedelta(hours=1),
        )
        Notification.create_for_users(
            user_ids=[self.parent.id],
            title="Expired",
            created_by=self.admin,
            expires_at=now - timedelta(minutes=1),
        )

        self.client.force_authenticate(self.parent)

        listing = self.client.get("/api/v1/inbox-notifications/")
        self.assertEqual(listing.status_code, 200)
        results = listing.data.get("results") if isinstance(listing.data, dict) else listing.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["title"], "Visible")

        summary = self.client.get("/api/v1/inbox-notifications/summary/")
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.data["total"], 1)
        self.assertEqual(summary.data["unread"], 1)

    def test_send_validates_expiry_after_publish(self):
        self.client.force_authenticate(self.admin)
        res = self.client.post(
            "/api/v1/inbox-notifications/send/",
            {
                "title": "Invalid",
                "target_user_ids": [self.parent.id],
                "publish_at": (timezone.now() + timedelta(hours=2)).isoformat(),
                "expires_at": (timezone.now() + timedelta(hours=1)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("expires_at", res.data)

    def test_homework_publish_creates_inbox_notifications(self):
        hw = Homework.objects.create(
            title="Chapter 1",
            class_name=self.school_class,
            section="A",
            subject=self.subject,
            created_by=self.teacher,
            due_date=timezone.now() + timedelta(days=2),
            status=Homework.STATUS_DRAFT,
        )

        self.client.force_authenticate(self.admin)
        res = self.client.post(f"/api/v1/homeworks/{hw.id}/publish/", {}, format="json")
        self.assertEqual(res.status_code, 200)

        recipients = NotificationRecipient.objects.filter(notification__type=Notification.TYPE_HOMEWORK_ASSIGNED)
        self.assertEqual(recipients.count(), 2)
        self.assertEqual(set(recipients.values_list("user_id", flat=True)), {self.student_user.id, self.parent.id})

    def test_attendance_absent_creates_alert_notification(self):
        self.client.force_authenticate(self.teacher)
        res = self.client.post(
            "/api/v1/attendance/",
            {
                "classroom": self.classroom.id,
                "student": self.student.id,
                "date": str(timezone.localdate()),
                "status": AttendanceRecord.STATUS_ABSENT,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)

        recipients = NotificationRecipient.objects.filter(notification__type=Notification.TYPE_ATTENDANCE_ABSENT_ALERT)
        self.assertEqual(recipients.count(), 2)
        self.assertEqual(set(recipients.values_list("user_id", flat=True)), {self.student_user.id, self.parent.id})

    def test_live_class_time_change_creates_immediate_notification(self):
        live_class = LiveClass.objects.create(
            classroom=self.classroom,
            title="Math Live",
            starts_at=timezone.now() + timedelta(hours=2),
            ends_at=timezone.now() + timedelta(hours=3),
            meet_link="https://meet.google.com/test-live",
            created_by=self.teacher,
        )

        self.client.force_authenticate(self.admin)
        res = self.client.patch(
            f"/api/v1/live-classes/{live_class.id}/",
            {
                "starts_at": (timezone.now() + timedelta(hours=4)).isoformat(),
                "ends_at": (timezone.now() + timedelta(hours=5)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)

        recipients = NotificationRecipient.objects.filter(
            notification__type=Notification.TYPE_LIVE_CLASS_REMINDER,
            notification__data__kind="TIME_CHANGED",
            notification__data__live_class_id=live_class.id,
        )
        self.assertEqual(recipients.count(), 2)
        self.assertEqual(set(recipients.values_list("user_id", flat=True)), {self.student_user.id, self.parent.id})

    def test_send_live_class_reminders_command_sends_once_for_30_min_window(self):
        soon = timezone.now() + timedelta(minutes=25)
        live_class = LiveClass.objects.create(
            classroom=self.classroom,
            title="Science Live",
            starts_at=soon,
            ends_at=soon + timedelta(minutes=45),
            meet_link="https://meet.google.com/test-reminder",
            created_by=self.teacher,
        )
        special = SpecialLiveClass.objects.create(
            school_class=self.school_class,
            section="A",
            date=timezone.localtime(soon).date(),
            start_time=timezone.localtime(soon).time().replace(microsecond=0),
            end_time=timezone.localtime(soon + timedelta(minutes=45)).time().replace(microsecond=0),
            title="Special Reminder",
            created_by=self.teacher,
        )

        call_command("send_live_class_reminders")
        call_command("send_live_class_reminders")

        live_rows = NotificationRecipient.objects.filter(
            notification__type=Notification.TYPE_LIVE_CLASS_REMINDER,
            notification__data__kind="STARTS_IN_30_MIN",
            notification__data__live_class_id=live_class.id,
        )
        special_rows = NotificationRecipient.objects.filter(
            notification__type=Notification.TYPE_LIVE_CLASS_REMINDER,
            notification__data__kind="STARTS_IN_30_MIN",
            notification__data__special_live_class_id=special.id,
        )
        self.assertEqual(live_rows.count(), 2)
        self.assertEqual(special_rows.count(), 2)
